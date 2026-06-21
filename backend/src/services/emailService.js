/**
 * Shared logic for turning an inbound email into a Dispatchly ticket.
 * Used by both the webhook endpoint and the IMAP poller.
 */
const pool = require('../db/pool');
const { SLA_MINUTES } = require('../config/constants');

/**
 * Parse the requester name from an email address string.
 * "Jane Smith <jane@hospital.org>" → "Jane Smith"
 * "jane@hospital.org"             → "jane"
 */
function parseDisplayName(from) {
  if (!from) return 'Unknown';
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  // Just an email address — use the local part
  return from
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseEmailAddress(from) {
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

/**
 * Create a ticket from a parsed email object.
 *
 * @param {object} email
 * @param {string} email.from        - "Name <email>" or just "email"
 * @param {string} email.subject     - Email subject line
 * @param {string} email.text        - Plain-text body
 * @param {string} [email.messageId] - RFC 2822 Message-ID for dedup
 * @returns {object|null} The created ticket row, or null if deduplicated
 */
async function createTicketFromEmail({ from, subject, text, messageId }) {
  // Dedup — ignore emails we've already processed
  if (messageId) {
    const { rows } = await pool.query('SELECT id FROM tickets WHERE email_message_id = $1', [
      messageId,
    ]);
    if (rows.length > 0) return null; // already processed
  }

  const requesterName = parseDisplayName(from);
  const requesterEmail = parseEmailAddress(from);
  const title = (subject || 'No subject').slice(0, 200).trim();
  const description = (text || '(No body)').trim();

  const {
    rows: [ticket],
  } = await pool.query(
    `INSERT INTO tickets
       (requester_name, requester_email, title, description,
        type, priority, sla_minutes,
        source, email_message_id, email_from,
        status)
     VALUES ($1,$2,$3,$4,'Incident','P3',$5,'email',$6,$7,'New')
     RETURNING *`,
    [
      requesterName,
      requesterEmail,
      title,
      description,
      SLA_MINUTES.P3,
      messageId || null,
      from || null,
    ]
  );

  return ticket;
}

module.exports = { createTicketFromEmail, parseDisplayName, parseEmailAddress };
