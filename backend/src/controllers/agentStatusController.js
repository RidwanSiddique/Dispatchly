const pool = require('../db/pool');
const { updateAgentStatus } = require('../services/scheduleManager');
const { canManageUser } = require('../middleware/rbac');

// Valid statuses agents can self-select (managers can set any)
const SELF_SETTABLE = ['available', 'on_duty', 'busy', 'break', 'lunch', 'training', 'meeting', 'offline'];
const MANAGER_SETTABLE = [...SELF_SETTABLE, 'off_duty', 'on_call'];

// ─── GET /api/agent-status ────────────────────────────────────────────────────
// Returns current status of all active staff (for the status board)

const getStatusBoard = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.title,
        u.current_status, u.current_status_reason, u.current_status_since,
        u.department_id, u.team_id,
        d.name AS department_name,
        t.name AS team_name,
        sb.name AS set_by_name,
        ws.start_hour, ws.end_hour, ws.work_days, ws.schedule_type,
        -- Open ticket count
        (
          SELECT COUNT(*)::int FROM tickets tk
          WHERE tk.assigned_to_user_id = u.id
            AND tk.status NOT IN ('Resolved','Closed','Pending Approval')
        ) AS open_tickets,
        -- Currently on-call
        EXISTS(
          SELECT 1 FROM oncall_schedules oc
          WHERE oc.user_id = u.id AND oc.start_time <= NOW() AND oc.end_time >= NOW()
        ) AS is_on_call_scheduled
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN teams t ON t.id = u.team_id
      LEFT JOIN users sb ON sb.id = u.current_status_set_by
      LEFT JOIN work_schedules ws ON ws.user_id = u.id
      WHERE u.is_active = TRUE
        AND u.role IN ('admin','manager','agent','technician','specialist')
      ORDER BY
        CASE u.current_status
          WHEN 'on_call'   THEN 0
          WHEN 'available' THEN 1
          WHEN 'on_duty'   THEN 2
          WHEN 'busy'      THEN 3
          WHEN 'break'     THEN 4
          WHEN 'lunch'     THEN 5
          WHEN 'training'  THEN 6
          WHEN 'meeting'   THEN 7
          WHEN 'off_duty'  THEN 8
          ELSE 9
        END,
        u.name
    `);
    res.json({ agents: rows });
  } catch (err) { next(err); }
};

// ─── GET /api/agent-status/:userId ───────────────────────────────────────────

const getUserStatus = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId || req.user.userId, 10);
    const { rows: [user] } = await pool.query(`
      SELECT
        u.id, u.name, u.current_status, u.current_status_reason,
        u.current_status_since, u.current_status_set_by,
        sb.name AS set_by_name,
        ws.start_hour, ws.end_hour, ws.work_days, ws.schedule_type, ws.timezone
      FROM users u
      LEFT JOIN users sb ON sb.id = u.current_status_set_by
      LEFT JOIN work_schedules ws ON ws.user_id = u.id
      WHERE u.id = $1
    `, [userId]);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ status: user });
  } catch (err) { next(err); }
};

// ─── PATCH /api/agent-status/:userId ─────────────────────────────────────────

const updateStatus = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const { status, reason } = req.body;

    if (!status) return res.status(400).json({ error: 'status is required' });

    const isSelf    = targetUserId === req.user.userId;
    const canManage = await canManageUser(req.user.userId, targetUserId, req.user.role);

    if (!isSelf && !canManage) {
      return res.status(403).json({ error: 'Cannot change status of this user' });
    }

    const allowed = isSelf && !canManage ? SELF_SETTABLE : MANAGER_SETTABLE;
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Invalid status '${status}'. Allowed: ${allowed.join(', ')}`,
      });
    }

    const result = await updateAgentStatus(
      targetUserId,
      status,
      req.user.userId,
      false,
      reason || null
    );

    res.json({ ok: true, change: result });
  } catch (err) { next(err); }
};

// ─── GET /api/agent-status/:userId/history ────────────────────────────────────

const getStatusHistory = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

    const canView = await canManageUser(req.user.userId, userId, req.user.role)
      || userId === req.user.userId;
    if (!canView) return res.status(403).json({ error: 'Cannot view this user\'s history' });

    const { rows } = await pool.query(`
      SELECT
        sl.*,
        u.name AS set_by_name
      FROM agent_status_log sl
      LEFT JOIN users u ON u.id = sl.set_by_user_id
      WHERE sl.user_id = $1
      ORDER BY sl.started_at DESC
      LIMIT $2
    `, [userId, limit]);

    res.json({ history: rows });
  } catch (err) { next(err); }
};

// ─── GET /api/agent-status/team-summary ──────────────────────────────────────
// Summary counts by status (for dashboard widgets)

