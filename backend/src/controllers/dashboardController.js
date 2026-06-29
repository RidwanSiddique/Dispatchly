const pool = require('../db/pool');
const { computeSla } = require('../utils/sla');
const { REQUESTER_ROLES } = require('../config/constants');

// ─── Visibility helper ────────────────────────────────────────────────────────

function visibilityClause(role, userId) {
  if (REQUESTER_ROLES.includes(role)) {
    return { clause: 'AND created_by_user_id = $1', values: [userId] };
  }
  if (role === 'technician') {
    return { clause: 'AND assigned_to_user_id = $1', values: [userId] };
  }
  return { clause: '', values: [] };
}

// ─── GET /api/dashboard ───────────────────────────────────────────────────────

const getDashboard = async (req, res, next) => {
  try {
    const { role, userId } = req.user;
    const { clause, values } = visibilityClause(role, userId);

    const [
      totalsRes,
      byPriorityRes,
      byStatusRes,
      byCategoryRes,
      byTypeRes,
      recentRes,
      openForSlaRes,
      resolvedRes,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)                                                    AS total,
           COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed')) AS open,
           COUNT(*) FILTER (WHERE status IN ('Resolved','Closed'))     AS resolved
         FROM tickets WHERE TRUE ${clause}`,
        values
      ),
      pool.query(
        `SELECT priority, COUNT(*) AS count
         FROM tickets WHERE status NOT IN ('Resolved','Closed') ${clause}
         GROUP BY priority`,
        values
      ),
      pool.query(
        `SELECT status, COUNT(*) AS count FROM tickets WHERE TRUE ${clause} GROUP BY status`,
        values
      ),
      pool.query(
        `SELECT category, COUNT(*) AS count
         FROM tickets
         WHERE status NOT IN ('Resolved','Closed') AND category IS NOT NULL ${clause}
         GROUP BY category ORDER BY count DESC`,
        values
      ),
      pool.query(
        `SELECT type, COUNT(*) AS count FROM tickets WHERE TRUE ${clause} GROUP BY type`,
        values
      ),
      pool.query(
        `SELECT id, title, priority, status, type, category, created_at, sla_minutes
         FROM tickets WHERE TRUE ${clause} ORDER BY created_at DESC LIMIT 7`,
        values
      ),
      pool.query(
        `SELECT created_at, sla_minutes, priority
         FROM tickets WHERE status NOT IN ('Resolved','Closed') ${clause}`,
        values
      ),
      pool.query(
        `SELECT created_at, resolved_at
         FROM tickets
         WHERE status IN ('Resolved','Closed')
           AND resolved_at IS NOT NULL
           AND resolved_at >= NOW() - INTERVAL '30 days' ${clause}`,
        values
      ),
    ]);

    // SLA health (computed in JS with business-hours-aware computeSla)
    let breached = 0, atRisk = 0;
    for (const t of openForSlaRes.rows) {
      const { status } = computeSla(t);
      if (status === 'Breached') breached++;
      else if (status === 'At Risk') atRisk++;
    }
    const openCount = openForSlaRes.rows.length;

    // Average resolution time (minutes) — last 30 days
    let avgResolutionMinutes = null;
    if (resolvedRes.rows.length > 0) {
      const totalMins = resolvedRes.rows.reduce(
        (sum, t) => sum + (new Date(t.resolved_at) - new Date(t.created_at)) / 60000,
        0
      );
      avgResolutionMinutes = Math.round(totalMins / resolvedRes.rows.length);
    }

    const row = totalsRes.rows[0];
    res.json({
      totals: {
        total: parseInt(row.total, 10),
        open: parseInt(row.open, 10),
        resolved: parseInt(row.resolved, 10),
      },
      sla: {
        breached,
        atRisk,
        onTrack: openCount - breached - atRisk,
        total: openCount,
        complianceRate: openCount > 0
          ? Math.round(((openCount - breached) / openCount) * 100)
          : 100,
      },
      avgResolutionMinutes,
      byPriority: byPriorityRes.rows.map((r) => ({ priority: r.priority, count: parseInt(r.count, 10) })),
      byStatus:   byStatusRes.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
      byCategory: byCategoryRes.rows.map((r) => ({ category: r.category, count: parseInt(r.count, 10) })),
      byType:     byTypeRes.rows.map((r) => ({ type: r.type, count: parseInt(r.count, 10) })),
      recentTickets: recentRes.rows,
      viewAs: role,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/dashboard/analytics?period=30 ──────────────────────────────────
// Full analytics: volume trend, SLA compliance by priority, MTTR trend,
// agent leaderboard, category breakdown, pending approvals, multi-SLA summary.

const getAnalytics = async (req, res, next) => {
  try {
    const { role, userId } = req.user;
    const { clause, values } = visibilityClause(role, userId);
    const period = Math.min(parseInt(req.query.period || '30', 10), 90);

    const isStaff = !REQUESTER_ROLES.includes(role) && role !== 'technician';

    // ── 1. Daily ticket volume for the last `period` days ─────────────────────
    const volumeRes = await pool.query(
      `SELECT
         DATE_TRUNC('day', created_at)::date AS day,
         COUNT(*) AS created,
         COUNT(*) FILTER (WHERE status IN ('Resolved','Closed')) AS resolved
       FROM tickets
       WHERE created_at >= NOW() - ($1 || ' days')::interval ${clause}
       GROUP BY 1 ORDER BY 1`,
      [period, ...values]
    );

    // ── 2. SLA compliance by priority (last `period` days, closed/resolved) ───
    const slaByPriorityRes = await pool.query(
      `SELECT
         priority,
         COUNT(*) AS total,
         COUNT(*) FILTER (
           WHERE resolved_at IS NOT NULL
             AND EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60 <= sla_minutes
         ) AS met
       FROM tickets
       WHERE status IN ('Resolved','Closed')
         AND created_at >= NOW() - ($1 || ' days')::interval ${clause}
       GROUP BY priority`,
      [period, ...values]
    );

    // ── 3. MTTR trend — average resolution time per week ─────────────────────
    const mttrRes = await pool.query(
      `SELECT
         DATE_TRUNC('week', resolved_at)::date AS week,
         ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)) AS avg_minutes,
         COUNT(*) AS count
       FROM tickets
       WHERE status IN ('Resolved','Closed')
         AND resolved_at IS NOT NULL
         AND resolved_at >= NOW() - ($1 || ' days')::interval ${clause}
       GROUP BY 1 ORDER BY 1`,
      [period, ...values]
    );

    // ── 4. Agent performance (staff only) ─────────────────────────────────────
    let agentPerformance = [];
    if (isStaff) {
      const agentRes = await pool.query(
        `SELECT
           u.id,
           u.name,
           u.role,
           COUNT(t.id)                                              AS assigned,
           COUNT(t.id) FILTER (WHERE t.status IN ('Resolved','Closed')) AS resolved,
           ROUND(AVG(
             CASE WHEN t.resolved_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60
             END
           ))                                                       AS avg_resolution_minutes,
           COUNT(t.id) FILTER (
             WHERE t.status IN ('Resolved','Closed')
               AND t.resolved_at IS NOT NULL
               AND EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60 <= t.sla_minutes
           )                                                        AS sla_met
         FROM users u
         LEFT JOIN tickets t ON t.assigned_to_user_id = u.id
           AND t.created_at >= NOW() - ($1 || ' days')::interval
         WHERE u.role IN ('agent','technician','specialist','manager')
           AND u.is_active = TRUE
         GROUP BY u.id, u.name, u.role
         ORDER BY resolved DESC`,
        [period]
      );

      agentPerformance = agentRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        assigned: parseInt(r.assigned, 10),
        resolved: parseInt(r.resolved, 10),
        avgResolutionMinutes: r.avg_resolution_minutes ? parseInt(r.avg_resolution_minutes, 10) : null,
        slaMet: parseInt(r.sla_met, 10),
        slaRate: parseInt(r.resolved, 10) > 0
          ? Math.round((parseInt(r.sla_met, 10) / parseInt(r.resolved, 10)) * 100)
          : null,
      }));
    }

    // ── 5. Category performance ───────────────────────────────────────────────
    const catPerfRes = await pool.query(
      `SELECT
         COALESCE(category, 'Uncategorized') AS category,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('Resolved','Closed')) AS resolved,
         ROUND(AVG(
           CASE WHEN resolved_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
           END
         )) AS avg_resolution_minutes
       FROM tickets
       WHERE created_at >= NOW() - ($1 || ' days')::interval ${clause}
       GROUP BY 1 ORDER BY total DESC`,
      [period, ...values]
    );

    // ── 6. Pending approvals & overdue tickets ────────────────────────────────
    const [pendingApprRes, overdueRes, escalatedRes] = await Promise.all([
      isStaff ? pool.query(
        `SELECT COUNT(*) AS count FROM tickets WHERE status = 'Pending Approval'`
      ) : Promise.resolve({ rows: [{ count: 0 }] }),
      pool.query(
        `SELECT COUNT(*) AS count
         FROM tickets
         WHERE status NOT IN ('Resolved','Closed','Pending Approval')
           AND created_at + (sla_minutes || ' minutes')::interval < NOW() ${clause}`,
        values
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM tickets WHERE status = 'Escalated' ${clause}`,
        values
      ),
    ]);

    // ── 7. Multi-SLA summary (staff only) ────────────────────────────────────
    let multiSlaSummary = [];
    if (isStaff) {
      const msRes = await pool.query(`
        SELECT
          sd.name, sd.type,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE ts.status = 'breached') AS breached,
          COUNT(*) FILTER (WHERE ts.status = 'met')      AS met,
          COUNT(*) FILTER (WHERE ts.status = 'active')   AS active
        FROM ticket_slas ts
        JOIN sla_definitions sd ON sd.id = ts.definition_id
        GROUP BY sd.id, sd.name, sd.type
        ORDER BY breached DESC
      `);
      multiSlaSummary = msRes.rows.map((r) => ({
        name: r.name,
        type: r.type,
        total: parseInt(r.total, 10),
        breached: parseInt(r.breached, 10),
        met: parseInt(r.met, 10),
        active: parseInt(r.active, 10),
        complianceRate: parseInt(r.total, 10) > 0
          ? Math.round(((parseInt(r.met, 10)) / (parseInt(r.met, 10) + parseInt(r.breached, 10) || 1)) * 100)
          : null,
      }));
    }

    // ── 8. First response time (time from created_at to first comment by staff) ─
    const frtRes = await pool.query(
      `SELECT
         ROUND(AVG(EXTRACT(EPOCH FROM (tc.created_at - t.created_at)) / 60)) AS avg_frt_minutes,
         COUNT(DISTINCT t.id) AS sample_size
       FROM tickets t
       JOIN LATERAL (
         SELECT created_at FROM ticket_comments
         WHERE ticket_id = t.id AND is_internal = FALSE
         ORDER BY created_at ASC LIMIT 1
       ) tc ON TRUE
       WHERE t.created_at >= NOW() - ($1 || ' days')::interval ${clause}`,
      [period, ...values]
    );

    res.json({
      period,
      volumeTrend: volumeRes.rows.map((r) => ({
        day: r.day,
        created: parseInt(r.created, 10),
        resolved: parseInt(r.resolved, 10),
      })),
      slaComplianceByPriority: slaByPriorityRes.rows.map((r) => ({
        priority: r.priority,
        total: parseInt(r.total, 10),
        met: parseInt(r.met, 10),
        rate: parseInt(r.total, 10) > 0
          ? Math.round((parseInt(r.met, 10) / parseInt(r.total, 10)) * 100)
          : null,
      })),
      mttrTrend: mttrRes.rows.map((r) => ({
        week: r.week,
        avgMinutes: r.avg_minutes ? parseInt(r.avg_minutes, 10) : null,
        count: parseInt(r.count, 10),
      })),
      agentPerformance,
      categoryPerformance: catPerfRes.rows.map((r) => ({
        category: r.category,
        total: parseInt(r.total, 10),
        resolved: parseInt(r.resolved, 10),
        avgResolutionMinutes: r.avg_resolution_minutes ? parseInt(r.avg_resolution_minutes, 10) : null,
      })),
      summary: {
        pendingApprovals: parseInt(pendingApprRes.rows[0]?.count || 0, 10),
        overdueTickets:   parseInt(overdueRes.rows[0]?.count  || 0, 10),
        escalatedTickets: parseInt(escalatedRes.rows[0]?.count || 0, 10),
        avgFirstResponseMinutes: frtRes.rows[0]?.avg_frt_minutes
          ? parseInt(frtRes.rows[0].avg_frt_minutes, 10)
          : null,
      },
      multiSlaSummary,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/dashboard/business-hours ───────────────────────────────────────

const getBusinessHours = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM business_hours_config WHERE id = 1');
    res.json({ config: rows[0] || null });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/dashboard/business-hours ─────────────────────────────────────

const updateBusinessHours = async (req, res, next) => {
  try {
    const { start_hour, end_hour, work_days, timezone } = req.body;
    const { rows: [config] } = await pool.query(
      `INSERT INTO business_hours_config (id, start_hour, end_hour, work_days, timezone, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE
         SET start_hour = $1, end_hour = $2, work_days = $3,
             timezone = $4, updated_at = NOW()
       RETURNING *`,
      [
        start_hour ?? 9,
        end_hour   ?? 17,
        work_days  ?? [1,2,3,4,5],
        timezone   ?? 'UTC',
      ]
    );
    // Refresh cached config
    const { setBusinessHoursConfig } = require('../utils/sla');
    setBusinessHoursConfig(config);
    res.json({ config });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/dashboard/sla-definitions ──────────────────────────────────────

const getSlaDefinitions = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sd.*,
              COUNT(ts.id)                                          AS total_tickets,
              COUNT(ts.id) FILTER (WHERE ts.status = 'breached')   AS breached_count,
              COUNT(ts.id) FILTER (WHERE ts.status = 'met')        AS met_count,
              COUNT(ts.id) FILTER (WHERE ts.status = 'active')     AS active_count
       FROM sla_definitions sd
       LEFT JOIN ticket_slas ts ON ts.definition_id = sd.id
       GROUP BY sd.id
       ORDER BY sd.type, sd.target_minutes`
    );
    res.json({ definitions: rows });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/dashboard/sla-definitions ─────────────────────────────────────

const createSlaDefinition = async (req, res, next) => {
  try {
    const {
      name, type = 'SLA', description, target_minutes,
      priority_filter, category_filter, applies_business_hours = false,
    } = req.body;

    if (!name || !target_minutes) {
      return res.status(400).json({ error: 'name and target_minutes are required' });
    }

    const { rows: [def] } = await pool.query(
      `INSERT INTO sla_definitions
         (name, type, description, target_minutes, priority_filter, category_filter, applies_business_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name, type, description || null, target_minutes,
       priority_filter || null, category_filter || null, applies_business_hours]
    );
    res.status(201).json({ definition: def });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/dashboard/sla-definitions/:id ────────────────────────────────

const updateSlaDefinition = async (req, res, next) => {
  try {
    const ALLOWED = ['name','type','description','target_minutes','priority_filter',
                     'category_filter','applies_business_hours','is_active'];
    const sets = [], vals = [];
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${vals.length + 1}`);
        vals.push(req.body[key]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows: [def] } = await pool.query(
      `UPDATE sla_definitions SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!def) return res.status(404).json({ error: 'Not found' });
    res.json({ definition: def });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getAnalytics,
  getBusinessHours,
  updateBusinessHours,
  getSlaDefinitions,
  createSlaDefinition,
  updateSlaDefinition,
};
