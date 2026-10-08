# ScamRadar — Backend + Dataset Integration Implementation Plan

## Environment Note
Node.js is **not installed** on this machine. The first item installs it via Homebrew. Every subsequent verification step assumes `node` and `npm` are on PATH after that install.

---

## Implementation Plan

- [ ] 1. Install Node.js and initialise the project `package.json`
      Node.js is absent from PATH; install via Homebrew so the backend can actually run. Then create `package.json` at the workspace root with all required dependencies pinned to exact versions.
      
      **Decision:** Use `better-sqlite3@9.4.3` (synchronous API, no async overhead, well-tested with Express). Use `csv-parse@5.5.3` for streaming CSV ingest. Use `node-fetch@2.7.0` (CommonJS-compatible, no ESM migration needed). Use `multer@1.4.5-lts.1` for CSV uploads. Use `nodemon@3.0.3` as devDependency.
      
      Files: `/Users/tejaswie/Desktop/thinkroot/package.json`
      
      Verify:
      ```
      # In /Users/tejaswie/Desktop/thinkroot:
      brew install node          # installs Node LTS
      npm install                # installs all deps; node_modules/ should exist
      node -e "require('better-sqlite3'); console.log('ok')"
      ```

- [ ] 2. Create SQLite database initialisation module `server/db.js`
      Creates all 7 tables on first run using `CREATE TABLE IF NOT EXISTS`. JSON columns (`act_sequence`, `language_distribution`, `identifiers`, `analyst_tags`) are stored as `TEXT` and must be serialised/deserialised by every caller. Exposes a single `db` export (the `better-sqlite3` Database instance) and a `initDb()` function.
      
      **Decision:** Keep db.js as a plain CommonJS module exporting the already-opened db instance (not a class). This matches `better-sqlite3`'s synchronous style and avoids passing the db handle around.
      
      Tables to create (column types match data.js exactly):
      - `lineages(id TEXT PK, name, script_type, act_sequence TEXT, created_date, complaint_count INT, nowcast_count INT, growth_rate, status, churn_rate, churn_speed_days REAL, language_distribution TEXT, description)`
      - `complaints(id TEXT PK, raw_text, reported_date, ingested_date, source_bank, language, script_type, lineage_id TEXT, identifiers TEXT, reporter_hash, analyst_tags TEXT)`
      - `identifiers(id TEXT PK, type, raw, value_hash, lineage_id TEXT, first_seen, last_seen, complaint_count INT)`
      - `alerts(id TEXT PK, lineage_id TEXT, script_type, trigger_reason, observed_count INT, nowcast_count INT, recommended_action, status, created_at, acknowledged_by, dismiss_reason)`
      - `audit_logs(id TEXT PK, timestamp, analyst_hash, action, affected_lineage, details, system_hash)`
      - `poisoning_queue(id TEXT PK, reporter_hash, target_lineage_id TEXT, complaint_count_24h INT, flagged_timestamp, status, sample_text, suspected_intent)`
      - `calibration(key TEXT PK, value TEXT)`
      
      Files: `/Users/tejaswie/Desktop/thinkroot/server/db.js`
      
      Verify:
      ```
      node -e "const {initDb} = require('./server/db'); initDb(); console.log('tables ok')"
      ls server/scamradar.db   # file should exist
      ```

- [ ] 3. Create seed script `server/seed.js`
      Reads the seed objects (`initialLineages`, `initialIdentifiers`, `initialComplaints`, `initialAlerts`, `initialAuditLogs`, `initialPoisoningQueue`, `defaultCalibration`) directly from `js/data.js` by requiring it (the file uses `function` declarations and `const` — wrap the require with a small shim that evaluates the file and reads the globals, or copy the data inline). Inserts every record with `INSERT OR REPLACE INTO`. Serialises all JSON fields to strings before INSERT. Also inserts all `defaultCalibration` key-value pairs into the `calibration` table. Prints a summary like "Seeded N lineages, M complaints…".
      
      **Decision:** Use Node's `vm.runInNewContext()` to evaluate `js/data.js` without a module wrapper, capturing its globals. This avoids duplicating the seed data and keeps `js/data.js` as the single source of truth.
      
      Files: `/Users/tejaswie/Desktop/thinkroot/server/seed.js`
      
      Verify:
      ```
      node server/seed.js
      # Expected output: "Seeded 6 lineages, 16 identifiers, 13 complaints, 4 alerts, 5 audit logs, 1 poisoning items, 6 calibration keys"
      node -e "const db = require('./server/db').db; console.log(db.prepare('SELECT COUNT(*) as n FROM lineages').get())"
      # Expected: { n: 6 }
      ```

