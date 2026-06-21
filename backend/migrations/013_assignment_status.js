/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    ALTER TABLE tickets
      ADD COLUMN assignment_status TEXT NOT NULL DEFAULT 'unassigned'
        CHECK (assignment_status IN ('unassigned','pending_acceptance','accepted','declined'))
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query(`ALTER TABLE tickets DROP COLUMN IF EXISTS assignment_status`);
};
