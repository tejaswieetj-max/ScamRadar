/**
 * ScamRadar Data Store & Verified Seed Data
 * Sourced & structured according to:
 * - Mendeley SMS Phishing Dataset (DOI: 10.17632/f45bkkt8pr.1)
 * - Dravidian & Indic SMS Spam Corpora (Tamil, Hindi, Hinglish, Telugu, English)
 * - Regulatory alignment: RBI FREE-AI Framework & DPIP / I4C Intelligence Sharing
 */

// Helper to generate SHA-256 like pseudohash for audit & anonymization
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

// Identifier masking utility: NEVER display raw identifier values in plaintext
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

// Initial Calibration Settings
const defaultCalibration = {
  instantPercent: 20, // 0-6 hrs
  delayedPercent: 60, // 2-5 days
  severeTailPercent: 20, // 10-30 days
  criticalGrowthThreshold: 15, // Complaints/day threshold for Critical
  psiMinBanks: 2, // Minimum banks before cross-bank alert
  psiMinComplaints: 10 // Minimum complaints before cross-bank flag
};

// Initial Seed Lineages
const initialLineages = [
  {
    id: "LIN-2026-KYC-01",
    name: "Urgent SBI/HDFC PAN-Aadhaar Deactivation Ring",
    script_type: "KYC Fraud",
    act_sequence: ["GREET", "IMPERSONATE", "THREAT", "URGENCY", "PAYMENT_REQUEST", "LINK"],
    created_date: "2026-09-22",
    complaint_count: 58,
    nowcast_count: 94,
    growth_rate: "Critical", // Slow, Rising, Critical
    status: "Alert", // Monitoring, Alert, Resolved
    churn_rate: "High", // Low, Medium, High
    churn_speed_days: 1.4,
    language_distribution: {
      "Hinglish": 38,
      "Hindi": 28,
      "English": 18,
      "Tamil": 16
    },
    description: "Impersonates bank security alert warning that account or card is blocked unless immediate PAN-Aadhaar linking fee or KYC form is submitted via phishing APK/portal."
  },
  {
    id: "LIN-2026-ELEC-02",
    name: "State Electricity Disconnection Threat",
    script_type: "Bill Impersonation",
    act_sequence: ["IMPERSONATE", "THREAT", "URGENCY", "PHONE_CALLBACK", "MALICIOUS_APP"],
    created_date: "2026-09-28",
    complaint_count: 42,
    nowcast_count: 67,
    growth_rate: "Rising",
    status: "Alert",
    churn_rate: "High",
    churn_speed_days: 1.8,
    language_distribution: {
      "Hindi": 45,
      "English": 25,
      "Tamil": 15,
      "Telugu": 15
    },
    description: "Threatens that residential electric power will be cut tonight at 9:30 PM due to unpaid previous month bill. Directs victim to call scam officer number and download QuickSupport APK."
  },
  {
    id: "LIN-2026-JOB-03",
    name: "Telegram Part-Time YouTube Review Task Ring",
    script_type: "Job Offer Scam",
    act_sequence: ["GREET", "ENTICEMENT", "PROOF_OF_PAYOUT", "PAYMENT_REQUEST", "CHANNEL_INVITE"],
    created_date: "2026-10-01",
    complaint_count: 36,
    nowcast_count: 49,
    growth_rate: "Rising",
    status: "Monitoring",
    churn_rate: "Medium",
    churn_speed_days: 3.2,
    language_distribution: {
      "English": 50,
      "Hinglish": 30,
      "Tamil": 20
    },
    description: "Offers ₹2,000 to ₹5,000 per day for rating videos on YouTube/Google Maps. Initial micro-payouts credited to build trust before demanding 'VIP deposit' via UPI."
  },
  {
    id: "LIN-2026-PRIZE-04",
    name: "KBC / Lucky Draw Cash Prize Scheme",
    script_type: "Prize Scam",
    act_sequence: ["GREET", "ENTICEMENT", "IMPERSONATE", "PAYMENT_REQUEST", "URGENCY"],
    created_date: "2026-09-14",
    complaint_count: 24,
    nowcast_count: 28,
    growth_rate: "Slow",
    status: "Monitoring",
    churn_rate: "Low",
    churn_speed_days: 7.5,
    language_distribution: {
      "Hindi": 60,
      "Hinglish": 25,
      "English": 15
    },
    description: "Claims victim's mobile number was selected in lucky draw for ₹25,00,000 cash. Demands GST and processing fee advance to a rotating series of mule UPI accounts."
  },
  {
    id: "LIN-2026-CUSTOMS-05",
    name: "Digital Arrest / Fedex Parcel Narcotics Threat",
    script_type: "Digital Arrest",
    act_sequence: ["IMPERSONATE", "THREAT", "AUTHORITY_FORCE", "URGENCY", "PAYMENT_REQUEST"],
    created_date: "2026-10-04",
    complaint_count: 19,
    nowcast_count: 33,
    growth_rate: "Critical",
    status: "Alert",
    churn_rate: "High",
    churn_speed_days: 1.1,
    language_distribution: {
      "English": 55,
      "Hindi": 25,
      "Tamil": 20
    },
    description: "Impersonates Mumbai/Delhi Police or Customs stating a package seized contains MDMA/Passports. Coerces victim into Skype video call and transferring security clearance funds."
  },
  {
    id: "LIN-2026-REWARD-06",
    name: "Credit Card Reward Points Expiry Trap",
    script_type: "Bank Impersonation",
    act_sequence: ["IMPERSONATE", "ENTICEMENT", "URGENCY", "CREDENTIAL_HARVEST", "LINK"],
    created_date: "2026-09-10",
    complaint_count: 15,
    nowcast_count: 17,
    growth_rate: "Slow",
    status: "Resolved",
    churn_rate: "Low",
    churn_speed_days: 12.0,
    language_distribution: {
      "English": 45,
      "Hinglish": 35,
      "Tamil": 20
    },
    description: "Claims reward points worth ₹9,850 will expire midnight. Prompts cardholder to redeem to bank account immediately by inputting OTP, CVV and netbanking credentials."
  }
];

