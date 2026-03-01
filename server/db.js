const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Initialize database
const db = new Database(path.join(__dirname, 'playwright-cloud.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    base_url TEXT,
    language TEXT DEFAULT 'TypeScript',
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS test_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    requirement_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    test_file_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    logs TEXT,
    error_message TEXT,
    screenshot_base64 TEXT,
    duration_ms INTEGER,
    report_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    FOREIGN KEY (test_file_id) REFERENCES test_files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_suites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS suite_test_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL,
    test_file_id INTEGER NOT NULL,
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
    FOREIGN KEY (test_file_id) REFERENCES test_files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS suite_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    total_tests INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    report_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS suite_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_execution_id INTEGER NOT NULL,
    test_file_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    logs TEXT,
    screenshot_base64 TEXT,
    FOREIGN KEY (suite_execution_id) REFERENCES suite_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (test_file_id) REFERENCES test_files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_file_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_file_id INTEGER NOT NULL,
    dependency_file_id INTEGER NOT NULL,
    dependency_type TEXT NOT NULL CHECK(dependency_type IN ('before', 'after')),
    execution_order INTEGER DEFAULT 0,
    FOREIGN KEY (test_file_id) REFERENCES test_files(id) ON DELETE CASCADE,
    FOREIGN KEY (dependency_file_id) REFERENCES test_files(id) ON DELETE CASCADE,
    UNIQUE(test_file_id, dependency_file_id, dependency_type)
  );

  CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id INTEGER NOT NULL,
    organization_id INTEGER,
    sprint_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('Draft', 'Approved', 'Implemented')) DEFAULT 'Draft',
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    preconditions TEXT,
    test_steps TEXT,
    expected_result TEXT,
    type TEXT NOT NULL CHECK(type IN ('Manual', 'Automated')) DEFAULT 'Manual',
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
    status TEXT NOT NULL CHECK(status IN ('Draft', 'Ready', 'Deprecated')) DEFAULT 'Draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS manual_test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_case_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Passed', 'Failed', 'Blocked')) DEFAULT 'Passed',
    executed_by TEXT,
    execution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS defects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    status TEXT NOT NULL CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Closed')) DEFAULT 'Open',
    linked_test_case_id INTEGER,
    linked_execution_id INTEGER,
    sprint_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL,
    FOREIGN KEY (linked_execution_id) REFERENCES executions(id) ON DELETE SET NULL,
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    goal TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL CHECK(status IN ('Planned', 'Active', 'Completed')) DEFAULT 'Planned',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add tags column if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(modules)").all();
  const hasTagsColumn = columns.some(col => col.name === 'tags');
  
  if (!hasTagsColumn) {
    db.exec('ALTER TABLE modules ADD COLUMN tags TEXT');
    console.log('Migration: Added tags column to modules table');
  }
} catch (error) {
  console.error('Migration error:', error);
}

// Migration: Add feature_id column to requirements if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(requirements)").all();
  const hasFeatureIdColumn = columns.some(col => col.name === 'feature_id');
  
  if (!hasFeatureIdColumn) {
    // First create a default feature for existing requirements
    const defaultFeature = db.prepare(`
      INSERT INTO features (name, description, priority)
      VALUES ('Legacy Feature', 'Default feature for existing requirements', 'Medium')
    `).run();
    
    // Add the column with default value
    db.exec(`ALTER TABLE requirements ADD COLUMN feature_id INTEGER NOT NULL DEFAULT ${defaultFeature.lastInsertRowid}`);
    console.log('Migration: Added feature_id column to requirements table');
  }
} catch (error) {
  console.error('Migration error for feature_id:', error);
}

// Migration: Add test_file_id column to test_cases if it doesn't exist
try {
  const tcColumns = db.prepare('PRAGMA table_info(test_cases)').all();
  const hasTestFileId = tcColumns.some(col => col.name === 'test_file_id');
  if (!hasTestFileId) {
    db.exec('ALTER TABLE test_cases ADD COLUMN test_file_id INTEGER REFERENCES test_files(id) ON DELETE SET NULL');
    console.log('Migration: Added test_file_id column to test_cases table');
  }
} catch (error) {
  console.error('Migration error for test_file_id:', error);
}

// Migration: Add screenshot column to defects if it doesn't exist
try {
  const defectCols = db.prepare('PRAGMA table_info(defects)').all();
  if (!defectCols.some(col => col.name === 'screenshot')) {
    db.exec('ALTER TABLE defects ADD COLUMN screenshot TEXT');
    console.log('Migration: Added screenshot column to defects table');
  }
} catch (error) {
  console.error('Migration error for defects.screenshot:', error);
}

