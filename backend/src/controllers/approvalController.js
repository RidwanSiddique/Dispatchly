const pool = require('../db/pool');

// GET /api/tickets/:id/approval — get approval record for a ticket
async function getApproval(req, res) {
  const {
    rows: [approval],
  } = await pool.query(
    `SELECT a.*, u.name AS approver_name
     FROM   approvals a
     LEFT   JOIN users u ON u.id = a.approver_id
     WHERE  a.ticket_id = $1`,
    [req.params.id]
  );
  res.json({ approval: approval || null });
}

// POST /api/tickets/:id/approve
async function approveTicket(req, res) {
  const { comment } = req.body;

  const {
    rows: [ticket],
  } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status !== 'Pending Approval') {
    return res.status(400).json({ error: 'Ticket is not pending approval' });
  }

  // Update approval record
  await pool.query(
    `UPDATE approvals
     SET status = 'approved', approver_id = $1, comment = $2, resolved_at = NOW()
     WHERE ticket_id = $3`,
    [req.user.userId, comment || null, ticket.id]
  );

  // Advance ticket to New
  await pool.query(`UPDATE tickets SET status = 'New' WHERE id = $1`, [ticket.id]);

  // Notify the requester
  if (ticket.created_by_user_id) {
    await pool.query(
      `INSERT INTO notifications (user_id, ticket_id, type, message)
       VALUES ($1,$2,'approval_resolved',$3)`,
      [
        ticket.created_by_user_id,
        ticket.id,
        `Your request "${ticket.title}" was approved. Work will begin shortly.`,
      ]
    );
  }

  const {
    rows: [updated],
  } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [ticket.id]);
  res.json({ ticket: updated });
}

// POST /api/tickets/:id/reject
async function rejectTicket(req, res) {
  const { comment } = req.body;

  const {
    rows: [ticket],
  } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status !== 'Pending Approval') {
    return res.status(400).json({ error: 'Ticket is not pending approval' });
  }

  // Update approval record
  await pool.query(
    `UPDATE approvals
     SET status = 'rejected', approver_id = $1, comment = $2, resolved_at = NOW()
     WHERE ticket_id = $3`,
    [req.user.userId, comment || null, ticket.id]
  );

  // Close the ticket with rejection note
  const rejectionNote = comment
    ? `Request rejected by ${req.user.name}: ${comment}`
    : `Request rejected by ${req.user.name}.`;

  await pool.query(
    `UPDATE tickets
     SET status = 'Closed', resolution_notes = $1, closed_at = NOW()
     WHERE id = $2`,
    [rejectionNote, ticket.id]
  );

  // Notify the requester
  if (ticket.created_by_user_id) {
    await pool.query(
      `INSERT INTO notifications (user_id, ticket_id, type, message)
       VALUES ($1,$2,'approval_resolved',$3)`,
      [
        ticket.created_by_user_id,
        ticket.id,
        `Your request "${ticket.title}" was not approved. ${comment ? `Reason: ${comment}` : ''}`,
      ]
    );
  }

  const {
    rows: [updated],
  } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [ticket.id]);
  res.json({ ticket: updated });
}

module.exports = { getApproval, approveTicket, rejectTicket };