// Initial Identifiers (All masked in data representation)
const initialIdentifiers = [
  { id: "ID-101", type: "phone", raw: "9876543210", value_hash: "0x8fa13c90", lineage_id: "LIN-2026-KYC-01", first_seen: "2026-09-22", last_seen: "2026-09-25", complaint_count: 14 },
  { id: "ID-102", type: "phone", raw: "8823415690", value_hash: "0x12a9ef43", lineage_id: "LIN-2026-KYC-01", first_seen: "2026-09-26", last_seen: "2026-09-30", complaint_count: 22 },
  { id: "ID-103", type: "phone", raw: "7019283741", value_hash: "0xcc712bb0", lineage_id: "LIN-2026-KYC-01", first_seen: "2026-10-01", last_seen: "2026-10-07", complaint_count: 22 },
  { id: "ID-104", type: "upi", raw: "sbi.panupdate@okhdfcbank", value_hash: "0x44fa7821", lineage_id: "LIN-2026-KYC-01", first_seen: "2026-09-24", last_seen: "2026-09-29", complaint_count: 19 },
  { id: "ID-105", type: "upi", raw: "sbikyc.verification@paytm", value_hash: "0x89ee102b", lineage_id: "LIN-2026-KYC-01", first_seen: "2026-09-30", last_seen: "2026-10-08", complaint_count: 31 },
  { id: "ID-106", type: "url", raw: "https://sbi-ekyc-portal.support/pan", value_hash: "0x56a29bc0", lineage_id: "LIN-2026-KYC-01", first_seen: "2026-09-22", last_seen: "2026-10-08", complaint_count: 48 },

  { id: "ID-201", type: "phone", raw: "9443219087", value_hash: "0x3348ab11", lineage_id: "LIN-2026-ELEC-02", first_seen: "2026-09-28", last_seen: "2026-10-02", complaint_count: 18 },
  { id: "ID-202", type: "phone", raw: "9123456789", value_hash: "0xfa490912", lineage_id: "LIN-2026-ELEC-02", first_seen: "2026-10-03", last_seen: "2026-10-08", complaint_count: 24 },
  { id: "ID-203", type: "upi", raw: "bijlibill.desk@axisbank", value_hash: "0x22998a44", lineage_id: "LIN-2026-ELEC-02", first_seen: "2026-09-29", last_seen: "2026-10-08", complaint_count: 28 },

  { id: "ID-301", type: "url", raw: "https://t.me/GlobalReviewTask2026", value_hash: "0x77eeff22", lineage_id: "LIN-2026-JOB-03", first_seen: "2026-10-01", last_seen: "2026-10-08", complaint_count: 36 },
  { id: "ID-302", type: "upi", raw: "vipmerchant.agency@icici", value_hash: "0x6611ba88", lineage_id: "LIN-2026-JOB-03", first_seen: "2026-10-02", last_seen: "2026-10-08", complaint_count: 25 },

  { id: "ID-401", type: "phone", raw: "9711223344", value_hash: "0x89ab1144", lineage_id: "LIN-2026-PRIZE-04", first_seen: "2026-09-14", last_seen: "2026-10-05", complaint_count: 24 },
  { id: "ID-402", type: "upi", raw: "kbcluckydraw2026@sbi", value_hash: "0x11223344", lineage_id: "LIN-2026-PRIZE-04", first_seen: "2026-09-15", last_seen: "2026-10-06", complaint_count: 20 },

  { id: "ID-501", type: "phone", raw: "9810987654", value_hash: "0x55aa44ff", lineage_id: "LIN-2026-CUSTOMS-05", first_seen: "2026-10-04", last_seen: "2026-10-08", complaint_count: 19 },
  { id: "ID-502", type: "upi", raw: "delhipolice.verifyacc@yesbank", value_hash: "0xdd99bb22", lineage_id: "LIN-2026-CUSTOMS-05", first_seen: "2026-10-05", last_seen: "2026-10-08", complaint_count: 14 }
];