- [ ] 4. Port classification logic to `server/classifier.js`
      Translate `ScamRadarEngine`'s pure-logic methods (detectLanguage, extractIdentifiers, extractActSequence, calculateActSimilarity, classifyComplaint) verbatim into a standalone CommonJS module. Methods query the `lineages` table in SQLite instead of an in-memory array. The `classifyComplaint(text, language, db)` function fetches all lineages, runs similarity scoring, and returns `{ assignedLineage, confidenceScore, extractedActs, isNew, language, extractedIdentifiers }`. The `checkPoisoning(reporterHash, lineageId, db)` function counts rows in `complaints` WHERE `reporter_hash = ? AND lineage_id = ? AND ingested_date >= date('now','-1 day')` — threshold >5 triggers flagging. The `quickHash` helper is copied from data.js. The `maskIdentifier` helper is copied from data.js — used in API responses.
      
      **Decision:** `classifier.js` is a pure module with no Express dependency. It takes a `db` argument on each call so it is easily testable. JSON parsing of `act_sequence` from SQLite TEXT is done inside the classifier when loading lineages.
      
      Files: `/Users/tejaswie/Desktop/thinkroot/server/classifier.js`
      
      Verify:
      ```
      node -e "
        const {classifyComplaint} = require('./server/classifier');
        const {db} = require('./server/db');
        const r = classifyComplaint('Dear customer aapka SBI account block ho gaya hai urgent KYC update', 'Hinglish', db);
        console.log(r.assignedLineage.id, r.confidenceScore);
      "
      # Expected: LIN-2026-KYC-01 with confidenceScore > 0.5
      ```

