/**
 * Migration 021 — Agent Status (expanded) + Work Schedules
 *
 * Adds:
 *   - current_status (expanded from migration 014's availability_status)
 *   - agent_status_log table (full status change history)
 *   - work_schedules table (per-user, manager-settable, drives auto-transitions)
 */

const VALID_STATUSES = [
  'available',  // logged in, ready to take tickets (green)
  'on_duty',    // active shift, general working state (blue)
  'on_call',    // assigned to on-call rotation outside normal hours (purple)
  'busy',       // currently working on a specific ticket (amber)
  'break',      // short break, back soon (grey)
  'lunch',      // lunch break (grey)
  'training',   // in a training session (teal)
  'meeting',    // in a meeting (teal)
  'offline',    // not logged in (dark grey)
  'off_duty',   // outside shift hours (dark grey)
];

/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  // ── Expand status on users ────────────────────────────────────────────────────
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS current_status       TEXT NOT NULL DEFAULT 'off_duty'
        CHECK (current_status IN (${VALID_STATUSES.map((s) => `'${s}'`).join(',')})),
      ADD COLUMN IF NOT EXISTS current_status_reason TEXT,
      ADD COLUMN IF NOT EXISTS current_status_since  TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS current_status_set_by INT REFERENCES users(id) ON DELETE SET NULL
  `);

  // Sync existing availability_status → current_status
  await client.query(`
    UPDATE users SET current_status = CASE
      WHEN availability_status = 'on_call'  THEN 'on_call'
      WHEN availability_status = 'busy'     THEN 'busy'
      WHEN availability_status = 'offline'  THEN 'offline'
      WHEN availability_status = 'available' THEN 'available'
      ELSE 'off_duty'
    END
  `);

  // ── Status change history ────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE agent_status_log (
      id              SERIAL PRIMARY KEY,
      user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status          TEXT NOT NULL,
      previous_status TEXT,
      reason          TEXT,
      set_by_user_id  INT REFERENCES users(id) ON DELETE SET NULL,
      is_automatic    BOOLEAN NOT NULL DEFAULT FALSE,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at        TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX idx_status_log_user    ON agent_status_log(user_id);
    CREATE INDEX idx_status_log_started ON agent_status_log(started_at DESC);
  `);

  // ── Work schedules (manager-settable per user) ────────────────────────────────
  await client.query(`
    CREATE TABLE work_schedules (
      id             SERIAL PRIMARY KEY,
      user_id        INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      schedule_type  TEXT NOT NULL DEFAULT 'standard'
                       CHECK (schedule_type IN ('standard','shift','on_call_rotation','custom','exempt')),
      start_hour     INT  NOT NULL DEFAULT 9  CHECK (start_hour  BETWEEN 0 AND 23),
      end_hour       INT  NOT NULL DEFAULT 17 CHECK (end_hour    BETWEEN 1 AND 24),
      work_days      INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
      timezone       TEXT NOT NULL DEFAULT 'UTC',
      shift_label    TEXT,
      effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
      effective_until DATE,
      set_by         INT REFERENCES users(id) ON DELETE SET NULL,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX idx_work_schedules_user ON work_schedules(user_id);
  `);

  // Seed a default schedule for all existing active users (standard 9-5 Mon-Fri)
  await client.query(`
    INSERT INTO work_schedules (user_id, schedule_type, start_hour, end_hour, work_days, timezone, notes)
    SELECT id, 'standard', 9, 17, '{1,2,3,4,5}', 'UTC', 'Default schedule'
    FROM users
    WHERE is_active = TRUE
    ON CONFLICT DO NOTHING
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS work_schedules CASCADE');
  await client.query('DROP TABLE IF EXISTS agent_status_log CASCADE');
  await client.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS current_status,
      DROP COLUMN IF EXISTS current_status_reason,
      DROP COLUMN IF EXISTS current_status_since,
      DROP COLUMN IF EXISTS current_status_set_by
  `);
};
