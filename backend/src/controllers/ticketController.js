const pool = require('../db/pool');
const { SLA_MINUTES, ESCALATION_TEAMS } = require('../config/constants');

// ─── SLA computation (pure JS, no DB) ────────────────────────────────────────

function computeSla(ticket) {
  if (['Resolved', 'Closed'].includes(ticket.status)) {
    return { status: 'Resolved', minutesRemaining: null, percentElapsed: 100 };
  }
  const elapsed = (Date.now() - new Date(ticket.created_at)) / 60000;
  const total = ticket.sla_minutes;
  const remaining = total - elapsed;
  const pct = Math.min(100, (elapsed / total) * 100);
  return {
    status: remaining < 0 ? 'Breached' : pct >= 75 ? 'At Risk' : 'On Track',
    minutesRemaining: Math.round(remaining),
    percentElapsed: Math.round(pct),
  };
}

function enrich(ticket) {
  return {
    ...ticket,
    sla: computeSla(ticket),
    suggestedEscalationTeam: ESCALATION_TEAMS[ticket.category] ?? null,
  };
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Build a dynamic WHERE clause from optional filter values.
 * Returns { where: string, values: any[], nextParam: () => number }
 */
function buildWhere(filters) {
  const conditions = [];
  const values = [];
  let n = 1;
  const p = () => n++;

  if (filters.status) {
    conditions.push(`status = $${p()}`);
    values.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`priority = $${p()}`);
    values.push(filters.priority);
  }
  if (filters.type) {
    conditions.push(`type = $${p()}`);
    values.push(filters.type);
  }
  if (filters.category) {
    conditions.push(`category = $${p()}`);
    values.push(filters.category);
  }
  if (filters.search) {
    const i = p();
    conditions.push(`(title ILIKE $${i} OR requester_name ILIKE $${i} OR description ILIKE $${i})`);
    values.push(`%${filters.search}%`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    // returns next available $N index
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
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { where, values, nextN } = buildWhere({ status, priority, type, category, search });

    const countRes = await pool.query(`SELECT COUNT(*) FROM tickets ${where}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const n = nextN();
    const ticketsRes = await pool.query(
      `SELECT * FROM tickets ${where}
       ORDER BY created_at DESC
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
    } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

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
    const {
      requester_name,
      requester_email,
      department,
      location,
      type = 'Incident',
      priority = 'P3',
      category,
      title,
      description,
    } = req.body;

    const sla_minutes = SLA_MINUTES[priority] ?? SLA_MINUTES.P3;

    const {
      rows: [ticket],
    } = await pool.query(
      `INSERT INTO tickets
         (requester_name, requester_email, department, location,
          type, priority, category, title, description, sla_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
        [ticket.id, reason, team, escalated_by || 'Tier 1 Agent']
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
    const { body, author, is_internal = false } = req.body;
    if (!body) return res.status(400).json({ error: 'Comment body is required' });

    const {
      rows: [ticket],
    } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const [
      {
        rows: [comment],
      },
    ] = await Promise.all([
      pool.query(
        `INSERT INTO ticket_comments (ticket_id, author, body, is_internal)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [ticket.id, author || 'Agent', body, is_internal]
      ),
      // Auto-advance New → In Progress on first comment
      ticket.status === 'New'
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
        author || 'Agent',
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
