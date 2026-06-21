exports.up = async (client) => {
  await client.query(`
    CREATE TABLE notifications (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      ticket_id  INTEGER          REFERENCES tickets(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      -- types: sla_at_risk | sla_breached | auto_escalated
      --        approval_needed | approval_resolved | ticket_assigned | email_ticket
      message    TEXT NOT NULL,
      is_read    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX idx_notifications_user    ON notifications (user_id, is_read)`);
  await client.query(`CREATE INDEX idx_notifications_ticket  ON notifications (ticket_id)`);
};

exports.down = async (client) => {
  await client.query(`DROP TABLE IF EXISTS notifications CASCADE`);
};
