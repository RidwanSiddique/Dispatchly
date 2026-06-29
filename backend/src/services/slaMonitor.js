/**
 * SLA Monitor — runs every 5 minutes.
 *
 * 1. Loads business hours config from DB (refreshed each run).
 * 2. Checks every open ticket's primary SLA (sla_minutes):
 *      ≥75% elapsed → "At Risk"  alert (deduped via sla_alerts)
 *      >100% elapsed → "Breached" alert + auto-escalation (deduped)
 * 3. Checks all active ticket_slas (OLA / UC / secondary SLAs):
 *      ≥75% → at-risk alert on the record
 *      >100% → breach alert + marks record as breached
 */

const cron = require('node-cron');
const pool = require('../db/pool');
const { computeSla, computeTicketSla, setBusinessHoursConfig } = require('../utils/sla');
const { notify, notifyMany } = require('./notifier');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getManagerAndAdminIds() {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE role IN ('admin','manager') AND is_active = TRUE`
  );
  return rows.map((r) => r.id);
}

async function tryFireAlert(ticketId, alertType) {
  try {
    await pool.query(
      `INSERT INTO sla_alerts (ticket_id, alert_type) VALUES ($1,$2)`,
      [ticketId, alertType]
    );
    return true; // first time this alert has fired
  } catch {
    return false; // unique constraint → already fired
  }
}

// ─── Load & cache business hours config ──────────────────────────────────────

async function refreshBusinessHoursConfig() {
  try {
    const { rows } = await pool.query('SELECT * FROM business_hours_config WHERE id = 1');
    if (rows.length) setBusinessHoursConfig(rows[0]);
  } catch {
    // Table may not exist yet during first migration — silently skip
  }
}

// ─── Primary SLA check (tickets.sla_minutes) ─────────────────────────────────

async function checkPrimarySlas(managerIds) {
  const { rows: tickets } = await pool.query(`
    SELECT t.*, u.id AS assigned_user_id
    FROM   tickets t
    LEFT   JOIN users u ON u.id = t.assigned_to_user_id
    WHERE  t.status NOT IN ('Resolved','Closed','Pending Approval')
      AND  t.sla_minutes IS NOT NULL
  `);

  for (const ticket of tickets) {
    const sla = computeSla(ticket);
    const pct = sla.pct;
    if (pct < 75) continue;

    const title = ticket.title.slice(0, 60) + (ticket.title.length > 60 ? '…' : '');

    if (pct >= 75 && pct <= 100) {
      // ── At Risk ────────────────────────────────────────────────────────────
      const fired = await tryFireAlert(ticket.id, 'at_risk');
      if (!fired) continue;

      const msg = `⚠️ SLA at risk: "${title}" — ${pct}% elapsed (${sla.minutesRemaining < 0 ? 'overdue' : `${sla.minutesRemaining}m remaining`})`;
      const recipients = new Set(managerIds);
      if (ticket.assigned_user_id) recipients.add(ticket.assigned_user_id);
      await notifyMany([...recipients], ticket.id, 'sla_at_risk', msg);
    }

    if (pct > 100) {
      // ── Breached ──────────────────────────────────────────────────────────
      const fired = await tryFireAlert(ticket.id, 'breached');
      if (fired) {
        const overdueMins = Math.abs(sla.minutesRemaining);
        const msg = `🚨 SLA breached: "${title}" — overdue by ${overdueMins} minute${overdueMins !== 1 ? 's' : ''}`;
        const recipients = new Set(managerIds);
        if (ticket.assigned_user_id) recipients.add(ticket.assigned_user_id);
        await notifyMany([...recipients], ticket.id, 'sla_breached', msg);
      }

      // ── Auto-escalate ─────────────────────────────────────────────────────
      if (ticket.status !== 'Escalated') {
        const escalateFired = await tryFireAlert(ticket.id, 'auto_escalated');
        if (escalateFired) {
          await pool.query(
            `UPDATE tickets
             SET  status            = 'Escalated',
                  escalated_at      = NOW(),
                  escalated_by      = 'System (SLA breach)',
                  escalation_reason = 'Auto-escalated: SLA breached'
             WHERE id = $1`,
            [ticket.id]
          );

          const escMsg = `🚨 Auto-escalated: "${title}" exceeded SLA and was escalated automatically.`;
          const recipients = new Set(managerIds);
          if (ticket.assigned_user_id) recipients.add(ticket.assigned_user_id);
          await notifyMany([...recipients], ticket.id, 'auto_escalated', escMsg);

          console.log(`[SLAMonitor] Auto-escalated ticket #${ticket.id}`);
        }
      }
    }
  }
}

