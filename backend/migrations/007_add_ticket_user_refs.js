exports.up = async (client) => {
  await client.query(`
    ALTER TABLE tickets
      ADD COLUMN created_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);

  await client.query(`CREATE INDEX idx_tickets_created_by  ON tickets (created_by_user_id)`);
  await client.query(`CREATE INDEX idx_tickets_assigned_to ON tickets (assigned_to_user_id)`);
};

exports.down = async (client) => {
  await client.query(`
    ALTER TABLE tickets
      DROP COLUMN IF EXISTS created_by_user_id,
      DROP COLUMN IF EXISTS assigned_to_user_id
  `);
};
