exports.up = async (client) => {
  await client.query(`
    CREATE TABLE approvals (
      id            SERIAL PRIMARY KEY,
      ticket_id     INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      approver_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
      comment       TEXT,
      requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at   TIMESTAMPTZ
    )
  `);
  await client.query(`CREATE INDEX idx_approvals_ticket   ON approvals (ticket_id)`);
  await client.query(`CREATE INDEX idx_approvals_approver ON approvals (approver_id)`);
  await client.query(`CREATE INDEX idx_approvals_status   ON approvals (status)`);
};

exports.down = async (client) => {
  await client.query(`DROP TABLE IF EXISTS approvals CASCADE`);
};
