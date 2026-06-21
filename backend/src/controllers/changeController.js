const pool = require('../db/pool');

// ─── GET /api/changes ─────────────────────────────────────────────────────────

async function getChanges(_req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT cr.*,
              u.name AS requester_name,
              COUNT(ct.ticket_id) AS linked_tickets_count
       FROM change_requests cr
       LEFT JOIN users u ON u.id = cr.requester_id
       LEFT JOIN change_tickets ct ON ct.change_id = cr.id
       GROUP BY cr.id, u.name
       ORDER BY cr.created_at DESC`
    );
    res.json({ changes: rows });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/changes ────────────────────────────────────────────────────────

async function createChange(req, res, next) {
  try {
    const {
      title, description, type = 'Normal', risk_level = 'Medium',
      implementation_plan, rollback_plan, affected_systems,
      maintenance_window_start, maintenance_window_end,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const {
      rows: [change],
    } = await pool.query(
      `INSERT INTO change_requests
         (title, description, type, risk_level, implementation_plan, rollback_plan,
          affected_systems, maintenance_window_start, maintenance_window_end, requester_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        title, description, type, risk_level,
        implementation_plan || null, rollback_plan || null, affected_systems || null,
        maintenance_window_start || null, maintenance_window_end || null,
        req.user.userId,
      ]
    );

    res.status(201).json({ change });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/changes/:id ─────────────────────────────────────────────────────

async function getChange(req, res, next) {
  try {
    const {
      rows: [change],
    } = await pool.query(
      `SELECT cr.*, u.name AS requester_name
       FROM change_requests cr
       LEFT JOIN users u ON u.id = cr.requester_id
       WHERE cr.id = $1`,
      [req.params.id]
    );
    if (!change) return res.status(404).json({ error: 'Change request not found' });

    // Approval record
    const { rows: approvals } = await pool.query(
      `SELECT ca.*, u.name AS approver_name
       FROM change_approvals ca
       LEFT JOIN users u ON u.id = ca.approver_id
       WHERE ca.change_id = $1`,
      [req.params.id]
    );

    // Linked tickets
    const { rows: tickets } = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.created_at
       FROM change_tickets ct
       JOIN tickets t ON t.id = ct.ticket_id
       WHERE ct.change_id = $1`,
      [req.params.id]
    );

    res.json({ change: { ...change, approvals, tickets } });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/changes/:id ───────────────────────────────────────────────────

async function updateChange(req, res, next) {
  try {
    const ALLOWED = [
      'title', 'description', 'type', 'risk_level', 'implementation_plan',
      'rollback_plan', 'affected_systems', 'maintenance_window_start', 'maintenance_window_end',
    ];
    const sets = [];
    const values = [];

    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${values.length + 1}`);
        values.push(req.body[key]);
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    sets.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());
    values.push(req.params.id);

    const {
      rows: [change],
    } = await pool.query(
      `UPDATE change_requests SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!change) return res.status(404).json({ error: 'Change request not found' });
    res.json({ change });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/changes/:id/submit ────────────────────────────────────────────

async function submitChange(req, res, next) {
  try {
    const {
      rows: [change],
    } = await pool.query(
      `UPDATE change_requests
         SET status = 'Submitted', updated_at = NOW()
       WHERE id = $1 AND status = 'Draft'
       RETURNING *`,
      [req.params.id]
    );
    if (!change) {
      return res.status(400).json({ error: 'Change request not found or not in Draft status' });
    }

    // Notify admin + manager for approval
    const { rows: managers } = await pool.query(
      `SELECT id FROM users WHERE role IN ('admin','manager') AND is_active = TRUE`
    );
    const msg = `Change request #${change.id} "${change.title}" needs your approval.`;
    await Promise.all(
      managers.map((m) =>
        pool.query(
          `INSERT INTO notifications (user_id, ticket_id, type, message) VALUES ($1,NULL,'approval_needed',$2)`,
          [m.id, msg]
        )
      )
    );

    res.json({ change });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/changes/:id/approve ───────────────────────────────────────────

async function approveChange(req, res, next) {
  try {
    const { comment } = req.body;

    const {
      rows: [change],
    } = await pool.query('SELECT * FROM change_requests WHERE id = $1', [req.params.id]);
    if (!change) return res.status(404).json({ error: 'Change request not found' });
    if (change.status !== 'Submitted') {
      return res.status(400).json({ error: 'Change request is not pending approval' });
    }

    // Upsert approval record
    await pool.query(
      `INSERT INTO change_approvals (change_id, approver_id, status, comment, reviewed_at)
       VALUES ($1,$2,'approved',$3,NOW())
       ON CONFLICT (change_id, approver_id)
       DO UPDATE SET status='approved', comment=$3, reviewed_at=NOW()`,
      [change.id, req.user.userId, comment || null]
    );

    // Advance to Approved
    const {
      rows: [updated],
    } = await pool.query(
      `UPDATE change_requests SET status = 'Approved', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [change.id]
    );

    // Notify requester
    if (change.requester_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, ticket_id, type, message)
         VALUES ($1,NULL,'approval_resolved',$2)`,
        [change.requester_id, `Your change request #${change.id} "${change.title}" was approved.`]
      );
    }

    res.json({ change: updated });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/changes/:id/reject ────────────────────────────────────────────

async function rejectChange(req, res, next) {
  try {
    const { comment } = req.body;

    const {
      rows: [change],
    } = await pool.query('SELECT * FROM change_requests WHERE id = $1', [req.params.id]);
    if (!change) return res.status(404).json({ error: 'Change request not found' });
    if (change.status !== 'Submitted') {
      return res.status(400).json({ error: 'Change request is not pending approval' });
    }

    await pool.query(
      `INSERT INTO change_approvals (change_id, approver_id, status, comment, reviewed_at)
       VALUES ($1,$2,'rejected',$3,NOW())
       ON CONFLICT (change_id, approver_id)
       DO UPDATE SET status='rejected', comment=$3, reviewed_at=NOW()`,
      [change.id, req.user.userId, comment || null]
    );

    const {
      rows: [updated],
    } = await pool.query(
      `UPDATE change_requests SET status = 'Rejected', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [change.id]
    );

    if (change.requester_id) {
      const reason = comment ? ` Reason: ${comment}` : '';
      await pool.query(
        `INSERT INTO notifications (user_id, ticket_id, type, message)
         VALUES ($1,NULL,'approval_resolved',$2)`,
        [
          change.requester_id,
          `Your change request #${change.id} "${change.title}" was rejected.${reason}`,
        ]
      );
    }

    res.json({ change: updated });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/changes/:id/link ───────────────────────────────────────────────

async function linkChangeTickets(req, res, next) {
  try {
    const { ticket_ids } = req.body;
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({ error: 'ticket_ids must be a non-empty array' });
    }
    await Promise.all(
      ticket_ids.map((tid) =>
        pool.query(
          `INSERT INTO change_tickets (change_id, ticket_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [req.params.id, tid]
        )
      )
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChanges, createChange, getChange, updateChange,
  submitChange, approveChange, rejectChange, linkChangeTickets,
};
