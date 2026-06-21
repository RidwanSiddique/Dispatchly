const pool = require('../db/pool');
const { REQUESTER_ROLES } = require('../config/constants');

// ─── GET /api/tickets/:id/time ───────────────────────────────────────────────

async function getTimeEntries(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.name AS user_name
       FROM time_entries t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.ticket_id = $1
       ORDER BY t.created_at DESC`,
      [req.params.id]
    );

    const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);
    res.json({ entries: rows, totalMinutes });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/tickets/:id/time ──────────────────────────────────────────────

async function logTime(req, res, next) {
  try {
    const { minutes, description } = req.body;
    const { userId, name: userName, role } = req.user;

    if (!minutes || Number.isNaN(Number(minutes)) || Number(minutes) <= 0) {
      return res.status(400).json({ error: 'minutes must be a positive number' });
    }

    // Requesters cannot log time
    if (REQUESTER_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Only staff can log time' });
    }

    const {
      rows: [ticket],
    } = await pool.query('SELECT id FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const {
      rows: [entry],
    } = await pool.query(
      `INSERT INTO time_entries (ticket_id, user_id, user_name, minutes, description)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [ticket.id, userId, userName, Number(minutes), description || null]
    );

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTimeEntries, logTime };
