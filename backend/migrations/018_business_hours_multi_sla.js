/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  // ─── Business Hours Configuration ────────────────────────────────────────────
  // A single-row config table (always id=1) storing the org's business hours.
  // Admins can update this via API. SLA clock pauses outside these hours for P3/P4.
  await client.query(`
    CREATE TABLE IF NOT EXISTS business_hours_config (
      id              INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      start_hour      INTEGER     NOT NULL DEFAULT 9,
      end_hour        INTEGER     NOT NULL DEFAULT 17,
      work_days       INTEGER[]   NOT NULL DEFAULT '{1,2,3,4,5}',
      timezone        TEXT        NOT NULL DEFAULT 'UTC',
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT valid_hours CHECK (start_hour >= 0 AND end_hour <= 24 AND end_hour > start_hour)
    )
  `);

  // Seed the default config row
  await client.query(`
    INSERT INTO business_hours_config (id, start_hour, end_hour, work_days, timezone)
    VALUES (1, 9, 17, '{1,2,3,4,5}', 'UTC')
    ON CONFLICT (id) DO NOTHING
  `);

  // ─── SLA Definitions (SLA / OLA / UC) ────────────────────────────────────────
  // Template records that define SLA contracts.
  // SLA  = external customer-facing agreement
  // OLA  = internal team operational agreement
  // UC   = underpinning contract with external vendor
  await client.query(`
    CREATE TABLE IF NOT EXISTS sla_definitions (
      id                SERIAL      PRIMARY KEY,
      name              TEXT        NOT NULL,
      type              TEXT        NOT NULL DEFAULT 'SLA'
                          CHECK (type IN ('SLA','OLA','UC')),
      description       TEXT,
      target_minutes    INTEGER     NOT NULL,
      priority_filter   TEXT[],
      category_filter   TEXT[],
      is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
      applies_business_hours BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed sensible ITIL-aligned default SLA definitions
  await client.query(`
    INSERT INTO sla_definitions
      (name, type, description, target_minutes, priority_filter, applies_business_hours)
    VALUES
      ('P1 Critical Response SLA',  'SLA', 'Critical incident resolved within 1 hour (24/7)',      60,   '{P1}',     FALSE),
      ('P2 High Response SLA',      'SLA', 'High priority resolved within 4 hours (24/7)',         240,  '{P2}',     FALSE),
      ('P3 Standard Response SLA',  'SLA', 'Standard request resolved within 1 business day',      480,  '{P3}',     TRUE),
      ('P4 Low Priority SLA',       'SLA', 'Low priority resolved within 3 business days',         1440, '{P4}',     TRUE),
      ('Tier 1 Response OLA',       'OLA', 'Tier 1 must respond within 30 minutes (24/7)',          30,  '{P1,P2}',  FALSE),
      ('Tier 2 Escalation OLA',     'OLA', 'Tier 2 must accept escalation within 2 business hours',120, '{P1,P2}',  FALSE),
      ('Vendor Hardware UC',        'UC',  'Hardware vendor must deliver replacement within 4 business hours', 240, NULL, TRUE)
    ON CONFLICT DO NOTHING
  `);

  // ─── Ticket SLAs (active SLA instances per ticket) ───────────────────────────
  // Each ticket can have multiple active SLA/OLA/UC instances,
  // one per matching sla_definition.
  await client.query(`
    CREATE TABLE IF NOT EXISTS ticket_slas (
      id                    SERIAL      PRIMARY KEY,
      ticket_id             INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      definition_id         INTEGER     NOT NULL REFERENCES sla_definitions(id),
      status                TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','paused','met','breached')),
      started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paused_at             TIMESTAMPTZ,
      breached_at           TIMESTAMPTZ,
      met_at                TIMESTAMPTZ,
      business_minutes_used INTEGER     NOT NULL DEFAULT 0,
      alert_at_risk_sent    BOOLEAN     NOT NULL DEFAULT FALSE,
      alert_breach_sent     BOOLEAN     NOT NULL DEFAULT FALSE,
      UNIQUE (ticket_id, definition_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ticket_slas_ticket    ON ticket_slas (ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_slas_status    ON ticket_slas (status);
    CREATE INDEX IF NOT EXISTS idx_sla_definitions_type  ON sla_definitions (type);
    CREATE INDEX IF NOT EXISTS idx_sla_definitions_active ON sla_definitions (is_active);
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS ticket_slas CASCADE');
  await client.query('DROP TABLE IF EXISTS sla_definitions CASCADE');
  await client.query('DROP TABLE IF EXISTS business_hours_config CASCADE');
};
