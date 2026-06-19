const pool = require('../db/pool');

// ─── Query helper ─────────────────────────────────────────────────────────────

function buildWhere(filters) {
  const conditions = ['is_published = TRUE'];
  const values = [];
  let n = 1;
  const p = () => n++;

  if (filters.category) {
    conditions.push(`category = $${p()}`);
    values.push(filters.category);
  }
  if (filters.search) {
    const i = p();
    conditions.push(`(title ILIKE $${i} OR symptoms ILIKE $${i} OR resolution_steps ILIKE $${i})`);
    values.push(`%${filters.search}%`);
  }
  if (filters.tag) {
    conditions.push(`id IN (SELECT article_id FROM kb_tags WHERE tag ILIKE $${p()})`);
    values.push(`%${filters.tag}%`);
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, values, nextN: () => n };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTagsForArticles(ids) {
  if (ids.length === 0) return {};
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `SELECT article_id, tag FROM kb_tags WHERE article_id IN (${placeholders})`,
    ids
  );
  return rows.reduce((acc, r) => {
    if (!acc[r.article_id]) acc[r.article_id] = [];
    acc[r.article_id].push(r.tag);
    return acc;
  }, {});
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/kb
 * Query: search, category, tag, page, limit
 */
const getArticles = async (req, res, next) => {
  try {
    const { search, category, tag, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { where, values, nextN } = buildWhere({ search, category, tag });

    const countRes = await pool.query(`SELECT COUNT(*) FROM kb_articles ${where}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const n = nextN();
    const { rows: articles } = await pool.query(
      `SELECT * FROM kb_articles ${where}
       ORDER BY created_at DESC
       LIMIT $${n} OFFSET $${n + 1}`,
      [...values, parseInt(limit, 10), offset]
    );

    const tagMap = await fetchTagsForArticles(articles.map((a) => a.id));

    res.json({
      articles: articles.map((a) => ({ ...a, tags: tagMap[a.id] ?? [] })),
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/kb/:id
 */
const getArticle = async (req, res, next) => {
  try {
    const {
      rows: [article],
    } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [req.params.id]);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const [tagsRes, ticketRes] = await Promise.all([
      pool.query('SELECT tag FROM kb_tags WHERE article_id = $1', [article.id]),
      article.source_ticket_id
        ? pool.query(
            `SELECT id, title, type, priority, category, created_at
             FROM tickets WHERE id = $1`,
            [article.source_ticket_id]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      ...article,
      tags: tagsRes.rows.map((r) => r.tag),
      sourceTicket: ticketRes.rows[0] ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/kb
 */
const createArticle = async (req, res, next) => {
  try {
    const { title, symptoms, resolution_steps, category, author = 'Agent', tags = [] } = req.body;

    const {
      rows: [article],
    } = await pool.query(
      `INSERT INTO kb_articles (title, symptoms, resolution_steps, category, author)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, symptoms, resolution_steps, category, author]
    );

    if (tags.length > 0) {
      const placeholders = tags.map((_, i) => `($1, $${i + 2})`).join(', ');
      await pool.query(`INSERT INTO kb_tags (article_id, tag) VALUES ${placeholders}`, [
        article.id,
        ...tags.map((t) => t.trim()),
      ]);
    }

    const { rows: insertedTags } = await pool.query(
      'SELECT tag FROM kb_tags WHERE article_id = $1',
      [article.id]
    );

    res.status(201).json({ ...article, tags: insertedTags.map((r) => r.tag) });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/kb/:id
 */
const updateArticle = async (req, res, next) => {
  try {
    const ALLOWED = ['title', 'symptoms', 'resolution_steps', 'category', 'is_published'];
    const sets = [];
    const values = [];

    ALLOWED.forEach((key) => {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${values.length + 1}`);
        values.push(req.body[key]);
      }
    });

    if (sets.length === 0 && req.body.tags === undefined) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    let article;
    if (sets.length > 0) {
      sets.push(`updated_at = $${values.length + 1}`);
      values.push(new Date());
      values.push(req.params.id);

      const {
        rows: [updated],
      } = await pool.query(
        `UPDATE kb_articles SET ${sets.join(', ')}
         WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!updated) return res.status(404).json({ error: 'Article not found' });
      article = updated;
    } else {
      const {
        rows: [existing],
      } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Article not found' });
      article = existing;
    }

    if (req.body.tags !== undefined) {
      await pool.query('DELETE FROM kb_tags WHERE article_id = $1', [article.id]);
      if (req.body.tags.length > 0) {
        const placeholders = req.body.tags.map((_, i) => `($1, $${i + 2})`).join(', ');
        await pool.query(`INSERT INTO kb_tags (article_id, tag) VALUES ${placeholders}`, [
          article.id,
          ...req.body.tags.map((t) => t.trim()),
        ]);
      }
    }

    const { rows: tags } = await pool.query('SELECT tag FROM kb_tags WHERE article_id = $1', [
      article.id,
    ]);

    res.json({ ...article, tags: tags.map((r) => r.tag) });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/kb/:id
 */
const deleteArticle = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM kb_articles WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { getArticles, getArticle, createArticle, updateArticle, deleteArticle };