- [ ] 5. Build all route files under `server/routes/`
      Create 7 route modules. Each follows the same pattern: `const router = require('express').Router()`, queries SQLite via `db` imported from `../db`, serialises/deserialises JSON fields, and calls `res.json()`. Identifier masking rule enforced on every GET response that returns identifiers (use `maskIdentifier` from classifier.js). Never expose `raw` field of identifiers in GET responses — replace it with `masked_value = maskIdentifier(raw, type)`.
      
      **`routes/lineages.js`:**
      - `GET /api/lineages` — returns all, parses JSON fields
      - `GET /api/lineages/:id` — single lineage with parsed JSON fields
      - `PUT /api/lineages/:id` — update `status`, `growth_rate` (audit-log the change)
      - `GET /api/lineages/:id/complaints` — complaints for a lineage
      - `GET /api/lineages/:id/identifiers` — identifiers for a lineage (masked)
      
      **`routes/complaints.js`:**
      - `GET /api/complaints` — supports `?lineage_id=` filter
      - `POST /api/complaints` — runs `classifyComplaint`, runs `checkPoisoning`, inserts complaint, updates lineage counts + `language_distribution`, re-evaluates `growth_rate` + `nowcast_count`, evaluates alert threshold, inserts audit log, returns classification result
      - `POST /api/complaints/bulk` — uses `multer` for file upload, pipes through `csv-parse`, calls the same ingest logic for each row
      
      **`routes/alerts.js`:**
      - `GET /api/alerts` — all alerts, sorted by created_at DESC
      - `PUT /api/alerts/:id` — updates `status`, `acknowledged_by`, `dismiss_reason`
      
      **`routes/audit.js`:**
      - `GET /api/audit` — supports `?search=&action=` query params (LIKE filtering)
      - `POST /api/audit` — insert a new audit log entry
      - `GET /api/audit/export` — returns CSV of all audit logs; requires `role: admin` header (check `x-analyst-role: admin` header)
      
      **`routes/crossbank.js`:**
      - `GET /api/cross-bank` — fetches calibration for `psiMinBanks` and `psiMinComplaints`, joins complaints→lineages, groups by lineage_id, counts distinct `source_bank` values (NEVER returns bank names, only `banks_count`), filters by thresholds, calculates overlap score and victim estimate, returns array
      
      **`routes/calibration.js`:**
      - `GET /api/calibration` — returns all calibration key-value pairs as a flat JSON object
      - `PUT /api/calibration` — Admin only (check `x-analyst-role: admin` header); updates all provided keys, inserts audit log
      
      **`routes/poisoning.js`:**
      - `GET /api/poisoning` — all items in poisoning_queue
      - `PUT /api/poisoning/:id` — update `status` (Quarantined / Released / Dismissed), inserts audit log
      
      **`routes/datasets.js`:**
      - `POST /api/datasets/upload` — Admin only; accepts CSV with columns `message_text,label,reported_date,language,source_bank`; uses `multer` + `csv-parse`; runs full ingest pipeline on each row; returns `{ loaded, lineagesCreated, lineagesAssigned }`
      - `GET /api/datasets/info` — returns JSON describing which dataset CSVs exist in `server/datasets/`
      
      Files:
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/lineages.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/complaints.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/alerts.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/audit.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/crossbank.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/calibration.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/poisoning.js`
      - `/Users/tejaswie/Desktop/thinkroot/server/routes/datasets.js`
      
      Verify:
      ```
      # Start server in background, then:
      node server/index.js &
      curl -s http://localhost:3000/api/lineages | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.length, d[0].id)"
      # Expected: 6 LIN-2026-KYC-01
      curl -s http://localhost:3000/api/alerts | node -e "process.stdin.resume();let b='';process.stdin.on('data',c=>b+=c);process.stdin.on('end',()=>console.log(JSON.parse(b).length))"
      # Expected: 4
      curl -s http://localhost:3000/api/audit | node -e "process.stdin.resume();let b='';process.stdin.on('data',c=>b+=c);process.stdin.on('end',()=>console.log(JSON.parse(b).length))"
      # Expected: >= 5
      ```

- [ ] 6. Create the Express entry point `server/index.js`
      Sets up: CORS (allow `http://localhost:3000` and any origin for dev), JSON body parser, urlencoded body parser, static file serving for the root dir (`/Users/tejaswie/Desktop/thinkroot`) at `/`, and mounts all 8 route modules. Calls `initDb()` on startup. Listens on port 3000. Graceful error handler returns `{ error: message }` JSON.
      
      Files: `/Users/tejaswie/Desktop/thinkroot/server/index.js`
      
      Verify:
      ```
      node server/index.js &
      sleep 1
      curl -s http://localhost:3000/api/calibration
      # Expected: JSON object with keys instantPercent, delayedPercent, etc.
      curl -s http://localhost:3000/ | grep -c "ScamRadar"
      # Expected: >= 1  (confirms index.html is served)
      kill %1
      ```

