exports.up = async (client) => {
  // One row per ticket per alert type — prevents duplicate alerts on repeated cron runs
  await client.query(`
    CREATE TABLE sla_alerts (
      id         SERIAL PRIMARY KEY,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL CHECK (alert_type IN ('at_risk','breached','auto_escalated')),
      fired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (ticket_id, alert_type)
    )
  `);
  await client.query(`CREATE INDEX idx_sla_alerts_ticket ON sla_alerts (ticket_id)`);
};

exports.down = async (client) => {
  await client.query(`DROP TABLE IF EXISTS sla_alerts CASCADE`);
};