// Migration: Fix linked_execution_id FK — was wrongly referencing executions, should be manual_test_runs
try {
  const fkList = db.prepare('PRAGMA foreign_key_list(defects)').all();
  const hasWrongFK = fkList.some(fk => fk.from === 'linked_execution_id' && fk.table === 'executions');

  if (hasWrongFK) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE defects_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
        status TEXT NOT NULL CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Closed')) DEFAULT 'Open',
        linked_test_case_id INTEGER,
        linked_execution_id INTEGER,
        sprint_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        screenshot TEXT,
        FOREIGN KEY (linked_test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL,
        FOREIGN KEY (linked_execution_id) REFERENCES manual_test_runs(id) ON DELETE SET NULL,
        FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
      );
      INSERT INTO defects_new SELECT * FROM defects;
      DROP TABLE defects;
      ALTER TABLE defects_new RENAME TO defects;
    `);
    db.pragma('foreign_keys = ON');
    console.log('Migration: Fixed linked_execution_id FK in defects table (executions -> manual_test_runs)');
  }
} catch (error) {
  console.error('Migration error for defects FK fix:', error);
}

// Module operations
const moduleOperations = {
  getAll: () => {
    const modules = db.prepare('SELECT * FROM modules ORDER BY created_at DESC').all();
    return modules.map(module => ({
      ...module,
      tags: module.tags ? JSON.parse(module.tags) : []
    }));
  },

  getById: (id) => {
    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (module && module.tags) {
      module.tags = JSON.parse(module.tags);
    }
    return module;
  },

  create: (module) => {
    const stmt = db.prepare(`
      INSERT INTO modules (name, description, base_url, language, tags)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      module.name,
      module.description || '',
      module.baseUrl || '',
      module.language || 'TypeScript',
      JSON.stringify(module.tags || [])
    );
    return { id: result.lastInsertRowid, ...module };
  },

  update: (id, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.baseUrl !== undefined) {
      fields.push('base_url = ?');
      values.push(updates.baseUrl);
    }
    if (updates.language !== undefined) {
      fields.push('language = ?');
      values.push(updates.language);
    }
    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }
    
    if (fields.length > 0) {
      const stmt = db.prepare(`
        UPDATE modules 
        SET ${fields.join(', ')}
        WHERE id = ?
      `);
      stmt.run(...values, id);
    }
    return moduleOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM modules WHERE id = ?').run(id);
  }
};