- [ ] 7. Create dataset download/generation script `server/datasets/download.js`
      Creates the `server/datasets/` directory if it doesn't exist.
      
      **Dataset 1 — Mendeley SMS Phishing:** Attempts HTTP GET to `https://prod-dcd-datasets-cache-zipfiles.s3.eu-west-1.amazonaws.com/f45bkkt8pr-1.zip` using `node-fetch`. If the download succeeds (HTTP 200 and content-type includes `zip`), writes to a temp file, extracts with the `unzipper` package (add `unzipper@0.10.14` to package.json), and looks for a CSV with columns `LABEL,TEXT` or `v1,v2` (the Mendeley dataset ships as `SMSSpamCollection` or `Dataset_5971.csv`). Maps labels: `smishing`→smishing, `spam`→spam, `ham`→ham. Writes out `server/datasets/mendeley_sms_phishing.csv` with columns `message_text,label,reported_date,language,source_bank`. If the download fails (network error or non-200), falls back to generating a representative synthetic dataset of 100 messages (mix of smishing/spam/ham, English + Hinglish), writes the same CSV, and logs "WARNING: Used synthetic fallback for Mendeley dataset".
      
      **Dataset 2 — Hindi/English SMS Spam (Yadav 2011):** Attempts HTTP GET to `https://raw.githubusercontent.com/mohitgupta-16/hindi-sms-spam/master/hindi-sms-spam.csv`. If that fails, generate 200 synthetic Hindi + Hinglish messages (60% ham, 30% spam, 10% smishing) with bank/KYC/electricity themes matching the paper's characteristics. Write `server/datasets/hindi_sms_spam.csv`.
      
      **Dataset 3 — Dravidian SMS Spam:** Since Springer access is required, always generate 500 synthetic messages in Tamil, Telugu, Kannada (distribution: 45% Tamil, 35% Telugu, 20% Kannada; 70% ham, 20% spam, 10% smishing). Write `server/datasets/dravidian_sms_spam.csv`.
      
      The synthetic generators must produce messages that are realistic for each language (use short representative templates drawn from the existing `initialComplaints` patterns in data.js — just expand and vary them). Each row must include: `message_text, label (ham/spam/smishing), reported_date (random within last 90 days), language, source_bank (Bank A/B/C random)`.
      
      Files:
      - `/Users/tejaswie/Desktop/thinkroot/server/datasets/download.js`
      - (output) `/Users/tejaswie/Desktop/thinkroot/server/datasets/mendeley_sms_phishing.csv`
      - (output) `/Users/tejaswie/Desktop/thinkroot/server/datasets/hindi_sms_spam.csv`
      - (output) `/Users/tejaswie/Desktop/thinkroot/server/datasets/dravidian_sms_spam.csv`
      - Updated: `/Users/tejaswie/Desktop/thinkroot/package.json` (add `unzipper`)
      
      Verify:
      ```
      node server/datasets/download.js
      wc -l server/datasets/mendeley_sms_phishing.csv   # >= 101 (100 rows + header)
      wc -l server/datasets/hindi_sms_spam.csv           # >= 201
      wc -l server/datasets/dravidian_sms_spam.csv       # >= 501
      head -2 server/datasets/dravidian_sms_spam.csv     # shows header + one data row
      ```

- [ ] 8. Create dataset ingest script `server/datasets/ingest.js`
      Reads all three CSV files from `server/datasets/`. For each row: parses with `csv-parse/sync`, runs `classifyComplaint` from `server/classifier.js`, generates a complaint ID (`CMP-DSET-{N}`), inserts into `complaints` table, updates lineage `complaint_count`, `language_distribution`, `nowcast_count`, and `growth_rate` using the same nowcast formula from `engine.js`. Skips rows labelled `ham`. Prints a running progress counter every 50 rows and a final summary. Makes `server/datasets/ingest.js` auto-runnable standalone: `node server/datasets/ingest.js`.
      
      **Decision:** Skip `ham`-labelled rows — they don't contribute to fraud lineages and would pollute the analysis. Only `spam` and `smishing` rows are ingested.
      
      Files: `/Users/tejaswie/Desktop/thinkroot/server/datasets/ingest.js`
      
      Verify:
      ```
      node server/datasets/ingest.js
      # Expected output: "Ingested N complaints across M lineages. X new lineages created."
      node -e "const {db}=require('./server/db'); console.log(db.prepare('SELECT COUNT(*) as n FROM complaints').get())"
      # Expected: n > 13 (seed + dataset rows)
      ```

