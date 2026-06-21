/** @param {import('pg').PoolClient} client */
exports.up = async (client) => {
  await client.query(`
    CREATE TABLE problems (
      id                  SERIAL      PRIMARY KEY,
      title               TEXT        NOT NULL,
      description         TEXT        NOT NULL,
      status              TEXT        NOT NULL DEFAULT 'Open'
        CHECK (status IN ('Open','In Investigation','Known Error','Resolved','Closed')),
      root_cause          TEXT,
      workaround          TEXT,
      resolution          TEXT,
      assigned_to_user_id INTEGER     REFERENCES users(id),
      created_by_user_id  INTEGER     REFERENCES users(id),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at         TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE TABLE problem_tickets (
      id          SERIAL      PRIMARY KEY,
      problem_id  INTEGER     NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      ticket_id   INTEGER     NOT NULL REFERENCES tickets(id)  ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(problem_id, ticket_id)
    )
  `);

  await client.query(`
    CREATE INDEX idx_problem_tickets_problem ON problem_tickets(problem_id);
    CREATE INDEX idx_problem_tickets_ticket  ON problem_tickets(ticket_id);
  `);
};

/** @param {import('pg').PoolClient} client */
exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS problem_tickets');
  await client.query('DROP TABLE IF EXISTS problems');
};
