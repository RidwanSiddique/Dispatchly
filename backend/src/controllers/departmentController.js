const pool = require('../db/pool');

// ─── Departments ──────────────────────────────────────────────────────────────

const getDepartments = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        d.*,
        u.name                                    AS head_name,
        u.email                                   AS head_email,
        p.name                                    AS parent_name,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id AND is_active = TRUE) AS member_count,
        (SELECT COUNT(*) FROM teams  WHERE department_id = d.id AND is_active = TRUE) AS team_count
      FROM departments d
      LEFT JOIN users        u ON u.id = d.head_user_id
      LEFT JOIN departments  p ON p.id = d.parent_department_id
      ORDER BY d.parent_department_id NULLS FIRST, d.name
    `);
    res.json({ departments: rows });
  } catch (err) { next(err); }
};

const getDepartment = async (req, res, next) => {
  try {
    const { rows: [dept] } = await pool.query(`
      SELECT d.*, u.name AS head_name, p.name AS parent_name
      FROM departments d
      LEFT JOIN users u ON u.id = d.head_user_id
      LEFT JOIN departments p ON p.id = d.parent_department_id
      WHERE d.id = $1
    `, [req.params.id]);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const [teamsRes, membersRes] = await Promise.all([
      pool.query(`
        SELECT t.*, u.name AS lead_name,
               (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
        FROM teams t
        LEFT JOIN users u ON u.id = t.team_lead_id
        WHERE t.department_id = $1 ORDER BY t.name
      `, [dept.id]),
      pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.title, u.current_status,
               u.team_id, t.name AS team_name
        FROM users u
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.department_id = $1 AND u.is_active = TRUE
        ORDER BY u.role, u.name
      `, [dept.id]),
    ]);

    res.json({ department: dept, teams: teamsRes.rows, members: membersRes.rows });
  } catch (err) { next(err); }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, head_user_id, parent_department_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [dept] } = await pool.query(`
      INSERT INTO departments (name, code, description, head_user_id, parent_department_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [name, code || null, description || null, head_user_id || null, parent_department_id || null]);
    res.status(201).json({ department: dept });
  } catch (err) { next(err); }
};

const updateDepartment = async (req, res, next) => {
  try {
    const ALLOWED = ['name','code','description','head_user_id','parent_department_id','is_active'];
    const sets = [], vals = [];
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) { sets.push(`${k} = $${vals.length + 1}`); vals.push(req.body[k]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows: [dept] } = await pool.query(
      `UPDATE departments SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!dept) return res.status(404).json({ error: 'Not found' });
    res.json({ department: dept });
  } catch (err) { next(err); }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const { rows: [dept] } = await pool.query(
      `UPDATE departments SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!dept) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ─── Teams ────────────────────────────────────────────────────────────────────

const getTeams = async (req, res, next) => {
  try {
    const deptFilter = req.query.department_id
      ? 'WHERE t.department_id = $1'
      : '';
    const vals = req.query.department_id ? [req.query.department_id] : [];
    const { rows } = await pool.query(`
      SELECT
        t.*,
        d.name AS department_name,
        d.code AS department_code,
        u.name AS lead_name,
        u.email AS lead_email,
        (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
      FROM teams t
      JOIN departments d ON d.id = t.department_id
      LEFT JOIN users u ON u.id = t.team_lead_id
      ${deptFilter}
      ORDER BY d.name, t.name
    `, vals);
    res.json({ teams: rows });
  } catch (err) { next(err); }
};

const getTeam = async (req, res, next) => {
  try {
    const { rows: [team] } = await pool.query(`
      SELECT t.*, d.name AS department_name, u.name AS lead_name
      FROM teams t
      JOIN departments d ON d.id = t.department_id
      LEFT JOIN users u ON u.id = t.team_lead_id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { rows: members } = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.title,
        u.current_status, u.current_status_since,
        tm.is_lead, tm.joined_at
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1 AND u.is_active = TRUE
      ORDER BY tm.is_lead DESC, u.name
    `, [team.id]);

    res.json({ team, members });
  } catch (err) { next(err); }
};

const createTeam = async (req, res, next) => {
  try {
    const { name, department_id, team_lead_id, description } = req.body;
    if (!name || !department_id) return res.status(400).json({ error: 'name and department_id required' });

    const { rows: [team] } = await pool.query(`
      INSERT INTO teams (name, department_id, team_lead_id, description)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [name, department_id, team_lead_id || null, description || null]);
    res.status(201).json({ team });
  } catch (err) { next(err); }
};

