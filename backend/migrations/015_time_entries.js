/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE time_entries (
      id          SERIAL      PRIMARY KEY,
      ticket_id   INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id     INTEGER     NOT NULL REFERENCES users(id),
      user_name   TEXT        NOT NULL DEFAULT '',
      minutes     INTEGER     NOT NULL CHECK (minutes > 0),
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX idx_time_entries_ticket ON time_entries(ticket_id);
    CREATE INDEX idx_time_entries_user   ON time_entries(user_id);
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS time_entries');
};
