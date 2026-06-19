/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE ticket_comments (
      id          SERIAL      PRIMARY KEY,
      ticket_id   INTEGER     NOT NULL
                    REFERENCES tickets (id) ON DELETE CASCADE,
      author      TEXT        NOT NULL DEFAULT 'Agent',
      body        TEXT        NOT NULL,
      is_internal BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    'CREATE INDEX idx_comments_ticket ON ticket_comments (ticket_id)'
  );
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS ticket_comments CASCADE');
};
