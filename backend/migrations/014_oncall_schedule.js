/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  // Add availability status + skills to users
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available'
        CHECK (availability_status IN ('available','on_call','offline','busy')),
      ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}'
  `);

  // On-call schedule slots
  await client.query(`
    CREATE TABLE oncall_schedules (
      id          SERIAL      PRIMARY KEY,
      user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_time  TIMESTAMPTZ NOT NULL,
      end_time    TIMESTAMPTZ NOT NULL,
      label       TEXT        NOT NULL DEFAULT 'On-Call',
      created_by  INTEGER     REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT valid_oncall_window CHECK (end_time > start_time)
    )
  `);

  await client.query(`
    CREATE INDEX idx_oncall_user  ON oncall_schedules(user_id);
    CREATE INDEX idx_oncall_times ON oncall_schedules(start_time, end_time);
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS oncall_schedules');
  await client.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS availability_status,
      DROP COLUMN IF EXISTS skills
  `);
};