// Test file operations
const testFileOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT tf.*, m.name as module_name
      FROM test_files tf
      LEFT JOIN modules m ON tf.module_id = m.id
      ORDER BY m.name ASC, tf.name ASC
    `).all();
  },

  getByModuleId: (moduleId) => {
    return db.prepare(`
      SELECT tf.*, r.title as requirement_title
      FROM test_files tf
      LEFT JOIN requirements r ON tf.requirement_id = r.id
      WHERE tf.module_id = ?
      ORDER BY tf.created_at ASC
    `).all(moduleId);
  },

  getById: (id) => {
    return db.prepare(`
      SELECT tf.*, r.title as requirement_title
      FROM test_files tf
      LEFT JOIN requirements r ON tf.requirement_id = r.id
      WHERE tf.id = ?
    `).get(id);
  },

  getByRequirementId: (requirementId) => {
    return db.prepare(`
      SELECT tf.*, m.name as module_name
      FROM test_files tf
      LEFT JOIN modules m ON tf.module_id = m.id
      WHERE tf.requirement_id = ?
      ORDER BY tf.created_at ASC
    `).all(requirementId);
  },

  create: (testFile) => {
    const stmt = db.prepare(`
      INSERT INTO test_files (module_id, name, content, requirement_id)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      testFile.moduleId,
      testFile.name,
      testFile.content,
      testFile.requirementId || null
    );
    return { id: result.lastInsertRowid, ...testFile };
  },

  update: (id, updates) => {
    // Handle both old update(id, content) and new update(id, {content, requirementId})
    if (typeof updates === 'string') {
      const stmt = db.prepare(`
        UPDATE test_files 
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(updates, id);
    } else {
      const fields = [];
      const values = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
      }
      if (updates.requirementId !== undefined) {
        fields.push('requirement_id = ?');
        values.push(updates.requirementId || null);
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      
      if (fields.length > 1) {
        const stmt = db.prepare(`
          UPDATE test_files 
          SET ${fields.join(', ')}
          WHERE id = ?
        `);
        stmt.run(...values, id);
      }
    }
    return testFileOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM test_files WHERE id = ?').run(id);
  }
};

// Execution operations
const executionOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT 
        e.*,
        m.name as module_name,
        tf.name as test_file_name
      FROM executions e
      LEFT JOIN modules m ON e.module_id = m.id
      LEFT JOIN test_files tf ON e.test_file_id = tf.id
      ORDER BY e.created_at DESC
    `).all();
  },

  getById: (id) => {
    return db.prepare(`
      SELECT 
        e.*,
        m.name as module_name,
        tf.name as test_file_name
      FROM executions e
      LEFT JOIN modules m ON e.module_id = m.id
      LEFT JOIN test_files tf ON e.test_file_id = tf.id
      WHERE e.id = ?
    `).get(id);
  },

  getByModuleId: (moduleId) => {
    return db.prepare(`
      SELECT 
        e.*,
        m.name as module_name,
        tf.name as test_file_name
      FROM executions e
      LEFT JOIN modules m ON e.module_id = m.id
      LEFT JOIN test_files tf ON e.test_file_id = tf.id
      WHERE e.module_id = ?
      ORDER BY e.created_at DESC
    `).all(moduleId);
  },

  create: (execution) => {
    const stmt = db.prepare(`
      INSERT INTO executions (module_id, test_file_id, status, logs, error_message, screenshot_base64, duration_ms, report_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      execution.moduleId,
      execution.testFileId,
      execution.status,
      execution.logs || '',
      execution.errorMessage || null,
      execution.screenshotBase64 || null,
      execution.durationMs || null,
      execution.reportPath || null
    );
    return { id: result.lastInsertRowid, ...execution };
  },

  delete: (id) => {
    return db.prepare('DELETE FROM executions WHERE id = ?').run(id);
  }
};

// Test suite operations
const testSuiteOperations = {
  getAll: () => {
    return db.prepare('SELECT * FROM test_suites ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM test_suites WHERE id = ?').get(id);
  },

  getByModuleId: (moduleId) => {
    return db.prepare('SELECT * FROM test_suites WHERE module_id = ? ORDER BY created_at DESC').all(moduleId);
  },

  create: (suite) => {
    const stmt = db.prepare(`
      INSERT INTO test_suites (module_id, name)
      VALUES (?, ?)
    `);
    const result = stmt.run(
      suite.moduleId,
      suite.name
    );
    return { id: result.lastInsertRowid, ...suite };
  },

  update: (id, name) => {
    const stmt = db.prepare(`
      UPDATE test_suites 
      SET name = ?
      WHERE id = ?
    `);
    stmt.run(name, id);
    return testSuiteOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM test_suites WHERE id = ?').run(id);
  }
};

// Suite test file operations
const suiteTestFileOperations = {
  getBySuiteId: (suiteId) => {
    return db.prepare(`
      SELECT 
        stf.*,
        tf.name as test_file_name,
        tf.content as test_file_content
      FROM suite_test_files stf
      LEFT JOIN test_files tf ON stf.test_file_id = tf.id
      WHERE stf.suite_id = ?
    `).all(suiteId);
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM suite_test_files WHERE id = ?').get(id);
  },

  add: (suiteTestFile) => {
    const stmt = db.prepare(`
      INSERT INTO suite_test_files (suite_id, test_file_id)
      VALUES (?, ?)
    `);
    const result = stmt.run(
      suiteTestFile.suiteId,
      suiteTestFile.testFileId
    );
    return { id: result.lastInsertRowid, ...suiteTestFile };
  },

  remove: (id) => {
    return db.prepare('DELETE FROM suite_test_files WHERE id = ?').run(id);
  },

  removeBySuiteAndTestFile: (suiteId, testFileId) => {
    return db.prepare('DELETE FROM suite_test_files WHERE suite_id = ? AND test_file_id = ?').run(suiteId, testFileId);
  }
};

// Suite execution operations
const suiteExecutionOperations = {
  getAll: () => {
    return db.prepare('SELECT * FROM suite_executions ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM suite_executions WHERE id = ?').get(id);
  },

  getBySuiteId: (suiteId, limit = 30) => {
    return db.prepare('SELECT * FROM suite_executions WHERE suite_id = ? ORDER BY created_at DESC LIMIT ?').all(suiteId, limit);
  },

  create: (suiteExecution) => {
    const stmt = db.prepare(`
      INSERT INTO suite_executions (suite_id, status, total_tests, passed, failed, duration_ms, report_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      suiteExecution.suiteId,
      suiteExecution.status,
      suiteExecution.totalTests,
      suiteExecution.passed,
      suiteExecution.failed,
      suiteExecution.durationMs,
      suiteExecution.reportPath || null
    );
    return { id: result.lastInsertRowid, ...suiteExecution };
  },

  delete: (id) => {
    return db.prepare('DELETE FROM suite_executions WHERE id = ?').run(id);
  }
};

// Suite test result operations
const suiteTestResultOperations = {
  getBySuiteExecutionId: (suiteExecutionId) => {
    return db.prepare(`
      SELECT 
        str.*,
        tf.name as test_file_name
      FROM suite_test_results str
      LEFT JOIN test_files tf ON str.test_file_id = tf.id
      WHERE str.suite_execution_id = ?
    `).all(suiteExecutionId);
  },

  create: (testResult) => {
    const stmt = db.prepare(`
      INSERT INTO suite_test_results (suite_execution_id, test_file_id, status, duration_ms, error_message, logs, screenshot_base64)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      testResult.suiteExecutionId,
      testResult.testFileId,
      testResult.status,
      testResult.durationMs,
      testResult.errorMessage,
      testResult.logs,
      testResult.screenshotBase64 || null
    );
    return { id: result.lastInsertRowid, ...testResult };
  },

  delete: (id) => {
    return db.prepare('DELETE FROM suite_test_results WHERE id = ?').run(id);
  }
};

// Test file dependency operations
const testFileDependencyOperations = {
  // Get all dependencies for a test file
  getByTestFileId: (testFileId) => {
    return db.prepare(`
      SELECT 
        tfd.*,
        tf.name as dependency_name,
        tf.module_id as dependency_module_id
      FROM test_file_dependencies tfd
      LEFT JOIN test_files tf ON tfd.dependency_file_id = tf.id
      WHERE tfd.test_file_id = ?
      ORDER BY tfd.dependency_type, tfd.execution_order
    `).all(testFileId);
  },

  // Get dependencies by type (before/after)
  getByTestFileIdAndType: (testFileId, dependencyType) => {
    return db.prepare(`
      SELECT 
        tfd.*,
        tf.name as dependency_name,
        tf.module_id as dependency_module_id
      FROM test_file_dependencies tfd
      LEFT JOIN test_files tf ON tfd.dependency_file_id = tf.id
      WHERE tfd.test_file_id = ? AND tfd.dependency_type = ?
      ORDER BY tfd.execution_order
    `).all(testFileId, dependencyType);
  },

  // Add a dependency
  add: (dependency) => {
    const stmt = db.prepare(`
      INSERT INTO test_file_dependencies (test_file_id, dependency_file_id, dependency_type, execution_order)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      dependency.testFileId,
      dependency.dependencyFileId,
      dependency.dependencyType,
      dependency.executionOrder || 0
    );
    return { id: result.lastInsertRowid, ...dependency };
  },

  // Remove a dependency
  remove: (testFileId, dependencyFileId, dependencyType) => {
    return db.prepare(`
      DELETE FROM test_file_dependencies 
      WHERE test_file_id = ? AND dependency_file_id = ? AND dependency_type = ?
    `).run(testFileId, dependencyFileId, dependencyType);
  },

  // Remove all dependencies for a test file
  removeAllForTestFile: (testFileId) => {
    return db.prepare('DELETE FROM test_file_dependencies WHERE test_file_id = ?').run(testFileId);
  },

  // Get execution order (all files that need to run for a given test file)
  getExecutionOrder: (testFileId) => {
    const beforeDeps = testFileDependencyOperations.getByTestFileIdAndType(testFileId, 'before');
    const afterDeps = testFileDependencyOperations.getByTestFileIdAndType(testFileId, 'after');
    const mainFile = testFileOperations.getById(testFileId);

    return {
      before: beforeDeps.map(d => ({
        id: d.dependency_file_id,
        name: d.dependency_name,
        module_id: d.dependency_module_id,
        order: d.execution_order
      })),
      main: mainFile ? { id: mainFile.id, name: mainFile.name, module_id: mainFile.module_id } : null,
      after: afterDeps.map(d => ({
        id: d.dependency_file_id,
        name: d.dependency_name,
        module_id: d.dependency_module_id,
        order: d.execution_order
      }))
    };
  }
};

// Feature operations
const featureOperations = {
  getAll: () => {
    return db.prepare('SELECT * FROM features ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM features WHERE id = ?').get(id);
  },

  create: (feature) => {
    const stmt = db.prepare(`
      INSERT INTO features (name, description, priority)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      feature.name,
      feature.description || null,
      feature.priority || 'Medium'
    );
    return { id: result.lastInsertRowid, ...feature };
  },

  update: (id, feature) => {
    const stmt = db.prepare(`
      UPDATE features 
      SET name = ?,
          description = ?,
          priority = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      feature.name,
      feature.description || null,
      feature.priority,
      id
    );
    return featureOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM features WHERE id = ?').run(id);
  }
};

// Requirement operations
const requirementOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT r.*, f.name as feature_name 
      FROM requirements r
      LEFT JOIN features f ON r.feature_id = f.id
      ORDER BY r.created_at DESC
    `).all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM requirements WHERE id = ?').get(id);
  },

  getByFeatureId: (featureId) => {
    return db.prepare(`
      SELECT r.*, s.name as sprint_name 
      FROM requirements r
      LEFT JOIN sprints s ON r.sprint_id = s.id
      WHERE r.feature_id = ?
      ORDER BY r.created_at DESC
    `).all(featureId);
  },

  create: (requirement) => {
    const stmt = db.prepare(`
      INSERT INTO requirements (feature_id, organization_id, sprint_id, title, description, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      requirement.featureId,
      requirement.organizationId || null,
      requirement.sprintId || null,
      requirement.title,
      requirement.description || null,
      requirement.status || 'Draft',
      requirement.priority || 'Medium'
    );
    return { id: result.lastInsertRowid, ...requirement };
  },

  update: (id, requirement) => {
    const stmt = db.prepare(`
      UPDATE requirements 
      SET feature_id = ?,
          organization_id = ?,
          sprint_id = ?,
          title = ?,
          description = ?,
          status = ?,
          priority = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      requirement.featureId,
      requirement.organizationId || null,
      requirement.sprintId || null,
      requirement.title,
      requirement.description || null,
      requirement.status,
      requirement.priority,
      id
    );
    return requirementOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM requirements WHERE id = ?').run(id);
  }
};

// Test case operations
const testCaseOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT 
        tc.*,
        r.title as requirement_title,
        r.sprint_id,
        s.name as sprint_name,
        s.status as sprint_status,
        tf.name as test_file_name,
        tf.module_id as test_file_module_id,
        m.name as test_file_module_name
      FROM test_cases tc
      LEFT JOIN requirements r ON tc.requirement_id = r.id
      LEFT JOIN sprints s ON r.sprint_id = s.id
      LEFT JOIN test_files tf ON tc.test_file_id = tf.id
      LEFT JOIN modules m ON tf.module_id = m.id
      ORDER BY tc.created_at DESC
    `).all();
  },

  getById: (id) => {
    return db.prepare(`
      SELECT 
        tc.*,
        r.title as requirement_title,
        r.sprint_id,
        s.name as sprint_name,
        s.status as sprint_status,
        tf.name as test_file_name,
        tf.module_id as test_file_module_id,
        m.name as test_file_module_name
      FROM test_cases tc
      LEFT JOIN requirements r ON tc.requirement_id = r.id
      LEFT JOIN sprints s ON r.sprint_id = s.id
      LEFT JOIN test_files tf ON tc.test_file_id = tf.id
      LEFT JOIN modules m ON tf.module_id = m.id
      WHERE tc.id = ?
    `).get(id);
  },

  getByRequirementId: (requirementId) => {
    return db.prepare('SELECT * FROM test_cases WHERE requirement_id = ? ORDER BY created_at DESC').all(requirementId);
  },

  create: (testCase) => {
    const stmt = db.prepare(`
      INSERT INTO test_cases (requirement_id, title, description, preconditions, test_steps, expected_result, type, priority, status, test_file_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      testCase.requirementId || null,
      testCase.title,
      testCase.description || null,
      testCase.preconditions || null,
      testCase.testSteps || null,
      testCase.expectedResult || null,
      testCase.type || 'Manual',
      testCase.priority || 'Medium',
      testCase.status || 'Draft',
      testCase.testFileId || null
    );
    return testCaseOperations.getById(result.lastInsertRowid);
  },

  update: (id, testCase) => {
    const stmt = db.prepare(`
      UPDATE test_cases 
      SET requirement_id = ?,
          title = ?,
          description = ?,
          preconditions = ?,
          test_steps = ?,
          expected_result = ?,
          type = ?,
          priority = ?,
          status = ?,
          test_file_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      testCase.requirementId || null,
      testCase.title,
      testCase.description || null,
      testCase.preconditions || null,
      testCase.testSteps || null,
      testCase.expectedResult || null,
      testCase.type,
      testCase.priority,
      testCase.status,
      testCase.testFileId || null,
      id
    );
    return testCaseOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);
  }
};

const manualTestRunOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT 
        mtr.*,
        tc.title as test_case_title,
        tc.type as test_case_type
      FROM manual_test_runs mtr
      LEFT JOIN test_cases tc ON mtr.test_case_id = tc.id
      ORDER BY mtr.created_at DESC
    `).all();
  },

  getById: (id) => {
    return db.prepare(`
      SELECT 
        mtr.*,
        tc.title as test_case_title,
        tc.type as test_case_type
      FROM manual_test_runs mtr
      LEFT JOIN test_cases tc ON mtr.test_case_id = tc.id
      WHERE mtr.id = ?
    `).get(id);
  },

  getByTestCaseId: (testCaseId) => {
    return db.prepare(`
      SELECT * FROM manual_test_runs 
      WHERE test_case_id = ? 
      ORDER BY created_at DESC
    `).all(testCaseId);
  },

  create: (testRun) => {
    const stmt = db.prepare(`
      INSERT INTO manual_test_runs (test_case_id, status, executed_by, execution_notes)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      testRun.testCaseId,
      testRun.status || 'Passed',
      testRun.executedBy || null,
      testRun.executionNotes || null
    );
    return { id: result.lastInsertRowid, ...testRun };
  },

  update: (id, testRun) => {
    const stmt = db.prepare(`
      UPDATE manual_test_runs 
      SET status = ?,
          executed_by = ?,
          execution_notes = ?
      WHERE id = ?
    `);
    stmt.run(
      testRun.status,
      testRun.executedBy || null,
      testRun.executionNotes || null,
      id
    );
    return manualTestRunOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM manual_test_runs WHERE id = ?').run(id);
  }
};

const defectOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT 
        d.*,
        tc.title as test_case_title,
        tf.name as execution_test_file,
        s.name as sprint_name,
        s.status as sprint_status
      FROM defects d
      LEFT JOIN test_cases tc ON d.linked_test_case_id = tc.id
      LEFT JOIN executions e ON d.linked_execution_id = e.id
      LEFT JOIN test_files tf ON e.test_file_id = tf.id
      LEFT JOIN sprints s ON d.sprint_id = s.id
      ORDER BY d.created_at DESC
    `).all();
  },

  getById: (id) => {
    return db.prepare(`
      SELECT 
        d.*,
        tc.title as test_case_title,
        tf.name as execution_test_file,
        s.name as sprint_name,
        s.status as sprint_status
      FROM defects d
      LEFT JOIN test_cases tc ON d.linked_test_case_id = tc.id
      LEFT JOIN executions e ON d.linked_execution_id = e.id
      LEFT JOIN test_files tf ON e.test_file_id = tf.id
      LEFT JOIN sprints s ON d.sprint_id = s.id
      WHERE d.id = ?
    `).get(id);
  },

  create: (defect) => {
    const stmt = db.prepare(`
      INSERT INTO defects (title, description, severity, status, linked_test_case_id, linked_execution_id, sprint_id, screenshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      defect.title,
      defect.description || null,
      defect.severity || 'Medium',
      defect.status || 'Open',
      defect.linkedTestCaseId || null,
      defect.linkedExecutionId || null,
      defect.sprintId || null,
      defect.screenshot || null
    );
    return defectOperations.getById(result.lastInsertRowid);
  },

  update: (id, defect) => {
    const stmt = db.prepare(`
      UPDATE defects 
      SET title = ?,
          description = ?,
          severity = ?,
          status = ?,
          linked_test_case_id = ?,
          linked_execution_id = ?,
          sprint_id = ?,
          screenshot = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      defect.title,
      defect.description || null,
      defect.severity,
      defect.status,
      defect.linkedTestCaseId || null,
      defect.linkedExecutionId || null,
      defect.sprintId || null,
      defect.screenshot !== undefined ? defect.screenshot : null,
      id
    );
    return defectOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM defects WHERE id = ?').run(id);
  }
};

// Sprint operations
const sprintOperations = {
  getAll: () => {
    return db.prepare('SELECT * FROM sprints ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  },

  getByIdWithMetrics: (id) => {
    const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
    
    if (!sprint) {
      return null;
    }

    // Get total test cases via requirements
    const totalTestCasesQuery = db.prepare(`
      SELECT COUNT(DISTINCT tc.id) as count
      FROM test_cases tc
      INNER JOIN requirements r ON tc.requirement_id = r.id
      WHERE r.sprint_id = ?
    `);
    const totalTestCases = totalTestCasesQuery.get(id).count;

    // Get automated test cases count
    const automatedTestCasesQuery = db.prepare(`
      SELECT COUNT(DISTINCT tc.id) as count
      FROM test_cases tc
      INNER JOIN requirements r ON tc.requirement_id = r.id
      WHERE r.sprint_id = ? AND tc.type = 'Automated'
    `);
    const automatedTestCases = automatedTestCasesQuery.get(id).count;

    // Get manual test cases count
    const manualTestCasesQuery = db.prepare(`
      SELECT COUNT(DISTINCT tc.id) as count
      FROM test_cases tc
      INNER JOIN requirements r ON tc.requirement_id = r.id
      WHERE r.sprint_id = ? AND tc.type = 'Manual'
    `);
    const manualTestCases = manualTestCasesQuery.get(id).count;

    // Get manual test runs by status
    const manualTestRunsQuery = db.prepare(`
      SELECT 
        mtr.status,
        COUNT(*) as count
      FROM manual_test_runs mtr
      INNER JOIN test_cases tc ON mtr.test_case_id = tc.id
      INNER JOIN requirements r ON tc.requirement_id = r.id
      WHERE r.sprint_id = ?
      GROUP BY mtr.status
    `);
    const manualTestRunsRaw = manualTestRunsQuery.all(id);
    
    // Convert to object for easier access
    const manualTestRuns = {
      passed: 0,
      failed: 0,
      blocked: 0,
      total: 0
    };
    
    manualTestRunsRaw.forEach(row => {
      const status = row.status.toLowerCase();
      manualTestRuns[status] = row.count;
      manualTestRuns.total += row.count;
    });

    // Get automation executions for this sprint
    // Count executions that occurred within sprint date range
    let automationExecutions = 0;
    
    if (sprint.start_date && sprint.end_date) {
      const executionsQuery = db.prepare(`
        SELECT COUNT(*) as count
        FROM executions
        WHERE created_at >= ? AND created_at <= ?
      `);
      automationExecutions = executionsQuery.get(sprint.start_date, sprint.end_date).count;
    } else {
      // If no dates, count executions linked via defects to this sprint
      const executionsViaDefectsQuery = db.prepare(`
        SELECT COUNT(DISTINCT e.id) as count
        FROM executions e
        INNER JOIN defects d ON e.id = d.linked_execution_id
        WHERE d.sprint_id = ?
      `);
      automationExecutions = executionsViaDefectsQuery.get(id).count;
    }

    // Get total requirements count
    const requirementsQuery = db.prepare(`
      SELECT COUNT(*) as count
      FROM requirements
      WHERE sprint_id = ?
    `);
    const totalRequirements = requirementsQuery.get(id).count;

    // Get total defects count
    const defectsQuery = db.prepare(`
      SELECT COUNT(*) as count
      FROM defects
      WHERE sprint_id = ?
    `);
    const totalDefects = defectsQuery.get(id).count;

    // Get defects by status
    const defectsByStatusQuery = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM defects
      WHERE sprint_id = ?
      GROUP BY status
    `);
    const defectsByStatusRaw = defectsByStatusQuery.all(id);
    
    const defectsByStatus = {
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0
    };
    
    defectsByStatusRaw.forEach(row => {
      const key = row.status.replace(' ', '').charAt(0).toLowerCase() + row.status.replace(' ', '').slice(1);
      defectsByStatus[key] = row.count;
    });

    return {
      ...sprint,
      metrics: {
        totalRequirements,
        totalTestCases,
        automatedTestCases,
        manualTestCases,
        automationCoverage: totalTestCases > 0 
          ? Math.round((automatedTestCases / totalTestCases) * 100) 
          : 0,
        manualTestRuns,
        automationExecutions,
        totalDefects,
        defectsByStatus
      }
    };
  },

  create: (sprint) => {
    const stmt = db.prepare(`
      INSERT INTO sprints (name, goal, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sprint.name,
      sprint.goal || null,
      sprint.startDate || null,
      sprint.endDate || null,
      sprint.status || 'Planned'
    );
    return sprintOperations.getById(result.lastInsertRowid);
  },

  update: (id, sprint) => {
    const stmt = db.prepare(`
      UPDATE sprints 
      SET name = ?,
          goal = ?,
          start_date = ?,
          end_date = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      sprint.name,
      sprint.goal || null,
      sprint.startDate || null,
      sprint.endDate || null,
      sprint.status,
      id
    );
    return sprintOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
  }
};

