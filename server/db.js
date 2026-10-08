/**
 * ScamRadar Database Initialisation Module
 * Uses better-sqlite3 for synchronous SQLite operations
 * All JSON fields are stored as TEXT and must be serialized/deserialized
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'scamradar.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function initDb() {
  // Lineages table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS lineages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      script_type TEXT NOT NULL,
      act_sequence TEXT NOT NULL,
      created_date TEXT NOT NULL,
      complaint_count INTEGER NOT NULL DEFAULT 0,
      nowcast_count INTEGER NOT NULL DEFAULT 0,
      growth_rate TEXT NOT NULL,
      status TEXT NOT NULL,
      churn_rate TEXT NOT NULL,
      churn_speed_days REAL NOT NULL,
      language_distribution TEXT NOT NULL,
      description TEXT
    )
  `).run();

  // Complaints table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      reported_date TEXT NOT NULL,
      ingested_date TEXT NOT NULL,
      source_bank TEXT NOT NULL,
      language TEXT NOT NULL,
      script_type TEXT NOT NULL,
      lineage_id TEXT NOT NULL,
      identifiers TEXT NOT NULL,
      reporter_hash TEXT NOT NULL,
      analyst_tags TEXT NOT NULL
    )
  `).run();

  // Identifiers table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS identifiers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      raw TEXT NOT NULL,
      value_hash TEXT NOT NULL,
      lineage_id TEXT NOT NULL,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      complaint_count INTEGER NOT NULL DEFAULT 0
    )
  `).run();

  // Alerts table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      lineage_id TEXT NOT NULL,
      script_type TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      observed_count INTEGER NOT NULL,
      nowcast_count INTEGER NOT NULL,
      recommended_action TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      acknowledged_by TEXT,
      dismiss_reason TEXT
    )
  `).run();

  // Audit logs table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      analyst_hash TEXT NOT NULL,
      action TEXT NOT NULL,
      affected_lineage TEXT NOT NULL,
      details TEXT NOT NULL,
      system_hash TEXT NOT NULL
    )
  `).run();

  // Poisoning queue table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS poisoning_queue (
      id TEXT PRIMARY KEY,
      reporter_hash TEXT NOT NULL,
      target_lineage_id TEXT NOT NULL,
      complaint_count_24h INTEGER NOT NULL,
      flagged_timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      sample_text TEXT NOT NULL,
      suspected_intent TEXT NOT NULL
    )
  `).run();

  // Calibration table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS calibration (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  console.log('✓ Database initialized successfully');
}

module.exports = { db, initDb };
