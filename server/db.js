'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err.message);
});

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL UNIQUE,
      plan          TEXT NOT NULL DEFAULT 'free',
      is_active     SMALLINT NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      max_users     INTEGER DEFAULT NULL,
      poc_name      TEXT DEFAULT NULL,
      poc_email     TEXT DEFAULT NULL,
      ai_healing_enabled SMALLINT NOT NULL DEFAULT 0,
      openai_api_key TEXT DEFAULT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS modules (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      base_url    TEXT,
      language    TEXT DEFAULT 'javascript',
      tags        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      imports     TEXT,
      org_id      INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_files (
      id             SERIAL PRIMARY KEY,
      module_id      INTEGER REFERENCES modules(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      content        TEXT NOT NULL DEFAULT '',
      requirement_id INTEGER,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      org_id         INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS executions (
      id                 SERIAL PRIMARY KEY,
      module_id          INTEGER REFERENCES modules(id) ON DELETE CASCADE,
      test_file_id       INTEGER REFERENCES test_files(id) ON DELETE CASCADE,
      status             TEXT NOT NULL DEFAULT 'pending',
      logs               TEXT,
      error_message      TEXT,
      screenshot_base64  TEXT,
      duration_ms        INTEGER,
      report_path        TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      org_id             INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_suites (
      id         SERIAL PRIMARY KEY,
      module_id  INTEGER REFERENCES modules(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      org_id     INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suite_test_files (
      id           SERIAL PRIMARY KEY,
      suite_id     INTEGER REFERENCES test_suites(id) ON DELETE CASCADE,
      test_file_id INTEGER REFERENCES test_files(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suite_executions (
      id           SERIAL PRIMARY KEY,
      suite_id     INTEGER REFERENCES test_suites(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      total_tests  INTEGER DEFAULT 0,
      passed       INTEGER DEFAULT 0,
      failed       INTEGER DEFAULT 0,
      duration_ms  INTEGER,
      report_path  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      org_id       INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suite_test_results (
      id                  SERIAL PRIMARY KEY,
      suite_execution_id  INTEGER REFERENCES suite_executions(id) ON DELETE CASCADE,
      test_file_id        INTEGER REFERENCES test_files(id) ON DELETE CASCADE,
      status              TEXT NOT NULL DEFAULT 'pending',
      duration_ms         INTEGER,
      error_message       TEXT,
      logs                TEXT,
      screenshot_base64   TEXT,
      org_id              INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_file_dependencies (
      id                  SERIAL PRIMARY KEY,
      test_file_id        INTEGER REFERENCES test_files(id) ON DELETE CASCADE,
      dependency_file_id  INTEGER REFERENCES test_files(id) ON DELETE CASCADE,
      dependency_type     TEXT NOT NULL CHECK (dependency_type IN ('before', 'after')),
      execution_order     INTEGER NOT NULL DEFAULT 0,
      UNIQUE (test_file_id, dependency_file_id, dependency_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS features (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      priority    TEXT DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      org_id      INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sprints (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      goal       TEXT,
      start_date TEXT,
      end_date   TEXT,
      status     TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned','Active','Completed','Cancelled')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      org_id     INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS requirements (
      id              SERIAL PRIMARY KEY,
      feature_id      INTEGER REFERENCES features(id) ON DELETE SET NULL,
      organization_id INTEGER,
      sprint_id       INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved','Implemented')),
      priority        TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      org_id          INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id              SERIAL PRIMARY KEY,
      requirement_id  INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      description     TEXT,
      preconditions   TEXT,
      test_steps      TEXT,
      expected_result TEXT,
      type            TEXT NOT NULL DEFAULT 'Manual' CHECK (type IN ('Manual','Automated')),
      priority        TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
      status          TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Ready','Deprecated')),
      test_file_id    INTEGER REFERENCES test_files(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      org_id          INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS manual_test_runs (
      id               SERIAL PRIMARY KEY,
      test_case_id     INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
      status           TEXT NOT NULL DEFAULT 'Not Run' CHECK (status IN ('Not Run','Passed','Failed','Blocked')),
      executed_by      TEXT,
      execution_notes  TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      org_id           INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS defects (
      id                  SERIAL PRIMARY KEY,
      title               TEXT NOT NULL,
      description         TEXT,
      severity            TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low','Medium','High','Critical')),
      status              TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved','Closed')),
      linked_test_case_id INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
      linked_execution_id INTEGER REFERENCES manual_test_runs(id) ON DELETE SET NULL,
      sprint_id           INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
      screenshot          TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW(),
      org_id              INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              SERIAL PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT,
      sprint_id       INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
      assignee_id     INTEGER,
      status          TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','In Progress','Completed','Done','Blocked')),
      priority        TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
      created_by      INTEGER,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      start_date      TEXT,
      end_date        TEXT,
      planned_hours   REAL DEFAULT 0,
      completed_hours REAL DEFAULT 0,
      requirement_id  INTEGER REFERENCES requirements(id) ON DELETE SET NULL,
      org_id          INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id          SERIAL PRIMARY KEY,
      task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id   INTEGER,
      author_name TEXT,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      org_id      INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_history (
      id                   SERIAL PRIMARY KEY,
      task_id              INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      changed_by_id        INTEGER,
      changed_by_username  TEXT,
      field                TEXT NOT NULL,
      old_value            TEXT,
      new_value            TEXT,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      org_id               INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_comments (
      id          SERIAL PRIMARY KEY,
      feature_id  INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      author_id   INTEGER,
      author_name TEXT,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      org_id      INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_history (
      id                  SERIAL PRIMARY KEY,
      feature_id          INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      changed_by_id       INTEGER,
      changed_by_username TEXT,
      field               TEXT NOT NULL,
      old_value           TEXT,
      new_value           TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      org_id              INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS defect_comments (
      id          SERIAL PRIMARY KEY,
      defect_id   INTEGER NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
      author_id   INTEGER,
      author_name TEXT,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      org_id      INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS defect_history (
      id                  SERIAL PRIMARY KEY,
      defect_id           INTEGER NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
      changed_by_id       INTEGER,
      changed_by_username TEXT,
      field               TEXT NOT NULL,
      old_value           TEXT,
      new_value           TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      org_id              INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requirement_comments (
      id              SERIAL PRIMARY KEY,
      requirement_id  INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      author_id       INTEGER,
      author_name     TEXT,
      content         TEXT NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      org_id          INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requirement_history (
      id                  SERIAL PRIMARY KEY,
      requirement_id      INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      changed_by_id       INTEGER,
      changed_by_username TEXT,
      field               TEXT NOT NULL,
      old_value           TEXT,
      new_value           TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      org_id              INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_case_comments (
      id            SERIAL PRIMARY KEY,
      test_case_id  INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
      author_id     INTEGER,
      author_name   TEXT,
      content       TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      org_id        INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_case_history (
      id                  SERIAL PRIMARY KEY,
      test_case_id        INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
      changed_by_id       INTEGER,
      changed_by_username TEXT,
      field               TEXT NOT NULL,
      old_value           TEXT,
      new_value           TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      org_id              INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token            TEXT PRIMARY KEY,
      user_id          INTEGER NOT NULL,
      username         TEXT NOT NULL,
      role             TEXT NOT NULL,
      org_id           INTEGER NOT NULL DEFAULT 1,
      custom_role_id   INTEGER,
      permissions      TEXT,
      custom_role_name TEXT,
      logged_in_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_by  INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      org_id      INTEGER NOT NULL DEFAULT 1,
      UNIQUE (name, org_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id               SERIAL PRIMARY KEY,
      username         TEXT NOT NULL UNIQUE,
      password_hash    TEXT NOT NULL,
      salt             TEXT NOT NULL,
      role             TEXT NOT NULL DEFAULT 'contributor',
      custom_role_id   INTEGER REFERENCES custom_roles(id) ON DELETE SET NULL,
      created_by       INTEGER,
      is_active        SMALLINT NOT NULL DEFAULT 1,
      permissions      TEXT DEFAULT NULL,
      org_id           INTEGER NOT NULL DEFAULT 1,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wiki_pages (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      parent_id   INTEGER REFERENCES wiki_pages(id) ON DELETE CASCADE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_by  TEXT,
      org_id      INTEGER NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO settings (key, value) VALUES ($1, $2)
    ON CONFLICT (key) DO NOTHING
  `, ['user_limit', '0']);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_variables (
      id          SERIAL PRIMARY KEY,
      key         TEXT NOT NULL,
      value       TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      org_id      INTEGER NOT NULL DEFAULT 1,
      UNIQUE (key, org_id)
    )
  `);

  // ── Schema migrations for existing tables ──────────────────────────────
  // Fix sprints status CHECK: was ('Planning',...) but app uses 'Planned'
  await pool.query(`ALTER TABLE sprints DROP CONSTRAINT IF EXISTS sprints_status_check`);
  await pool.query(`ALTER TABLE sprints ALTER COLUMN status SET DEFAULT 'Planned'`);
  await pool.query(`ALTER TABLE sprints ADD CONSTRAINT sprints_status_check CHECK (status IN ('Planned','Active','Completed','Cancelled'))`);
  await pool.query(`UPDATE sprints SET status = 'Planned' WHERE status = 'Planning'`);

  // Fix requirements status CHECK: was ('Draft','Review','Approved','Rejected') but app uses 'Implemented'
  await pool.query(`ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_status_check`);
  await pool.query(`ALTER TABLE requirements ADD CONSTRAINT requirements_status_check CHECK (status IN ('Draft','Approved','Implemented'))`);
  await pool.query(`UPDATE requirements SET status = 'Draft' WHERE status NOT IN ('Draft','Approved','Implemented')`);

  // Fix test_cases status CHECK: was ('Draft','Active','Deprecated') but app uses 'Ready'
  await pool.query(`ALTER TABLE test_cases DROP CONSTRAINT IF EXISTS test_cases_status_check`);
  await pool.query(`ALTER TABLE test_cases ADD CONSTRAINT test_cases_status_check CHECK (status IN ('Draft','Ready','Deprecated'))`);
  await pool.query(`UPDATE test_cases SET status = 'Ready' WHERE status = 'Active'`);

  // Fix tasks status CHECK: add 'Completed' which was missing from original constraint
  await pool.query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check`);
  await pool.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('New','In Progress','Completed','Done','Blocked'))`);
  await pool.query(`UPDATE tasks SET status = 'New' WHERE status NOT IN ('New','In Progress','Completed','Done','Blocked')`);

  // Add logs_json column to suite_executions for CI log persistence
  await pool.query(`ALTER TABLE suite_executions ADD COLUMN IF NOT EXISTS logs_json TEXT`);

  // Add created_by column to features, requirements, and test_cases
  await pool.query(`ALTER TABLE features ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await pool.query(`ALTER TABLE requirements ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await pool.query(`ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS created_by TEXT`);

  // Add created_by and assigned_to to defects
  await pool.query(`ALTER TABLE defects ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await pool.query(`ALTER TABLE defects ADD COLUMN IF NOT EXISTS assigned_to TEXT`);

  // Ensure comment/history tables have org_id (safe for DBs created before this column was added)
  for (const tbl of ['task_comments','task_history','feature_comments','feature_history',
                      'requirement_comments','requirement_history','test_case_comments','test_case_history']) {
    await pool.query(`ALTER TABLE IF EXISTS ${tbl} ADD COLUMN IF NOT EXISTS org_id INTEGER NOT NULL DEFAULT 1`);
  }

  // Enquiries (landing page contact form)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      company     TEXT,
      team_size   TEXT,
      message     TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Platform feature requests (submitted by users from within the app)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_feedback (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      submitted_by  TEXT NOT NULL,
      org_slug      TEXT,
      org_id        INTEGER,
      status        TEXT NOT NULL DEFAULT 'open',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Platform bug reports (submitted by users from within the app)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_bug_reports (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      steps         TEXT,
      severity      TEXT NOT NULL DEFAULT 'medium',
      submitted_by  TEXT NOT NULL,
      org_slug      TEXT,
      org_id        INTEGER,
      status        TEXT NOT NULL DEFAULT 'open',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await seedDefaultOrg();
  await seedDefaultUsers();
  console.log('Database initialised');
}

async function seedDefaultOrg() {
  const existing = await pool.query("SELECT id FROM organizations WHERE slug = 'default'");
  if (existing.rows.length === 0) {
    await pool.query("INSERT INTO organizations (name, slug, plan) VALUES ($1, $2, $3)", ['Default Org', 'default', 'free']);
    console.log('Default organisation seeded');
  }
}

async function seedDefaultUsers() {
  const { rows: [{ count: userCount }] } = await pool.query('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount, 10) === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    await pool.query('INSERT INTO users (username, password_hash, salt, role) VALUES ($1, $2, $3, $4)',
      ['admin', hash, salt, 'admin']);
    console.log('Default admin created — username: admin  password: admin123');
  }

  const { rows: [{ count: saCount }] } = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'");
  if (parseInt(saCount, 10) === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('playwright2403', salt, 64).toString('hex');
    await pool.query('INSERT INTO users (username, password_hash, salt, role) VALUES ($1, $2, $3, $4)',
      ['admin01', hash, salt, 'super_admin']);
    console.log('Default super admin created — username: admin01  password: playwright2403');
  } else {
    const existing = await pool.query("SELECT id FROM users WHERE username = 'superadmin' AND role = 'super_admin'");
    if (existing.rows.length > 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync('playwright2403', salt, 64).toString('hex');
      await pool.query('UPDATE users SET username = $1, password_hash = $2, salt = $3 WHERE id = $4',
        ['admin01', hash, salt, existing.rows[0].id]);
      console.log('Super admin credentials updated — username: admin01  password: playwright2403');
    }
  }
}

// ---------------------------------------------------------------------------
// Module Operations
// ---------------------------------------------------------------------------
const parseModuleTags = (row) => {
  if (!row) return row;
  if (row.tags && typeof row.tags === 'string') {
    try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
  } else if (!row.tags) {
    row.tags = [];
  }
  return row;
};

const moduleOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM modules WHERE org_id = $1 ORDER BY created_at ASC', [orgId]);
    return r.rows.map(parseModuleTags);
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM modules WHERE id = $1', [id]);
    return parseModuleTags(r.rows[0] || null);
  },

  create: async ({ name, description, base_url, language = 'javascript', tags, imports }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO modules (name, description, base_url, language, tags, imports, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [name, description || null, base_url || null, language, tags ? JSON.stringify(tags) : null, imports || null, orgId]
    );
    return moduleOperations.getById(r.rows[0].id);
  },

  update: async (id, { name, description, base_url, language, tags, imports }) => {
    await pool.query(
      'UPDATE modules SET name=$1, description=$2, base_url=$3, language=$4, tags=$5, imports=$6 WHERE id=$7',
      [name, description || null, base_url || null, language, tags ? JSON.stringify(tags) : null, imports || null, id]
    );
    return moduleOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM modules WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Test File Operations
// ---------------------------------------------------------------------------
const testFileOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM test_files WHERE org_id = $1 ORDER BY created_at ASC', [orgId]);
    return r.rows;
  },

  getByModuleId: async (moduleId) => {
    const r = await pool.query('SELECT * FROM test_files WHERE module_id = $1 ORDER BY created_at ASC', [moduleId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM test_files WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getByRequirementId: async (requirementId) => {
    const r = await pool.query('SELECT * FROM test_files WHERE requirement_id = $1', [requirementId]);
    return r.rows;
  },

  create: async ({ module_id, name, content = '', requirement_id }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO test_files (module_id, name, content, requirement_id, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [module_id, name, content, requirement_id || null, orgId]
    );
    return testFileOperations.getById(r.rows[0].id);
  },

  update: async (id, fields) => {
    const setClauses = [];
    const values = [];
    let idx = 1;
    if (fields.name !== undefined)           { setClauses.push(`name=$${idx++}`);           values.push(fields.name); }
    if (fields.content !== undefined)        { setClauses.push(`content=$${idx++}`);        values.push(fields.content); }
    if (fields.requirement_id !== undefined) { setClauses.push(`requirement_id=$${idx++}`); values.push(fields.requirement_id || null); }
    if (setClauses.length === 0) return testFileOperations.getById(id);
    setClauses.push(`updated_at=NOW()`);
    values.push(id);
    await pool.query(
      `UPDATE test_files SET ${setClauses.join(', ')} WHERE id=$${idx}`,
      values
    );
    return testFileOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM test_files WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Execution Operations
// ---------------------------------------------------------------------------
const executionOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM executions WHERE org_id = $1 ORDER BY created_at DESC', [orgId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM executions WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getByModuleId: async (moduleId) => {
    const r = await pool.query('SELECT * FROM executions WHERE module_id = $1 ORDER BY created_at DESC', [moduleId]);
    return r.rows;
  },

  create: async ({ module_id, test_file_id, status, logs, error_message, screenshot_base64, duration_ms, report_path }, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO executions (module_id, test_file_id, status, logs, error_message, screenshot_base64, duration_ms, report_path, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [module_id, test_file_id || null, status, logs || null, error_message || null, screenshot_base64 || null, duration_ms || null, report_path || null, orgId]
    );
    return executionOperations.getById(r.rows[0].id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM executions WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Test Suite Operations
// ---------------------------------------------------------------------------
const testSuiteOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM test_suites WHERE org_id = $1 ORDER BY created_at ASC', [orgId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM test_suites WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getByModuleId: async (moduleId) => {
    const r = await pool.query('SELECT * FROM test_suites WHERE module_id = $1 ORDER BY created_at ASC', [moduleId]);
    return r.rows;
  },

  create: async ({ module_id, name }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO test_suites (module_id, name, org_id) VALUES ($1,$2,$3) RETURNING id',
      [module_id, name, orgId]
    );
    return testSuiteOperations.getById(r.rows[0].id);
  },

  update: async (id, { name }) => {
    await pool.query('UPDATE test_suites SET name=$1 WHERE id=$2', [name, id]);
    return testSuiteOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM test_suites WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Suite Test File Operations
// ---------------------------------------------------------------------------
const suiteTestFileOperations = {
  getBySuiteId: async (suiteId) => {
    const r = await pool.query(
      `SELECT stf.*, tf.name as test_file_name, tf.content as test_file_content FROM suite_test_files stf
       JOIN test_files tf ON stf.test_file_id = tf.id
       WHERE stf.suite_id = $1`,
      [suiteId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM suite_test_files WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  add: async ({ suite_id, test_file_id }) => {
    const r = await pool.query(
      'INSERT INTO suite_test_files (suite_id, test_file_id) VALUES ($1,$2) RETURNING id',
      [suite_id, test_file_id]
    );
    return suiteTestFileOperations.getById(r.rows[0].id);
  },

  remove: async (id) => {
    return pool.query('DELETE FROM suite_test_files WHERE id = $1', [id]);
  },

  removeBySuiteAndTestFile: async (suiteId, testFileId) => {
    return pool.query('DELETE FROM suite_test_files WHERE suite_id=$1 AND test_file_id=$2', [suiteId, testFileId]);
  }
};

// ---------------------------------------------------------------------------
// Suite Execution Operations
// ---------------------------------------------------------------------------
const suiteExecutionOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM suite_executions WHERE org_id = $1 ORDER BY created_at DESC', [orgId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM suite_executions WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getBySuiteId: async (suiteId) => {
    const r = await pool.query('SELECT * FROM suite_executions WHERE suite_id = $1 ORDER BY created_at DESC', [suiteId]);
    return r.rows;
  },

  create: async ({ suite_id, status = 'pending', total_tests = 0, passed = 0, failed = 0, duration_ms, report_path }, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO suite_executions (suite_id, status, total_tests, passed, failed, duration_ms, report_path, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [suite_id, status, total_tests, passed, failed, duration_ms || null, report_path || null, orgId]
    );
    return suiteExecutionOperations.getById(r.rows[0].id);
  },

  update: async (id, { status, total_tests, passed, failed, duration_ms, report_path }) => {
    await pool.query(
      `UPDATE suite_executions SET status=$1, total_tests=$2, passed=$3, failed=$4, duration_ms=$5, report_path=$6 WHERE id=$7`,
      [status, total_tests, passed, failed, duration_ms || null, report_path || null, id]
    );
    return suiteExecutionOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM suite_executions WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Suite Test Result Operations
// ---------------------------------------------------------------------------
const suiteTestResultOperations = {
  getBySuiteExecutionId: async (suiteExecutionId) => {
    const r = await pool.query(
      `SELECT str.*, tf.name as test_file_name FROM suite_test_results str
       LEFT JOIN test_files tf ON str.test_file_id = tf.id
       WHERE str.suite_execution_id = $1`,
      [suiteExecutionId]
    );
    return r.rows;
  },

  create: async ({ suite_execution_id, test_file_id, status, duration_ms, error_message, logs, screenshot_base64 }, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO suite_test_results (suite_execution_id, test_file_id, status, duration_ms, error_message, logs, screenshot_base64, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [suite_execution_id, test_file_id || null, status, duration_ms || null, error_message || null, logs || null, screenshot_base64 || null, orgId]
    );
    const created = await pool.query('SELECT * FROM suite_test_results WHERE id = $1', [r.rows[0].id]);
    return created.rows[0];
  },

  delete: async (id) => {
    return pool.query('DELETE FROM suite_test_results WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Test File Dependency Operations
// ---------------------------------------------------------------------------
const testFileDependencyOperations = {
  getByTestFileId: async (testFileId) => {
    const r = await pool.query(
      `SELECT tfd.*, tf.name as dependency_name FROM test_file_dependencies tfd
       JOIN test_files tf ON tfd.dependency_file_id = tf.id
       WHERE tfd.test_file_id = $1 ORDER BY tfd.execution_order ASC`,
      [testFileId]
    );
    return r.rows;
  },

  getByTestFileIdAndType: async (testFileId, type) => {
    const r = await pool.query(
      `SELECT tfd.*, tf.name as dependency_name FROM test_file_dependencies tfd
       JOIN test_files tf ON tfd.dependency_file_id = tf.id
       WHERE tfd.test_file_id = $1 AND tfd.dependency_type = $2
       ORDER BY tfd.execution_order ASC`,
      [testFileId, type]
    );
    return r.rows;
  },

  add: async ({ test_file_id, dependency_file_id, dependency_type, execution_order = 0 }) => {
    const r = await pool.query(
      `INSERT INTO test_file_dependencies (test_file_id, dependency_file_id, dependency_type, execution_order)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (test_file_id, dependency_file_id, dependency_type) DO UPDATE SET execution_order = EXCLUDED.execution_order
       RETURNING id`,
      [test_file_id, dependency_file_id, dependency_type, execution_order]
    );
    const created = await pool.query('SELECT * FROM test_file_dependencies WHERE id = $1', [r.rows[0].id]);
    return created.rows[0];
  },

  remove: async (id) => {
    return pool.query('DELETE FROM test_file_dependencies WHERE id = $1', [id]);
  },

  removeAllForTestFile: async (testFileId) => {
    return pool.query('DELETE FROM test_file_dependencies WHERE test_file_id = $1', [testFileId]);
  },

  getExecutionOrder: async (testFileId) => {
    const before = await testFileDependencyOperations.getByTestFileIdAndType(testFileId, 'before');
    const after  = await testFileDependencyOperations.getByTestFileIdAndType(testFileId, 'after');
    const self   = await testFileOperations.getById(testFileId);
    return { before, self, after };
  }
};

// ---------------------------------------------------------------------------
// Feature Operations
// ---------------------------------------------------------------------------
const featureOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM features WHERE org_id = $1 ORDER BY created_at ASC', [orgId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM features WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  create: async ({ name, description, priority = 'Medium', created_by }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO features (name, description, priority, created_by, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name, description || null, priority, created_by || null, orgId]
    );
    return featureOperations.getById(r.rows[0].id);
  },

  update: async (id, { name, description, priority }) => {
    await pool.query(
      'UPDATE features SET name=$1, description=$2, priority=$3, updated_at=NOW() WHERE id=$4',
      [name, description || null, priority, id]
    );
    return featureOperations.getById(id);
  },

  delete: async (id) => {
    // Explicitly delete all test cases under each requirement of this feature
    const reqs = await pool.query('SELECT id FROM requirements WHERE feature_id = $1', [id]);
    const reqIds = reqs.rows.map(r => r.id);
    if (reqIds.length > 0) {
      await pool.query('DELETE FROM test_cases WHERE requirement_id = ANY($1::int[])', [reqIds]);
    }
    // Delete the requirements
    await pool.query('DELETE FROM requirements WHERE feature_id = $1', [id]);
    return pool.query('DELETE FROM features WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Requirement Operations
// ---------------------------------------------------------------------------
const requirementOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT r.*, f.name as feature_name, s.name as sprint_name FROM requirements r
       LEFT JOIN features f ON r.feature_id = f.id
       LEFT JOIN sprints s ON r.sprint_id = s.id
       WHERE r.org_id = $1 ORDER BY r.created_at ASC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query(
      `SELECT r.*, f.name as feature_name, s.name as sprint_name FROM requirements r
       LEFT JOIN features f ON r.feature_id = f.id
       LEFT JOIN sprints s ON r.sprint_id = s.id
       WHERE r.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  },

  getByFeatureId: async (featureId) => {
    const r = await pool.query(
      'SELECT * FROM requirements WHERE feature_id = $1 ORDER BY created_at ASC',
      [featureId]
    );
    return r.rows;
  },

  create: async ({ feature_id, sprint_id, title, description, status = 'Draft', priority = 'Medium', created_by }, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO requirements (feature_id, sprint_id, title, description, status, priority, created_by, org_id, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
      [feature_id || null, sprint_id || null, title, description || null, status, priority, created_by || null, orgId]
    );
    return requirementOperations.getById(r.rows[0].id);
  },

  update: async (id, { feature_id, sprint_id, title, description, status, priority }) => {
    await pool.query(
      `UPDATE requirements SET feature_id=$1, sprint_id=$2, title=$3, description=$4, status=$5, priority=$6, updated_at=NOW() WHERE id=$7`,
      [feature_id || null, sprint_id || null, title, description || null, status, priority, id]
    );
    return requirementOperations.getById(id);
  },

  delete: async (id) => {
    // Explicitly delete test cases first (ON DELETE CASCADE may not exist on older DB)
    await pool.query('DELETE FROM test_cases WHERE requirement_id = $1', [id]);
    return pool.query('DELETE FROM requirements WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Test Case Operations
// ---------------------------------------------------------------------------
const testCaseOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT tc.*, r.title as requirement_title FROM test_cases tc
       LEFT JOIN requirements r ON tc.requirement_id = r.id
       WHERE tc.org_id = $1 ORDER BY tc.created_at ASC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query(
      `SELECT tc.*, r.title as requirement_title FROM test_cases tc
       LEFT JOIN requirements r ON tc.requirement_id = r.id
       WHERE tc.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  },

  getByRequirementId: async (requirementId) => {
    const r = await pool.query(
      'SELECT * FROM test_cases WHERE requirement_id = $1 ORDER BY created_at ASC',
      [requirementId]
    );
    return r.rows;
  },

  create: async ({ requirement_id, title, description, preconditions, test_steps, expected_result, type = 'Manual', priority = 'Medium', status = 'Draft', test_file_id, created_by }, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO test_cases (requirement_id, title, description, preconditions, test_steps, expected_result, type, priority, status, test_file_id, created_by, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [requirement_id || null, title, description || null, preconditions || null, test_steps || null, expected_result || null, type, priority, status, test_file_id || null, created_by || null, orgId]
    );
    return testCaseOperations.getById(r.rows[0].id);
  },

  update: async (id, { requirement_id, title, description, preconditions, test_steps, expected_result, type, priority, status, test_file_id }) => {
    await pool.query(
      `UPDATE test_cases SET requirement_id=$1, title=$2, description=$3, preconditions=$4, test_steps=$5,
       expected_result=$6, type=$7, priority=$8, status=$9, test_file_id=$10, updated_at=NOW() WHERE id=$11`,
      [requirement_id || null, title, description || null, preconditions || null, test_steps || null, expected_result || null, type, priority, status, test_file_id || null, id]
    );
    return testCaseOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM test_cases WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Manual Test Run Operations
// ---------------------------------------------------------------------------
const manualTestRunOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT mtr.*, tc.title as test_case_title FROM manual_test_runs mtr
       LEFT JOIN test_cases tc ON mtr.test_case_id = tc.id
       WHERE mtr.org_id = $1 ORDER BY mtr.created_at DESC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM manual_test_runs WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getByTestCaseId: async (testCaseId) => {
    const r = await pool.query(
      'SELECT * FROM manual_test_runs WHERE test_case_id = $1 ORDER BY created_at DESC',
      [testCaseId]
    );
    return r.rows;
  },

  create: async ({ test_case_id, status = 'Not Run', executed_by, execution_notes }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO manual_test_runs (test_case_id, status, executed_by, execution_notes, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [test_case_id || null, status, executed_by || null, execution_notes || null, orgId]
    );
    return manualTestRunOperations.getById(r.rows[0].id);
  },

  update: async (id, { status, executed_by, execution_notes }) => {
    await pool.query(
      'UPDATE manual_test_runs SET status=$1, executed_by=$2, execution_notes=$3 WHERE id=$4',
      [status, executed_by || null, execution_notes || null, id]
    );
    return manualTestRunOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM manual_test_runs WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Defect Operations
// ---------------------------------------------------------------------------
const defectOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT d.*, tc.title as linked_test_case_title, s.name as sprint_name FROM defects d
       LEFT JOIN test_cases tc ON d.linked_test_case_id = tc.id
       LEFT JOIN sprints s ON d.sprint_id = s.id
       WHERE d.org_id = $1 ORDER BY d.created_at DESC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM defects WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  create: async ({ title, description, severity = 'Medium', status = 'Open', linked_test_case_id, linked_execution_id, sprint_id, screenshot, created_by, assigned_to }, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO defects (title, description, severity, status, linked_test_case_id, linked_execution_id, sprint_id, screenshot, created_by, assigned_to, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [title, description || null, severity, status, linked_test_case_id || null, linked_execution_id || null, sprint_id || null, screenshot || null, created_by || null, assigned_to || null, orgId]
    );
    return defectOperations.getById(r.rows[0].id);
  },

  update: async (id, { title, description, severity, status, linked_test_case_id, linked_execution_id, sprint_id, screenshot, assigned_to }) => {
    await pool.query(
      `UPDATE defects SET title=$1, description=$2, severity=$3, status=$4, linked_test_case_id=$5,
       linked_execution_id=$6, sprint_id=$7, screenshot=$8, assigned_to=$9, updated_at=NOW() WHERE id=$10`,
      [title, description || null, severity, status, linked_test_case_id || null, linked_execution_id || null, sprint_id || null, screenshot || null, assigned_to || null, id]
    );
    return defectOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM defects WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Defect Comment / History Operations
// ---------------------------------------------------------------------------
const defectCommentOperations = {
  getByDefectId: async (defectId) => {
    const r = await pool.query('SELECT * FROM defect_comments WHERE defect_id = $1 ORDER BY created_at ASC', [defectId]);
    return r.rows;
  },
  create: async ({ defectId, authorId, authorName, content }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO defect_comments (defect_id, author_id, author_name, content, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [defectId, authorId || null, authorName || null, content, orgId]
    );
    return r.rows[0];
  }
};

const defectHistoryOperations = {
  getByDefectId: async (defectId) => {
    const r = await pool.query('SELECT * FROM defect_history WHERE defect_id = $1 ORDER BY created_at DESC', [defectId]);
    return r.rows;
  },
  create: async ({ defectId, changedById, changedByUsername, field, oldValue, newValue }, orgId = 1) => {
    await pool.query(
      'INSERT INTO defect_history (defect_id, changed_by_id, changed_by_username, field, old_value, new_value, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [defectId, changedById || null, changedByUsername || null, field, oldValue ?? null, newValue ?? null, orgId]
    );
  }
};

// ---------------------------------------------------------------------------
// Sprint Operations
// ---------------------------------------------------------------------------
const sprintOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM sprints WHERE org_id = $1 ORDER BY created_at DESC', [orgId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM sprints WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getByIdWithMetrics: async (id) => {
    const sprintRes = await pool.query('SELECT * FROM sprints WHERE id = $1', [id]);
    const sprint = sprintRes.rows[0];
    if (!sprint) return null;

    const [
      totalTCRes,
      autoTCRes,
      manualTCRes,
      manualRunsRes,
      reqRes,
      defectRes,
      defectsByStatusRes
    ] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT tc.id) as count FROM test_cases tc
        INNER JOIN requirements r ON tc.requirement_id = r.id WHERE r.sprint_id = $1`, [id]),
      pool.query(`SELECT COUNT(DISTINCT tc.id) as count FROM test_cases tc
        INNER JOIN requirements r ON tc.requirement_id = r.id WHERE r.sprint_id = $1 AND tc.type = 'Automated'`, [id]),
      pool.query(`SELECT COUNT(DISTINCT tc.id) as count FROM test_cases tc
        INNER JOIN requirements r ON tc.requirement_id = r.id WHERE r.sprint_id = $1 AND tc.type = 'Manual'`, [id]),
      pool.query(`SELECT mtr.status, COUNT(*) as count FROM manual_test_runs mtr
        INNER JOIN test_cases tc ON mtr.test_case_id = tc.id
        INNER JOIN requirements r ON tc.requirement_id = r.id
        WHERE r.sprint_id = $1 GROUP BY mtr.status`, [id]),
      pool.query(`SELECT COUNT(*) as count FROM requirements WHERE sprint_id = $1`, [id]),
      pool.query(`SELECT COUNT(*) as count FROM defects WHERE sprint_id = $1`, [id]),
      pool.query(`SELECT status, COUNT(*) as count FROM defects WHERE sprint_id = $1 GROUP BY status`, [id])
    ]);

    let automationExecutions = 0;
    if (sprint.start_date && sprint.end_date) {
      const execRes = await pool.query(
        `SELECT COUNT(*) as count FROM executions WHERE created_at >= $1 AND created_at <= $2`,
        [sprint.start_date, sprint.end_date]
      );
      automationExecutions = parseInt(execRes.rows[0].count, 10);
    } else {
      const execRes = await pool.query(
        `SELECT COUNT(DISTINCT e.id) as count FROM executions e
         INNER JOIN defects d ON e.id = d.linked_execution_id WHERE d.sprint_id = $1`,
        [id]
      );
      automationExecutions = parseInt(execRes.rows[0].count, 10);
    }

    const manualTestRuns = { passed: 0, failed: 0, blocked: 0, total: 0 };
    manualRunsRes.rows.forEach(row => {
      const key = row.status.toLowerCase();
      manualTestRuns[key] = parseInt(row.count, 10);
      manualTestRuns.total += parseInt(row.count, 10);
    });

    const defectsByStatus = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    defectsByStatusRes.rows.forEach(row => {
      const rawKey = row.status.replace(/ /g, '');
      const key = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
      defectsByStatus[key] = parseInt(row.count, 10);
    });

    return {
      ...sprint,
      metrics: {
        totalRequirements:  parseInt(reqRes.rows[0].count, 10),
        totalTestCases:     parseInt(totalTCRes.rows[0].count, 10),
        automatedTestCases: parseInt(autoTCRes.rows[0].count, 10),
        manualTestCases:    parseInt(manualTCRes.rows[0].count, 10),
        manualTestRuns,
        automationExecutions,
        totalDefects:       parseInt(defectRes.rows[0].count, 10),
        defectsByStatus
      }
    };
  },

  create: async ({ name, goal, start_date, end_date, status = 'Planned' }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO sprints (name, goal, start_date, end_date, status, org_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, goal || null, start_date || null, end_date || null, status, orgId]
    );
    return sprintOperations.getById(r.rows[0].id);
  },

  update: async (id, { name, goal, start_date, end_date, status }) => {
    await pool.query(
      'UPDATE sprints SET name=$1, goal=$2, start_date=$3, end_date=$4, status=$5, updated_at=NOW() WHERE id=$6',
      [name, goal || null, start_date || null, end_date || null, status, id]
    );
    return sprintOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM sprints WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Task Operations
// ---------------------------------------------------------------------------
const taskOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT t.*, r.title AS requirement_title, u.username AS assignee_username
       FROM tasks t
       LEFT JOIN requirements r ON t.requirement_id = r.id
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.org_id = $1 ORDER BY t.created_at DESC`,
      [orgId]
    );
    return r.rows;
  },

  getBySprintId: async (sprintId) => {
    const r = await pool.query(
      `SELECT t.*, r.title AS requirement_title, u.username AS assignee_username
       FROM tasks t
       LEFT JOIN requirements r ON t.requirement_id = r.id
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.sprint_id = $1 ORDER BY t.created_at DESC`,
      [sprintId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  create: async (task, orgId = 1) => {
    const r = await pool.query(
      `INSERT INTO tasks (title, description, sprint_id, assignee_id, status, priority, created_by,
       start_date, end_date, planned_hours, completed_hours, requirement_id, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        task.title,
        task.description || null,
        task.sprintId || null,
        task.assigneeId || null,
        task.status || 'New',
        task.priority || 'Medium',
        task.createdBy || null,
        task.startDate || null,
        task.endDate || null,
        task.plannedHours != null ? parseFloat(task.plannedHours) : 0,
        task.completedHours != null ? parseFloat(task.completedHours) : 0,
        task.requirementId || null,
        orgId
      ]
    );
    return taskOperations.getById(r.rows[0].id);
  },

  update: async (id, task) => {
    await pool.query(
      `UPDATE tasks SET title=$1, description=$2, sprint_id=$3, assignee_id=$4, status=$5, priority=$6,
       start_date=$7, end_date=$8, planned_hours=$9, completed_hours=$10, requirement_id=$11, updated_at=NOW()
       WHERE id=$12`,
      [
        task.title,
        task.description || null,
        task.sprintId || null,
        task.assigneeId || null,
        task.status,
        task.priority,
        task.startDate || null,
        task.endDate || null,
        task.plannedHours != null ? parseFloat(task.plannedHours) : 0,
        task.completedHours != null ? parseFloat(task.completedHours) : 0,
        task.requirementId || null,
        id
      ]
    );
    return taskOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Task Comment Operations
// ---------------------------------------------------------------------------
const taskCommentOperations = {
  getByTaskId: async (taskId) => {
    const r = await pool.query(
      'SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC',
      [taskId]
    );
    return r.rows;
  },
  create: async ({ taskId, authorId, authorName, content }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO task_comments (task_id, author_id, author_name, content, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [taskId, authorId || null, authorName || null, content, orgId]
    );
    return r.rows[0];
  }
};

// ---------------------------------------------------------------------------
// Task History Operations
// ---------------------------------------------------------------------------
const taskHistoryOperations = {
  getByTaskId: async (taskId) => {
    const r = await pool.query(
      'SELECT * FROM task_history WHERE task_id = $1 ORDER BY created_at DESC',
      [taskId]
    );
    return r.rows;
  },
  create: async ({ taskId, changedById, changedByUsername, field, oldValue, newValue }, orgId = 1) => {
    await pool.query(
      'INSERT INTO task_history (task_id, changed_by_id, changed_by_username, field, old_value, new_value, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [taskId, changedById || null, changedByUsername || null, field, oldValue ?? null, newValue ?? null, orgId]
    );
  }
};

// ---------------------------------------------------------------------------
// Feature Comment / History Operations
// ---------------------------------------------------------------------------
const featureCommentOperations = {
  getByFeatureId: async (featureId) => {
    const r = await pool.query('SELECT * FROM feature_comments WHERE feature_id = $1 ORDER BY created_at ASC', [featureId]);
    return r.rows;
  },
  create: async ({ featureId, authorId, authorName, content }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO feature_comments (feature_id, author_id, author_name, content, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [featureId, authorId || null, authorName || null, content, orgId]
    );
    return r.rows[0];
  }
};

const featureHistoryOperations = {
  getByFeatureId: async (featureId) => {
    const r = await pool.query('SELECT * FROM feature_history WHERE feature_id = $1 ORDER BY created_at DESC', [featureId]);
    return r.rows;
  },
  create: async ({ featureId, changedById, changedByUsername, field, oldValue, newValue }, orgId = 1) => {
    await pool.query(
      'INSERT INTO feature_history (feature_id, changed_by_id, changed_by_username, field, old_value, new_value, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [featureId, changedById || null, changedByUsername || null, field, oldValue ?? null, newValue ?? null, orgId]
    );
  }
};

// ---------------------------------------------------------------------------
// Requirement Comment / History Operations
// ---------------------------------------------------------------------------
const requirementCommentOperations = {
  getByRequirementId: async (requirementId) => {
    const r = await pool.query('SELECT * FROM requirement_comments WHERE requirement_id = $1 ORDER BY created_at ASC', [requirementId]);
    return r.rows;
  },
  create: async ({ requirementId, authorId, authorName, content }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO requirement_comments (requirement_id, author_id, author_name, content, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [requirementId, authorId || null, authorName || null, content, orgId]
    );
    return r.rows[0];
  }
};

const requirementHistoryOperations = {
  getByRequirementId: async (requirementId) => {
    const r = await pool.query('SELECT * FROM requirement_history WHERE requirement_id = $1 ORDER BY created_at DESC', [requirementId]);
    return r.rows;
  },
  create: async ({ requirementId, changedById, changedByUsername, field, oldValue, newValue }, orgId = 1) => {
    await pool.query(
      'INSERT INTO requirement_history (requirement_id, changed_by_id, changed_by_username, field, old_value, new_value, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [requirementId, changedById || null, changedByUsername || null, field, oldValue ?? null, newValue ?? null, orgId]
    );
  }
};

// ---------------------------------------------------------------------------
// Test Case Comment / History Operations
// ---------------------------------------------------------------------------
const testCaseCommentOperations = {
  getByTestCaseId: async (testCaseId) => {
    const r = await pool.query('SELECT * FROM test_case_comments WHERE test_case_id = $1 ORDER BY created_at ASC', [testCaseId]);
    return r.rows;
  },
  create: async ({ testCaseId, authorId, authorName, content }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO test_case_comments (test_case_id, author_id, author_name, content, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [testCaseId, authorId || null, authorName || null, content, orgId]
    );
    return r.rows[0];
  }
};

const testCaseHistoryOperations = {
  getByTestCaseId: async (testCaseId) => {
    const r = await pool.query('SELECT * FROM test_case_history WHERE test_case_id = $1 ORDER BY created_at DESC', [testCaseId]);
    return r.rows;
  },
  create: async ({ testCaseId, changedById, changedByUsername, field, oldValue, newValue }, orgId = 1) => {
    await pool.query(
      'INSERT INTO test_case_history (test_case_id, changed_by_id, changed_by_username, field, old_value, new_value, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [testCaseId, changedById || null, changedByUsername || null, field, oldValue ?? null, newValue ?? null, orgId]
    );
  }
};

// ---------------------------------------------------------------------------
// User Operations
// ---------------------------------------------------------------------------
const userOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT u.id, u.username, u.role, u.custom_role_id, u.is_active, u.created_at, u.permissions,
              c.username as created_by_username,
              cr.name as custom_role_name
       FROM users u
       LEFT JOIN users c ON u.created_by = c.id
       LEFT JOIN custom_roles cr ON u.custom_role_id = cr.id
       WHERE u.org_id = $1 AND u.role != 'super_admin'
       ORDER BY u.created_at ASC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query(
      'SELECT id, username, role, custom_role_id, is_active, created_at, org_id, permissions FROM users WHERE id = $1',
      [id]
    );
    return r.rows[0] || null;
  },

  getByUsername: async (username) => {
    const r = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return r.rows[0] || null;
  },

  create: async (user, orgId = 1) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(user.password, salt, 64).toString('hex');
    const permJson = (user.permissions && user.permissions.length > 0) ? JSON.stringify(user.permissions) : null;
    const r = await pool.query(
      `INSERT INTO users (username, password_hash, salt, role, custom_role_id, created_by, org_id, permissions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [user.username, hash, salt, user.role || 'contributor', user.customRoleId || null, user.createdBy || null, orgId, permJson]
    );
    return userOperations.getById(r.rows[0].id);
  },

  verifyPassword: (plaintext, storedHash, salt) => {
    const inputHash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
    return inputHash === storedHash;
  },

  update: async (id, updates) => {
    const permJson = updates.permissions !== undefined
      ? ((updates.permissions && updates.permissions.length > 0) ? JSON.stringify(updates.permissions) : null)
      : undefined;
    const isActive = updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : 1;

    if (updates.password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(updates.password, salt, 64).toString('hex');
      if (permJson !== undefined) {
        await pool.query(
          `UPDATE users SET username=$1, password_hash=$2, salt=$3, role=$4, custom_role_id=$5, is_active=$6, permissions=$7 WHERE id=$8`,
          [updates.username, hash, salt, updates.role, updates.customRoleId || null, isActive, permJson, id]
        );
      } else {
        await pool.query(
          `UPDATE users SET username=$1, password_hash=$2, salt=$3, role=$4, custom_role_id=$5, is_active=$6 WHERE id=$7`,
          [updates.username, hash, salt, updates.role, updates.customRoleId || null, isActive, id]
        );
      }
    } else {
      if (permJson !== undefined) {
        await pool.query(
          `UPDATE users SET username=$1, role=$2, custom_role_id=$3, is_active=$4, permissions=$5 WHERE id=$6`,
          [updates.username, updates.role, updates.customRoleId || null, isActive, permJson, id]
        );
      } else {
        await pool.query(
          `UPDATE users SET username=$1, role=$2, custom_role_id=$3, is_active=$4 WHERE id=$5`,
          [updates.username, updates.role, updates.customRoleId || null, isActive, id]
        );
      }
    }
    return userOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM users WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Custom Role Operations
// ---------------------------------------------------------------------------
const customRoleOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT cr.*, u.username as created_by_username
       FROM custom_roles cr
       LEFT JOIN users u ON cr.created_by = u.id
       WHERE cr.org_id = $1 ORDER BY cr.created_at ASC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM custom_roles WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  create: async ({ name, permissions, createdBy }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO custom_roles (name, permissions, created_by, org_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, JSON.stringify(permissions || []), createdBy || null, orgId]
    );
    return customRoleOperations.getById(r.rows[0].id);
  },

  update: async (id, { name, permissions }) => {
    await pool.query(
      'UPDATE custom_roles SET name=$1, permissions=$2 WHERE id=$3',
      [name, JSON.stringify(permissions || []), id]
    );
    return customRoleOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM custom_roles WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Wiki Operations
// ---------------------------------------------------------------------------
const wikiOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query(
      `SELECT id, title, parent_id, sort_order, created_by, created_at, updated_at
       FROM wiki_pages WHERE org_id = $1
       ORDER BY parent_id ASC NULLS FIRST, sort_order ASC, title ASC`,
      [orgId]
    );
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM wiki_pages WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  create: async ({ title, content = '', parentId = null, createdBy = null }, orgId = 1) => {
    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) as m FROM wiki_pages
       WHERE ($1::INTEGER IS NULL AND parent_id IS NULL) OR parent_id = $1`,
      [parentId]
    );
    const nextOrder = (parseInt(maxRes.rows[0].m, 10) || 0) + 1;
    const r = await pool.query(
      `INSERT INTO wiki_pages (title, content, parent_id, sort_order, created_by, org_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, content, parentId, nextOrder, createdBy, orgId]
    );
    return wikiOperations.getById(r.rows[0].id);
  },

  update: async (id, { title, content }) => {
    await pool.query(
      `UPDATE wiki_pages SET title=$1, content=$2, updated_at=NOW() WHERE id=$3`,
      [title, content, id]
    );
    return wikiOperations.getById(id);
  },

  delete: async (id) => {
    return pool.query('DELETE FROM wiki_pages WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Settings Operations
// ---------------------------------------------------------------------------
const settingsOperations = {
  get: async (key) => {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0] ? r.rows[0].value : null;
  },

  set: async (key, value) => {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, String(value)]
    );
  },

  getAll: async () => {
    const r = await pool.query('SELECT key, value FROM settings');
    return Object.fromEntries(r.rows.map(row => [row.key, row.value]));
  }
};

// ---------------------------------------------------------------------------
// Global Variable Operations
// ---------------------------------------------------------------------------
const globalVariableOperations = {
  getAll: async (orgId = 1) => {
    const r = await pool.query('SELECT * FROM global_variables WHERE org_id = $1 ORDER BY key ASC', [orgId]);
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM global_variables WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getAllAsEnv: async (orgId = 1) => {
    const r = await pool.query('SELECT key, value FROM global_variables WHERE org_id = $1', [orgId]);
    return Object.fromEntries(r.rows.map(row => [row.key, row.value]));
  },

  create: async ({ key, value, description }, orgId = 1) => {
    const r = await pool.query(
      'INSERT INTO global_variables (key, value, description, org_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [key, value ?? '', description ?? '', orgId]
    );
    return globalVariableOperations.getById(r.rows[0].id);
  },

  update: async (id, { key, value, description }) => {
    await pool.query(
      'UPDATE global_variables SET key=$1, value=$2, description=$3, updated_at=NOW() WHERE id=$4',
      [key, value ?? '', description ?? '', id]
    );
    return globalVariableOperations.getById(id);
  },

  upsertByKey: async (key, value, orgId = 1) => {
    const existing = await pool.query(
      'SELECT id FROM global_variables WHERE key = $1 AND org_id = $2',
      [key, orgId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE global_variables SET value=$1, updated_at=NOW() WHERE id=$2',
        [value ?? '', existing.rows[0].id]
      );
      return globalVariableOperations.getById(existing.rows[0].id);
    }
    const r = await pool.query(
      'INSERT INTO global_variables (key, value, description, org_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [key, value ?? '', '', orgId]
    );
    return globalVariableOperations.getById(r.rows[0].id);
  },

  getByKey: async (key, orgId = 1) => {
    const r = await pool.query(
      'SELECT * FROM global_variables WHERE key = $1 AND org_id = $2',
      [key, orgId]
    );
    return r.rows[0] || null;
  },

  delete: async (id) => {
    return pool.query('DELETE FROM global_variables WHERE id = $1', [id]);
  }
};

// ---------------------------------------------------------------------------
// Organization Operations
// ---------------------------------------------------------------------------
const organizationOperations = {
  getAll: async () => {
    const r = await pool.query('SELECT * FROM organizations ORDER BY created_at ASC');
    return r.rows;
  },

  getById: async (id) => {
    const r = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  getBySlug: async (slug) => {
    const r = await pool.query('SELECT * FROM organizations WHERE LOWER(slug) = LOWER($1)', [slug]);
    return r.rows[0] || null;
  },

  create: async ({ name, slug, plan = 'free', maxUsers = null, pocName = null, pocEmail = null, aiHealingEnabled = 0, openaiApiKey = null }) => {
    const r = await pool.query(
      'INSERT INTO organizations (name, slug, plan, max_users, poc_name, poc_email, ai_healing_enabled, openai_api_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [name, slug, plan, maxUsers || null, pocName || null, pocEmail || null, aiHealingEnabled ? 1 : 0, openaiApiKey || null]
    );
    return organizationOperations.getById(r.rows[0].id);
  },

  update: async (id, { name, plan, is_active, maxUsers, pocName, pocEmail, aiHealingEnabled, openaiApiKey }) => {
    await pool.query(
      `UPDATE organizations
       SET name=$1, plan=$2, is_active=$3, max_users=$4, poc_name=$5, poc_email=$6,
           ai_healing_enabled=$7,
           openai_api_key = CASE WHEN $8::TEXT IS NOT NULL THEN $8::TEXT ELSE openai_api_key END
       WHERE id=$9`,
      [
        name,
        plan,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        maxUsers ?? null,
        pocName ?? null,
        pocEmail ?? null,
        aiHealingEnabled !== undefined ? (aiHealingEnabled ? 1 : 0) : 0,
        (openaiApiKey !== undefined && openaiApiKey !== null && openaiApiKey !== '') ? openaiApiKey : null,
        id
      ]
    );
    return organizationOperations.getById(id);
  }
};

// ---------------------------------------------------------------------------
// Session persistence (DB-backed so sessions survive server restarts)
// ---------------------------------------------------------------------------
const sessionOperations = {
  create: async (token, data) => {
    await pool.query(
      `INSERT INTO auth_sessions (token, user_id, username, role, org_id, custom_role_id, permissions, custom_role_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (token) DO UPDATE SET user_id=$2, username=$3, role=$4, org_id=$5, custom_role_id=$6, permissions=$7, custom_role_name=$8`,
      [token, data.userId, data.username, data.role, data.orgId || 1,
       data.customRoleId || null,
       data.permissions ? JSON.stringify(data.permissions) : null,
       data.customRoleName || null]
    );
  },
  getAll: async () => {
    const r = await pool.query('SELECT * FROM auth_sessions');
    return r.rows;
  },
  delete: async (token) => {
    await pool.query('DELETE FROM auth_sessions WHERE token = $1', [token]);
  },
  deleteByUserId: async (userId) => {
    await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
  },
};

// ---------------------------------------------------------------------------
// Enquiry Operations
// ---------------------------------------------------------------------------
const enquiryOperations = {
  create: async ({ name, email, company, team_size, message }) => {
    const r = await pool.query(
      `INSERT INTO enquiries (name, email, company, team_size, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, email, company || null, team_size || null, message]
    );
    return r.rows[0];
  },
  getAll: async () => {
    const r = await pool.query('SELECT * FROM enquiries ORDER BY created_at DESC');
    return r.rows;
  }
};

// ---------------------------------------------------------------------------
// Platform Feedback (Feature Requests) Operations
// ---------------------------------------------------------------------------
const platformFeedbackOperations = {
  create: async ({ title, description, submitted_by, org_slug, org_id }) => {
    const r = await pool.query(
      `INSERT INTO platform_feedback (title, description, submitted_by, org_slug, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description, submitted_by, org_slug || null, org_id || null]
    );
    return r.rows[0];
  },
  getAll: async () => {
    const r = await pool.query('SELECT * FROM platform_feedback ORDER BY created_at DESC');
    return r.rows;
  },
  updateStatus: async (id, status) => {
    await pool.query('UPDATE platform_feedback SET status=$1 WHERE id=$2', [status, id]);
  }
};

// ---------------------------------------------------------------------------
// Platform Bug Reports Operations
// ---------------------------------------------------------------------------
const platformBugReportOperations = {
  create: async ({ title, description, steps, severity, submitted_by, org_slug, org_id }) => {
    const r = await pool.query(
      `INSERT INTO platform_bug_reports (title, description, steps, severity, submitted_by, org_slug, org_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, description, steps || null, severity || 'medium', submitted_by, org_slug || null, org_id || null]
    );
    return r.rows[0];
  },
  getAll: async () => {
    const r = await pool.query('SELECT * FROM platform_bug_reports ORDER BY created_at DESC');
    return r.rows;
  },
  updateStatus: async (id, status) => {
    await pool.query('UPDATE platform_bug_reports SET status=$1 WHERE id=$2', [status, id]);
  }
};

// ---------------------------------------------------------------------------
// Initialise on startup
// ---------------------------------------------------------------------------
initDB().catch((err) => {
  console.error('Fatal: database initialisation failed', err.message);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Exports (pool exposed for direct queries in server.js)
// ---------------------------------------------------------------------------
module.exports = {
  pool,
  organizationOperations,
  moduleOperations,
  testFileOperations,
  executionOperations,
  testSuiteOperations,
  suiteTestFileOperations,
  suiteExecutionOperations,
  suiteTestResultOperations,
  testFileDependencyOperations,
  featureOperations,
  requirementOperations,
  testCaseOperations,
  manualTestRunOperations,
  defectOperations,
  defectCommentOperations,
  defectHistoryOperations,
  sprintOperations,
  taskOperations,
  taskCommentOperations,
  taskHistoryOperations,
  featureCommentOperations,
  featureHistoryOperations,
  requirementCommentOperations,
  requirementHistoryOperations,
  testCaseCommentOperations,
  testCaseHistoryOperations,
  sessionOperations,
  userOperations,
  customRoleOperations,
  wikiOperations,
  settingsOperations,
  globalVariableOperations,
  enquiryOperations,
  platformFeedbackOperations,
  platformBugReportOperations
};