// ─── Multi-SLA check (ticket_slas table — OLA / UC / secondary SLAs) ─────────

async function checkMultiSlas(managerIds) {
  // Fetch all active ticket_sla records along with their definition and ticket
  const { rows } = await pool.query(`
    SELECT
      ts.*,
      sd.name        AS def_name,
      sd.type        AS def_type,
      sd.target_minutes,
      sd.applies_business_hours,
      t.title        AS ticket_title,
      t.status       AS ticket_status,
      t.assigned_to_user_id
    FROM ticket_slas ts
    JOIN sla_definitions sd ON sd.id = ts.definition_id
    JOIN tickets t          ON t.id  = ts.ticket_id
    WHERE ts.status = 'active'
      AND t.status NOT IN ('Resolved','Closed','Pending Approval')
  `);

  for (const row of rows) {
    const computed = computeTicketSla(row, {
      target_minutes: row.target_minutes,
      applies_business_hours: row.applies_business_hours,
    });

    const title = row.ticket_title.slice(0, 50) + (row.ticket_title.length > 50 ? '…' : '');
    const defLabel = `${row.def_type} "${row.def_name}"`;

    if (computed.pct >= 75 && !row.alert_at_risk_sent) {
      // ── At Risk ───────────────────────────────────────────────────────────
      await pool.query(
        `UPDATE ticket_slas SET alert_at_risk_sent = TRUE WHERE id = $1`,
        [row.id]
      );
      const msg = `⚠️ ${defLabel} at risk on ticket "${title}" — ${computed.pct}% elapsed`;
      const recipients = new Set(managerIds);
      if (row.assigned_to_user_id) recipients.add(row.assigned_to_user_id);
      await notifyMany([...recipients], row.ticket_id, 'sla_at_risk', msg);
    }

    if (computed.pct > 100 && !row.alert_breach_sent) {
      // ── Breached ──────────────────────────────────────────────────────────
      await pool.query(
        `UPDATE ticket_slas
         SET status = 'breached', breached_at = NOW(), alert_breach_sent = TRUE
         WHERE id = $1`,
        [row.id]
      );
      const msg = `🚨 ${defLabel} breached on ticket "${title}" — overdue by ${Math.abs(computed.remaining)} minutes`;
      const recipients = new Set(managerIds);
      if (row.assigned_to_user_id) recipients.add(row.assigned_to_user_id);
      await notifyMany([...recipients], row.ticket_id, 'sla_breached', msg);
      console.log(`[SLAMonitor] Ticket SLA #${row.id} breached (ticket #${row.ticket_id})`);
    }
  }

  // Mark ticket_slas as 'met' when their ticket gets resolved/closed
  await pool.query(`
    UPDATE ticket_slas ts
    SET    status = 'met', met_at = NOW()
    FROM   tickets t
    WHERE  ts.ticket_id = t.id
      AND  ts.status    = 'active'
      AND  t.status IN ('Resolved','Closed')
  `);
}

// ─── Main check ──────────────────────────────────────────────────────────────

async function runCheck() {
  // Refresh business hours config from DB before each check
  await refreshBusinessHoursConfig();

  const managerIds = await getManagerAndAdminIds();

  await Promise.all([
    checkPrimarySlas(managerIds),
    checkMultiSlas(managerIds),
  ]);
}

// ─── Start ────────────────────────────────────────────────────────────────────

function start() {
  console.log('[SLAMonitor] Starting — checks every 5 minutes (primary + multi-SLA)');

  // Run once immediately so new deployments don't wait 5 minutes
  runCheck().catch((err) => console.error('[SLAMonitor] Startup check error:', err.message));

  cron.schedule('*/5 * * * *', () => {
    runCheck().catch((err) => console.error('[SLAMonitor] Check error:', err.message));
  });
}

module.exports = { start, runCheck };