// ===== Custom Roles Table =====
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch (error) {
  console.error('Migration error for custom_roles table:', error);
}

// ===== Users Table (with extended role support) =====
try {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  const schemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  const hasRestrictiveCheck = schemaRow && schemaRow.sql && schemaRow.sql.includes("CHECK(role IN ('admin'");
  const hasCustomRoleId = columns.some(c => c.name === 'custom_role_id');

  if (hasRestrictiveCheck || !hasCustomRoleId) {
    // Recreate users table: remove restrictive CHECK, add custom_role_id
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'contributor',
        custom_role_id INTEGER,
        created_by INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const colNames = columns.map(c => c.name);
    const selectCols = colNames.includes('custom_role_id')
      ? colNames.join(', ')
      : colNames.map(c => c === 'created_at' ? 'created_at' : c).join(', ') + ', NULL as custom_role_id_placeholder';
    // Simple copy: existing columns + NULL for custom_role_id
    const existingCols = colNames.join(', ');
    db.exec(`INSERT OR IGNORE INTO users_v2 (id, username, password_hash, salt, role, created_by, is_active, created_at) SELECT id, username, password_hash, salt, role, created_by, is_active, created_at FROM users`);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_v2 RENAME TO users');
    console.log('Migrated users table to support extended roles (super_admin, custom)');
  }
} catch (error) {
  console.error('Migration error for users table:', error);
}