- [ ] 9. Create the frontend API client `js/api.js`
      Plain JavaScript file (no bundler, no imports). Sets `window.API` to an object with all async fetch functions. Base URL: `http://localhost:3000/api`. All functions use `fetch()`, check `response.ok`, and throw on HTTP errors. Include `window.API.healthCheck()` that calls `GET /api/calibration` and returns `true` if 200.
      
      Functions to implement exactly:
      ```
      window.API = {
        baseUrl: 'http://localhost:3000/api',
        fetchLineages(),           // GET /api/lineages
        fetchLineage(id),          // GET /api/lineages/:id
        fetchComplaints(lineageId),// GET /api/lineages/:id/complaints (if id given) or GET /api/complaints
        ingestComplaint(data),     // POST /api/complaints
        fetchAlerts(),             // GET /api/alerts
        updateAlert(id, data),     // PUT /api/alerts/:id
        fetchAuditLogs(params),    // GET /api/audit?search=&action=
        fetchCrossBank(),          // GET /api/cross-bank
        fetchCalibration(),        // GET /api/calibration
        updateCalibration(data),   // PUT /api/calibration  [header: x-analyst-role: admin]
        fetchPoisoningQueue(),     // GET /api/poisoning
        updatePoisoning(id, data), // PUT /api/poisoning/:id
        uploadBulkCSV(file),       // POST /api/complaints/bulk (multipart/form-data, field: 'csv')
        uploadDataset(file),       // POST /api/datasets/upload (multipart/form-data, field: 'dataset')
        healthCheck(),             // GET /api/calibration → true/false
      }
      ```
      
      Files: `/Users/tejaswie/Desktop/thinkroot/js/api.js`
      
      Verify: File is valid JS (no syntax errors). Tested in step 11 when app loads and shows "Backend Connected".

- [ ] 10. Update `js/engine.js` to support `apiMode`
      Add `this.apiMode = false` to the constructor. Add a `setApiMode(flag)` method. Modify `ingestComplaint`, `getLineages()` (new read method), `getAlerts()`, `getAuditLogs()`, `getCrossBankIntelligence()`, `getPoisoningQueue()`, and `getCalibration()` to check `this.apiMode`:
      
      - When `apiMode = true`: delegate to the corresponding `window.API.*` function and return a Promise. Show a console warning if `window.API` is not defined.
      - When `apiMode = false`: use the existing in-memory logic (no change to current behaviour).
      
      All existing methods that don't have a network equivalent (e.g. `detectLanguage`, `extractActSequence`, `generateLineageTimeline`) remain pure in-memory — they are used for real-time UI feedback even in API mode.
      
      **Decision:** Keep engine.js as the single source of truth for offline mode. The `apiMode` flag simply redirects reads/writes to the API. This avoids a complete rewrite and preserves the offline fallback requirement.
      
      Files: `/Users/tejaswie/Desktop/thinkroot/js/engine.js`
      
      Verify: Load `index.html` with backend down — app still initialises fully in offline mode (no errors in browser console).

- [ ] 11. Update `js/app.js` to connect to the backend on init and add the status indicator
      In the `init()` method, after existing setup calls, add:
      ```js
      this.connectBackend();
      ```
      
      Implement `async connectBackend()`:
      1. Calls `window.API.healthCheck()`.
      2. If successful: calls `scamRadar.setApiMode(true)`, updates the header status pill to show "Backend Connected" (green dot, text "Backend: CONNECTED"), then re-renders dashboard/alerts/audit from API data.
      3. If failed: shows "Offline Mode" (amber dot, text "Backend: OFFLINE") — no other changes; engine continues in-memory.
      
      **Header status pill implementation:** Add a second `siem-status-pill` div in the `header-center-info` section (this is done in the HTML update in step 12). The `connectBackend()` method sets `id="backend-status-pill"` inner content.
      
      Update `applyCalibrationChanges()` to call `window.API.updateCalibration(...)` when in API mode (after current in-memory update, making the change persist to the DB as well).
      
      Update `loadVerifiedMendeleyCorpus()` to call `POST /api/datasets/upload` if in API mode (wrapping the existing fake-progress UX around a real fetch call).
      
      Files: `/Users/tejaswie/Desktop/thinkroot/js/app.js`
      
      Verify:
      ```
      # With server running:
      open http://localhost:3000
      # Header should show green "Backend: CONNECTED" pill
      # With server not running:
      open index.html directly in browser → amber "Backend: OFFLINE" pill, app works fully
      ```