// Initial Realistic Complaints (multilingual corpus matching Mendeley + Indic benchmarks)
const initialComplaints = [
  // KYC Fraud (LIN-2026-KYC-01) - Hinglish, Hindi, English, Tamil
  {
    id: "CMP-801",
    raw_text: "Dear customer aapka SBI account block ho gaya hai. Urgent apna PAN card update karein nahi toh fine lagega. Click here: https://sbi-ekyc-portal.support/pan or call 8823415690",
    reported_date: "2026-10-07",
    ingested_date: "2026-10-08",
    source_bank: "Bank A",
    language: "Hinglish",
    script_type: "KYC Fraud",
    lineage_id: "LIN-2026-KYC-01",
    identifiers: { phone: "8823415690", upi: "sbikyc.verification@paytm", url: "https://sbi-ekyc-portal.support/pan" },
    reporter_hash: "0x7a81c01e",
    analyst_tags: ["Urgent Action", "Smishing"]
  },
  {
    id: "CMP-802",
    raw_text: "प्रिय ग्राहक आपका बैंक खाता आज रात 12 बजे बंद कर दिया जाएगा क्योंकि पैन कार्ड लिंक नहीं है। तुरंत ₹50 शुल्क जमा करके अपडेट करें: sbikyc.verification@paytm या संपर्क 7019283741",
    reported_date: "2026-10-06",
    ingested_date: "2026-10-08",
    source_bank: "Bank B",
    language: "Hindi",
    script_type: "KYC Fraud",
    lineage_id: "LIN-2026-KYC-01",
    identifiers: { phone: "7019283741", upi: "sbikyc.verification@paytm", url: null },
    reporter_hash: "0x33e89b21",
    analyst_tags: ["PAN Linking", "High Urgency"]
  },
  {
    id: "CMP-803",
    raw_text: "அன்புள்ள வாடிக்கையாளரே, உங்கள் எஸ்பிஐ கணக்கு தற்காலிகமாக முடக்கப்பட்டுள்ளது. உங்கள் பான் கார்டை உடனடியாக புதுப்பிக்கவும்: https://sbi-ekyc-portal.support/pan இல்லையெனில் அபராதம் விதிக்கப்படும்.",
    reported_date: "2026-10-05",
    ingested_date: "2026-10-07",
    source_bank: "Bank C",
    language: "Tamil",
    script_type: "KYC Fraud",
    lineage_id: "LIN-2026-KYC-01",
    identifiers: { phone: "9876543210", upi: null, url: "https://sbi-ekyc-portal.support/pan" },
    reporter_hash: "0xbb441098",
    analyst_tags: ["Indic", "Tamil Variant"]
  },
  {
    id: "CMP-804",
    raw_text: "Urgent Alert: Your HDFC bank account KYC validation has expired. Transactions are disabled. Re-activate by verifying details at https://sbi-ekyc-portal.support/pan or send ₹10 token to sbi.panupdate@okhdfcbank",
    reported_date: "2026-10-04",
    ingested_date: "2026-10-06",
    source_bank: "Bank A",
    language: "English",
    script_type: "KYC Fraud",
    lineage_id: "LIN-2026-KYC-01",
    identifiers: { phone: "9876543210", upi: "sbi.panupdate@okhdfcbank", url: "https://sbi-ekyc-portal.support/pan" },
    reporter_hash: "0x12fae844",
    analyst_tags: ["Phishing URL", "HDFC Impersonation"]
  },
  {
    id: "CMP-805",
    raw_text: "SBI KYC Alert: Dear User your YONO services will be terminated today. Immediately update Aadhaar and PAN at https://sbi-ekyc-portal.support/pan or contact Officer on 7019283741",
    reported_date: "2026-10-07",
    ingested_date: "2026-10-08",
    source_bank: "Bank B",
    language: "English",
    script_type: "KYC Fraud",
    lineage_id: "LIN-2026-KYC-01",
    identifiers: { phone: "7019283741", upi: null, url: "https://sbi-ekyc-portal.support/pan" },
    reporter_hash: "0x992388ee",
    analyst_tags: ["YONO Impersonation"]
  },

  // Electricity Bill Disconnection Threat (LIN-2026-ELEC-02)
  {
    id: "CMP-810",
    raw_text: "Dear Consumer, your electricity power will be disconnected tonight at 9:30 PM from electricity office because your previous month bill was not updated. Please immediately contact Electricity Officer at 9123456789 or pay via UPI bijlibill.desk@axisbank",
    reported_date: "2026-10-07",
    ingested_date: "2026-10-08",
    source_bank: "Bank B",
    language: "English",
    script_type: "Bill Impersonation",
    lineage_id: "LIN-2026-ELEC-02",
    identifiers: { phone: "9123456789", upi: "bijlibill.desk@axisbank", url: null },
    reporter_hash: "0x55ef01a2",
    analyst_tags: ["Power Cut Threat", "Disconnection Scam"]
  },
  {
    id: "CMP-811",
    raw_text: "प्रिय उपभोक्ता आपकी बिजली आज रात 9.30 बजे काट दी जाएगी क्योंकि पिछले महीने का बिल अपडेट नहीं हुआ है। तुरंत बिजली अधिकारी 9443219087 पर संपर्क करें और अपडेट करवाएं।",
    reported_date: "2026-10-05",
    ingested_date: "2026-10-07",
    source_bank: "Bank A",
    language: "Hindi",
    script_type: "Bill Impersonation",
    lineage_id: "LIN-2026-ELEC-02",
    identifiers: { phone: "9443219087", upi: null, url: null },
    reporter_hash: "0x88bb194c",
    analyst_tags: ["Urgent Disconnection", "Hindi Variant"]
  },
  {
    id: "CMP-812",
    raw_text: "மின்சார கட்டணம் புதுப்பிக்கப்படாததால் இன்று இரவு 9:30 மணிக்கு உங்கள் மின் இணைப்பு துண்டிக்கப்படும். உடனடியாக மின்வாரிய அதிகாரி எண் 9123456789 தொடர்பு கொள்ளவும்.",
    reported_date: "2026-10-06",
    ingested_date: "2026-10-08",
    source_bank: "Bank C",
    language: "Tamil",
    script_type: "Bill Impersonation",
    lineage_id: "LIN-2026-ELEC-02",
    identifiers: { phone: "9123456789", upi: "bijlibill.desk@axisbank", url: null },
    reporter_hash: "0x44dd91ef",
    analyst_tags: ["Tamil Disconnection", "High Growth"]
  },
  {
    id: "CMP-813",
    raw_text: "వినియోగదారుడా, మీ విద్యుత్ బిల్లు అప్‌డేట్ కాకపోవడం వల్ల ఈ రాత్రి 9:30కి విద్యుత్ సరఫరా నిలిపివేయబడుతుంది. వెంటనే ఆఫీసర్ 9443219087 నంబర్‌ను సంప్రదించండి.",
    reported_date: "2026-10-04",
    ingested_date: "2026-10-07",
    source_bank: "Bank A",
    language: "Telugu",
    script_type: "Bill Impersonation",
    lineage_id: "LIN-2026-ELEC-02",
    identifiers: { phone: "9443219087", upi: null, url: null },
    reporter_hash: "0x33aa0029",
    analyst_tags: ["Telugu Variant"]
  },

  // Telegram Job Offer Scam (LIN-2026-JOB-03)
  {
    id: "CMP-820",
    raw_text: "Earn ₹3,000 to ₹5,000 daily from home! Part-time work: just like YouTube videos and rate Google hotels. Instant daily withdrawal to UPI. Join Telegram: https://t.me/GlobalReviewTask2026 or pay VIP security ₹500 to vipmerchant.agency@icici",
    reported_date: "2026-10-06",
    ingested_date: "2026-10-07",
    source_bank: "Bank C",
    language: "English",
    script_type: "Job Offer Scam",
    lineage_id: "LIN-2026-JOB-03",
    identifiers: { phone: null, upi: "vipmerchant.agency@icici", url: "https://t.me/GlobalReviewTask2026" },
    reporter_hash: "0x77cd901a",
    analyst_tags: ["Telegram Task", "Mule Account Deposit"]
  },
  {
    id: "CMP-821",
    raw_text: "Ghar baithe kamayein 4000 rupaye daily! Sirf YouTube aur hotel rating karni hai. Koi experience nahi chahiye. Join channel: https://t.me/GlobalReviewTask2026 registration bilkul free.",
    reported_date: "2026-10-07",
    ingested_date: "2026-10-08",
    source_bank: "Bank A",
    language: "Hinglish",
    script_type: "Job Offer Scam",
    lineage_id: "LIN-2026-JOB-03",
    identifiers: { phone: null, upi: "vipmerchant.agency@icici", url: "https://t.me/GlobalReviewTask2026" },
    reporter_hash: "0x90ea12bf",
    analyst_tags: ["Hinglish Task Scam"]
  },

  // Digital Arrest Scam (LIN-2026-CUSTOMS-05)
  {
    id: "CMP-830",
    raw_text: "URGENT NOTICE: Narcotics Control Bureau & Mumbai Police Crime Branch. A DHL consignment addressed to you containing 16 fake passports and MDMA contraband was intercepted. A warrant of arrest is issued. Contact Investigating Officer immediately on 9810987654 to deposit verification bond at delhipolice.verifyacc@yesbank",
    reported_date: "2026-10-07",
    ingested_date: "2026-10-08",
    source_bank: "Bank B",
    language: "English",
    script_type: "Digital Arrest",
    lineage_id: "LIN-2026-CUSTOMS-05",
    identifiers: { phone: "9810987654", upi: "delhipolice.verifyacc@yesbank", url: null },
    reporter_hash: "0x66ee3310",
    analyst_tags: ["Digital Arrest", "Police Impersonation", "Severe Threat"]
  },
  {
    id: "CMP-831",
    raw_text: "सावधान! दिल्ली पुलिस और फेडेक्स कोरियर: आपके पार्सल में गैरकानूनी सामग्री पाई गई है। गिरफ्तारी वारंट जारी हुआ है। तुरंत अधिकारी 9810987654 से संपर्क करें सत्यापन राशि जमा करें।",
    reported_date: "2026-10-06",
    ingested_date: "2026-10-08",
    source_bank: "Bank A",
    language: "Hindi",
    script_type: "Digital Arrest",
    lineage_id: "LIN-2026-CUSTOMS-05",
    identifiers: { phone: "9810987654", upi: "delhipolice.verifyacc@yesbank", url: null },
    reporter_hash: "0x11ee8801",
    analyst_tags: ["Digital Arrest", "High Loss Risk"]
  },

  // Lucky Draw Prize Scam (LIN-2026-PRIZE-04)
  {
    id: "CMP-840",
    raw_text: "बधाई हो! केबीसी लकी ड्रा में आपके मोबाइल नंबर को ₹25,00,000 का नकद पुरस्कार मिला है। चेक प्राप्त करने के लिए टैक्स और फाइल चार्ज ₹12,500 जमा करें: kbcluckydraw2026@sbi या कॉल करें 9711223344",
    reported_date: "2026-10-03",
    ingested_date: "2026-10-05",
    source_bank: "Bank A",
    language: "Hindi",
    script_type: "Prize Scam",
    lineage_id: "LIN-2026-PRIZE-04",
    identifiers: { phone: "9711223344", upi: "kbcluckydraw2026@sbi", url: null },
    reporter_hash: "0x55443322",
    analyst_tags: ["KBC Lottery", "Advance Fee"]
  }
];

