/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    ALTER TABLE tickets
      ADD COLUMN kb_article_id INTEGER
        REFERENCES kb_articles (id) ON DELETE SET NULL
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('ALTER TABLE tickets DROP COLUMN IF EXISTS kb_article_id');
};