// Seed default admin if no users exist
try {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    db.prepare(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)`)
      .run('admin', hash, salt, 'admin');
    console.log('Default admin created — username: admin  password: admin123');
  }
} catch (error) {
  console.error('Error seeding default admin:', error);
}

// Seed super_admin if none exists
try {
  const saCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'").get();
  if (saCount.count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('playwright2403', salt, 64).toString('hex');
    db.prepare(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)`)
      .run('admin01', hash, salt, 'super_admin');
    console.log('Default super admin created — username: admin01  password: playwright2403');
  } else {
    // Migrate existing super_admin to new credentials if still using old username
    const existing = db.prepare("SELECT id FROM users WHERE username = 'superadmin' AND role = 'super_admin'").get();
    if (existing) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync('playwright2403', salt, 64).toString('hex');
      db.prepare(`UPDATE users SET username = ?, password_hash = ?, salt = ? WHERE id = ?`)
        .run('admin01', hash, salt, existing.id);
      console.log('Super admin credentials updated — username: admin01  password: playwright2403');
    }
  }
} catch (error) {
  console.error('Error seeding super_admin:', error);
}


const userOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT u.id, u.username, u.role, u.custom_role_id, u.is_active, u.created_at,
             c.username as created_by_username,
             cr.name as custom_role_name
      FROM users u
      LEFT JOIN users c ON u.created_by = c.id
      LEFT JOIN custom_roles cr ON u.custom_role_id = cr.id
      ORDER BY u.created_at ASC
    `).all();
  },

  getById: (id) => {
    return db.prepare('SELECT id, username, role, custom_role_id, is_active, created_at FROM users WHERE id = ?').get(id);
  },

  getByUsername: (username) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  create: (user) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(user.password, salt, 64).toString('hex');
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, custom_role_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.username, hash, salt, user.role || 'contributor', user.customRoleId || null, user.createdBy || null);
    return userOperations.getById(result.lastInsertRowid);
  },

  verifyPassword: (plaintext, storedHash, salt) => {
    const inputHash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
    return inputHash === storedHash;
  },

  update: (id, updates) => {
    if (updates.password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(updates.password, salt, 64).toString('hex');
      db.prepare(`UPDATE users SET username = ?, password_hash = ?, salt = ?, role = ?, custom_role_id = ?, is_active = ? WHERE id = ?`)
        .run(updates.username, hash, salt, updates.role, updates.customRoleId || null, updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : 1, id);
    } else {
      db.prepare(`UPDATE users SET username = ?, role = ?, custom_role_id = ?, is_active = ? WHERE id = ?`)
        .run(updates.username, updates.role, updates.customRoleId || null, updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : 1, id);
    }
    return userOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
};

const customRoleOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT cr.*, u.username as created_by_username
      FROM custom_roles cr
      LEFT JOIN users u ON cr.created_by = u.id
      ORDER BY cr.created_at ASC
    `).all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM custom_roles WHERE id = ?').get(id);
  },

  create: ({ name, permissions, createdBy }) => {
    const result = db.prepare('INSERT INTO custom_roles (name, permissions, created_by) VALUES (?, ?, ?)')
      .run(name, JSON.stringify(permissions || []), createdBy || null);
    return customRoleOperations.getById(result.lastInsertRowid);
  },

  update: (id, { name, permissions }) => {
    db.prepare('UPDATE custom_roles SET name = ?, permissions = ? WHERE id = ?')
      .run(name, JSON.stringify(permissions || []), id);
    return customRoleOperations.getById(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM custom_roles WHERE id = ?').run(id);
  }
};

