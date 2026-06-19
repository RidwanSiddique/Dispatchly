/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE escalations (
      id                 SERIAL      PRIMARY KEY,
      ticket_id          INTEGER     NOT NULL
                           REFERENCES tickets (id) ON DELETE CASCADE,
      reason             TEXT        NOT NULL,
      escalated_to_team  TEXT,
      escalated_by       TEXT        NOT NULL DEFAULT 'Tier 1 Agent',
      escalated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    'CREATE INDEX idx_escalations_ticket ON escalations (ticket_id)'
  );
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS escalations CASCADE');
};
