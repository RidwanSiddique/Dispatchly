exports.up = async (client) => {
  await client.query(`
    CREATE TABLE users (
      id              SERIAL PRIMARY KEY,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      name            TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'client'
                        CHECK (role IN ('admin','manager','agent','technician','specialist','hr','client')),
      department      TEXT,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`CREATE INDEX idx_users_email    ON users (email)`);
  await client.query(`CREATE INDEX idx_users_role     ON users (role)`);
  await client.query(`CREATE INDEX idx_users_active   ON users (is_active)`);
};

exports.down = async (client) => {
  await client.query('DROP TABLE IF EXISTS users CASCADE');
};
