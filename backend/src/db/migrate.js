/**
 * Pure-pg migration runner.
 *
 * Usage:
 *   node src/db/migrate.js up      — apply all pending migrations
 *   node src/db/migrate.js down    — roll back the last applied migration
 *   node src/db/migrate.js status  — list applied / pending migrations
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

// Standalone pool for the CLI — closed after run
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'dispatchly',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort(); // alphabetical = chronological given 001_, 002_, … prefix
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY name ASC');
  return rows.map((r) => r.name);
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function migrateUp() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const files = getMigrationFiles();
    const applied = await getAppliedMigrations(client);
    const pending = files.filter((f) => !applied.includes(f));

    if (pending.length === 0) {
      console.log('✓ Nothing to migrate — already up to date.');
      return;
    }

    for (const file of pending) {
      const migration = require(path.join(MIGRATIONS_DIR, file));
      console.log(`  Applying: ${file}`);
      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed:  ${file}\n`, err.message);
        throw err;
      }
    }
    console.log(`\nDone — ${pending.length} migration(s) applied.`);
  } finally {
    client.release();
  }
}

async function migrateDown() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    if (applied.length === 0) {
      console.log('Nothing to roll back.');
      return;
    }

    const last = applied[applied.length - 1];
    const migration = require(path.join(MIGRATIONS_DIR, last));

    console.log(`  Rolling back: ${last}`);
    await client.query('BEGIN');
    try {
      await migration.down(client);
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [last]);
      await client.query('COMMIT');
      console.log(`  ✓ Rolled back: ${last}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ Failed: ${last}\n`, err.message);
      throw err;
    }
  } finally {
    client.release();
  }
}

async function migrateStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const files = getMigrationFiles();
    const applied = new Set(await getAppliedMigrations(client));

    console.log('\nMigration status:');
    console.log('─'.repeat(50));
    for (const file of files) {
      const mark = applied.has(file) ? '✓ applied ' : '○ pending ';
      console.log(`  ${mark}  ${file}`);
    }
    console.log('─'.repeat(50));
    console.log(`  ${applied.size} applied, ${files.length - applied.size} pending\n`);
  } finally {
    client.release();
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const command = process.argv[2] || 'up';
const commands = { up: migrateUp, down: migrateDown, status: migrateStatus };

if (!commands[command]) {
  console.error(`Unknown command: ${command}. Use: up | down | status`);
  process.exit(1);
}

commands[command]()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    pool.end().finally(() => process.exit(1));
  });
