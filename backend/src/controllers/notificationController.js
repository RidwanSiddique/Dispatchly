const pool = require('../db/pool');

// GET /api/notifications — unread notifications for the current user (max 50)
async function getNotifications(req, res) {
  const { rows } = await pool.query(
    `SELECT n.id, n.type, n.message, n.is_read, n.created_at,
            n.ticket_id, t.title AS ticket_title
     FROM   notifications n
     LEFT   JOIN tickets t ON t.id = n.ticket_id
     WHERE  n.user_id = $1
     ORDER  BY n.created_at DESC
     LIMIT  50`,
    [req.user.userId]
  );

  const unreadCount = rows.filter((r) => !r.is_read).length;
  res.json({ notifications: rows, unreadCount });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const { rows } = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  await pool.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.user.userId]);
  res.json({ ok: true });
}

module.exports = { getNotifications, markRead, markAllRead };
