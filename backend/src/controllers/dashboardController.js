const pool = require('../db/pool');
const { computeSla } = require('../utils/sla');
const { REQUESTER_ROLES } = require('../config/constants');

// Build optional WHERE clause for role-based ticket visibility
function visibilityClause(role, userId) {
  if (REQUESTER_ROLES.includes(role)) {
    return { clause: 'AND created_by_user_id = $1', values: [userId] };
  }
  if (role === 'technician') {
    return { clause: 'AND assigned_to_user_id = $1', values: [userId] };
  }
  return { clause: '', values: [] };
}

const getDashboard = async (req, res, next) => {
  try {
    const { role, userId } = req.user;
    const { clause, values } = visibilityClause(role, userId);
    const hasFilter = values.length > 0;

    // Dynamic query fragment helper
    const scoped = (baseWhere) =>
      hasFilter ? `${baseWhere} ${clause}` : baseWhere;

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
          COUNT(*)                                                  AS total,
          COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed')) AS open,
          COUNT(*) FILTER (WHERE status IN ('Resolved','Closed'))     AS resolved
         FROM tickets
         WHERE TRUE ${clause}`,
        values
      ),
      pool.query(
        `SELECT priority, COUNT(*) AS count
         FROM tickets
         WHERE status NOT IN ('Resolved','Closed') ${clause}
         GROUP BY priority`,
        values
      ),
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM tickets
         WHERE TRUE ${clause}
         GROUP BY status`,
        values
      ),
      pool.query(
        `SELECT category, COUNT(*) AS count
         FROM tickets
         WHERE status NOT IN ('Resolved','Closed')
           AND category IS NOT NULL ${clause}
         GROUP BY category
         ORDER BY count DESC`,
        values
      ),
      pool.query(
        `SELECT type, COUNT(*) AS count
         FROM tickets
         WHERE TRUE ${clause}
         GROUP BY type`,
        values
      ),
      pool.query(
        `SELECT id, title, priority, status, type, category, created_at, sla_minutes
         FROM tickets
         WHERE TRUE ${clause}
         ORDER BY created_at DESC
         LIMIT 7`,
        values
      ),
      pool.query(
        `SELECT created_at, sla_minutes
         FROM tickets
         WHERE status NOT IN ('Resolved','Closed') ${clause}`,
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

    // SLA health computed in JS
    let breached = 0;
    let atRisk = 0;
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
      },
      avgResolutionMinutes,
      byPriority: byPriorityRes.rows.map((r) => ({
        priority: r.priority,
        count: parseInt(r.count, 10),
      })),
      byStatus: byStatusRes.rows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      byCategory: byCategoryRes.rows.map((r) => ({
        category: r.category,
        count: parseInt(r.count, 10),
      })),
      byType: byTypeRes.rows.map((r) => ({
        type: r.type,
        count: parseInt(r.count, 10),
      })),
      recentTickets: recentRes.rows,
      viewAs: role,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };
