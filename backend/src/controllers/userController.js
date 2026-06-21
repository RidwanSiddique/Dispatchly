const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { ROLES } = require('../config/constants');

const SAFE_FIELDS = 'id, email, name, role, department, is_active, availability_status, skills, created_at, updated_at';

// ─── GET /api/users ───────────────────────────────────────────────────────────

const getUsers = async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS} FROM users ORDER BY role ASC, name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

const getUser = async (req, res, next) => {
  try {
    const {
      rows: [user],
    } = await pool.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`, [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/users ──────────────────────────────────────────────────────────

const createUser = async (req, res, next) => {
  try {
    const { email, password, name, role = 'client', department } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = await bcrypt.hash(password, 12);

    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SAFE_FIELDS}`,
      [email.trim().toLowerCase(), hash, name.trim(), role, department || null]
    );

    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on email
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    next(err);
  }
};

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

const updateUser = async (req, res, next) => {
  try {
    const ALLOWED = ['name', 'role', 'department', 'is_active'];
    const sets = [];
    const values = [];

    // Password change
    if (req.body.password) {
      if (req.body.password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      sets.push(`password_hash = $${values.length + 1}`);
      values.push(await bcrypt.hash(req.body.password, 12));
    }

    ALLOWED.forEach((key) => {
      if (req.body[key] !== undefined) {
        if (key === 'role' && !ROLES.includes(req.body[key])) return;
        sets.push(`${key} = $${values.length + 1}`);
        values.push(req.body[key]);
      }
    });

    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    sets.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());
    values.push(req.params.id);

    const {
      rows: [user],
    } = await pool.query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${values.length}
       RETURNING ${SAFE_FIELDS}`,
      values
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent demoting the last admin
    if (req.body.role && req.body.role !== 'admin') {
      const {
        rows: [{ count }],
      } = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = TRUE`);
      if (parseInt(count, 10) === 0) {
        // Revert — can't remove the last admin
        await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [req.params.id]);
        return res.status(400).json({ error: 'Cannot remove the last admin account' });
      }
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/users/:id (soft-delete / deactivate) ────────────────────────

const deactivateUser = async (req, res, next) => {
  try {
    // Cannot deactivate yourself
    if (parseInt(req.params.id, 10) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const {
      rows: [user],
    } = await pool.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING ${SAFE_FIELDS}`,
      [req.params.id]
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/staff — staff users for assignment dropdowns ────────────────────
// Accessible to admin + manager (non-admin staff can also see this for routing purposes)

const getStaff = async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS}
       FROM users
       WHERE role IN ('admin','manager','agent','technician','specialist')
         AND is_active = TRUE
       ORDER BY role ASC, name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/users/me/availability ─────────────────────────────────────────

const updateAvailability = async (req, res, next) => {
  try {
    const { availability_status } = req.body;
    const VALID = ['available', 'on_call', 'offline', 'busy'];
    if (!VALID.includes(availability_status)) {
      return res.status(400).json({ error: `availability_status must be one of: ${VALID.join(', ')}` });
    }
    const {
      rows: [user],
    } = await pool.query(
      `UPDATE users SET availability_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING ${SAFE_FIELDS}`,
      [availability_status, req.user.userId]
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/users/:id/skills ─────────────────────────────────────────────

const updateSkills = async (req, res, next) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'skills must be an array' });
    }
    const {
      rows: [user],
    } = await pool.query(
      `UPDATE users SET skills = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING ${SAFE_FIELDS}`,
      [skills, req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers, getUser, createUser, updateUser, deactivateUser,
  getStaff, updateAvailability, updateSkills,
};
