/**
 * ScamRadar — Alerts Route
 */

const router = require('express').Router();
const { db } = require('../db');

// GET /api/alerts — all alerts sorted by created_at DESC
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id — update status, acknowledged_by, dismiss_reason
router.put('/:id', (req, res) => {
  try {
    const { status, acknowledged_by, dismiss_reason } = req.body;
    const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Alert not found' });

    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (acknowledged_by) { updates.push('acknowledged_by = ?'); params.push(acknowledged_by); }
    if (dismiss_reason !== undefined) { updates.push('dismiss_reason = ?'); params.push(dismiss_reason); }

    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
