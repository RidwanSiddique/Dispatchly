const pool = require('../db/pool');

const getDashboard = async (_req, res, next) => {
  try {
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
      // Totals
      pool.query(`
        SELECT
          COUNT(*)                                                  AS total,
          COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed')) AS open,
          COUNT(*) FILTER (WHERE status IN ('Resolved','Closed'))     AS resolved
        FROM tickets
      `),
      // Open tickets by priority
      pool.query(`
        SELECT priority, COUNT(*) AS count
        FROM tickets
        WHERE status NOT IN ('Resolved','Closed')
        GROUP BY priority
      `),
      // All tickets by status
      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM tickets
        GROUP BY status
      `),
      // Open tickets by category
      pool.query(`
        SELECT category, COUNT(*) AS count
        FROM tickets
        WHERE status NOT IN ('Resolved','Closed')
          AND category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `),
      // Tickets by type
      pool.query(`
        SELECT type, COUNT(*) AS count
        FROM tickets
        GROUP BY type
      `),
      // 7 most recent tickets
      pool.query(`
        SELECT id, title, priority, status, type, category, created_at, sla_minutes
        FROM tickets
        ORDER BY created_at DESC
        LIMIT 7
      `),
      // All open tickets — for JS-side SLA computation
      pool.query(`
        SELECT created_at, sla_minutes
        FROM tickets
        WHERE status NOT IN ('Resolved','Closed')
      `),
      // Resolved in last 30 days — for avg resolution time
      pool.query(`
        SELECT created_at, resolved_at
        FROM tickets
        WHERE status IN ('Resolved','Closed')
          AND resolved_at IS NOT NULL
          AND resolved_at >= NOW() - INTERVAL '30 days'
      `),
    ]);

    // SLA health (computed in JS — avoids coupling SQL to clock drift)
    const now = Date.now();
    let breached = 0;
    let atRisk = 0;
    for (const t of openForSlaRes.rows) {
      const elapsed = (now - new Date(t.created_at)) / 60000;
      const pct = (elapsed / t.sla_minutes) * 100;
      if (pct >= 100) breached++;
      else if (pct >= 75) atRisk++;
    }
    const openCount = openForSlaRes.rows.length;

    // Average resolution time (minutes)
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
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };
