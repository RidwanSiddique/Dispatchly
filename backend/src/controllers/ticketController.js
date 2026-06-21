const pool = require('../db/pool');
const { SLA_MINUTES, ESCALATION_TEAMS, REQUESTER_ROLES } = require('../config/constants');
const { enrich } = require('../utils/sla');

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Build a dynamic WHERE clause from optional filter values.
 * Supports role-based visibility filters (created_by_user_id, assigned_to_user_id).
 */
function buildWhere(filters) {
  const conditions = [];
  const values = [];
  let n = 1;
  const p = () => n++;

  if (filters.status) {
    conditions.push(`t.status = $${p()}`);
    values.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${p()}`);
    values.push(filters.priority);
  }
  if (filters.type) {
    conditions.push(`t.type = $${p()}`);
    values.push(filters.type);
  }
  if (filters.category) {
    conditions.push(`t.category = $${p()}`);
    values.push(filters.category);
  }
  if (filters.created_by_user_id != null) {
    conditions.push(`t.created_by_user_id = $${p()}`);
    values.push(filters.created_by_user_id);
  }
  if (filters.assigned_to_user_id != null) {
    conditions.push(`t.assigned_to_user_id = $${p()}`);
    values.push(filters.assigned_to_user_id);
  }
  if (filters.search) {
    const i = p();
    conditions.push(`(t.title ILIKE $${i} OR t.requester_name ILIKE $${i} OR t.description ILIKE $${i})`);
    values.push(`%${filters.search}%`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    nextN: () => n,
  };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/tickets
 * Query: status, priority, type, category, search, page, limit
 */
const getTickets = async (req, res, next) => {
  try {
    const { status, priority, type, category, search, page = 1, limit = 25 } = req.query;
    const { role, userId } = req.user;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Role-based visibility
    const roleFilters = {};
    if (REQUESTER_ROLES.includes(role)) {
      roleFilters.created_by_user_id = userId;
    } else if (role === 'technician') {
      roleFilters.assigned_to_user_id = userId;
    }

    const { where, values, nextN } = buildWhere({ status, priority, type, category, search, ...roleFilters });

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM tickets t ${where}`,
      values
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const n = nextN();
    const ticketsRes = await pool.query(
      `SELECT t.*,
              au.name AS assigned_to_name,
              cu.name AS created_by_name
       FROM tickets t
       LEFT JOIN users au ON t.assigned_to_user_id = au.id
       LEFT JOIN users cu ON t.created_by_user_id  = cu.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${n} OFFSET $${n + 1}`,
      [...values, parseInt(limit, 10), offset]
    );

    res.json({
      tickets: ticketsRes.rows.map(enrich),
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/tickets/:id
 */
const getTicket = async (req, res, next) => {
  try {
    const {
      rows: [ticket],
    } = await pool.query(
      `SELECT t.*,
              au.name AS assigned_to_name,
              cu.name AS created_by_name
       FROM tickets t
       LEFT JOIN users au ON t.assigned_to_user_id = au.id
       LEFT JOIN users cu ON t.created_by_user_id  = cu.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Role-based access check
    const { role, userId } = req.user;
    if (REQUESTER_ROLES.includes(role) && ticket.created_by_user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (role === 'technician' && ticket.assigned_to_user_id !== userId) {
      return res.status(403).json({ error: 'Access denied — ticket not assigned to you' });
    }

    const [commentsRes, escalationsRes] = await Promise.all([
      pool.query('SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC', [
        ticket.id,
      ]),
      pool.query('SELECT * FROM escalations WHERE ticket_id = $1 ORDER BY escalated_at ASC', [
        ticket.id,
      ]),
    ]);

    let kbArticle = null;
    if (ticket.kb_article_id) {
      const {
        rows: [art],
      } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [ticket.kb_article_id]);
      kbArticle = art ?? null;
    }

    res.json({
      ...enrich(ticket),
      comments: commentsRes.rows,
      escalations: escalationsRes.rows,
      kbArticle,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets
 */
const createTicket = async (req, res, next) => {
  try {
    const { role, userId, name: userName, email: userEmail, department: userDept } = req.user;
    const isRequester = REQUESTER_ROLES.includes(role);

    const {
      requester_name = isRequester ? userName : undefined,
      requester_email = isRequester ? userEmail : undefined,
      department = isRequester ? userDept : undefined,
      location,
      type = 'Incident',
      category,
      title,
      description,
    } = req.body;

    // Requester roles cannot set priority — fixed to P3
    const priority = isRequester ? 'P3' : (req.body.priority ?? 'P3');
    const sla_minutes = SLA_MINUTES[priority] ?? SLA_MINUTES.P3;

    if (!requester_name) {
      return res.status(400).json({ error: 'requester_name is required' });
    }

    const {
      rows: [ticket],
    } = await pool.query(
      `INSERT INTO tickets
         (requester_name, requester_email, department, location,
          type, priority, category, title, description, sla_minutes,
          created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        requester_name,
        requester_email,
        department,
        location,
        type,
        priority,
        category,
        title,
        description,
        sla_minutes,
        userId,
      ]
    );

    res.status(201).json(enrich(ticket));
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/tickets/:id
 */
const updateTicket = async (req, res, next) => {
  try {
    const { role } = req.user;
    const ALLOWED = [
      'status',
      'priority',
      'category',
      'title',
      'description',
      'resolution_notes',
      'resolved_at',
      'closed_at',
      'kb_article_id',
    ];
    // Only admin/manager can reassign tickets
    if (['admin', 'manager'].includes(role)) ALLOWED.push('assigned_to_user_id');

    const sets = [];
    const values = [];

    // Auto-timestamps for status transitions
    if (req.body.status === 'Resolved' && req.body.resolved_at === undefined) {
      req.body.resolved_at = new Date();
    }
    if (req.body.status === 'Closed' && req.body.closed_at === undefined) {
      req.body.closed_at = new Date();
    }

    ALLOWED.forEach((key) => {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${values.length + 1}`);
        values.push(req.body[key]);
      }
    });

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    sets.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());
    values.push(req.params.id); // for WHERE

    const {
      rows: [ticket],
    } = await pool.query(
      `UPDATE tickets SET ${sets.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(enrich(ticket));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/:id/escalate
 */
const escalateTicket = async (req, res, next) => {
  try {
    const { reason, escalated_to_team, escalated_by } = req.body;
    if (!reason) return res.status(400).json({ error: 'Escalation reason is required' });

    const {
      rows: [ticket],
    } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (['Resolved', 'Closed'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Cannot escalate a resolved or closed ticket' });
    }

    const team = escalated_to_team || ESCALATION_TEAMS[ticket.category] || 'Tier 2 Support';

    const [
      {
        rows: [escalation],
      },
      {
        rows: [updated],
      },
    ] = await Promise.all([
      pool.query(
        `INSERT INTO escalations (ticket_id, reason, escalated_to_team, escalated_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [ticket.id, reason, team, escalated_by || req.user.name || 'Tier 1 Agent']
      ),
      pool.query(
        `UPDATE tickets SET status = 'Escalated', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [ticket.id]
      ),
    ]);

    res.json({ ticket: enrich(updated), escalation });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/:id/comments
 */
const addComment = async (req, res, next) => {
  try {
    const { body, is_internal = false } = req.body;
    if (!body) return res.status(400).json({ error: 'Comment body is required' });

    const { role, userId, name: userName } = req.user;

    // Requester roles cannot post internal notes
    const internal = REQUESTER_ROLES.includes(role) ? false : Boolean(is_internal);

    const {
      rows: [ticket],
    } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Requesters can only comment on their own tickets
    if (REQUESTER_ROLES.includes(role) && ticket.created_by_user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [
      {
        rows: [comment],
      },
    ] = await Promise.all([
      pool.query(
        `INSERT INTO ticket_comments (ticket_id, author, body, is_internal)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [ticket.id, req.body.author || userName || 'Agent', body, internal]
      ),
      // Auto-advance New → In Progress on first staff comment
      ticket.status === 'New' && !REQUESTER_ROLES.includes(role)
        ? pool.query(
            `UPDATE tickets SET status = 'In Progress', updated_at = NOW() WHERE id = $1`,
            [ticket.id]
          )
        : Promise.resolve(),
    ]);

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/:id/convert-to-kb
 */
const convertToKb = async (req, res, next) => {
  try {
    const {
      rows: [ticket],
    } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!['Resolved', 'Closed'].includes(ticket.status)) {
      return res
        .status(400)
        .json({ error: 'Only resolved tickets can be converted to KB articles' });
    }

    const { title, symptoms, resolution_steps, tags = [], author } = req.body;

    const {
      rows: [article],
    } = await pool.query(
      `INSERT INTO kb_articles
         (title, symptoms, resolution_steps, category, author, is_published, source_ticket_id)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6)
       RETURNING *`,
      [
        title || ticket.title,
        symptoms || ticket.description,
        resolution_steps || ticket.resolution_notes || '',
        ticket.category,
        author || req.user.name || 'Agent',
        ticket.id,
      ]
    );

    if (tags.length > 0) {
      const tagValues = tags.map((_, i) => `($1, $${i + 2})`).join(', ');
      await pool.query(`INSERT INTO kb_tags (article_id, tag) VALUES ${tagValues}`, [
        article.id,
        ...tags.map((t) => t.trim()),
      ]);
    }

    await pool.query('UPDATE tickets SET kb_article_id = $1, updated_at = NOW() WHERE id = $2', [
      article.id,
      ticket.id,
    ]);

    const { rows: insertedTags } = await pool.query(
      'SELECT tag FROM kb_tags WHERE article_id = $1',
      [article.id]
    );

    res.status(201).json({ ...article, tags: insertedTags.map((t) => t.tag) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  escalateTicket,
  addComment,
  convertToKb,
};
