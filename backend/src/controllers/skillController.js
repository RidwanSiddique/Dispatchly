const pool = require('../db/pool');
const { canManageUser } = require('../middleware/rbac');

// ─── Skills catalogue ─────────────────────────────────────────────────────────

const getSkills = async (req, res, next) => {
  try {
    const { category, active } = req.query;
    const conditions = [];
    const vals = [];
    if (category) { conditions.push(`s.category = $${vals.length + 1}`); vals.push(category); }
    if (active !== undefined) { conditions.push(`s.is_active = $${vals.length + 1}`); vals.push(active !== 'false'); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*)::int FROM user_skills us WHERE us.skill_id = s.id) AS user_count
      FROM skills s ${where}
      ORDER BY s.category, s.name
    `, vals);

    // Group by category
    const byCategory = {};
    rows.forEach((s) => {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    });

    res.json({ skills: rows, byCategory });
  } catch (err) { next(err); }
};

const createSkill = async (req, res, next) => {
  try {
    const { name, category = 'General', description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows: [skill] } = await pool.query(`
      INSERT INTO skills (name, category, description) VALUES ($1,$2,$3) RETURNING *
    `, [name, category, description || null]);
    res.status(201).json({ skill });
  } catch (err) { next(err); }
};

const updateSkill = async (req, res, next) => {
  try {
    const ALLOWED = ['name','category','description','is_active'];
    const sets = [], vals = [];
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) { sets.push(`${k} = $${vals.length + 1}`); vals.push(req.body[k]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(req.params.id);
    const { rows: [skill] } = await pool.query(
      `UPDATE skills SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!skill) return res.status(404).json({ error: 'Not found' });
    res.json({ skill });
  } catch (err) { next(err); }
};

// ─── User skills ──────────────────────────────────────────────────────────────

const getUserSkills = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.userId;
    const { rows } = await pool.query(`
      SELECT
        us.*,
        s.name AS skill_name, s.category, s.description,
        v.name AS verified_by_name
      FROM user_skills us
      JOIN skills s ON s.id = us.skill_id
      LEFT JOIN users v ON v.id = us.verified_by
      WHERE us.user_id = $1
      ORDER BY s.category, s.name
    `, [userId]);
    res.json({ userSkills: rows });
  } catch (err) { next(err); }
};

const assignSkillToUser = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const { skill_id, proficiency_level = 1, notes } = req.body;

    if (!skill_id) return res.status(400).json({ error: 'skill_id is required' });

    // Permission: can assign if same user (assign:own) or manager (assign:reports) or admin
    const canSelf   = targetUserId === req.user.userId;
    const canReport = await canManageUser(req.user.userId, targetUserId, req.user.role);
    if (!canSelf && !canReport) {
      return res.status(403).json({ error: 'Cannot assign skills to this user' });
    }

    const { rows: [us] } = await pool.query(`
      INSERT INTO user_skills (user_id, skill_id, proficiency_level, notes)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id, skill_id)
      DO UPDATE SET proficiency_level = $3, notes = $4, updated_at = NOW()
      RETURNING *
    `, [targetUserId, skill_id, proficiency_level, notes || null]);
    res.status(201).json({ userSkill: us });
  } catch (err) { next(err); }
};

const verifyUserSkill = async (req, res, next) => {
  try {
    const { id } = req.params; // user_skills.id
    const { rows: [us] } = await pool.query(`
      UPDATE user_skills
      SET verified_by = $1, verified_at = NOW()
      WHERE id = $2 RETURNING *
    `, [req.user.userId, id]);
    if (!us) return res.status(404).json({ error: 'Not found' });
    res.json({ userSkill: us });
  } catch (err) { next(err); }
};

const removeUserSkill = async (req, res, next) => {
  try {
    const { userId, skillId } = req.params;
    const canReport = await canManageUser(req.user.userId, parseInt(userId, 10), req.user.role);
    if (!canReport) return res.status(403).json({ error: 'Cannot remove skills from this user' });
    await pool.query('DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2', [userId, skillId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ─── Ticket required skills ───────────────────────────────────────────────────

const getTicketSkills = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT trs.*, s.name AS skill_name, s.category
      FROM ticket_required_skills trs
      JOIN skills s ON s.id = trs.skill_id
      WHERE trs.ticket_id = $1
    `, [req.params.ticketId]);
    res.json({ requiredSkills: rows });
  } catch (err) { next(err); }
};

const setTicketSkill = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { skill_id, required_proficiency = 1 } = req.body;
    if (!skill_id) return res.status(400).json({ error: 'skill_id required' });

    const { rows: [trs] } = await pool.query(`
      INSERT INTO ticket_required_skills (ticket_id, skill_id, required_proficiency)
      VALUES ($1,$2,$3)
      ON CONFLICT (ticket_id, skill_id)
      DO UPDATE SET required_proficiency = $3
      RETURNING *
    `, [ticketId, skill_id, required_proficiency]);
    res.status(201).json({ ticketSkill: trs });
  } catch (err) { next(err); }
};

const removeTicketSkill = async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM ticket_required_skills WHERE ticket_id = $1 AND skill_id = $2',
      [req.params.ticketId, req.params.skillId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ─── Suggest agents for a ticket based on skills ─────────────────────────────

const suggestAgentsForTicket = async (req, res, next) => {
  try {
    const { suggestAgents } = require('../services/skillsRouter');
    const { ticketId } = req.params;
    const { department_id } = req.query;
    const agents = await suggestAgents(ticketId, department_id ? parseInt(department_id) : null);
    res.json({ agents });
  } catch (err) { next(err); }
};

module.exports = {
  getSkills, createSkill, updateSkill,
  getUserSkills, assignSkillToUser, verifyUserSkill, removeUserSkill,
  getTicketSkills, setTicketSkill, removeTicketSkill,
  suggestAgentsForTicket,
};
