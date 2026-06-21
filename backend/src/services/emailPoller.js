/**
 * Optional IMAP email poller.
 *
 * Polls a mailbox every 2 minutes and creates tickets from unread emails.
 * Only starts if EMAIL_IMAP_HOST is set in .env.
 *
 * Required .env variables:
 *   EMAIL_IMAP_HOST     e.g. imap.gmail.com
 *   EMAIL_IMAP_PORT     e.g. 993
 *   EMAIL_IMAP_USER     e.g. helpdesk@yourcompany.com
 *   EMAIL_IMAP_PASS     App password (not your login password)
 *
 * For Gmail: enable "Less secure app access" or use an App Password.
 * For Outlook/365: use IMAP with OAuth2 or App Password.
 */
const cron = require('node-cron');
const { createTicketFromEmail } = require('./emailService');

let pollerStarted = false;

async function pollOnce() {
  // Lazy-require so the app starts fine even without imapflow installed
  let ImapFlow, simpleParser;
  try {
    ({ ImapFlow } = require('imapflow'));
    ({ simpleParser } = require('mailparser'));
  } catch {
    console.warn('[EmailPoller] imapflow or mailparser not installed — skipping poll');
    return;
  }

  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST,
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.EMAIL_IMAP_USER,
      pass: process.env.EMAIL_IMAP_PASS,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    // Find unseen messages
    const messages = await client.search({ seen: false });
    if (messages.length === 0) {
      await client.logout();
      return;
    }

    let created = 0;
    for await (const msg of client.fetch(messages, { source: true })) {
      const parsed = await simpleParser(msg.source);
      const ticket = await createTicketFromEmail({
        from: parsed.from?.text ?? '',
        subject: parsed.subject ?? '',
        text: parsed.text ?? parsed.html ?? '',
        messageId: parsed.messageId,
      });
      if (ticket) {
        created++;
        // Mark as seen so we don't re-process
        await client.messageFlagsAdd(msg.seq, ['\\Seen']);
      }
    }

    if (created > 0) {
      console.log(`[EmailPoller] Created ${created} ticket(s) from email`);
    }

    await client.logout();
  } catch (err) {
    console.error('[EmailPoller] Error:', err.message);
    try {
      await client.logout();
    } catch {}
  }
}

function start() {
  if (pollerStarted) return;

  if (!process.env.EMAIL_IMAP_HOST) {
    console.log('[EmailPoller] EMAIL_IMAP_HOST not set — IMAP polling disabled');
    console.log('[EmailPoller] Use POST /api/email/inbound for webhook-based email-to-ticket');
    return;
  }

  pollerStarted = true;
  console.log(`[EmailPoller] Polling ${process.env.EMAIL_IMAP_HOST} every 2 minutes`);

  // Run immediately on startup, then every 2 minutes
  pollOnce();
  cron.schedule('*/2 * * * *', pollOnce);
}

module.exports = { start };
