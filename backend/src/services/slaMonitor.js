/**
 * SLA Monitor — runs every 5 minutes.
 *
 * For every open (non-closed/non-resolved) ticket:
 *   ≥75% elapsed  → "At Risk"  alert (fires once per ticket)
 *   >100% elapsed → "Breached" alert + auto-escalation (fires once per ticket)
 *
 * Alert dedup is handled by the sla_alerts table (UNIQUE on ticket_id + alert_type).
 */
const cron = require('node-cron');
const pool = require('../db/pool');
const { computeSla } = require('../utils/sla');

// ---------- helpers ----------

async function getManagerAndAdminUserIds() {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE role IN ('admin','manager') AND is_active = TRUE`
  );
  return rows.map((r) => r.id);
}

async function createNotification(userId, ticketId, type, message) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, ticket_id, type, message)
       VALUES ($1,$2,$3,$4)`,
      [userId, ticketId, type, message]
    );
  } catch {
    // Non-fatal — log and continue
  }
}

async function notifyUsers(userIds, ticketId, type, message) {
  await Promise.all(userIds.map((uid) => createNotification(uid, ticketId, type, message)));
}

async function tryFireAlert(ticketId, alertType) {
  try {
    await pool.query(`INSERT INTO sla_alerts (ticket_id, alert_type) VALUES ($1,$2)`, [
      ticketId,
      alertType,
    ]);
    return true; // inserted → first time we've fired this alert
  } catch {
    return false; // unique violation → already fired
  }
}

// ---------- main check ----------

async function runCheck() {
  const { rows: tickets } = await pool.query(`
    SELECT t.*, u.id AS assigned_user_id
    FROM   tickets t
    LEFT   JOIN users u ON u.id = t.assigned_to_user_id
    WHERE  t.status NOT IN ('Resolved','Closed','Pending Approval')
      AND  t.sla_minutes IS NOT NULL
  `);

  if (tickets.length === 0) return;

  const managerIds = await getManagerAndAdminUserIds();

  for (const ticket of tickets) {
    const sla = computeSla(ticket);
    if (!sla || sla.pct < 75) continue;

    const title = ticket.title.slice(0, 60) + (ticket.title.length > 60 ? '…' : '');

    // ── At Risk (≥75%) ─────────────────────────────────────────────
    if (sla.pct >= 75 && sla.pct <= 100) {
      const fired = await tryFireAlert(ticket.id, 'at_risk');
      if (!fired) continue;

      const msg = `SLA at risk: "${title}" is ${sla.pct}% elapsed.`;
      const recipients = new Set(managerIds);
      if (ticket.assigned_user_id) recipients.add(ticket.assigned_user_id);
      await notifyUsers([...recipients], ticket.id, 'sla_at_risk', msg);
    }

    // ── Breached (>100%) ───────────────────────────────────────────
    if (sla.pct > 100) {
      const fired = await tryFireAlert(ticket.id, 'breached');
      if (fired) {
        const msg = `SLA breached: "${title}" is ${sla.pct}% elapsed.`;
        const recipients = new Set(managerIds);
        if (ticket.assigned_user_id) recipients.add(ticket.assigned_user_id);
        await notifyUsers([...recipients], ticket.id, 'sla_breached', msg);
      }

      // Auto-escalate if not already escalated
      if (ticket.status !== 'Escalated') {
        const escalateFired = await tryFireAlert(ticket.id, 'auto_escalated');
        if (escalateFired) {
          await pool.query(
            `UPDATE tickets
             SET    status          = 'Escalated',
                    escalated_at    = NOW(),
                    escalated_by    = 'System (SLA breach)',
                    escalation_reason = 'Auto-escalated: SLA breached'
             WHERE  id = $1`,
            [ticket.id]
          );

          const escalateMsg = `Auto-escalated: "${title}" breached SLA and was escalated automatically.`;
          const recipients = new Set(managerIds);
          if (ticket.assigned_user_id) recipients.add(ticket.assigned_user_id);
          await notifyUsers([...recipients], ticket.id, 'auto_escalated', escalateMsg);

          console.log(`[SLAMonitor] Auto-escalated ticket #${ticket.id}`);
        }
      }
    }
  }
}

// ---------- start ----------

function start() {
  console.log('[SLAMonitor] Starting — checks every 5 minutes');

  // Run once on startup so new deployments don't wait 5 minutes
  runCheck().catch((err) => console.error('[SLAMonitor] Startup check error:', err.message));

  cron.schedule('*/5 * * * *', () => {
    runCheck().catch((err) => console.error('[SLAMonitor] Check error:', err.message));
  });
}

module.exports = { start, runCheck };
