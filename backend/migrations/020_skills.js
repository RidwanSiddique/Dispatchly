/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  // ── Skill catalogue ──────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE skills (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      category    TEXT NOT NULL DEFAULT 'General',
      description TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── User → skill assignments with proficiency 1-5 ────────────────────────────
  await client.query(`
    CREATE TABLE user_skills (
      id                SERIAL PRIMARY KEY,
      user_id           INT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      skill_id          INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      proficiency_level INT NOT NULL DEFAULT 1
                          CHECK (proficiency_level BETWEEN 1 AND 5),
      notes             TEXT,
      verified_by       INT REFERENCES users(id) ON DELETE SET NULL,
      verified_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, skill_id)
    )
  `);

  // ── Required skills per ticket (set at creation or by agent) ─────────────────
  await client.query(`
    CREATE TABLE ticket_required_skills (
      id                   SERIAL PRIMARY KEY,
      ticket_id            INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      skill_id             INT NOT NULL REFERENCES skills(id)  ON DELETE CASCADE,
      required_proficiency INT NOT NULL DEFAULT 1
                             CHECK (required_proficiency BETWEEN 1 AND 5),
      UNIQUE (ticket_id, skill_id)
    )
  `);

  await client.query(`
    CREATE INDEX idx_user_skills_user    ON user_skills(user_id);
    CREATE INDEX idx_user_skills_skill   ON user_skills(skill_id);
    CREATE INDEX idx_ticket_skills       ON ticket_required_skills(ticket_id);
  `);

  // ── Seed default skills ───────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO skills (name, category, description) VALUES
      -- Hardware
      ('Hardware Repair',          'Hardware',   'Physical hardware diagnosis and repair'),
      ('Printer Support',          'Hardware',   'Printer, scanner, and peripheral support'),
      ('Mobile Device Management', 'Hardware',   'Smartphone and tablet provisioning'),
      -- Network
      ('Network Configuration',    'Network',    'LAN/WAN/VPN setup and troubleshooting'),
      ('Firewall & Security',      'Network',    'Firewall rules and network security'),
      ('Wi-Fi & Wireless',         'Network',    'Wireless network installation and support'),
      -- Software & OS
      ('Windows Administration',   'Software',   'Windows OS support and administration'),
      ('Linux Administration',     'Software',   'Linux/Unix OS support and administration'),
      ('macOS Support',            'Software',   'Apple macOS desktop support'),
      ('Microsoft 365',            'Software',   'Office 365, Teams, Exchange administration'),
      ('Application Support',      'Software',   'Business application troubleshooting'),
      -- Identity & Cloud
      ('Active Directory',         'Identity',   'AD/LDAP user and group management'),
      ('SSO & MFA',                'Identity',   'Single sign-on and multi-factor auth'),
      ('Cloud Services (AWS)',     'Cloud',      'Amazon Web Services administration'),
      ('Cloud Services (Azure)',   'Cloud',      'Microsoft Azure administration'),
      ('Cloud Services (GCP)',     'Cloud',      'Google Cloud Platform administration'),
      -- Database & Security
      ('Database Administration',  'Database',   'SQL/NoSQL database management'),
      ('Security Incidents',       'Security',   'Cybersecurity incident response and forensics'),
      ('Vulnerability Management', 'Security',   'Patch management and CVE remediation'),
      -- Soft skills
      ('Customer Service',         'Soft Skills','Client-facing communication and de-escalation'),
      ('Change Management',        'Process',    'ITIL change management processes'),
      ('ITIL Fundamentals',        'Process',    'ITIL framework knowledge')
    ON CONFLICT DO NOTHING
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS ticket_required_skills CASCADE');
  await client.query('DROP TABLE IF EXISTS user_skills CASCADE');
  await client.query('DROP TABLE IF EXISTS skills CASCADE');
};