const getTeamStatusSummary = async (req, res, next) => {
  try {
    const { department_id, team_id } = req.query;

    let conditions = `u.is_active = TRUE AND u.role IN ('admin','manager','agent','technician','specialist')`;
    const vals = [];
    if (department_id) { vals.push(department_id); conditions += ` AND u.department_id = $${vals.length}`; }
    if (team_id)       { vals.push(team_id);       conditions += ` AND u.team_id = $${vals.length}`; }

    const { rows } = await pool.query(`
      SELECT current_status, COUNT(*)::int AS count
      FROM users u
      WHERE ${conditions}
      GROUP BY current_status
      ORDER BY current_status
    `, vals);

    const byStatus = {};
    let total = 0;
    rows.forEach((r) => { byStatus[r.current_status] = r.count; total += r.count; });

    res.json({ byStatus, total });
  } catch (err) { next(err); }
};

// ─── Work Schedule CRUD ────────────────────────────────────────────────────────
// (Schedule management for managers to set their reports' working hours)

const getSchedule = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const canView = await canManageUser(req.user.userId, targetUserId, req.user.role)
      || targetUserId === req.user.userId;
    if (!canView) return res.status(403).json({ error: 'Cannot view this schedule' });

    const [schedRes, userRes] = await Promise.all([
      pool.query('SELECT * FROM work_schedules WHERE user_id = $1', [targetUserId]),
      pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.title,
               m.name AS manager_name, d.name AS department_name, t.name AS team_name
        FROM users u
        LEFT JOIN users m ON m.id = u.manager_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = $1
      `, [targetUserId]),
    ]);

    res.json({
      schedule: schedRes.rows[0] || null,
      user: userRes.rows[0] || null,
    });
  } catch (err) { next(err); }
};

const upsertSchedule = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const canSet = await canManageUser(req.user.userId, targetUserId, req.user.role)
      || targetUserId === req.user.userId;
    if (!canSet) return res.status(403).json({ error: 'Cannot set schedule for this user' });

    const {
      schedule_type = 'standard',
      start_hour = 9,
      end_hour = 17,
      work_days = [1,2,3,4,5],
      timezone = 'UTC',
      shift_label,
      effective_from,
      effective_until,
      notes,
    } = req.body;

    const { rows: [sched] } = await pool.query(`
      INSERT INTO work_schedules
        (user_id, schedule_type, start_hour, end_hour, work_days, timezone,
         shift_label, effective_from, effective_until, set_by, notes, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        schedule_type   = $2,
        start_hour      = $3,
        end_hour        = $4,
        work_days       = $5,
        timezone        = $6,
        shift_label     = $7,
        effective_from  = COALESCE($8, work_schedules.effective_from),
        effective_until = $9,
        set_by          = $10,
        notes           = $11,
        updated_at      = NOW()
      RETURNING *
    `, [
      targetUserId, schedule_type, start_hour, end_hour, work_days, timezone,
      shift_label || null, effective_from || null, effective_until || null,
      req.user.userId, notes || null,
    ]);

    res.json({ schedule: sched });
  } catch (err) { next(err); }
};

// ─── GET /api/agent-status/schedules (manager views team schedules) ───────────

const getTeamSchedules = async (req, res, next) => {
  try {
    const { department_id, team_id } = req.query;
    let where = `u.is_active = TRUE AND u.role IN ('agent','technician','specialist','manager')`;
    const vals = [];

    if (department_id) { vals.push(department_id); where += ` AND u.department_id = $${vals.length}`; }
    if (team_id)       { vals.push(team_id);       where += ` AND u.team_id = $${vals.length}`; }
    else if (req.user.role === 'manager') {
      // Default: show manager's direct reports
      vals.push(req.user.userId);
      where += ` AND (u.manager_id = $${vals.length} OR u.id = $${vals.length})`;
    }

    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.title,
        u.current_status, u.department_id, u.team_id,
        d.name AS department_name, t.name AS team_name,
        ws.schedule_type, ws.start_hour, ws.end_hour, ws.work_days,
        ws.timezone, ws.shift_label, ws.effective_from, ws.effective_until,
        ws.notes, sb.name AS set_by_name
      FROM users u
      LEFT JOIN work_schedules ws ON ws.user_id = u.id
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN teams t ON t.id = u.team_id
      LEFT JOIN users sb ON sb.id = ws.set_by
      WHERE ${where}
      ORDER BY d.name, t.name, u.name
    `, vals);

    res.json({ schedules: rows });
  } catch (err) { next(err); }
};

module.exports = {
  getStatusBoard,
  getUserStatus,
  updateStatus,
  getStatusHistory,
  getTeamStatusSummary,
  getSchedule,
  upsertSchedule,
  getTeamSchedules,
};
