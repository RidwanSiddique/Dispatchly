/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE kb_articles (
      id               SERIAL      PRIMARY KEY,
      title            TEXT        NOT NULL,
      symptoms         TEXT        NOT NULL,
      resolution_steps TEXT        NOT NULL,
      category         TEXT,
      author           TEXT        NOT NULL DEFAULT 'Agent',
      is_published     BOOLEAN     NOT NULL DEFAULT TRUE,
      -- Populated when a resolved ticket is converted to a KB article
      source_ticket_id INTEGER     REFERENCES tickets (id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE kb_tags (
      id         SERIAL  PRIMARY KEY,
      article_id INTEGER NOT NULL
                   REFERENCES kb_articles (id) ON DELETE CASCADE,
      tag        TEXT    NOT NULL
    )
  `);

  await client.query(
    'CREATE INDEX idx_kb_tags_article ON kb_tags (article_id)'
  );
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS kb_tags CASCADE');
  await client.query('DROP TABLE IF EXISTS kb_articles CASCADE');
};
