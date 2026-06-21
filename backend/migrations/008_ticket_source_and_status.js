exports.up = async (client) => {
  // Expand the status CHECK to include 'Pending Approval'
  await client.query(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await client.query(`
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_status_check
      CHECK (status IN ('New','In Progress','Escalated','Resolved','Closed','Pending Approval'))
  `);

  // Track how a ticket was created and store email metadata
  await client.query(`
    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'portal'
                                               CHECK (source IN ('portal','email','catalog')),
      ADD COLUMN IF NOT EXISTS email_message_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS email_from       TEXT,
      ADD COLUMN IF NOT EXISTS catalog_item_id  INTEGER
  `);
};

exports.down = async (client) => {
  await client.query(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await client.query(`
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_status_check
      CHECK (status IN ('New','In Progress','Escalated','Resolved','Closed'))
  `);
  await client.query(`
    ALTER TABLE tickets
      DROP COLUMN IF EXISTS source,
      DROP COLUMN IF EXISTS email_message_id,
      DROP COLUMN IF EXISTS email_from,
      DROP COLUMN IF EXISTS catalog_item_id
  `);
};
