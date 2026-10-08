/**
 * ScamRadar — Complaints Route
 */

const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { db } = require('../db');
const { classifyComplaint, checkPoisoning, quickHash, maskIdentifier } = require('../classifier');

const upload = multer({ storage: multer.memoryStorage() });

// Shared ingest logic
function ingestOneComplaint({ rawText, reportedDate, sourceBank, language, reporterHash, analystTags }) {
  const classification = classifyComplaint(rawText, language, db);
  const assignedLineageId = classification.assignedLineage.id;

  // Check poisoning
  const recentCount = checkPoisoning(reporterHash, assignedLineageId, db);
  if (recentCount > 5) {
    const poisonId = `POI-${Math.floor(100 + Math.random() * 900)}`;
    const flaggedTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    db.prepare(`
      INSERT OR REPLACE INTO poisoning_queue (id, reporter_hash, target_lineage_id, complaint_count_24h,
        flagged_timestamp, status, sample_text, suspected_intent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poisonId, reporterHash, assignedLineageId, recentCount + 1, flaggedTimestamp,
      'Held for Admin Review',
      rawText.substring(0, 120) + (rawText.length > 120 ? '...' : ''),
      'High-Frequency Reporter Anomaly / Potential Smear Attempt'
    );

    // Log the poisoning flag
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const systemHash = quickHash(`${timestamp}|${reporterHash}|POISONING_ATTEMPT_FLAGGED|${assignedLineageId}`);
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, analyst_hash, action, affected_lineage, details, system_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `AUD-${Math.floor(1000 + Math.random() * 9000)}`, timestamp, reporterHash,
      'POISONING_ATTEMPT_FLAGGED', assignedLineageId,
      `Reporter exceeded 5 complaints/24h threshold (${recentCount + 1} filed). Held for Admin review.`,
      systemHash
    );

    return {
      success: false,
      poisoned: true,
      message: `Submission flagged by Poisoning Resistance Layer: single reporter exceeded 5 submissions to this lineage in 24h. Held for admin review.`
    };
  }

  // Check if lineage exists, create if not
  const existingLineage = db.prepare('SELECT * FROM lineages WHERE id = ?').get(assignedLineageId);
  if (!existingLineage) {
    const newLineageActs = JSON.stringify(classification.extractedActs);
    db.prepare(`
      INSERT INTO lineages (id, name, script_type, act_sequence, created_date, complaint_count,
        nowcast_count, growth_rate, status, churn_rate, churn_speed_days, language_distribution, description)
      VALUES (?, ?, ?, ?, ?, 0, 0, 'Rising', 'Monitoring', 'Medium', 2.5, '{}', ?)
    `).run(
      assignedLineageId,
      classification.assignedLineage.name,
      classification.assignedLineage.script_type,
      newLineageActs,
      new Date().toISOString().split('T')[0],
      `Induction script discovered with sequence ${classification.extractedActs.join(' → ')}`
    );

    const auditTs = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const auditHash = quickHash(`${auditTs}|0xSYSTEM_INDUCER|NEW_LINEAGE_CREATED|${assignedLineageId}`);
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, analyst_hash, action, affected_lineage, details, system_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `AUD-${Math.floor(1000 + Math.random() * 9000)}`, auditTs, '0xSYSTEM_INDUCER',
      'NEW_LINEAGE_CREATED', assignedLineageId,
      `Induced new script lineage with confidence ${(classification.confidenceScore * 100).toFixed(1)}%`,
      auditHash
    );
  }

  // Create complaint record
  const cmpId = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
  const today = new Date().toISOString().split('T')[0];
  const extractedIds = classification.extractedIdentifiers;

  db.prepare(`
    INSERT INTO complaints (id, raw_text, reported_date, ingested_date, source_bank, language,
      script_type, lineage_id, identifiers, reporter_hash, analyst_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cmpId, rawText, reportedDate || today, today,
    sourceBank || 'Bank A',
    classification.language,
    classification.assignedLineage.script_type,
    assignedLineageId,
    JSON.stringify(extractedIds),
    reporterHash || '0xANON',
    JSON.stringify(analystTags || ['Auto-Ingested'])
  );

  // Update lineage counts
  const lineage = db.prepare('SELECT * FROM lineages WHERE id = ?').get(assignedLineageId);
  const langDist = JSON.parse(lineage.language_distribution || '{}');
  langDist[classification.language] = (langDist[classification.language] || 0) + 1;
  const newComplaintCount = lineage.complaint_count + 1;

  // Recalculate nowcast
  const cal = {};
  db.prepare('SELECT key, value FROM calibration').all().forEach(r => { cal[r.key] = Number(r.value); });
  const instantPercent = cal.instantPercent || 20;
  const delayedPercent = cal.delayedPercent || 60;
  const severeTailPercent = cal.severeTailPercent || 20;
  const criticalGrowthThreshold = cal.criticalGrowthThreshold || 15;

  const multiplier = 1 + (delayedPercent * 0.007 + severeTailPercent * 0.012);
  const newNowcast = Math.round(newComplaintCount * multiplier);
  const dailyRate = newComplaintCount * 0.28;

  let newGrowthRate = 'Slow';
  if (dailyRate >= criticalGrowthThreshold || newNowcast > 70) newGrowthRate = 'Critical';
  else if (dailyRate >= criticalGrowthThreshold * 0.5 || newNowcast > 35) newGrowthRate = 'Rising';

  let newStatus = lineage.status;
  if (newGrowthRate === 'Critical' && lineage.status !== 'Resolved') {
    newStatus = 'Alert';
    // Check if alert already exists
    const existingAlert = db.prepare(
      "SELECT id FROM alerts WHERE lineage_id = ? AND status = 'Active'"
    ).get(assignedLineageId);
    if (!existingAlert) {
      const newAlertId = `ALT-2026-${Math.floor(100 + Math.random() * 900)}`;
      const alertTs = new Date().toISOString().replace('T', ' ').substring(0, 16);
      db.prepare(`
        INSERT INTO alerts (id, lineage_id, script_type, trigger_reason, observed_count,
          nowcast_count, recommended_action, status, created_at, acknowledged_by, dismiss_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `).run(
        newAlertId, assignedLineageId, lineage.script_type,
        `Nowcast-corrected volume (${newNowcast}) crossed critical surveillance threshold; growth rate flagged as Critical.`,
        newComplaintCount, newNowcast,
        newNowcast > 80 ? 'Escalate to I4C' : 'File DPIP Report',
        'Active', alertTs
      );
    }
  }

  db.prepare(`
    UPDATE lineages SET complaint_count = ?, nowcast_count = ?, growth_rate = ?, status = ?,
      language_distribution = ? WHERE id = ?
  `).run(newComplaintCount, newNowcast, newGrowthRate, newStatus, JSON.stringify(langDist), assignedLineageId);

  // Upsert identifiers (masked storage is handled in GET — raw stored here for internal use only)
  function upsertIdentifier(type, rawVal) {
    if (!rawVal) return;
    const valHash = quickHash(rawVal);
    const existing = db.prepare(
      'SELECT id FROM identifiers WHERE raw = ? AND lineage_id = ?'
    ).get(rawVal, assignedLineageId);
    if (existing) {
      db.prepare(`
        UPDATE identifiers SET last_seen = ?, complaint_count = complaint_count + 1 WHERE id = ?
      `).run(today, existing.id);
    } else {
      db.prepare(`
        INSERT INTO identifiers (id, type, raw, value_hash, lineage_id, first_seen, last_seen, complaint_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(`ID-${Math.floor(100 + Math.random() * 900)}`, type, rawVal, valHash, assignedLineageId, today, today);
    }
  }
  if (extractedIds.phone) upsertIdentifier('phone', extractedIds.phone);
  if (extractedIds.upi) upsertIdentifier('upi', extractedIds.upi);
  if (extractedIds.url) upsertIdentifier('url', extractedIds.url);

  // Audit log
  const auditTs = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const auditHash = quickHash(`${auditTs}|0xANALYST_OP|COMPLAINT_INGESTED|${assignedLineageId}|${cmpId}`);
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, analyst_hash, action, affected_lineage, details, system_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `AUD-${Math.floor(1000 + Math.random() * 9000)}`, auditTs, reporterHash || '0xANALYST_OP',
    'COMPLAINT_INGESTED', assignedLineageId,
    `Ingested complaint ${cmpId}. Lineage count now ${newComplaintCount}`,
    auditHash
  );

  const updatedLineage = db.prepare('SELECT * FROM lineages WHERE id = ?').get(assignedLineageId);
  return {
    success: true,
    complaint: {
      id: cmpId,
      raw_text: rawText,
      reported_date: reportedDate || today,
      ingested_date: today,
      source_bank: sourceBank || 'Bank A',
      language: classification.language,
      script_type: classification.assignedLineage.script_type,
      lineage_id: assignedLineageId,
      identifiers: extractedIds,
      reporter_hash: reporterHash || '0xANON',
      analyst_tags: analystTags || ['Auto-Ingested']
    },
    lineage: {
      ...updatedLineage,
      act_sequence: JSON.parse(updatedLineage.act_sequence),
      language_distribution: JSON.parse(updatedLineage.language_distribution)
    },
    classification
  };
}

// GET /api/complaints — all complaints with optional lineage_id filter
router.get('/', (req, res) => {
  try {
    const { lineage_id } = req.query;
    let rows;
    if (lineage_id) {
      rows = db.prepare('SELECT * FROM complaints WHERE lineage_id = ? ORDER BY reported_date DESC').all(lineage_id);
    } else {
      rows = db.prepare('SELECT * FROM complaints ORDER BY reported_date DESC').all();
    }
    const parsed = rows.map(c => ({
      ...c,
      identifiers: JSON.parse(c.identifiers),
      analyst_tags: JSON.parse(c.analyst_tags)
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/complaints — ingest one complaint
router.post('/', (req, res) => {
  try {
    const { rawText, reportedDate, sourceBank, language, reporterHash, analystTags } = req.body;
    if (!rawText) return res.status(400).json({ error: 'rawText is required' });

    const result = ingestOneComplaint({ rawText, reportedDate, sourceBank, language, reporterHash, analystTags });
    res.status(result.success ? 201 : 422).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/complaints/bulk — CSV bulk upload
router.post('/bulk', upload.single('csv'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file required (field: csv)' });

    const csvText = req.file.buffer.toString('utf8');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let loaded = 0;
    let poisoned = 0;

    const ingestAll = db.transaction(() => {
      for (const row of records) {
        const rawText = row.message_text || row.raw_text || row.text || '';
        if (!rawText) continue;

        const result = ingestOneComplaint({
          rawText,
          reportedDate: row.reported_date || row.date || null,
          sourceBank: row.source_bank || row.bank || 'Bank A',
          language: row.language || null,
          reporterHash: row.reporter_hash || `0xBATCH_${loaded + 100}`,
          analystTags: ['Bulk-Upload']
        });

        if (result.success) loaded++;
        else if (result.poisoned) poisoned++;
      }
    });
    ingestAll();

    res.json({
      success: true,
      loaded,
      poisoned,
      total: records.length,
      message: `Ingested ${loaded} complaints (${poisoned} flagged for poisoning review)`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, ingestOneComplaint };