const updateTeam = async (req, res, next) => {
  try {
    const ALLOWED = ['name','department_id','team_lead_id','description','is_active'];
    const sets = [], vals = [];
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) { sets.push(`${k} = $${vals.length + 1}`); vals.push(req.body[k]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows: [team] } = await pool.query(
      `UPDATE teams SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!team) return res.status(404).json({ error: 'Not found' });
    res.json({ team });
  } catch (err) { next(err); }
};

// ─── Team membership ──────────────────────────────────────────────────────────

const addTeamMember = async (req, res, next) => {
  try {
    const { team_id } = req.params;
    const { user_id, is_lead = false } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    await pool.query(`
      INSERT INTO team_members (team_id, user_id, is_lead)
      VALUES ($1,$2,$3)
      ON CONFLICT (team_id, user_id) DO UPDATE SET is_lead = $3
    `, [team_id, user_id, is_lead]);

    // Update user's primary team_id if not already set
    await pool.query(`
      UPDATE users SET team_id = $1 WHERE id = $2 AND team_id IS NULL
    `, [team_id, user_id]);

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
};

const removeTeamMember = async (req, res, next) => {
  try {
    const { team_id, user_id } = req.params;
    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [team_id, user_id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ─── Org chart (full hierarchy tree) ─────────────────────────────────────────

const getOrgChart = async (req, res, next) => {
  try {
    const [depts, teams, members] = await Promise.all([
      pool.query(`
        SELECT d.*, u.name AS head_name FROM departments d
        LEFT JOIN users u ON u.id = d.head_user_id
        WHERE d.is_active = TRUE ORDER BY d.parent_department_id NULLS FIRST, d.name
      `),
      pool.query(`
        SELECT t.*, u.name AS lead_name
        FROM teams t LEFT JOIN users u ON u.id = t.team_lead_id
        WHERE t.is_active = TRUE ORDER BY t.name
      `),
      pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.title,
               u.current_status, u.department_id, u.team_id, u.manager_id,
               m.name AS manager_name,
               t.name AS team_name
        FROM users u
        LEFT JOIN users m ON m.id = u.manager_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.is_active = TRUE
        ORDER BY u.name
      `),
    ]);

    // Build tree structure
    const deptMap = {};
    depts.rows.forEach((d) => {
      deptMap[d.id] = { ...d, children: [], teams: [] };
    });
    depts.rows.forEach((d) => {
      if (d.parent_department_id && deptMap[d.parent_department_id]) {
        deptMap[d.parent_department_id].children.push(deptMap[d.id]);
      }
    });

    teams.rows.forEach((t) => {
      if (deptMap[t.department_id]) {
        deptMap[t.department_id].teams.push({
          ...t,
          members: members.rows.filter((m) => m.team_id === t.id),
        });
      }
    });

    const roots = Object.values(deptMap).filter((d) => !d.parent_department_id);
    res.json({ tree: roots, users: members.rows });
  } catch (err) { next(err); }
};

// ─── User reporting chain ─────────────────────────────────────────────────────

const getUserHierarchy = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.userId;

    // Direct reports
    const [userRes, reportsRes, chainRes] = await Promise.all([
      pool.query(`
        SELECT u.*, m.name AS manager_name, d.name AS department_name, t.name AS team_name
        FROM users u
        LEFT JOIN users m ON m.id = u.manager_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = $1
      `, [userId]),
      pool.query(`
        SELECT id, name, email, role, title, current_status, team_id
        FROM users WHERE manager_id = $1 AND is_active = TRUE ORDER BY name
      `, [userId]),
      // Walk up the reporting chain
      pool.query(`
        WITH RECURSIVE chain AS (
          SELECT id, name, role, title, manager_id, 0 AS depth
          FROM users WHERE id = $1
          UNION ALL
          SELECT u.id, u.name, u.role, u.title, u.manager_id, c.depth + 1
          FROM users u JOIN chain c ON u.id = c.manager_id
          WHERE c.depth < 10
        )
        SELECT * FROM chain ORDER BY depth
      `, [userId]),
    ]);

    res.json({
      user: userRes.rows[0] || null,
      directReports: reportsRes.rows,
      reportingChain: chainRes.rows,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  getTeams, getTeam, createTeam, updateTeam,
  addTeamMember, removeTeamMember,
  getOrgChart, getUserHierarchy,
};