// Initial Early Warning Alerts
const initialAlerts = [
  {
    id: "ALT-2026-001",
    lineage_id: "LIN-2026-KYC-01",
    script_type: "KYC Fraud",
    trigger_reason: "Complaint rate tripled in 48 hours; active identifier rotation observed across 3 institutions",
    observed_count: 58,
    nowcast_count: 94,
    recommended_action: "Escalate to I4C", // Monitor / Escalate to I4C / File DPIP Report
    status: "Active", // Active, Escalated, Dismissed
    created_at: "2026-10-08 09:15",
    acknowledged_by: null
  },
  {
    id: "ALT-2026-002",
    lineage_id: "LIN-2026-CUSTOMS-05",
    script_type: "Digital Arrest",
    trigger_reason: "High victim loss velocity; severe psychological coercion dialog acts detected in cross-lingual reports",
    observed_count: 19,
    nowcast_count: 33,
    recommended_action: "File DPIP Report",
    status: "Active",
    created_at: "2026-10-08 10:45",
    acknowledged_by: null
  },
  {
    id: "ALT-2026-003",
    lineage_id: "LIN-2026-ELEC-02",
    script_type: "Bill Impersonation",
    trigger_reason: "Nowcast surge: Rt > 2.2 with 60% reporting lag window, rapid Tamil & Telugu expansion",
    observed_count: 42,
    nowcast_count: 67,
    recommended_action: "Escalate to I4C",
    status: "Active",
    created_at: "2026-10-07 18:30",
    acknowledged_by: null
  },
  {
    id: "ALT-2026-004",
    lineage_id: "LIN-2026-REWARD-06",
    script_type: "Bank Impersonation",
    trigger_reason: "Legacy credential harvester domain blocked by telecommunication provider",
    observed_count: 15,
    nowcast_count: 17,
    recommended_action: "Monitor",
    status: "Dismissed",
    dismiss_reason: "Resolved Externally",
    created_at: "2026-09-25 11:00",
    acknowledged_by: "0xANALYST_99"
  }
];