- [ ] 12. Update `index.html` to add the `js/api.js` script tag and backend status pill
      Two changes:
      1. Add `<script src="js/api.js"></script>` **before** the `<script src="js/app.js"></script>` tag (after `js/charts.js`).
      2. In the `header-center-info` div, add a new status pill:
         ```html
         <div class="siem-status-pill" id="backend-status-pill">
           <span class="status-dot-offline"></span>
           <span>Backend: <strong>CONNECTING...</strong></span>
         </div>
         ```
      3. Add CSS for `.status-dot-offline` (amber colour, no pulse animation) to `css/style.css` alongside the existing `.status-dot-pulse` rule.
      
      Files:
      - `/Users/tejaswie/Desktop/thinkroot/index.html`
      - `/Users/tejaswie/Desktop/thinkroot/css/style.css`
      
      Verify:
      ```
      grep -n "api.js" index.html                    # confirms script tag added
      grep -n "backend-status-pill" index.html       # confirms pill added
      grep -n "status-dot-offline" css/style.css     # confirms CSS added
      ```
      (These are structural checks; the real verification is the browser test in item 11.)

- [ ] 13. Full integration verification run
      With everything in place, run the complete verification sequence from the spec:
      
      ```bash
      cd /Users/tejaswie/Desktop/thinkroot
      
      # 1. Install deps (already done in item 1, re-run to confirm clean)
      npm install
      
      # 2. Seed initial data
      node server/seed.js
      
      # 3. Download/generate datasets
      node server/datasets/download.js
      
      # 4. Ingest datasets
      node server/datasets/ingest.js
      
      # 5. Start server
      node server/index.js &
      sleep 2
      
      # 6. Test key endpoints
      curl -s http://localhost:3000/api/lineages | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.assert(d.length>=6,'lineages'); console.log('GET /api/lineages: OK', d.length)"
      curl -s http://localhost:3000/api/alerts    | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('GET /api/alerts: OK', d.length)"
      curl -s http://localhost:3000/api/audit     | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('GET /api/audit: OK', d.length)"
      curl -s http://localhost:3000/api/cross-bank | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('GET /api/cross-bank: OK', d.length)"
      
      # 7. Verify frontend serves correctly
      curl -s http://localhost:3000/ | grep -c "ScamRadar"   # >= 1
      
      # 8. Test complaint POST
      curl -s -X POST http://localhost:3000/api/complaints \
        -H "Content-Type: application/json" \
        -d '{"rawText":"Dear customer aapka SBI KYC block ho gaya hai urgent update karein 9876543210","reportedDate":"2026-10-08","sourceBank":"Bank A","language":"Hinglish","reporterHash":"0xTEST_001"}' \
        | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.assert(d.success,'complaint ingest'); console.log('POST /api/complaints: OK', d.complaint?.id)"
      
      kill %1
      ```
      
      All curl commands must return valid JSON without errors. The frontend must load at `http://localhost:3000` with the "Backend: CONNECTED" indicator.
      
      Files: none (verification only)

---

## Key Design Decisions (summary)

| Decision | Choice | Rationale |
|---|---|---|
| ORM vs raw SQL | Raw `better-sqlite3` statements | No extra abstraction layer; synchronous API matches Express request lifecycle perfectly |
| JSON fields in SQLite | Store as TEXT, parse/serialise at DB boundary | SQLite has no native JSON column; parsing at the route layer keeps queries simple |
| Dataset fallback strategy | Generate synthetic data when real download fails | Institutional access barriers make 2/3 datasets unavailable; synthetic data preserves realistic corpus properties |
| Ham rows in ingest | Skip ham rows | Ham messages don't map to any fraud lineage; including them would create noise lineages |
| API mode in engine.js | `apiMode` flag delegating to `window.API` | Preserves the offline fallback requirement; avoids rewriting all existing UI render methods |
| Auth for Admin endpoints | `x-analyst-role: admin` request header | The existing app has no session/JWT system; a simple header check matches the current role-switcher model without adding auth infrastructure |
| Port | 3000 | As specified |
| DB path | `server/scamradar.db` | As specified |
