const { createTicketFromEmail } = require('../services/emailService');

/**
 * POST /api/email/inbound
 *
 * Webhook endpoint compatible with:
 *   - SendGrid Inbound Parse
 *   - Mailgun Routes
 *   - Postmark Inbound
 *   - Any custom relay that POSTs JSON
 *
 * Expected body (JSON):
 *   { from, subject, text, messageId }
 *
 * The endpoint is secured by a shared secret in EMAIL_WEBHOOK_SECRET.
 * If not set, the endpoint is open (useful for dev/testing).
 */
async function inboundEmail(req, res) {
  // Optional secret-based authentication
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers['x-webhook-secret'] || req.body.secret;
    if (provided !== secret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const { from, subject, text, messageId } = req.body;

  if (!from && !subject) {
    return res.status(400).json({ error: 'from or subject is required' });
  }

  const ticket = await createTicketFromEmail({ from, subject, text, messageId });

  if (!ticket) {
    // Deduplicated — this messageId was already processed
    return res.json({ ok: true, duplicate: true });
  }

  res.status(201).json({ ok: true, ticketId: ticket.id });
}

module.exports = { inboundEmail };
