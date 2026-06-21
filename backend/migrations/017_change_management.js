/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE change_requests (
      id                        SERIAL      PRIMARY KEY,
      title                     TEXT        NOT NULL,
      description               TEXT        NOT NULL,
      type                      TEXT        NOT NULL DEFAULT 'Normal'
        CHECK (type IN ('Standard','Normal','Emergency')),
      risk_level                TEXT        NOT NULL DEFAULT 'Medium'
        CHECK (risk_level IN ('Low','Medium','High','Critical')),
      status                    TEXT        NOT NULL DEFAULT 'Draft'
        CHECK (status IN ('Draft','Submitted','Approved','Rejected','In Progress','Completed','Cancelled')),
      requester_id              INTEGER     REFERENCES users(id),
      implementation_plan       TEXT,
      rollback_plan             TEXT,
      affected_systems          TEXT,
      maintenance_window_start  TIMESTAMPTZ,
      maintenance_window_end    TIMESTAMPTZ,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE change_approvals (
      id          SERIAL      PRIMARY KEY,
      change_id   INTEGER     NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
      approver_id INTEGER     REFERENCES users(id),
      status      TEXT        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected')),
      comment     TEXT,
      reviewed_at TIMESTAMPTZ,
      UNIQUE(change_id, approver_id)
    )
  `);

  await client.query(`
    CREATE TABLE change_tickets (
      change_id   INTEGER NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
      ticket_id   INTEGER NOT NULL REFERENCES tickets(id)         ON DELETE CASCADE,
      PRIMARY KEY (change_id, ticket_id)
    )
  `);

  await client.query(`
    CREATE INDEX idx_change_requests_status  ON change_requests(status);
    CREATE INDEX idx_change_approvals_change ON change_approvals(change_id);
    CREATE INDEX idx_change_tickets_change   ON change_tickets(change_id);
    CREATE INDEX idx_change_tickets_ticket   ON change_tickets(ticket_id);
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS change_tickets');
  await client.query('DROP TABLE IF EXISTS change_approvals');
  await client.query('DROP TABLE IF EXISTS change_requests');
};
