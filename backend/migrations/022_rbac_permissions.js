/**
 * Migration 022 — Granular RBAC
 *
 * Tables:
 *   permissions        — resource:action pairs
 *   role_permissions   — which permissions each role has by default
 *   user_permissions   — per-user overrides (grant or explicit deny)
 *
 * Permission inheritance (enforced in middleware, not DB):
 *   read:all      ⊇ read:team      ⊇ read:own
 *   update:all    ⊇ update:reports ⊇ update:own
 *   assign:all    ⊇ assign:reports ⊇ assign:own
 */

/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  // ── Permission catalogue ─────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE permissions (
      id          SERIAL PRIMARY KEY,
      resource    TEXT NOT NULL,
      action      TEXT NOT NULL,
      description TEXT,
      UNIQUE (resource, action)
    )
  `);

  // ── Role defaults ────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE role_permissions (
      id            SERIAL PRIMARY KEY,
      role          TEXT NOT NULL,
      permission_id INT  NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE (role, permission_id)
    )
  `);

  // ── Per-user overrides ───────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE user_permissions (
      id            SERIAL PRIMARY KEY,
      user_id       INT  NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
      permission_id INT  NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      granted       BOOLEAN NOT NULL DEFAULT TRUE,
      granted_by    INT  REFERENCES users(id) ON DELETE SET NULL,
      reason        TEXT,
      expires_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, permission_id)
    )
  `);

  await client.query(`
    CREATE INDEX idx_role_perms_role ON role_permissions(role);
    CREATE INDEX idx_user_perms_user ON user_permissions(user_id);
  `);

  // ── Seed permissions ─────────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO permissions (resource, action, description) VALUES
      -- Tickets
      ('tickets','create',           'Create new tickets'),
      ('tickets','read:own',         'Read tickets created by self'),
      ('tickets','read:team',        'Read tickets belonging to own team/department'),
      ('tickets','read:all',         'Read any ticket'),
      ('tickets','update:own',       'Update own tickets'),
      ('tickets','update:assigned',  'Update tickets assigned to self'),
      ('tickets','update:all',       'Update any ticket'),
      ('tickets','delete',           'Delete tickets'),
      ('tickets','assign',           'Assign tickets to users'),
      ('tickets','escalate',         'Escalate tickets'),
      ('tickets','approve',          'Approve ticket actions/changes'),
      ('tickets','close',            'Close resolved tickets'),
      ('tickets','comment:internal', 'Post internal/private comments'),
      -- Users
      ('users','create',             'Create user accounts'),
      ('users','read:own',           'Read own profile'),
      ('users','read:team',          'Read team member profiles'),
      ('users','read:all',           'Read any user profile'),
      ('users','update:own',         'Update own profile'),
      ('users','update:reports',     'Update direct reports profiles'),
      ('users','update:all',         'Update any user profile'),
      ('users','delete',             'Deactivate or delete users'),
      ('users','manage:roles',       'Assign roles to users'),
      -- Departments & Teams
      ('departments','read',         'View departments and teams'),
      ('departments','manage',       'Create/edit/delete departments and teams'),
      -- Skills
      ('skills','read',              'View skill catalogue'),
      ('skills','manage',            'Create/edit/delete skill definitions'),
      ('skills','assign:own',        'Add skills to own profile'),
      ('skills','assign:reports',    'Add skills to direct reports profiles'),
      ('skills','assign:all',        'Add skills to any user profile'),
      -- Work Schedules
      ('schedule','read:own',        'View own work schedule'),
      ('schedule','read:reports',    'View direct reports work schedules'),
      ('schedule','read:all',        'View all work schedules'),
      ('schedule','update:own',      'Update own work schedule'),
      ('schedule','update:reports',  'Update direct reports work schedules'),
      ('schedule','update:all',      'Update any work schedule'),
      -- Agent Status
      ('status','update:own',        'Change own availability status'),
      ('status','update:reports',    'Change direct reports status'),
      ('status','update:all',        'Change any users status'),
      ('status','read:all',          'View all agent statuses'),
      -- Knowledge Base
      ('kb','read',                  'Read knowledge base articles'),
      ('kb','create',                'Create KB articles'),
      ('kb','update',                'Update KB articles'),
      ('kb','delete',                'Delete KB articles'),
      -- Analytics
      ('analytics','read:own',       'View own performance metrics'),
      ('analytics','read:team',      'View team analytics'),
      ('analytics','read:all',       'View organisation-wide analytics'),
      -- Changes
      ('changes','create',           'Create change requests'),
      ('changes','read',             'View change requests'),
      ('changes','update',           'Update change requests'),
      ('changes','approve',          'Approve change requests (CAB)'),
      -- Problems
      ('problems','create',          'Create problem records'),
      ('problems','read',            'View problem records'),
      ('problems','update',          'Update problem records'),
      -- On-call
      ('oncall','read',              'View on-call schedule'),
      ('oncall','manage',            'Create/edit on-call rotations'),
      -- SLA
      ('sla','read',                 'View SLA definitions and ticket SLA status'),
      ('sla','manage',               'Create/edit SLA definitions and business hours'),
      -- System
      ('system','configure',         'Configure system settings (SMTP, SLA defaults, etc.)')
    ON CONFLICT DO NOTHING
  `);

  // ── Helper: grant permissions to a role ─────────────────────────────────────
  // We'll do this as a series of inserts using the permission IDs
  const grant = async (role, pairs) => {
    for (const [resource, action] of pairs) {
      await client.query(`
        INSERT INTO role_permissions (role, permission_id)
        SELECT $1, id FROM permissions WHERE resource = $2 AND action = $3
        ON CONFLICT DO NOTHING
      `, [role, resource, action]);
    }
  };

  // ── manager ──────────────────────────────────────────────────────────────────
  await grant('manager', [
    ['tickets','create'],['tickets','read:own'],['tickets','read:team'],['tickets','read:all'],
    ['tickets','update:all'],['tickets','assign'],['tickets','escalate'],['tickets','approve'],
    ['tickets','close'],['tickets','comment:internal'],
    ['users','create'],['users','read:own'],['users','read:team'],['users','read:all'],
    ['users','update:own'],['users','update:reports'],
    ['departments','read'],
    ['skills','read'],['skills','assign:reports'],
    ['schedule','read:own'],['schedule','read:reports'],['schedule','read:all'],
    ['schedule','update:own'],['schedule','update:reports'],
    ['status','update:own'],['status','update:reports'],['status','read:all'],
    ['kb','read'],['kb','create'],['kb','update'],['kb','delete'],
    ['analytics','read:own'],['analytics','read:team'],['analytics','read:all'],
    ['changes','create'],['changes','read'],['changes','update'],['changes','approve'],
    ['problems','create'],['problems','read'],['problems','update'],
    ['oncall','read'],['oncall','manage'],
    ['sla','read'],['sla','manage'],
  ]);

  // ── agent ────────────────────────────────────────────────────────────────────
  await grant('agent', [
    ['tickets','create'],['tickets','read:own'],['tickets','read:team'],['tickets','read:all'],
    ['tickets','update:assigned'],['tickets','update:all'],['tickets','assign'],
    ['tickets','escalate'],['tickets','close'],['tickets','comment:internal'],
    ['users','read:own'],['users','read:team'],['users','update:own'],
    ['departments','read'],
    ['skills','read'],['skills','assign:own'],
    ['schedule','read:own'],['schedule','update:own'],
    ['status','update:own'],
    ['kb','read'],['kb','create'],['kb','update'],
    ['analytics','read:own'],['analytics','read:team'],
    ['changes','create'],['changes','read'],['changes','update'],
    ['problems','create'],['problems','read'],['problems','update'],
    ['oncall','read'],
    ['sla','read'],
  ]);

  // ── technician ───────────────────────────────────────────────────────────────
  await grant('technician', [
    ['tickets','create'],['tickets','read:own'],['tickets','read:team'],
    ['tickets','update:assigned'],['tickets','close'],['tickets','comment:internal'],
    ['users','read:own'],['users','update:own'],
    ['departments','read'],
    ['skills','read'],['skills','assign:own'],
    ['schedule','read:own'],
    ['status','update:own'],
    ['kb','read'],
    ['analytics','read:own'],
    ['oncall','read'],
    ['sla','read'],
  ]);

  // ── specialist ───────────────────────────────────────────────────────────────
  await grant('specialist', [
    ['tickets','create'],['tickets','read:own'],['tickets','read:team'],['tickets','read:all'],
    ['tickets','update:assigned'],['tickets','update:all'],['tickets','escalate'],
    ['tickets','close'],['tickets','comment:internal'],
    ['users','read:own'],['users','read:team'],['users','update:own'],
    ['departments','read'],
    ['skills','read'],['skills','manage'],['skills','assign:all'],
    ['schedule','read:own'],
    ['status','update:own'],
    ['kb','read'],['kb','create'],['kb','update'],['kb','delete'],
    ['analytics','read:own'],['analytics','read:team'],
    ['changes','create'],['changes','read'],['changes','update'],
    ['problems','create'],['problems','read'],['problems','update'],
    ['oncall','read'],
    ['sla','read'],
  ]);

  // ── hr ───────────────────────────────────────────────────────────────────────
  await grant('hr', [
    ['tickets','create'],['tickets','read:own'],['tickets','update:own'],
    ['users','read:own'],['users','update:own'],
    ['departments','read'],
    ['skills','read'],
    ['schedule','read:own'],
    ['status','update:own'],
    ['kb','read'],
    ['analytics','read:own'],
  ]);

  // ── client ───────────────────────────────────────────────────────────────────
  await grant('client', [
    ['tickets','create'],['tickets','read:own'],
    ['users','read:own'],['users','update:own'],
    ['kb','read'],
    ['schedule','read:own'],
    ['status','update:own'],
    ['analytics','read:own'],
  ]);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS user_permissions CASCADE');
  await client.query('DROP TABLE IF EXISTS role_permissions CASCADE');
  await client.query('DROP TABLE IF EXISTS permissions CASCADE');
};
