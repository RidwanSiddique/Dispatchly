/**
 * Email Notifier — Nodemailer + SMTP
 *
 * Sends outbound notification emails alongside in-app notifications.
 *
 * Required .env variables (all optional — if SMTP_HOST is not set,
 * email sending is silently skipped so the app still works without config):
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       e.g. 587 (TLS) or 465 (SSL)
 *   SMTP_SECURE     true for SSL (port 465), false for STARTTLS (port 587)
 *   SMTP_USER       e.g. helpdesk@yourcompany.com
 *   SMTP_PASS       App password or SMTP password
 *   EMAIL_FROM      Display name + address: "Dispatchly <helpdesk@co.com>"
 *   APP_URL         Base URL for links in emails: https://app.dispatchly.com
 */

const nodemailer = require('nodemailer');

// ─── Transporter (lazy-initialised once) ──────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!process.env.SMTP_HOST) return null; // Email disabled — no config

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

const FROM = process.env.EMAIL_FROM || 'Dispatchly <noreply@dispatchly.local>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ─── Notification type → email subject prefix ────────────────────────────────

const SUBJECT_PREFIX = {
  new_ticket:       '🆕 New Ticket',
  ticket_updated:   '📝 Ticket Updated',
  ticket_assigned:  '👤 Ticket Assigned',
  ticket_replied:   '💬 New Reply',
  ticket_escalated: '🔺 Ticket Escalated',
  sla_at_risk:      '⚠️ SLA At Risk',
  sla_breached:     '🚨 SLA Breached',
  auto_escalated:   '🚨 Auto-Escalated',
  approval_needed:  '✅ Approval Required',
  approval_resolved:'✅ Approval Decision',
};

// ─── HTML template ────────────────────────────────────────────────────────────

function buildHtml({ message, ticketId, ticketTitle, type }) {
  const ticketLink = ticketId ? `${APP_URL}/tickets/${ticketId}` : null;
  const priorityColor = {
    sla_breached: '#dc2626',
    auto_escalated: '#dc2626',
    sla_at_risk: '#d97706',
    ticket_escalated: '#7c3aed',
    new_ticket: '#2563eb',
    approval_needed: '#d97706',
  }[type] || '#374151';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dispatchly Notification</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:${priorityColor};padding:20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-.3px;">⚡ Dispatchly</span>
                  </td>
                  <td align="right">
                    <span style="color:rgba(255,255,255,.8);font-size:12px;font-weight:600;">${SUBJECT_PREFIX[type] || 'Notification'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 20px;">
              <p style="margin:0;font-size:15px;color:#111827;line-height:1.6;">${message.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>

              ${ticketId && ticketTitle ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 16px;background:#f9fafb;">
                    <p style="margin:0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Ticket</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">#${ticketId} — ${ticketTitle}</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${ticketLink ? `
              <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#2563eb;border-radius:8px;">
                    <a href="${ticketLink}" style="display:inline-block;padding:10px 20px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">View Ticket →</a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this because you're a member of the Dispatchly service desk. <a href="${APP_URL}" style="color:#6b7280;">Visit the dashboard</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send a notification email.
 * Silently skips if SMTP is not configured or if toEmail is empty.
 *
 * @param {object} opts
 * @param {string}  opts.toEmail       Recipient email address
 * @param {string}  opts.toName        Recipient display name
 * @param {string}  opts.type          Notification type key
 * @param {string}  opts.message       Notification body text
 * @param {number}  [opts.ticketId]    Optional ticket ID for link/context
 * @param {string}  [opts.ticketTitle] Optional ticket title for context
 */
async function sendNotificationEmail({ toEmail, toName, type, message, ticketId, ticketTitle }) {
  if (!toEmail) return;

  const transporter = getTransporter();
  if (!transporter) return; // SMTP not configured

  const prefix = SUBJECT_PREFIX[type] || 'Notification';
  const subject = ticketTitle
    ? `${prefix}: ${ticketTitle.slice(0, 60)}${ticketTitle.length > 60 ? '…' : ''}`
    : `${prefix}: ${message.slice(0, 80)}${message.length > 80 ? '…' : ''}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject,
      text: `${message}\n\n${ticketId ? `View ticket: ${APP_URL}/tickets/${ticketId}` : APP_URL}`,
      html: buildHtml({ message, ticketId, ticketTitle, type }),
    });
  } catch (err) {
    // Non-fatal — email failure should never break the main flow
    console.error(`[EmailNotifier] Failed to send to ${toEmail}:`, err.message);
  }
}

module.exports = { sendNotificationEmail };
