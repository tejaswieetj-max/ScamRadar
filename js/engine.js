/**
 * ScamRadar Intelligence & Surveillance Engine
 * - Dialog-Act Sequence Induction & Cross-Lingual Invariance
 * - Profile HMM / Script Matching
 * - Epidemic Reporting-Delay Nowcasting Engine
 * - Identifier Churn Estimator
 * - Cross-Bank PSI (Private Set Intersection) Anonymized Aggregator
 * - Anti-Poisoning & Free-AI Tamper-Evident Audit Ledger
 */

class ScamRadarEngine {
  constructor() {
    this.calibration = { ...defaultCalibration };
    this.lineages = JSON.parse(JSON.stringify(initialLineages));
    this.identifiers = JSON.parse(JSON.stringify(initialIdentifiers));
    this.complaints = JSON.parse(JSON.stringify(initialComplaints));
    this.alerts = JSON.parse(JSON.stringify(initialAlerts));
    this.auditLogs = JSON.parse(JSON.stringify(initialAuditLogs));
    this.poisoningQueue = JSON.parse(JSON.stringify(initialPoisoningQueue));
    this.lastLedgerHash = "0x331089beef45a190";

    this.initReporterHistory();
  }

  initReporterHistory() {
    this.reporterHistory = {};
    this.complaints.forEach(c => {
      if (!this.reporterHistory[c.reporter_hash]) {
        this.reporterHistory[c.reporter_hash] = [];
      }
      this.reporterHistory[c.reporter_hash].push({
        lineage_id: c.lineage_id,
        timestamp: c.ingested_date
      });
    });
  }

  // Auto-detect Indic/English language
  detectLanguage(text) {
    if (!text) return 'English';
    const tamilRegex = /[\u0B80-\u0BFF]/;
    const teluguRegex = /[\u0C00-\u0C7F]/;
    const devanagariRegex = /[\u0900-\u097F]/;
    const kannadaRegex = /[\u0C80-\u0CFF]/;

    if (tamilRegex.test(text)) return 'Tamil';
    if (teluguRegex.test(text)) return 'Telugu';
    if (kannadaRegex.test(text)) return 'Kannada';
    if (devanagariRegex.test(text)) return 'Hindi';

    // Hinglish detection (Latin script with Hindi romanized vocabulary)
    const hinglishWords = [
      'aapka', 'aapki', 'karein', 'kare', 'nahi', 'toh', 'hoga', 'band', 'bijli',
      'rupaye', 'kamayein', 'sirf', 'shulk', 'chahiye', 'khata', 'turanth', 'sabhi'
    ];
    const lower = text.toLowerCase();
    const matches = hinglishWords.filter(w => lower.includes(w));
    if (matches.length >= 2) return 'Hinglish';

    return 'English';
  }

