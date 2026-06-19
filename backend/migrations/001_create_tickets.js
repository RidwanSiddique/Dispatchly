/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE tickets (
      id               SERIAL      PRIMARY KEY,
      requester_name   TEXT        NOT NULL,
      requester_email  TEXT,
      department       TEXT,
      location         TEXT,
      type             TEXT        NOT NULL DEFAULT 'Incident'
                         CHECK (type IN ('Incident', 'Service Request')),
      priority         TEXT        NOT NULL DEFAULT 'P3'
                         CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
      category         TEXT,
      title            TEXT        NOT NULL,
      description      TEXT        NOT NULL,
      status           TEXT        NOT NULL DEFAULT 'New'
                         CHECK (status IN ('New', 'In Progress', 'Escalated', 'Resolved', 'Closed')),
      -- SLA target in minutes: P1=60, P2=240, P3=480, P4=4320
      sla_minutes      INTEGER     NOT NULL DEFAULT 480,
      resolution_notes TEXT,
      resolved_at      TIMESTAMPTZ,
      closed_at        TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX idx_tickets_status   ON tickets (status);
    CREATE INDEX idx_tickets_priority ON tickets (priority);
    CREATE INDEX idx_tickets_created  ON tickets (created_at DESC);
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS tickets CASCADE');
};