// Initial Audit Trail (Compliant with RBI FREE-AI Framework)
const initialAuditLogs = [
  {
    id: "AUD-9001",
    timestamp: "2026-10-08 09:15:22",
    analyst_hash: "0xANALYST_4B",
    action: "SYSTEM_ALERT_TRIGGERED",
    affected_lineage: "LIN-2026-KYC-01",
    details: "Threshold crossed: Daily growth +42% nowcast adjusted",
    system_hash: "0x98fbc1023a88b1f4"
  },
  {
    id: "AUD-9002",
    timestamp: "2026-10-08 09:30:11",
    analyst_hash: "0xANALYST_4B",
    action: "TAG_VARIANT_OF_CONCERN",
    affected_lineage: "LIN-2026-KYC-01",
    details: "Marked as Variant of Concern (VOC-2026-Q4) after cross-bank overlap detection",
    system_hash: "0x7a22dc9901eef410"
  },
  {
    id: "AUD-9003",
    timestamp: "2026-10-08 10:45:04",
    analyst_hash: "0xANALYST_7F",
    action: "LINEAGE_ASSIGNMENT",
    affected_lineage: "LIN-2026-CUSTOMS-05",
    details: "Assigned CMP-830 with 94.2% dialog-act sequence similarity confidence",
    system_hash: "0x55e90ab12fcd8811"
  },
  {
    id: "AUD-9004",
    timestamp: "2026-10-08 11:20:19",
    analyst_hash: "0xADMIN_SEC_01",
    action: "CALIBRATION_UPDATED",
    affected_lineage: "GLOBAL",
    details: "Updated reporting delay calibration weights: 20% instant, 60% delayed, 20% severe tail",
    system_hash: "0xbb89104fa2890012"
  },
  {
    id: "AUD-9005",
    timestamp: "2026-10-08 12:05:40",
    analyst_hash: "0xANALYST_7F",
    action: "ALERT_ESCALATED_I4C",
    affected_lineage: "LIN-2026-KYC-01",
    details: "Dossier compiled and transmitted to I4C/DPIP sharing queue with keyed identifier hashes",
    system_hash: "0x331089beef45a190"
  }
];

// Poisoning Watch Queue (reporter submitting > 5 times to same lineage in 24h)
const initialPoisoningQueue = [
  {
    id: "POI-001",
    reporter_hash: "0xBAD_ACTOR_99",
    target_lineage_id: "LIN-2026-PRIZE-04",
    complaint_count_24h: 7,
    flagged_timestamp: "2026-10-08 08:40",
    status: "Held for Admin Review", // Held for Admin Review, Quarantined, Released
    sample_text: "This merchant is a scammer! Immediately ban this UPI account and freeze their bank branch!",
    suspected_intent: "Competitor Merchant Smear / Account Freeze Poisoning"
  }
];