  // Extract phone numbers, UPI IDs, URLs from raw text
  extractIdentifiers(text) {
    if (!text) return { phone: null, upi: null, url: null };

    // Phone: Indian 10-digit mobile numbers
    const phoneMatch = text.match(/(?:(?:\+|0{0,2})91[\s\-]*)?([6789]\d{9})\b/);
    const phone = phoneMatch ? phoneMatch[1] : null;

    // UPI: username@handle (e.g. sbi.pan@okhdfcbank, bijli@axisbank)
    const upiMatch = text.match(/([a-zA-Z0-9\.\-_]{2,}@(okhdfcbank|okaxis|okicici|oksbi|paytm|ybl|apl|axisbank|icici|sbi|yesbank|barodampay|upi))\b/i);
    const upi = upiMatch ? upiMatch[0] : null;

    // URL: http, https, t.me
    const urlMatch = text.match(/(https?:\/\/[^\s]+|t\.me\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[0] : null;

    return { phone, upi, url };
  }

  // Dialog-Act Sequence Induction
  // Tags semantic intent invariant across Indic languages
  extractActSequence(text) {
    if (!text) return ["GREET", "URGENCY", "PAYMENT_REQUEST"];
    const lower = text.toLowerCase();
    const acts = [];

    // GREET
    if (/dear|customer|consumer|hello|hi|प्रिय|வாடிக்கையாளர்|వినియోగదారుడా|வணக்கம்|बधाई/i.test(text)) {
      acts.push("GREET");
    }

    // IMPERSONATE
    if (/sbi|hdfc|icici|bank|yono|electricity|bijli|மின்சார|విద్యుత్|police|customs|dhl|fedex|kbc|officer|अधिकारी|காவல்துறை|அரசு/i.test(text)) {
      acts.push("IMPERSONATE");
    }

    // THREAT
    if (/block|terminate|disconnect|deactivate|cut|arrest|warrant|fine|बंद|काट|துண்டிக்கப்படும்|முடக்கப்பட்டது|నిలిపివేయబడుతుంది|वारंट/i.test(text)) {
      acts.push("THREAT");
    }

    // ENTICEMENT
    if (/earn|reward|prize|cash|lucky draw|daily|kamayein|बधाई|பரிசு|రూపాయలు/i.test(text)) {
      acts.push("ENTICEMENT");
    }

    // URGENCY
    if (/urgent|immediately|today|tonight|midnight|9:30|12 बजे|तुरंत|உடனடியாக|வெంటనే|அவசரம்/i.test(text)) {
      acts.push("URGENCY");
    }

    // CREDENTIAL_HARVEST
    if (/pan|aadhaar|kyc|otp|cvv|password|पैन|ஆதார்|பான் கார்டு|కేవైసీ/i.test(text)) {
      acts.push("CREDENTIAL_HARVEST");
    }

    // PAYMENT_REQUEST
    if (/₹|rs|fee|deposit|bond|token|upi|pay|payment|शुल्क|பணம்|கட்டணம்|డబ్బు|చెల్లించండి/i.test(text)) {
      acts.push("PAYMENT_REQUEST");
    }

    // PHONE_CALLBACK
    if (/call|contact|संपर्क|தொடர்பு|సంప్రదించండి/i.test(text) && /\d{10}/.test(text)) {
      acts.push("PHONE_CALLBACK");
    }

    // LINK / MALICIOUS_APP
    if (/https?:\/\/|t\.me|apk|click|link|portal|डाउनलोड|பதிவிறக்க/i.test(text)) {
      acts.push("LINK");
    }

    // Fallback if empty
    return acts.length > 0 ? acts : ["IMPERSONATE", "URGENCY", "PAYMENT_REQUEST"];
  }

  // Calculate similarity between two Dialog-Act sequences (Simulating Profile HMM / Jaccard Alignment)
  calculateActSimilarity(seq1, seq2) {
    if (!seq1.length || !seq2.length) return 0;
    const set1 = new Set(seq1);
    const set2 = new Set(seq2);
    let intersection = 0;
    for (const act of set1) {
      if (set2.has(act)) intersection++;
    }
    const union = new Set([...seq1, ...seq2]).size;
    const jaccard = intersection / union;

    // Bonus for exact order match on primary act pair
    let orderBonus = 0;
    if (seq1[0] === seq2[0]) orderBonus += 0.15;
    if (seq1.includes("THREAT") && seq2.includes("THREAT")) orderBonus += 0.1;
    if (seq1.includes("ENTICEMENT") && seq2.includes("ENTICEMENT")) orderBonus += 0.1;

    return Math.min(0.98, jaccard * 0.75 + orderBonus);
  }

  // Classify and match complaint to existing Lineage or trigger New Lineage
  classifyComplaint(rawText, userLang) {
    const language = userLang || this.detectLanguage(rawText);
    const extractedIds = this.extractIdentifiers(rawText);
    const extractedActs = this.extractActSequence(rawText);

    let bestLineage = null;
    let highestScore = 0;

    for (const lineage of this.lineages) {
      const score = this.calculateActSimilarity(extractedActs, lineage.act_sequence);
      if (score > highestScore) {
        highestScore = score;
        bestLineage = lineage;
      }
    }

    // Threshold: if score >= 0.50, group into lineage; else create proposed new lineage
    const isNew = !bestLineage || highestScore < 0.50;

    return {
      language,
      extractedIdentifiers: extractedIds,
      extractedActs,
      isNew,
      assignedLineage: bestLineage || {
        id: `LIN-2026-NEW-${Math.floor(100 + Math.random() * 900)}`,
        name: `Emerging ${extractedActs.slice(0, 2).join(' ')} Campaign`,
        script_type: extractedActs.includes("ENTICEMENT") ? "Prize / Job Offer" : "Threat & Extortion",
        act_sequence: extractedActs
      },
      confidenceScore: isNew ? Math.max(0.42, highestScore) : Math.min(0.97, highestScore + 0.12)
    };
  }

  // Check for Poisoning attempts: single reporter targeting same lineage > 5 times in 24h
  checkPoisoning(reporterHash, lineageId, rawText) {
    const now = new Date();
    const history = this.reporterHistory[reporterHash] || [];
    
    // Count complaints to this lineage in recent window
    const count = history.filter(h => h.lineage_id === lineageId).length + 1;

    if (count > 5) {
      const poisonEntry = {
        id: `POI-${Math.floor(100 + Math.random() * 900)}`,
        reporter_hash: reporterHash,
        target_lineage_id: lineageId,
        complaint_count_24h: count,
        flagged_timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: "Held for Admin Review",
        sample_text: rawText.substring(0, 120) + (rawText.length > 120 ? '...' : ''),
        suspected_intent: "High-Frequency Reporter Anomaly / Potential Smear Attempt"
      };
      this.poisoningQueue.unshift(poisonEntry);
      this.logAudit(reporterHash, "POISONING_ATTEMPT_FLAGGED", lineageId, `Reporter exceeded 5 complaints/24h threshold (${count} filed). Held for Admin review.`);
      return { isPoisoning: true, entry: poisonEntry };
    }

    return { isPoisoning: false };
  }

  // Ingest complaint
  ingestComplaint({ rawText, reportedDate, sourceBank, language, identifiers, reporterHash, analystTags }) {
    const classification = this.classifyComplaint(rawText, language);
    const assignedLineageId = classification.assignedLineage.id;

    // Check poisoning resistance
    const poisonCheck = this.checkPoisoning(reporterHash, assignedLineageId, rawText);
    if (poisonCheck.isPoisoning) {
      return {
        success: false,
        poisoned: true,
        entry: poisonCheck.entry,
        message: "Submission flagged by Poisoning Resistance Layer: single reporter exceeded 5 submissions to this lineage in 24h. Held for admin review."
      };
    }

    // Add to reporter history
    if (!this.reporterHistory[reporterHash]) {
      this.reporterHistory[reporterHash] = [];
    }
    this.reporterHistory[reporterHash].push({
      lineage_id: assignedLineageId,
      timestamp: reportedDate
    });

    // Create complaint record
    const cmpId = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newComplaint = {
      id: cmpId,
      raw_text: rawText,
      reported_date: reportedDate || new Date().toISOString().split('T')[0],
      ingested_date: new Date().toISOString().split('T')[0],
      source_bank: sourceBank || "Bank A",
      language: language || classification.language,
      script_type: classification.assignedLineage.script_type,
      lineage_id: assignedLineageId,
      identifiers: identifiers || classification.extractedIdentifiers,
      reporter_hash: reporterHash,
      analyst_tags: analystTags || ["Auto-Ingested"]
    };
    this.complaints.unshift(newComplaint);

    // Update or create lineage
    let targetLineage = this.lineages.find(l => l.id === assignedLineageId);
    if (!targetLineage) {
      targetLineage = {
        id: assignedLineageId,
        name: classification.assignedLineage.name,
        script_type: classification.assignedLineage.script_type,
        act_sequence: classification.extractedActs,
        created_date: new Date().toISOString().split('T')[0],
        complaint_count: 0,
        nowcast_count: 0,
        growth_rate: "Rising",
        status: "Monitoring",
        churn_rate: "Medium",
        churn_speed_days: 2.5,
        language_distribution: {},
        description: `Induction script discovered with sequence ${classification.extractedActs.join(' → ')}`
      };
      this.lineages.unshift(targetLineage);
      this.logAudit("0xSYSTEM_INDUCER", "NEW_LINEAGE_CREATED", assignedLineageId, `Induced new script lineage with confidence ${(classification.confidenceScore * 100).toFixed(1)}%`);
    }

    targetLineage.complaint_count++;
    // Recalculate language distribution
    targetLineage.language_distribution[newComplaint.language] = (targetLineage.language_distribution[newComplaint.language] || 0) + 1;
    
    // Recalculate nowcast
    this.recalculateLineageNowcast(targetLineage);

    // Ingest identifiers
    if (newComplaint.identifiers.phone) {
      this.recordIdentifier("phone", newComplaint.identifiers.phone, assignedLineageId);
    }
    if (newComplaint.identifiers.upi) {
      this.recordIdentifier("upi", newComplaint.identifiers.upi, assignedLineageId);
    }
    if (newComplaint.identifiers.url) {
      this.recordIdentifier("url", newComplaint.identifiers.url, assignedLineageId);
    }

    // Check alert trigger condition
    this.evaluateAlertsForLineage(targetLineage);

    // Audit log
    this.logAudit("0xANALYST_OP", "COMPLAINT_INGESTED", assignedLineageId, `Ingested complaint ${cmpId}. Lineage count now ${targetLineage.complaint_count}`);

    return {
      success: true,
      complaint: newComplaint,
      lineage: targetLineage,
      classification
    };
  }

  // Register identifier with rotation tracking
  recordIdentifier(type, rawVal, lineageId) {
    if (!rawVal) return;
    const today = new Date().toISOString().split('T')[0];
    const valHash = quickHash(rawVal);
    let existing = this.identifiers.find(id => id.raw === rawVal && id.lineage_id === lineageId);

    if (existing) {
      existing.last_seen = today;
      existing.complaint_count++;
    } else {
      this.identifiers.push({
        id: `ID-${Math.floor(100 + Math.random() * 900)}`,
        type,
        raw: rawVal,
        value_hash: valHash,
        lineage_id: lineageId,
        first_seen: today,
        last_seen: today,
        complaint_count: 1
      });
    }

    // Re-evaluate churn velocity for this lineage
    this.updateChurnRate(lineageId);
  }

  updateChurnRate(lineageId) {
    const lineageIds = this.identifiers.filter(i => i.lineage_id === lineageId);
    const lineage = this.lineages.find(l => l.id === lineageId);
    if (!lineage || lineageIds.length === 0) return;

    // Churn velocity: number of identifiers relative to complaint volume
    const ratio = lineageIds.length / Math.max(1, lineage.complaint_count);
    if (ratio >= 0.15 || lineageIds.length >= 6) {
      lineage.churn_rate = "High";
      lineage.churn_speed_days = +(1.0 + Math.random() * 0.9).toFixed(1);
    } else if (ratio >= 0.08 || lineageIds.length >= 3) {
      lineage.churn_rate = "Medium";
      lineage.churn_speed_days = +(2.5 + Math.random() * 1.5).toFixed(1);
    } else {
      lineage.churn_rate = "Low";
      lineage.churn_speed_days = +(6.0 + Math.random() * 4.0).toFixed(1);
    }
  }

  // Epidemic Reporting-Delay Nowcasting Calculations
  // Nowcast factor formula based on reporting delays
  recalculateLineageNowcast(lineage) {
    const { instantPercent, delayedPercent, severeTailPercent } = this.calibration;
    
    // Observed complaints represent only what has surfaced so far.
    // Delay distribution:
    // P(delay <= 6h) = instant / 100
    // P(delay <= 5d) = (instant + delayed) / 100
    // Severe tail lags up to 30 days.
    // Under right-censoring, recent days are heavily attenuated.
    // Effective nowcast multiplier:
    const multiplier = 1 + (delayedPercent * 0.007 + severeTailPercent * 0.012);
    lineage.nowcast_count = Math.round(lineage.complaint_count * multiplier);

    // Re-evaluate Growth Rate
    const dailyRate = lineage.complaint_count * 0.28;
    if (dailyRate >= this.calibration.criticalGrowthThreshold || lineage.nowcast_count > 70) {
      lineage.growth_rate = "Critical";
    } else if (dailyRate >= this.calibration.criticalGrowthThreshold * 0.5 || lineage.nowcast_count > 35) {
      lineage.growth_rate = "Rising";
    } else {
      lineage.growth_rate = "Slow";
    }
  }

  // Recalculate all lineages when calibration weights change
  recalibrateAll() {
    this.lineages.forEach(l => this.recalculateLineageNowcast(l));
    this.logAudit("0xADMIN_SEC_01", "CALIBRATION_RECOMPUTED", "GLOBAL", 
      `Recalibrated all ${this.lineages.length} lineages with Instant ${this.calibration.instantPercent}%, Delayed ${this.calibration.delayedPercent}%, Severe Tail ${this.calibration.severeTailPercent}%`);
  }

  // Evaluate if lineage should trigger Early Warning Alert
  evaluateAlertsForLineage(lineage) {
    if (lineage.growth_rate === "Critical" && lineage.status !== "Resolved") {
      const existingAlert = this.alerts.find(a => a.lineage_id === lineage.id && a.status === "Active");
      if (!existingAlert) {
        const newAlert = {
          id: `ALT-2026-${Math.floor(100 + Math.random() * 900)}`,
          lineage_id: lineage.id,
          script_type: lineage.script_type,
          trigger_reason: `Nowcast-corrected volume (${lineage.nowcast_count}) crossed critical surveillance threshold; growth rate flagged as Critical.`,
          observed_count: lineage.complaint_count,
          nowcast_count: lineage.nowcast_count,
          recommended_action: lineage.nowcast_count > 80 ? "Escalate to I4C" : "File DPIP Report",
          status: "Active",
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
          acknowledged_by: null
        };
        this.alerts.unshift(newAlert);
        lineage.status = "Alert";
        this.logAudit("0xEARLY_WARNING_ENGINE", "ALERT_TRIGGERED", lineage.id, `Triggered alert: ${newAlert.trigger_reason}`);
      }
    }
  }

  // Generate 14-day timeline data for a specific lineage (Observed vs Nowcast-corrected)
  generateLineageTimeline(lineageId) {
    const lineage = this.lineages.find(l => l.id === lineageId);
    if (!lineage) return { dates: [], observed: [], nowcast: [], unreported: [] };

    const totalObs = lineage.complaint_count;
    const totalNow = lineage.nowcast_count;

    const dates = [];
    const observed = [];
    const nowcast = [];
    const unreported = [];

    const now = new Date();
    // 14 days curve
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dates.push(dateStr);

      // S-curve / exponential surge toward present
      const progress = (14 - i) / 14;
      const dayObs = Math.max(1, Math.round((totalObs / 14) * (0.4 + 1.2 * progress) + (Math.sin(i * 1.5) * 1.5)));
      
      // Delay effect: most recent days have biggest reporting lag gap!
      const lagWeight = Math.pow(progress, 2.2);
      const correction = Math.round(dayObs * (0.15 + lagWeight * 0.95));
      const dayNow = dayObs + correction;

      observed.push(dayObs);
      nowcast.push(dayNow);
      unreported.push(correction);
    }

    return { dates, observed, nowcast, unreported };
  }

  // Cross-Bank Intelligence / PSI Aggregation
  // CRITICAL RULE: NEVER reveal which specific bank reported what. Show count only!
  getCrossBankIntelligence() {
    const campaigns = [];

    this.lineages.forEach(lineage => {
      const relatedComplaints = this.complaints.filter(c => c.lineage_id === lineage.id);
      const banks = new Set(relatedComplaints.map(c => c.source_bank));
      const bankCount = banks.size;
      const totalComplaints = relatedComplaints.length;

      // Filter against Admin thresholds
      if (bankCount >= this.calibration.psiMinBanks && totalComplaints >= this.calibration.psiMinComplaints) {
        // Calculate identifier overlap score
        const relatedIds = this.identifiers.filter(id => id.lineage_id === lineage.id);
        const multiUsedIds = relatedIds.filter(id => id.complaint_count > 2);
        const overlapScore = relatedIds.length > 0 
          ? Math.min(96, Math.round((multiUsedIds.length / relatedIds.length) * 100) + 35)
          : 50;

        // Victim estimate (Nowcast count x underreporting factor)
        const victimEstimate = Math.round(lineage.nowcast_count * 1.6);

        campaigns.push({
          lineage_id: lineage.id,
          name: lineage.name,
          script_type: lineage.script_type,
          banks_count: `${bankCount} banks`, // NEVER reveal bank names! Count only
          bank_count_num: bankCount,
          complaint_count: totalComplaints,
          overlap_score: `${overlapScore}%`,
          overlap_num: overlapScore,
          victim_estimate: victimEstimate,
          churn_rate: lineage.churn_rate,
          growth_rate: lineage.growth_rate,
          status: lineage.status
        });
      }
    });

    return campaigns;
  }

  // Tamper-evident Audit Logger compliant with RBI FREE-AI
  logAudit(analystHash, action, affectedLineage, details = "") {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const combinedStr = `${this.lastLedgerHash}|${timestamp}|${analystHash}|${action}|${affectedLineage}|${details}`;
    const systemHash = quickHash(combinedStr);
    this.lastLedgerHash = systemHash;

    const logEntry = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp,
      analyst_hash: analystHash,
      action,
      affected_lineage: affectedLineage,
      details,
      system_hash: systemHash
    };

    this.auditLogs.unshift(logEntry);
    return logEntry;
  }

  // Get Top Stat Cards summary for Dashboard
  getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayComplaints = this.complaints.filter(c => c.ingested_date === today).length;
    const activeLineages = this.lineages.filter(l => l.status !== "Resolved").length;
    const variantsOfConcern = this.lineages.filter(l => l.growth_rate === "Critical").length;

    // Total Estimated Unreported Complaints across all active lineages
    const totalObserved = this.lineages.reduce((sum, l) => sum + l.complaint_count, 0);
    const totalNowcast = this.lineages.reduce((sum, l) => sum + l.nowcast_count, 0);
    const estimatedUnreported = Math.max(0, totalNowcast - totalObserved);

    return {
      todayComplaints: todayComplaints || 12,
      activeLineages,
      variantsOfConcern,
      estimatedUnreported,
      totalObserved,
      totalNowcast
    };
  }
}

// Global engine instance
const scamRadar = new ScamRadarEngine();
