/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  // ── Departments (support sub-departments via parent_id) ──────────────────────
  await client.query(`
    CREATE TABLE departments (
      id                    SERIAL PRIMARY KEY,
      name                  TEXT NOT NULL UNIQUE,
      code                  TEXT UNIQUE,                        -- e.g. "IT", "HR"
      description           TEXT,
      head_user_id          INT REFERENCES users(id) ON DELETE SET NULL,
      parent_department_id  INT REFERENCES departments(id) ON DELETE SET NULL,
      is_active             BOOLEAN NOT NULL DEFAULT TRUE,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Teams (belong to a department) ──────────────────────────────────────────
  await client.query(`
    CREATE TABLE teams (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      team_lead_id  INT REFERENCES users(id) ON DELETE SET NULL,
      description   TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (name, department_id)
    )
  `);

  // ── Team membership ──────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE team_members (
      id        SERIAL PRIMARY KEY,
      team_id   INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_lead   BOOLEAN NOT NULL DEFAULT FALSE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (team_id, user_id)
    )
  `);

  // ── Extend users table with hierarchy fields ──────────────────────────────────
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS department_id   INT  REFERENCES departments(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS team_id         INT  REFERENCES teams(id)       ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS manager_id      INT  REFERENCES users(id)       ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS title           TEXT,
      ADD COLUMN IF NOT EXISTS employee_number TEXT UNIQUE
  `);

  // ── Indexes ──────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE INDEX idx_teams_department      ON teams(department_id);
    CREATE INDEX idx_team_members_team     ON team_members(team_id);
    CREATE INDEX idx_team_members_user     ON team_members(user_id);
    CREATE INDEX idx_users_department_id   ON users(department_id);
    CREATE INDEX idx_users_team_id         ON users(team_id);
    CREATE INDEX idx_users_manager_id      ON users(manager_id);
  `);

  // ── Seed default departments and teams ────────────────────────────────────────
  await client.query(`
    INSERT INTO departments (name, code, description) VALUES
      ('Information Technology', 'IT',  'IT support, infrastructure, and software systems'),
      ('Human Resources',        'HR',  'People operations, onboarding, and employee relations'),
      ('Customer Success',       'CS',  'External client support and account management'),
      ('Finance',                'FIN', 'Financial operations and reporting'),
      ('Operations',             'OPS', 'Internal operations and facilities')
    ON CONFLICT DO NOTHING
  `);

  await client.query(`
    INSERT INTO teams (name, department_id, description)
    SELECT name, d.id, desc
    FROM (VALUES
      ('Hardware Support',    'IT',  'Physical hardware and device repair'),
      ('Network Engineering', 'IT',  'Network infrastructure and connectivity'),
      ('Software Support',    'IT',  'Application and OS support'),
      ('Security',            'IT',  'Cybersecurity and access management'),
      ('Cloud & DevOps',      'IT',  'Cloud infrastructure and deployments'),
      ('HR Operations',       'HR',  'Onboarding, offboarding, and HR systems'),
      ('Client Support',      'CS',  'External client ticket handling')
    ) AS t(name, dept_code, desc)
    JOIN departments d ON d.code = t.dept_code
    ON CONFLICT DO NOTHING
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS department_id,
      DROP COLUMN IF EXISTS team_id,
      DROP COLUMN IF EXISTS manager_id,
      DROP COLUMN IF EXISTS title,
      DROP COLUMN IF EXISTS employee_number
  `);
  await client.query('DROP TABLE IF EXISTS team_members CASCADE');
  await client.query('DROP TABLE IF EXISTS teams CASCADE');
  await client.query('DROP TABLE IF EXISTS departments CASCADE');
};
