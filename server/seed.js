/**
 * ScamRadar Database Seed Script
 * Reads seed data from js/data.js and inserts into SQLite
 */

const { db, initDb } = require('./db');
const path = require('path');

// Initialize database tables
initDb();

// We'll manually extract the seed data by evaluating the data.js file
// and pulling constants from the global scope
const dataJsPath = path.join(__dirname, '..', 'js', 'data.js');

// Load the data by requiring as module (need to add temp exports)
const Module = require('module');
const originalCompile = Module.prototype._compile;

let seedData = {};

Module.prototype._compile = function(content, filename) {
  if (filename === dataJsPath) {
    // Append exports at the end
    content += `\nif (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        quickHash,
        maskIdentifier,
        defaultCalibration,
        initialLineages,
        initialIdentifiers,
        initialComplaints,
        initialAlerts,
        initialAuditLogs,
        initialPoisoningQueue
      };
    }`;
  }
  return originalCompile.call(this, content, filename);
};

seedData = require(dataJsPath);

Module.prototype._compile = originalCompile;

const {
  defaultCalibration,
  initialLineages,
  initialIdentifiers,
  initialComplaints,
  initialAlerts,
  initialAuditLogs,
  initialPoisoningQueue
} = seedData;

// Helper to serialize JSON fields
function serialize(obj) {
  return JSON.stringify(obj);
}

// Seed lineages
const lineageStmt = db.prepare(`
  INSERT OR REPLACE INTO lineages (
    id, name, script_type, act_sequence, created_date, complaint_count,
    nowcast_count, growth_rate, status, churn_rate, churn_speed_days,
    language_distribution, description
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedLineages = db.transaction(() => {
  for (const l of initialLineages) {
    lineageStmt.run(
      l.id, l.name, l.script_type, serialize(l.act_sequence), l.created_date,
      l.complaint_count, l.nowcast_count, l.growth_rate, l.status, l.churn_rate,
      l.churn_speed_days, serialize(l.language_distribution), l.description
    );
  }
});
seedLineages();

// Seed identifiers
const identifierStmt = db.prepare(`
  INSERT OR REPLACE INTO identifiers (
    id, type, raw, value_hash, lineage_id, first_seen, last_seen, complaint_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedIdentifiers = db.transaction(() => {
  for (const i of initialIdentifiers) {
    identifierStmt.run(
      i.id, i.type, i.raw, i.value_hash, i.lineage_id, i.first_seen, i.last_seen, i.complaint_count
    );
  }
});
seedIdentifiers();

// Seed complaints
const complaintStmt = db.prepare(`
  INSERT OR REPLACE INTO complaints (
    id, raw_text, reported_date, ingested_date, source_bank, language,
    script_type, lineage_id, identifiers, reporter_hash, analyst_tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedComplaints = db.transaction(() => {
  for (const c of initialComplaints) {
    complaintStmt.run(
      c.id, c.raw_text, c.reported_date, c.ingested_date, c.source_bank, c.language,
      c.script_type, c.lineage_id, serialize(c.identifiers), c.reporter_hash, serialize(c.analyst_tags)
    );
  }
});
seedComplaints();

// Seed alerts
const alertStmt = db.prepare(`
  INSERT OR REPLACE INTO alerts (
    id, lineage_id, script_type, trigger_reason, observed_count, nowcast_count,
    recommended_action, status, created_at, acknowledged_by, dismiss_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedAlerts = db.transaction(() => {
  for (const a of initialAlerts) {
    alertStmt.run(
      a.id, a.lineage_id, a.script_type, a.trigger_reason, a.observed_count, a.nowcast_count,
      a.recommended_action, a.status, a.created_at, a.acknowledged_by || null, a.dismiss_reason || null
    );
  }
});
seedAlerts();

// Seed audit logs
const auditStmt = db.prepare(`
  INSERT OR REPLACE INTO audit_logs (
    id, timestamp, analyst_hash, action, affected_lineage, details, system_hash
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const seedAuditLogs = db.transaction(() => {
  for (const a of initialAuditLogs) {
    auditStmt.run(
      a.id, a.timestamp, a.analyst_hash, a.action, a.affected_lineage, a.details, a.system_hash
    );
  }
});
seedAuditLogs();

// Seed poisoning queue
const poisoningStmt = db.prepare(`
  INSERT OR REPLACE INTO poisoning_queue (
    id, reporter_hash, target_lineage_id, complaint_count_24h, flagged_timestamp,
    status, sample_text, suspected_intent
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedPoisoning = db.transaction(() => {
  for (const p of initialPoisoningQueue) {
    poisoningStmt.run(
      p.id, p.reporter_hash, p.target_lineage_id, p.complaint_count_24h, p.flagged_timestamp,
      p.status, p.sample_text, p.suspected_intent
    );
  }
});
seedPoisoning();

// Seed calibration
const calibrationStmt = db.prepare(`
  INSERT OR REPLACE INTO calibration (key, value) VALUES (?, ?)
`);

const seedCalibration = db.transaction(() => {
  for (const [key, value] of Object.entries(defaultCalibration)) {
    calibrationStmt.run(key, String(value));
  }
});
seedCalibration();

// Print summary
const counts = {
  lineages: db.prepare('SELECT COUNT(*) as n FROM lineages').get().n,
  identifiers: db.prepare('SELECT COUNT(*) as n FROM identifiers').get().n,
  complaints: db.prepare('SELECT COUNT(*) as n FROM complaints').get().n,
  alerts: db.prepare('SELECT COUNT(*) as n FROM alerts').get().n,
  auditLogs: db.prepare('SELECT COUNT(*) as n FROM audit_logs').get().n,
  poisoning: db.prepare('SELECT COUNT(*) as n FROM poisoning_queue').get().n,
  calibration: db.prepare('SELECT COUNT(*) as n FROM calibration').get().n
};

console.log(`✓ Seeded ${counts.lineages} lineages, ${counts.identifiers} identifiers, ${counts.complaints} complaints, ${counts.alerts} alerts, ${counts.auditLogs} audit logs, ${counts.poisoning} poisoning items, ${counts.calibration} calibration keys`);

db.close();
