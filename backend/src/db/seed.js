/**
 * Demo seed — pure pg.
 * Run:  node src/db/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { SLA_MINUTES } = require('../config/constants');

const hoursAgo = (h) => new Date(Date.now() - h * 3600000);

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear in FK-safe order
    await client.query('DELETE FROM kb_tags');
    await client.query('DELETE FROM ticket_comments');
    await client.query('DELETE FROM escalations');
    await client.query('UPDATE tickets SET kb_article_id = NULL');
    await client.query('DELETE FROM kb_articles');
    await client.query('DELETE FROM tickets');
    await client.query('DELETE FROM users');

    // ── Demo users (password: password123) ───────────────────────────────────

    const PASSWORD_HASH = await bcrypt.hash('password123', 12);

    const DEMO_USERS = [
      { email: 'admin@dispatchly.com', name: 'Admin User', role: 'admin', department: 'IT' },
      { email: 'manager@dispatchly.com', name: 'Sam Manager', role: 'manager', department: 'IT' },
      { email: 'agent@dispatchly.com', name: 'Alex Agent', role: 'agent', department: 'Service Desk' },
      { email: 'tech@dispatchly.com', name: 'Taylor Technician', role: 'technician', department: 'Desktop Support' },
      { email: 'specialist@dispatchly.com', name: 'Casey Specialist', role: 'specialist', department: 'Clinical Applications' },
      { email: 'hr@dispatchly.com', name: 'Jordan HR', role: 'hr', department: 'Human Resources' },
      { email: 'client@dispatchly.com', name: 'Morgan Client', role: 'client', department: 'Radiology' },
    ];

    const userRows = [];
    for (const u of DEMO_USERS) {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, name, role, department)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role`,
        [u.email, PASSWORD_HASH, u.name, u.role, u.department]
      );
      userRows.push(user);
    }

    // Look up specific users for seeding tickets
    const userByRole = (role) => userRows.find((u) => u.role === role);
    const agentId = userByRole('agent').id;
    const managerId = userByRole('manager').id;
    const clientId = userByRole('client').id;
    const hrId = userByRole('hr').id;
    const techId = userByRole('technician').id;

    console.log('✓ Users seeded:');
    userRows.forEach((u) => console.log(`  ${u.role.padEnd(12)} → ${u.email}`));

    // ── Tickets ──────────────────────────────────────────────────────────────
    const { rows: tickets } = await client.query(
      `INSERT INTO tickets
        (requester_name, requester_email, department, location,
         type, priority, category, title, description,
         status, sla_minutes, resolution_notes, resolved_at,
         created_at, updated_at,
         created_by_user_id, assigned_to_user_id)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17),
        ($18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34),
        ($35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51),
        ($52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63,$64,$65,$66,$67,$68),
        ($69,$70,$71,$72,$73,$74,$75,$76,$77,$78,$79,$80,$81,$82,$83,$84,$85)
       RETURNING id`,
      [
        // 1 — P1 In Progress (0.5h old) — created by agent, assigned to technician
        'Sarah Chen', 'sarah.chen@hospital.org', 'Radiology', 'Main Campus',
        'Incident', 'P1', 'Clinical Application',
        'PACS imaging system unresponsive',
        'The PACS system is down and radiologists cannot access patient images. This is impacting critical patient care workflows.',
        'In Progress', SLA_MINUTES.P1, null, null,
        hoursAgo(0.5), hoursAgo(0.5), agentId, techId,

        // 2 — P2 Escalated (3h old) — created by agent
        'Marcus Williams', 'marcus.w@hospital.org', 'ICU', 'North Wing',
        'Incident', 'P2', 'Network',
        'Intermittent network drops on floor 3',
        'Multiple workstations on floor 3 are experiencing frequent network disconnections. Affecting about 8 users.',
        'Escalated', SLA_MINUTES.P2, null, null,
        hoursAgo(3), hoursAgo(1), agentId, null,

        // 3 — P4 New (5h old) — created by HR user
        'Jordan Lee', 'jordan.lee@hospital.org', 'HR', 'Admin Building',
        'Service Request', 'P4', 'Account Access',
        'New hire laptop setup — Maria Rodriguez',
        'New employee Maria Rodriguez starts Monday. Need laptop provisioned with standard software and network credentials.',
        'New', SLA_MINUTES.P4, null, null,
        hoursAgo(5), hoursAgo(5), hrId, null,

        // 4 — P3 Resolved (6h old, resolved 0.5h ago) — created by agent
        'Dr. Priya Nair', 'p.nair@hospital.org', 'Cardiology', 'East Wing',
        'Incident', 'P3', 'Hardware',
        'Printer in Cardiology not feeding paper',
        'The HP LaserJet in the Cardiology nurses station keeps jamming and will not print. Staff are using the floor above.',
        'Resolved', SLA_MINUTES.P3,
        'Replaced paper feed roller assembly. Tested with 50-page print job — no further jams.',
        hoursAgo(0.5),
        hoursAgo(6), hoursAgo(0.5), agentId, techId,

        // 5 — P2 New (1h old) — created by client user
        'Morgan Client', 'client@dispatchly.com', 'Radiology', 'Main Campus',
        'Incident', 'P2', 'Software',
        'Medication dispensing software login failure',
        'Cannot log into the Pyxis dispensing cabinet software. Error: "Authentication server unreachable".',
        'New', SLA_MINUTES.P2, null, null,
        hoursAgo(1), hoursAgo(1), clientId, null,
      ]
    );

    const ids = tickets.map((r) => r.id);

    // ── Escalation for ticket #2 ──────────────────────────────────────────────
    await client.query(
      `INSERT INTO escalations
         (ticket_id, reason, escalated_to_team, escalated_by, escalated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        ids[1],
        'Issue persists after basic troubleshooting (restart, cable check). Root cause appears to be switch-level — requires Tier 2 network access.',
        'Network Infrastructure Team',
        'Alex Agent',
        hoursAgo(1),
      ]
    );

    // ── Comments ─────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO ticket_comments (ticket_id, author, body, is_internal, created_at)
       VALUES
        ($1, $2, $3, $4, $5),
        ($6, $7, $8, $9, $10)`,
      [
        ids[0],
        'Alex Agent',
        'Confirmed outage. PACS server is not responding to ping. Escalating to clinical systems team.',
        true,
        hoursAgo(0.4),

        ids[1],
        'Alex Agent',
        'Rebooted the access switch on floor 3. Issue returned within 10 minutes. Suspect faulty switch port or VLAN misconfiguration.',
        false,
        hoursAgo(2),
      ]
    );

    // ── KB article from resolved printer ticket ───────────────────────────────
    const {
      rows: [article],
    } = await client.query(
      `INSERT INTO kb_articles
         (title, symptoms, resolution_steps, category, author, is_published, source_ticket_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        'HP LaserJet Paper Feed Jam — Roller Replacement',
        'Printer repeatedly jams on paper feed. Paper not advancing from tray. Error light flashing on control panel.',
        '1. Power off the printer and unplug.\n2. Open the rear access panel.\n3. Locate the paper feed roller assembly.\n4. Release the two retaining clips and slide out the old roller.\n5. Install the replacement roller (Part #RM1-4006) and re-clip.\n6. Reattach rear panel and power on.\n7. Run a 50-page test print to confirm resolution.',
        'Hardware',
        'Alex Agent',
        true,
        ids[3],
      ]
    );

    await client.query(
      `INSERT INTO kb_tags (article_id, tag) VALUES
         ($1, 'printer'), ($1, 'hardware'), ($1, 'HP LaserJet'), ($1, 'paper jam')`,
      [article.id]
    );

    // Link ticket #4 back to the KB article
    await client.query('UPDATE tickets SET kb_article_id = $1 WHERE id = $2', [article.id, ids[3]]);

    await client.query('COMMIT');
    console.log('\n✓ Seed completed');
    console.log(`  Tickets : ${ids.join(', ')}`);
    console.log(`  KB article: ${article.id}`);
    console.log('\n  Login credentials (password: password123)');
    console.log('  admin@dispatchly.com       → admin');
    console.log('  manager@dispatchly.com     → manager');
    console.log('  agent@dispatchly.com       → agent');
    console.log('  tech@dispatchly.com        → technician');
    console.log('  specialist@dispatchly.com  → specialist');
    console.log('  hr@dispatchly.com          → hr');
    console.log('  client@dispatchly.com      → client');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    pool.end().finally(() => process.exit(1));
  });
