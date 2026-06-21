exports.up = async (client) => {
  // Service catalog items
  await client.query(`
    CREATE TABLE catalog_items (
      id                 SERIAL PRIMARY KEY,
      name               TEXT NOT NULL,
      description        TEXT NOT NULL,
      category           TEXT,
      icon               TEXT NOT NULL DEFAULT '🔧',
      default_priority   TEXT NOT NULL DEFAULT 'P3',
      estimated_minutes  INTEGER,
      requires_approval  BOOLEAN NOT NULL DEFAULT FALSE,
      approver_role      TEXT NOT NULL DEFAULT 'manager',
      is_active          BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order         INTEGER NOT NULL DEFAULT 0,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Dynamic form fields per catalog item
  await client.query(`
    CREATE TABLE catalog_fields (
      id              SERIAL PRIMARY KEY,
      catalog_item_id INTEGER NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
      field_name      TEXT NOT NULL,
      field_label     TEXT NOT NULL,
      field_type      TEXT NOT NULL DEFAULT 'text'
                        CHECK (field_type IN ('text','textarea','select','checkbox')),
      options         JSONB,
      is_required     BOOLEAN NOT NULL DEFAULT FALSE,
      placeholder     TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0
    )
  `);

  await client.query(`CREATE INDEX idx_catalog_fields_item ON catalog_fields (catalog_item_id)`);

  // FK from tickets to catalog items (already added as nullable column in 008)
  await client.query(`
    ALTER TABLE tickets
      ADD CONSTRAINT fk_tickets_catalog
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE SET NULL
  `);
};

exports.down = async (client) => {
  await client.query(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS fk_tickets_catalog`);
  await client.query(`DROP TABLE IF EXISTS catalog_fields CASCADE`);
  await client.query(`DROP TABLE IF EXISTS catalog_items CASCADE`);
};
