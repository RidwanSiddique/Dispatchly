/**
 * Unified Notifier
 *
 * Single source of truth for all notifications in Dispatchly.
 * Each call:
 *   1. Inserts an in-app notification row (notifications table)
 *   2. Looks up the user's email and sends an SMTP email (if SMTP configured)
 *
 * Usage — replace all direct pool.query('INSERT INTO notifications…') calls:
 *
 *   const { notify, notifyMany } = require('../services/notifier');
 *   await notify(userId, ticketId, 'ticket_updated', 'Your ticket was resolved');
 *   await notifyMany([uid1, uid2], ticketId, 'sla_breached', 'SLA breached!');
 */

const pool = require('../db/pool');
const { sendNotificationEmail } = require('./emailNotifier');

/**
 * Notify a single user — in-app + email.
 *
 * @param {number|null} userId
 * @param {number|null} ticketId  (null for non-ticket notifications like changes)
 * @param {string}      type      Notification type key
 * @param {string}      message   Human-readable message
 */
async function notify(userId, ticketId, type, message) {
  if (!userId) return;

  try {
    // 1 ── In-app notification
    await pool.query(
      `INSERT INTO notifications (user_id, ticket_id, type, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, ticketId, type, message]
    );

    // 2 ── Email notification (non-blocking lookup)
    const { rows } = await pool.query(
      `SELECT email, name FROM users WHERE id = $1 AND is_active = TRUE`,
      [userId]
    );
    if (!rows.length) return;

    const { email, name } = rows[0];

    // Look up ticket title for richer email subject/body
    let ticketTitle = null;
    if (ticketId) {
      const { rows: tRows } = await pool.query(
        'SELECT title FROM tickets WHERE id = $1',
        [ticketId]
      );
      ticketTitle = tRows[0]?.title ?? null;
    }

    // Fire-and-forget email (errors are caught inside sendNotificationEmail)
    sendNotificationEmail({ toEmail: email, toName: name, type, message, ticketId, ticketTitle });
  } catch (err) {
    // In-app notification failure is non-fatal
    console.error('[Notifier] Error:', err.message);
  }
}

/**
 * Notify multiple users at once.
 */
async function notifyMany(userIds, ticketId, type, message) {
  if (!userIds?.length) return;
  await Promise.all(userIds.map((uid) => notify(uid, ticketId, type, message)));
}

module.exports = { notify, notifyMany };
