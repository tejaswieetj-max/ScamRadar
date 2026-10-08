/**
 * ScamRadar — Lineages Route
 */

const router = require('express').Router();
const { db } = require('../db');
const { maskIdentifier } = require('../classifier');

// Parse JSON fields from a lineage row
function parseLineage(row) {
  return {
    ...row,
    act_sequence: JSON.parse(row.act_sequence),
    language_distribution: JSON.parse(row.language_distribution)
  };
}

// GET /api/lineages — all lineages
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM lineages ORDER BY complaint_count DESC').all();
    res.json(rows.map(parseLineage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lineages/:id — single lineage
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM lineages WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Lineage not found' });
    res.json(parseLineage(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/lineages/:id — update status and/or growth_rate
router.put('/:id', (req, res) => {
  try {
    const { status, growth_rate } = req.body;
    const row = db.prepare('SELECT * FROM lineages WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Lineage not found' });

    if (status) {
      db.prepare('UPDATE lineages SET status = ? WHERE id = ?').run(status, req.params.id);
    }
    if (growth_rate) {
      db.prepare('UPDATE lineages SET growth_rate = ? WHERE id = ?').run(growth_rate, req.params.id);
    }

    // Audit log the change
    const { quickHash } = require('../classifier');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const analystHash = req.headers['x-analyst-hash'] || '0xSYSTEM';
    const details = `Updated lineage: ${status ? 'status=' + status : ''} ${growth_rate ? 'growth_rate=' + growth_rate : ''}`.trim();
    const combinedStr = `${timestamp}|${analystHash}|LINEAGE_UPDATED|${req.params.id}|${details}`;
    const systemHash = quickHash(combinedStr);
    const auditId = `AUD-${Math.floor(1000 + Math.random() * 9000)}`;
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, analyst_hash, action, affected_lineage, details, system_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(auditId, timestamp, analystHash, 'LINEAGE_UPDATED', req.params.id, details, systemHash);

    const updated = db.prepare('SELECT * FROM lineages WHERE id = ?').get(req.params.id);
    res.json(parseLineage(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lineages/:id/complaints — complaints for a lineage
router.get('/:id/complaints', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM complaints WHERE lineage_id = ? ORDER BY reported_date DESC'
    ).all(req.params.id);

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

// GET /api/lineages/:id/identifiers — identifiers for a lineage (masked)
router.get('/:id/identifiers', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM identifiers WHERE lineage_id = ? ORDER BY complaint_count DESC'
    ).all(req.params.id);

    const masked = rows.map(id => ({
      id: id.id,
      type: id.type,
      masked_value: maskIdentifier(id.raw, id.type),
      value_hash: id.value_hash,
      lineage_id: id.lineage_id,
      first_seen: id.first_seen,
      last_seen: id.last_seen,
      complaint_count: id.complaint_count
      // raw is intentionally excluded
    }));
    res.json(masked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