// Wiki pages table
db.exec(`
  CREATE TABLE IF NOT EXISTS wiki_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    parent_id INTEGER REFERENCES wiki_pages(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const wikiOperations = {
  getAll: () => {
    return db.prepare(`
      SELECT id, title, parent_id, sort_order, created_by, created_at, updated_at
      FROM wiki_pages ORDER BY parent_id ASC, sort_order ASC, title ASC
    `).all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(id);
  },

  create: ({ title, content = '', parentId = null, createdBy = null }) => {
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order),0) as m FROM wiki_pages WHERE parent_id IS ?'
    ).get(parentId);
    const result = db.prepare(
      `INSERT INTO wiki_pages (title, content, parent_id, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(title, content, parentId, (maxOrder.m || 0) + 1, createdBy);
    return db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(result.lastInsertRowid);
  },

  update: (id, { title, content }) => {
    db.prepare(
      `UPDATE wiki_pages SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(title, content, id);
    return db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(id);
  }
};

// ===== Settings Table =====
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Seed default user_limit (0 = unlimited)
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('user_limit', '0');
} catch (error) {
  console.error('Migration error for settings table:', error);
}

const settingsOperations = {
  get: (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  set: (key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  },
  getAll: () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
};

module.exports = {
  db,
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
  sprintOperations,
  userOperations,
  customRoleOperations,
  wikiOperations,
  settingsOperations
};
