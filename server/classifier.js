/**
 * ScamRadar Classification Engine (Server-Side Port)
 * Pure logic functions ported from js/engine.js
 */

// Helper to generate SHA-256 like pseudohash
function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${hex}${Math.abs(hash * 31).toString(16).padStart(8, '0')}`;
}

// Identifier masking utility
function maskIdentifier(val, type) {
  if (!val) return '******';
  const clean = String(val).trim();
  if (type === 'phone' || /^\+?[0-9]{10,12}$/.test(clean)) {
    return '******' + clean.slice(-4);
  } else if (type === 'upi' || clean.includes('@')) {
    const parts = clean.split('@');
    const user = parts[0];
    const handle = parts[1] || 'upi';
    const maskedUser = user.length <= 4 ? '***' : user.slice(0, 1) + '***' + user.slice(-2);
    return `${maskedUser}@${handle}`;
  } else if (type === 'url' || clean.startsWith('http') || clean.includes('.')) {
    try {
      const url = new URL(clean.startsWith('http') ? clean : 'https://' + clean);
      return `https://******.${url.hostname.split('.').slice(-2).join('.')}${url.pathname.length > 5 ? '/...' + url.pathname.slice(-4) : ''}`;
    } catch {
      return 'https://******.link';
    }
  }
  return '******' + clean.slice(-4);
}

// Auto-detect Indic/English language
function detectLanguage(text) {
  if (!text) return 'English';
  const tamilRegex = /[\u0B80-\u0BFF]/;
  const teluguRegex = /[\u0C00-\u0C7F]/;
  const devanagariRegex = /[\u0900-\u097F]/;
  const kannadaRegex = /[\u0C80-\u0CFF]/;

  if (tamilRegex.test(text)) return 'Tamil';
  if (teluguRegex.test(text)) return 'Telugu';
  if (kannadaRegex.test(text)) return 'Kannada';
  if (devanagariRegex.test(text)) return 'Hindi';

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
function extractIdentifiers(text) {
  if (!text) return { phone: null, upi: null, url: null };

  const phoneMatch = text.match(/(?:(?:\+|0{0,2})91[\s\-]*)?([6789]\d{9})\b/);
  const phone = phoneMatch ? phoneMatch[1] : null;

  const upiMatch = text.match(/([a-zA-Z0-9\.\-_]{2,}@(okhdfcbank|okaxis|okicici|oksbi|paytm|ybl|apl|axisbank|icici|sbi|yesbank|barodampay|upi))\b/i);
  const upi = upiMatch ? upiMatch[0] : null;

  const urlMatch = text.match(/(https?:\/\/[^\s]+|t\.me\/[^\s]+)/i);
  const url = urlMatch ? urlMatch[0] : null;

  return { phone, upi, url };
}

// Dialog-Act Sequence Induction
function extractActSequence(text) {
  if (!text) return ["GREET", "URGENCY", "PAYMENT_REQUEST"];
  const lower = text.toLowerCase();
  const acts = [];

  if (/dear|customer|consumer|hello|hi|प्रिय|வாடிக்கையாளர்|వినియోగదారుడా|வணக்கம்|बधाई/i.test(text)) {
    acts.push("GREET");
  }

  if (/sbi|hdfc|icici|bank|yono|electricity|bijli|மின்சார|విద్యుత్|police|customs|dhl|fedex|kbc|officer|अधिकारी|காவல்துறை|అరసు/i.test(text)) {
    acts.push("IMPERSONATE");
  }

  if (/block|terminate|disconnect|deactivate|cut|arrest|warrant|fine|बंद|काट|துண்டிக்கப்படும்|முடக்கப்பட்டது|నిలిపివేయబడుతుంది|वारंट/i.test(text)) {
    acts.push("THREAT");
  }

  if (/earn|reward|prize|cash|lucky draw|daily|kamayein|बधाई|பரிசு|రూపాయలు/i.test(text)) {
    acts.push("ENTICEMENT");
  }

  if (/urgent|immediately|today|tonight|midnight|9:30|12 बजे|तुरंत|உடனடியாக|వెంటనే|அவசரம்/i.test(text)) {
    acts.push("URGENCY");
  }

  if (/pan|aadhaar|kyc|otp|cvv|password|पैन|ஆதார்|பான் கார்டு|కేవైసీ/i.test(text)) {
    acts.push("CREDENTIAL_HARVEST");
  }

  if (/₹|rs|fee|deposit|bond|token|upi|pay|payment|शुल्क|பணம்|கட்டணம்|డబ్బు|చెల్లించండి/i.test(text)) {
    acts.push("PAYMENT_REQUEST");
  }

  if (/call|contact|संपर्क|தொடர்பு|సంప్రదించండి/i.test(text) && /\d{10}/.test(text)) {
    acts.push("PHONE_CALLBACK");
  }

  if (/https?:\/\/|t\.me|apk|click|link|portal|डाउनलोड|பதிவிறக்க/i.test(text)) {
    acts.push("LINK");
  }

  return acts.length > 0 ? acts : ["IMPERSONATE", "URGENCY", "PAYMENT_REQUEST"];
}

// Calculate similarity between two Dialog-Act sequences
function calculateActSimilarity(seq1, seq2) {
  if (!seq1.length || !seq2.length) return 0;
  const set1 = new Set(seq1);
  const set2 = new Set(seq2);
  let intersection = 0;
  for (const act of set1) {
    if (set2.has(act)) intersection++;
  }
  const union = new Set([...seq1, ...seq2]).size;
  const jaccard = intersection / union;

  let orderBonus = 0;
  if (seq1[0] === seq2[0]) orderBonus += 0.15;
  if (seq1.includes("THREAT") && seq2.includes("THREAT")) orderBonus += 0.1;
  if (seq1.includes("ENTICEMENT") && seq2.includes("ENTICEMENT")) orderBonus += 0.1;

  return Math.min(0.98, jaccard * 0.75 + orderBonus);
}

// Classify complaint and match to existing lineage
function classifyComplaint(rawText, userLang, db) {
  const language = userLang || detectLanguage(rawText);
  const extractedIds = extractIdentifiers(rawText);
  const extractedActs = extractActSequence(rawText);

  // Fetch all lineages from DB
  const lineages = db.prepare('SELECT * FROM lineages').all();
  
  let bestLineage = null;
  let highestScore = 0;

  for (const lineage of lineages) {
    const lineageActs = JSON.parse(lineage.act_sequence);
    const score = calculateActSimilarity(extractedActs, lineageActs);
    if (score > highestScore) {
      highestScore = score;
      bestLineage = lineage;
    }
  }

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
      act_sequence: JSON.stringify(extractedActs)
    },
    confidenceScore: isNew ? Math.max(0.42, highestScore) : Math.min(0.97, highestScore + 0.12)
  };
}

// Check for Poisoning attempts
function checkPoisoning(reporterHash, lineageId, db) {
  const count = db.prepare(`
    SELECT COUNT(*) as n FROM complaints 
    WHERE reporter_hash = ? 
    AND lineage_id = ? 
    AND ingested_date >= date('now', '-1 day')
  `).get(reporterHash, lineageId).n;

  return count;
}

module.exports = {
  quickHash,
  maskIdentifier,
  detectLanguage,
  extractIdentifiers,
  extractActSequence,
  calculateActSimilarity,
  classifyComplaint,
  checkPoisoning
};
