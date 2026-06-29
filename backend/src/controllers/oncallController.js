const pool = require('../db/pool');
const { updateAgentStatus } = require('../services/scheduleManager');
const { notify } = require('../services/notifier');

const STAFF_FIELDS =
  'id, name, email, role, department, availability_status, current_status, skills, is_active';

// ─── GET /api/oncall ─────────────────────────────────────────────────────────
// Returns: current on-call users, all staff with their status, upcoming schedules

async function getOncall(_req, res, next) {
  try {
    const now = new Date().toISOString();

    const [staffRes, schedulesRes, currentRes] = await Promise.all([
      // All active staff with availability
      pool.query(
        `SELECT ${STAFF_FIELDS}
         FROM users
         WHERE role IN ('admin','manager','agent','technician','specialist')
           AND is_active = TRUE
         ORDER BY role ASC, name ASC`
      ),
      // Upcoming schedules (next 14 days)
      pool.query(
        `SELECT s.*, u.name AS user_name, u.role AS user_role, u.skills AS user_skills
         FROM oncall_schedules s
         JOIN users u ON u.id = s.user_id
         WHERE s.end_time >= NOW() AND s.start_time <= NOW() + INTERVAL '14 days'
         ORDER BY s.start_time ASC`
      ),
      // Currently on-call (schedule covers right now)
      pool.query(
        `SELECT ${STAFF_FIELDS.replace(/([a-z_]+)/g, 'u.$1')},
                s.label, s.start_time, s.end_time
         FROM oncall_schedules s
         JOIN users u ON u.id = s.user_id
         WHERE s.start_time <= $1 AND s.end_time >= $1`,
        [now]
      ),
    ]);

    res.json({
      staff: staffRes.rows,
      schedules: schedulesRes.rows,
      currentOncall: currentRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/oncall ────────────────────────────────────────────────────────

async function createSchedule(req, res, next) {
  try {
    const { user_id, start_time, end_time, label = 'On-Call' } = req.body;
    if (!user_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'user_id, start_time, and end_time are required' });
    }

    const {
      rows: [schedule],
    } = await pool.query(
      `INSERT INTO oncall_schedules (user_id, start_time, end_time, label, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [user_id, start_time, end_time, label, req.user.userId]
    );

    // Auto-set user status to on_call if schedule is active right now
    const now = new Date();
    if (new Date(start_time) <= now && new Date(end_time) >= now) {
      await updateAgentStatus(user_id, 'on_call', req.user.userId, false,
        `Assigned to on-call: ${label}`);
      await notify(user_id, null, 'ticket_assigned',
        `📟 You have been scheduled for on-call duty: ${label}`);
    }

    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/oncall/:id ──────────────────────────────────────────────────

async function deleteSchedule(req, res, next) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM oncall_schedules WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/oncall/page/:userId ───────────────────────────────────────────
// Admin/manager pages a technician — sends an urgent notification

async function pageUser(req, res, next) {
  try {
    const { userId: targetId } = req.params;
    const { message, ticket_id } = req.body;

    const {
      rows: [target],
    } = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = TRUE', [targetId]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const pageMsg = message || `You are being paged by ${req.user.name}. Please respond immediately.`;

    await pool.query(
      `INSERT INTO notifications (user_id, ticket_id, type, message)
       VALUES ($1,$2,'sla_breached',$3)`,
      [targetId, ticket_id || null, `🚨 PAGE: ${pageMsg}`]
    );

    res.json({ ok: true, paged: target.name });
  } catch (err) {
    next(err);
  }
}

// ─── Helper: get current on-call user (used by ticket creation) ───────────────

async function getCurrentOncallUser() {
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.role, u.skills
     FROM oncall_schedules s
     JOIN users u ON u.id = s.user_id
     WHERE s.start_time <= $1 AND s.end_time >= $1
       AND u.availability_status IN ('available','on_call')
       AND u.is_active = TRUE
     ORDER BY s.start_time ASC
     LIMIT 1`,
    [now]
  );
  return rows[0] || null;
}

module.exports = { getOncall, createSchedule, deleteSchedule, pageUser, getCurrentOncallUser };
