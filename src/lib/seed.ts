// Schema + seed for the RCM prototype, persisted in browser via sql.js.
// Cendana Health Group — 4 hospitals across Indonesia.
// Three payors: BPJS Kesehatan (gov), AIA Indonesia (private), Prudential Indonesia (private).

export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY, name TEXT, city TEXT, country TEXT, beds INTEGER
);
CREATE TABLE IF NOT EXISTS payors (
  id TEXT PRIMARY KEY, name TEXT, kind TEXT, country TEXT,
  clean_claim_rate REAL, avg_dtp_days REAL, denial_rate REAL,
  threads_ingested INTEGER, monthly_volume_idr INTEGER, color TEXT
);
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY, mrn TEXT, name TEXT, age INTEGER, sex TEXT,
  national_id TEXT, policy_number TEXT, payor_id TEXT, ward_class TEXT,
  pre_existing_conditions TEXT
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY, patient_id TEXT, payor_id TEXT, hospital_id TEXT, drg TEXT, dx TEXT,
  los_days INTEGER, gross_idr INTEGER, expected_reimb_idr INTEGER, deposit_idr INTEGER,
  status TEXT, stage TEXT, days_in_stage INTEGER,
  submitted_at TEXT, paid_at TEXT, denial_reason TEXT,
  acceptance_score REAL, predicted_dtp_days INTEGER, agent_step TEXT, risk_flag TEXT,
  source TEXT DEFAULT 'EMR'
);
CREATE TABLE IF NOT EXISTS uploaded_docs (
  id TEXT PRIMARY KEY,
  owner_kind TEXT, owner_id TEXT, patient_id TEXT,
  kind TEXT, filename TEXT, source_clinic TEXT,
  uploaded_by TEXT, uploaded_at TEXT, pages INTEGER,
  ocr_excerpt TEXT, extracted_icd TEXT, extracted_cpt TEXT, extracted_drg TEXT,
  status TEXT, sort INTEGER
);
CREATE TABLE IF NOT EXISTS payor_rules (
  id TEXT PRIMARY KEY,
  payor_id TEXT,
  category TEXT,             -- 'documentation' | 'financial' | 'process'
  kind TEXT,                 -- documentation/narrative/format/evidence/pre-auth (back-compat)
  drg_pattern TEXT,
  description TEXT,
  threshold_value TEXT,      -- plain-text threshold/value
  source_confidence TEXT,    -- 'extracted' | 'industry_typical' | 'admin_added' | 'promoted_from_denial'
  evidence_url TEXT,         -- citation URL (or empty)
  evidence_threads INTEGER,
  lift_pct REAL,
  added_by TEXT              -- 'system' | initials of admin
);
CREATE TABLE IF NOT EXISTS denial_codes (
  id TEXT PRIMARY KEY,
  payor_id TEXT,             -- NULL means applies to all
  bucket TEXT,               -- 'technical' | 'clinical' | 'contractual' | 'administrative'
  code TEXT,                 -- e.g. 'TEC-01'
  phrasing TEXT,             -- Bahasa-Indonesian phrasing as TPAs use
  frequency_pct REAL         -- 0..1, share of denials
);
CREATE TABLE IF NOT EXISTS email_threads (
  id TEXT PRIMARY KEY, payor_id TEXT, patient_id TEXT, subject TEXT, sender TEXT,
  excerpt TEXT, body TEXT, highlight TEXT, outcome TEXT, learned_rule TEXT, ts TEXT
);
CREATE TABLE IF NOT EXISTS gl_submissions (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  kind TEXT,
  state TEXT,
  amount_idr INTEGER,
  drafted_at TEXT,
  submitted_at TEXT,
  decided_at TEXT,
  decision_note TEXT
);
CREATE TABLE IF NOT EXISTS cashflow_days (
  d TEXT PRIMARY KEY, billed_idr INTEGER, collected_idr INTEGER, denied_idr INTEGER
);
CREATE TABLE IF NOT EXISTS pipeline_buckets (
  id TEXT PRIMARY KEY, label TEXT, count INTEGER, value_idr INTEGER, sort INTEGER
);
CREATE TABLE IF NOT EXISTS eligibility_checks (
  id TEXT PRIMARY KEY, patient_id TEXT, payor_id TEXT, hospital_id TEXT,
  status TEXT, source TEXT,
  started_at TEXT, completed_at TEXT, tat_seconds INTEGER,
  annual_limit_remaining_idr INTEGER, annual_limit_total_idr INTEGER,
  room_class_entitlement TEXT, pre_auth_required INTEGER, pre_auth_status TEXT,
  cob_primary_payor TEXT, dispute_risk_score REAL, exclusions_json TEXT,
  scheduled_admission_at TEXT, planned_procedure TEXT
);
CREATE TABLE IF NOT EXISTS denials (
  id TEXT PRIMARY KEY, claim_id TEXT, payor_id TEXT, hospital_id TEXT,
  category TEXT, reason_code TEXT, reason_text TEXT,
  denied_amount_idr INTEGER, denied_at TEXT, appeal_deadline_at TEXT,
  appeal_status TEXT, success_probability REAL, root_cause_step TEXT,
  recurring_pattern_id TEXT
);
CREATE TABLE IF NOT EXISTS appeal_drafts (
  id TEXT PRIMARY KEY, denial_id TEXT,
  letter_md TEXT, attachments_json TEXT,
  drafted_at TEXT, submitted_at TEXT, outcome TEXT
);
CREATE TABLE IF NOT EXISTS clearances (
  id TEXT PRIMARY KEY, patient_id TEXT, payor_id TEXT, hospital_id TEXT,
  status TEXT, drg TEXT, dx TEXT,
  scheduled_admission_at TEXT,
  los_predicted REAL, los_ci_low REAL, los_ci_high REAL,
  episode_cost_idr INTEGER, expected_reimb_idr INTEGER,
  patient_liability_idr INTEGER, deposit_required_idr INTEGER, deposit_collected_idr INTEGER,
  bad_debt_risk_tier TEXT,
  payment_mode TEXT,
  gop_status TEXT, gop_letter_md TEXT,
  consent_status TEXT, consent_signed_at TEXT,
  cost_breakdown_json TEXT
);
CREATE TABLE IF NOT EXISTS inpatients (
  id TEXT PRIMARY KEY, patient_id TEXT, payor_id TEXT, hospital_id TEXT,
  drg TEXT, dx TEXT, ward_class TEXT, attending_physician TEXT,
  admission_date TEXT, day_of_stay INTEGER,
  authorized_days INTEGER, los_drg_benchmark REAL, los_variance_pct REAL,
  acuity TEXT,
  medical_necessity_score REAL, medical_necessity_gaps_json TEXT,
  auth_extension_status TEXT, auth_extension_letter_md TEXT,
  discharge_readiness_score REAL,
  avoidable_day_flag INTEGER, avoidable_day_reason TEXT
);
`;

// ── Helpers to build SQL inserts ──────────────────────────────────────────
const esc = (v: string | number | null) =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replaceAll("'", "''")}'`;
const ins = (table: string, rows: Array<Record<string, string | number | null>>) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const vals = rows.map((r) => `(${cols.map((c) => esc(r[c])).join(",")})`).join(",\n");
  return `INSERT INTO ${table} (${cols.join(",")}) VALUES\n${vals};`;
};

// ── Seed data ─────────────────────────────────────────────────────────────
const hospitals = [
  // P5: h1 renamed to Mayapada Hospital (Budi + Ravi); h2 becomes RS Cendana Jakarta (Siti).
  { id: "h1", name: "Mayapada Hospital", city: "Jakarta", country: "ID", beds: 410 },
  { id: "h2", name: "RS Cendana Jakarta", city: "Jakarta", country: "ID", beds: 320 },
  { id: "h3", name: "Cendana Bandung", city: "Bandung", country: "ID", beds: 180 },
  { id: "h4", name: "Cendana Medan", city: "Medan", country: "ID", beds: 160 },
];

const payors = [
  {
    id: "bpjs",
    name: "BPJS Kesehatan",
    kind: "government",
    country: "ID",
    clean_claim_rate: 0.71,
    avg_dtp_days: 38,
    denial_rate: 0.18,
    threads_ingested: 4_812,
    monthly_volume_idr: 18_400_000_000,
    color: "#34d399",
  },
  {
    id: "aia",
    name: "AIA Indonesia",
    kind: "private",
    country: "ID",
    clean_claim_rate: 0.83,
    avg_dtp_days: 22,
    denial_rate: 0.12,
    threads_ingested: 2_137,
    monthly_volume_idr: 6_900_000_000,
    color: "#e7c08a",
  },
  {
    id: "pru",
    name: "Prudential Indonesia",
    kind: "private",
    country: "ID",
    clean_claim_rate: 0.81,
    avg_dtp_days: 24,
    denial_rate: 0.13,
    threads_ingested: 1_950,
    monthly_volume_idr: 5_500_000_000,
    color: "#f87171",
  },
];

// Patients — 28 total across the 4 sites
const patients = [
  { id: "p1", mrn: "MRN-734291", name: "Sari Wulandari", age: 47, sex: "F", national_id: "317301**********", policy_number: "0001-2099-447-188", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p2", mrn: "MRN-734302", name: "Budi Hartono", age: 62, sex: "M", national_id: "317304**********", policy_number: "AIA-IDN-22-118-901", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p3", mrn: "MRN-734318", name: "Putri Anggraini", age: 34, sex: "F", national_id: "317306**********", policy_number: "0001-2031-901-882", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p4", mrn: "MRN-734341", name: "Joko Mulyadi", age: 58, sex: "M", national_id: "317308**********", policy_number: "PRU-44-998-122", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p5", mrn: "MRN-734362", name: "Aditya Pratama", age: 51, sex: "M", national_id: "351002**********", policy_number: "0001-3122-118-441", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p6", mrn: "MRN-734381", name: "Dian Kusuma", age: 39, sex: "F", national_id: "351008**********", policy_number: "AIA-IDN-22-309-117", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p7", mrn: "MRN-734395", name: "Reza Firmansyah", age: 66, sex: "M", national_id: "320409**********", policy_number: "0001-4471-002-919", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p8", mrn: "MRN-734410", name: "Yulia Sari", age: 28, sex: "F", national_id: "320411**********", policy_number: "0001-4499-018-220", payor_id: "bpjs", ward_class: "Class III", pre_existing_conditions: '[]' },
  { id: "p9", mrn: "MRN-734428", name: "Wahyu Santoso", age: 54, sex: "M", national_id: "121707**********", policy_number: "PRU-44-991-770", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p10", mrn: "MRN-734441", name: "Indah Permata", age: 43, sex: "F", national_id: "121711**********", policy_number: "AIA-IDN-22-622-441", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p11", mrn: "MRN-734457", name: "Krisna Wijaya", age: 71, sex: "M", national_id: "317314**********", policy_number: "0001-5510-117-228", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p12", mrn: "MRN-734471", name: "Lestari Dewi", age: 36, sex: "F", national_id: "351019**********", policy_number: "0001-5571-208-039", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p13", mrn: "MRN-734489", name: "Hadi Nugroho", age: 49, sex: "M", national_id: "317320**********", policy_number: "AIA-IDN-22-880-117", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p14", mrn: "MRN-734502", name: "Rini Setiawati", age: 31, sex: "F", national_id: "320418**********", policy_number: "0001-6620-441-552", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p15", mrn: "MRN-734518", name: "Bayu Anggara", age: 45, sex: "M", national_id: "317329**********", policy_number: "PRU-44-110-882", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p16", mrn: "MRN-734534", name: "Citra Maharani", age: 53, sex: "F", national_id: "351027**********", policy_number: "0001-7741-002-118", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p17", mrn: "MRN-734549", name: "Eko Saputra", age: 60, sex: "M", national_id: "121719**********", policy_number: "AIA-IDN-22-901-330", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p18", mrn: "MRN-734564", name: "Maya Hartati", age: 41, sex: "F", national_id: "320424**********", policy_number: "0001-8870-118-449", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p19", mrn: "MRN-734578", name: "Faisal Rahman", age: 56, sex: "M", national_id: "317336**********", policy_number: "PRU-44-330-119", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p20", mrn: "MRN-734591", name: "Devi Lestari", age: 33, sex: "F", national_id: "351034**********", policy_number: "0001-9921-441-118", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p21", mrn: "MRN-734604", name: "Arif Hidayat", age: 48, sex: "M", national_id: "121723**********", policy_number: "AIA-IDN-22-117-880", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p22", mrn: "MRN-734618", name: "Nina Yuliani", age: 38, sex: "F", national_id: "320431**********", policy_number: "0001-2210-001-117", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p23", mrn: "MRN-734631", name: "Bagus Pradana", age: 64, sex: "M", national_id: "317344**********", policy_number: "PRU-44-228-117", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p24", mrn: "MRN-734647", name: "Rara Anjani", age: 29, sex: "F", national_id: "351041**********", policy_number: "0001-3340-119-228", payor_id: "bpjs", ward_class: "Class III", pre_existing_conditions: '[]' },
  { id: "p25", mrn: "MRN-734660", name: "Galih Prasetya", age: 52, sex: "M", national_id: "317352**********", policy_number: "AIA-IDN-22-558-117", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p26", mrn: "MRN-734674", name: "Sinta Andini", age: 44, sex: "F", national_id: "320438**********", policy_number: "0001-4470-119-552", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p27", mrn: "MRN-734687", name: "Pandu Wirawan", age: 67, sex: "M", national_id: "121728**********", policy_number: "PRU-44-447-002", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p28", mrn: "MRN-734702", name: "Maharani Indah", age: 35, sex: "F", national_id: "317359**********", policy_number: "0001-5580-118-441", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p29", mrn: "MRN-734718", name: "Tedi Ramadhan", age: 57, sex: "M", national_id: "317365**********", policy_number: "AIA-IDN-22-771-559", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p30", mrn: "MRN-734724", name: "Sukma Larasati", age: 42, sex: "F", national_id: "320445**********", policy_number: "0001-6691-118-447", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p31", mrn: "MRN-734739", name: "Hendra Wibowo", age: 63, sex: "M", national_id: "121733**********", policy_number: "PRU-44-552-117", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p32", mrn: "MRN-734751", name: "Anita Permadi", age: 38, sex: "F", national_id: "351049**********", policy_number: "0001-7720-441-118", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p33", mrn: "MRN-734767", name: "Lukman Hakim", age: 49, sex: "M", national_id: "317371**********", policy_number: "0001-8830-447-112", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p34", mrn: "MRN-734781", name: "Wulan Pertiwi", age: 32, sex: "F", national_id: "351055**********", policy_number: "AIA-IDN-22-440-118", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p35", mrn: "MRN-734798", name: "Ardi Saputra", age: 55, sex: "M", national_id: "121738**********", policy_number: "PRU-44-770-228", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p36", mrn: "MRN-734814", name: "Kirana Sari", age: 41, sex: "F", national_id: "320452**********", policy_number: "0001-9920-118-449", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p37", mrn: "MRN-734827", name: "Bima Pratama", age: 37, sex: "M", national_id: "317382**********", policy_number: "AIA-IDN-22-118-664", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p38", mrn: "MRN-734841", name: "Nadia Khairani", age: 29, sex: "F", national_id: "351068**********", policy_number: "0001-2210-441-118", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  { id: "p39", mrn: "MRN-734856", name: "Galih Saputra", age: 46, sex: "M", national_id: "317391**********", policy_number: "AIA-IDN-22-330-882", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p40", mrn: "MRN-734869", name: "Ratri Hartini", age: 51, sex: "F", national_id: "320461**********", policy_number: "0001-3340-441-228", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '[]' },
  { id: "p41", mrn: "MRN-734881", name: "Surya Mahendra", age: 39, sex: "M", national_id: "121742**********", policy_number: "PRU-44-118-770", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '[]' },
  { id: "p42", mrn: "MRN-734895", name: "Indira Kusumawati", age: 33, sex: "F", national_id: "351074**********", policy_number: "0001-4470-118-441", payor_id: "bpjs", ward_class: "Class II", pre_existing_conditions: '[]' },
  // Showcase manual-intake patient — sparse context, evidence arrives via uploaded scans
  { id: "p43", mrn: "MRN-734910", name: "Ayu Lestari", age: 42, sex: "F", national_id: "317399**********", policy_number: "PRU-IDN-22-008-441", payor_id: "pru", ward_class: "Private", pre_existing_conditions: '["Symptomatic fibroid uterus"]' },
  // P5 deep-seed trio — Budi (BPJS cardiac surgery), Siti (BPJS C-section pre-auth), Ravi (AIA PCI dispute)
  { id: "p-budi", mrn: "MRN-901001", name: "Budi Santoso", age: 58, sex: "M", national_id: "317301**********", policy_number: "0001-5018-880-221", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '["HTN (10y)", "T2DM (controlled)", "Dyslipidaemia"]' },
  { id: "p-siti", mrn: "MRN-901002", name: "Ibu Siti Aminah", age: 34, sex: "F", national_id: "317302**********", policy_number: "0001-9011-002-447", payor_id: "bpjs", ward_class: "Class I", pre_existing_conditions: '["Prior C-section scar"]' },
  { id: "p-ravi", mrn: "MRN-901003", name: "Ravi Subramaniam", age: 51, sex: "M", national_id: "121702**********", policy_number: "AIA-IDN-23-117-902", payor_id: "aia", ward_class: "Private", pre_existing_conditions: '["CAD", "HTN (controlled)"]' },
];

// Stage taxonomy: BUILDING · AWAITING_PREAUTH · READY · SUBMITTED · AT_RISK · DENIED · PAID
// 28 claims spread across the chain
const claims = [
  // BUILDING (4) — agents reasoning right now
  { id: "c1", patient_id: "p1", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-13-I", dx: "Laparoscopic hysterectomy · endometriosis (N80.9)", los_days: 4, gross_idr: 38_400_000, expected_reimb_idr: 32_900_000, deposit_idr: 2_500_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.92, predicted_dtp_days: 11, agent_step: "Composing packet · 12 artifacts", risk_flag: null },
  { id: "c5", patient_id: "p5", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy · acute (K35.8)", los_days: 2, gross_idr: 18_700_000, expected_reimb_idr: 16_200_000, deposit_idr: 1_500_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 13, agent_step: "Pulling OT record + anaesthesia log", risk_flag: null },
  { id: "c6", patient_id: "p6", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · stable angina (I20.0)", los_days: 2, gross_idr: 138_900_000, expected_reimb_idr: 124_400_000, deposit_idr: 6_000_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.79, predicted_dtp_days: 17, agent_step: "Drafting SYNTAX score worksheet", risk_flag: null },
  { id: "c7", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG E-4-10-I", dx: "Severe community-acquired pneumonia (J18.9)", los_days: 6, gross_idr: 27_600_000, expected_reimb_idr: 22_800_000, deposit_idr: 1_500_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.74, predicted_dtp_days: 18, agent_step: "Auto-coding ICD-10 from progress notes", risk_flag: null },

  // PREAUTH_BUILDING (4) — agent assembling pre-auth packet, not yet sent
  { id: "c29", patient_id: "p29", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Pre-admit · scheduled multi-vessel PCI · UA (I20.0)", los_days: 3, gross_idr: 168_500_000, expected_reimb_idr: 152_300_000, deposit_idr: 9_000_000, status: "PREAUTH_BUILDING", stage: "PREAUTH_BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.81, predicted_dtp_days: 18, agent_step: "Drafting SYNTAX worksheet · pulling angio report", risk_flag: null },
  { id: "c30", patient_id: "p30", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-15-I", dx: "Pre-admit · scheduled myomectomy · fibroid (D25)", los_days: 4, gross_idr: 28_900_000, expected_reimb_idr: 24_700_000, deposit_idr: 2_000_000, status: "PREAUTH_BUILDING", stage: "PREAUTH_BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.85, predicted_dtp_days: 14, agent_step: "Attaching pre-op MRI · DRG matcher running", risk_flag: null },
  { id: "c31", patient_id: "p31", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Pre-admit · scheduled left THR · OA hip (M16.1)", los_days: 5, gross_idr: 218_400_000, expected_reimb_idr: 196_500_000, deposit_idr: 16_000_000, status: "PREAUTH_BUILDING", stage: "PREAUTH_BUILDING", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.74, predicted_dtp_days: 21, agent_step: "Implant model lookup · matching to PA template", risk_flag: null },
  { id: "c32", patient_id: "p32", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-15-II", dx: "Pre-admit · planned lap appendectomy · sub-acute (K35.8)", los_days: 2, gross_idr: 19_200_000, expected_reimb_idr: 16_400_000, deposit_idr: 1_500_000, status: "PREAUTH_BUILDING", stage: "PREAUTH_BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 10, agent_step: "Coding ICD-10 · OT scheduled tomorrow", risk_flag: null },

  // AWAITING_PREAUTH (5) — submitted, waiting on insurer
  { id: "c8", patient_id: "p8", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "Elective C-section · breech (O64)", los_days: 3, gross_idr: 22_400_000, expected_reimb_idr: 19_100_000, deposit_idr: 1_500_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 1, submitted_at: "2026-05-02T09:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.83, predicted_dtp_days: 16, agent_step: "Pre-auth ack · awaiting approval", risk_flag: null },
  { id: "c9", patient_id: "p9", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Right THR · OA hip (M16.1)", los_days: 5, gross_idr: 198_400_000, expected_reimb_idr: 178_900_000, deposit_idr: 14_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 2, submitted_at: "2026-05-01T14:32:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.71, predicted_dtp_days: 22, agent_step: "Implant lot match verified · pending PA", risk_flag: null },
  { id: "c10", patient_id: "p10", payor_id: "aia", hospital_id: "h2", drg: "PRIV-ONCO-CHEMO-D", dx: "Cycle 4 · breast Ca chemo (C50.9)", los_days: 1, gross_idr: 41_200_000, expected_reimb_idr: 38_700_000, deposit_idr: 2_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 0, submitted_at: "2026-05-03T10:15:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 10, agent_step: "Treatment-protocol ref attached", risk_flag: null },
  { id: "c11", patient_id: "p11", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-2-13-I", dx: "TURP · BPH (N40)", los_days: 3, gross_idr: 31_500_000, expected_reimb_idr: 27_200_000, deposit_idr: 2_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 3, submitted_at: "2026-04-30T11:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.77, predicted_dtp_days: 19, agent_step: "PA aging · auto-followup queued", risk_flag: "AGING_PA" },
  { id: "c12", patient_id: "p12", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", los_days: 4, gross_idr: 26_800_000, expected_reimb_idr: 22_400_000, deposit_idr: 2_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 1, submitted_at: "2026-05-02T15:21:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.81, predicted_dtp_days: 17, agent_step: "MRI evidence attached", risk_flag: null },

  // PREAUTH_APPROVED (2) — agent submitted, payor approved · zero human touch
  { id: "c38", patient_id: "p38", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-10-I", dx: "Pre-admit · scheduled C-section · breech (O64)", los_days: 3, gross_idr: 22_900_000, expected_reimb_idr: 19_500_000, deposit_idr: 1_500_000, status: "PREAUTH_APPROVED", stage: "PREAUTH_APPROVED", days_in_stage: 0, submitted_at: "2026-05-02T08:14:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.95, predicted_dtp_days: 11, agent_step: "Auto-approved · PA-99814 issued", risk_flag: null },
  { id: "c39", patient_id: "p39", payor_id: "aia", hospital_id: "h1", drg: "PRIV-ENT-TONSIL", dx: "Pre-admit · scheduled tonsillectomy (J35.0)", los_days: 1, gross_idr: 41_200_000, expected_reimb_idr: 37_400_000, deposit_idr: 2_500_000, status: "PREAUTH_APPROVED", stage: "PREAUTH_APPROVED", days_in_stage: 1, submitted_at: "2026-05-01T10:32:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.96, predicted_dtp_days: 8, agent_step: "Auto-approved · letter on file", risk_flag: null },

  // READY (3) — passed scrubbing, awaiting human submit
  { id: "c13", patient_id: "p13", payor_id: "aia", hospital_id: "h1", drg: "PRIV-NEURO-CRANI", dx: "Elective craniotomy · meningioma (D32.0)", los_days: 7, gross_idr: 312_700_000, expected_reimb_idr: 281_400_000, deposit_idr: 22_000_000, status: "READY", stage: "READY", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.94, predicted_dtp_days: 14, agent_step: "Ready · 0 critical · 1 advisory", risk_flag: null },
  { id: "c14", patient_id: "p14", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG K-1-14-I", dx: "Open cholecystectomy · cholelithiasis (K80)", los_days: 4, gross_idr: 24_900_000, expected_reimb_idr: 21_400_000, deposit_idr: 1_500_000, status: "READY", stage: "READY", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.91, predicted_dtp_days: 12, agent_step: "Ready for review", risk_flag: null },
  { id: "c15", patient_id: "p15", payor_id: "pru", hospital_id: "h4", drg: "PRIV-ORTHO-TKR", dx: "Left TKR · OA knee (M17.1)", los_days: 5, gross_idr: 172_300_000, expected_reimb_idr: 154_800_000, deposit_idr: 12_000_000, status: "READY", stage: "READY", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.89, predicted_dtp_days: 18, agent_step: "Ready · implant lot verified", risk_flag: null },

  // SUBMITTED (8) — in payor adjudication
  { id: "c2", patient_id: "p2", payor_id: "aia", hospital_id: "h1", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · NSTEMI (I21.4)", los_days: 3, gross_idr: 142_300_000, expected_reimb_idr: 128_700_000, deposit_idr: 8_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 4, submitted_at: "2026-04-29T11:14:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.91, predicted_dtp_days: 19, agent_step: "Acknowledged · adjudication", risk_flag: null },
  { id: "c16", patient_id: "p16", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-13-I", dx: "Total abdominal hysterectomy · adenomyosis", los_days: 5, gross_idr: 35_200_000, expected_reimb_idr: 30_100_000, deposit_idr: 2_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 7, submitted_at: "2026-04-26T09:30:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 13, agent_step: "Adjudicated · awaiting payment", risk_flag: null },
  { id: "c17", patient_id: "p17", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Multi-vessel PCI · STEMI (I21.0)", los_days: 4, gross_idr: 218_500_000, expected_reimb_idr: 197_800_000, deposit_idr: 12_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 3, submitted_at: "2026-04-30T17:11:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.93, predicted_dtp_days: 17, agent_step: "Acknowledged", risk_flag: null },
  { id: "c18", patient_id: "p18", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy", los_days: 2, gross_idr: 17_900_000, expected_reimb_idr: 15_400_000, deposit_idr: 1_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 5, submitted_at: "2026-04-28T13:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 11, agent_step: "Adjudicated", risk_flag: null },
  { id: "c19", patient_id: "p19", payor_id: "pru", hospital_id: "h2", drg: "PRIV-ORTHO-TKR", dx: "Bilateral TKR staged · OA knee", los_days: 7, gross_idr: 285_400_000, expected_reimb_idr: 256_800_000, deposit_idr: 18_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 6, submitted_at: "2026-04-27T10:45:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.84, predicted_dtp_days: 22, agent_step: "Acknowledged · 1 query open", risk_flag: null },
  { id: "c20", patient_id: "p20", payor_id: "bpjs", hospital_id: "h4", drg: "INA-CBG O-6-10-I", dx: "Emergency C-section · fetal distress (O68)", los_days: 3, gross_idr: 19_400_000, expected_reimb_idr: 16_800_000, deposit_idr: 1_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 9, submitted_at: "2026-04-24T07:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.82, predicted_dtp_days: 14, agent_step: "Adjudicated · DRG accepted", risk_flag: null },
  { id: "c21", patient_id: "p21", payor_id: "aia", hospital_id: "h1", drg: "PRIV-NEURO-CRANI", dx: "Craniotomy · glioblastoma (C71.9)", los_days: 9, gross_idr: 348_900_000, expected_reimb_idr: 312_500_000, deposit_idr: 25_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 8, submitted_at: "2026-04-25T16:20:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.87, predicted_dtp_days: 23, agent_step: "Adjudicated · pending oncology review", risk_flag: null },
  { id: "c22", patient_id: "p22", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-14-I", dx: "Open cholecystectomy + CBD exploration", los_days: 5, gross_idr: 28_700_000, expected_reimb_idr: 24_600_000, deposit_idr: 2_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 2, submitted_at: "2026-05-01T08:15:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.85, predicted_dtp_days: 13, agent_step: "Acknowledged", risk_flag: null },
  { id: "c33", patient_id: "p33", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy · acute (K35.8)", los_days: 2, gross_idr: 19_800_000, expected_reimb_idr: 17_100_000, deposit_idr: 1_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 1, submitted_at: "2026-05-03T09:22:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.92, predicted_dtp_days: 11, agent_step: "Acknowledged · adjudicating", risk_flag: null },
  { id: "c34", patient_id: "p34", payor_id: "aia", hospital_id: "h2", drg: "PRIV-OBGYN-LAP", dx: "Laparoscopic ovarian cystectomy (N83.2)", los_days: 2, gross_idr: 64_500_000, expected_reimb_idr: 58_700_000, deposit_idr: 4_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 2, submitted_at: "2026-05-02T14:08:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.89, predicted_dtp_days: 14, agent_step: "Acknowledged", risk_flag: null },
  { id: "c35", patient_id: "p35", payor_id: "pru", hospital_id: "h1", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · stable angina (I20.0)", los_days: 3, gross_idr: 162_400_000, expected_reimb_idr: 146_500_000, deposit_idr: 9_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 3, submitted_at: "2026-05-01T16:40:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.9, predicted_dtp_days: 16, agent_step: "Adjudicated · awaiting EOB", risk_flag: null },
  { id: "c36", patient_id: "p36", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", los_days: 4, gross_idr: 27_300_000, expected_reimb_idr: 23_100_000, deposit_idr: 2_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 4, submitted_at: "2026-04-30T11:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 12, agent_step: "Adjudicated", risk_flag: null },
  { id: "c37", patient_id: "p37", payor_id: "aia", hospital_id: "h1", drg: "PRIV-ENT-TONSIL", dx: "Tonsillectomy · chronic tonsillitis (J35.0)", los_days: 1, gross_idr: 38_900_000, expected_reimb_idr: 35_400_000, deposit_idr: 2_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 5, submitted_at: "2026-04-29T10:11:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.94, predicted_dtp_days: 9, agent_step: "Acknowledged · clean pass", risk_flag: null },

  // AUTO_CLEARED (3) — agent built + submitted + ack received · zero human touch
  { id: "c40", patient_id: "p40", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "Elective C-section · uncomplicated (O82)", los_days: 3, gross_idr: 21_400_000, expected_reimb_idr: 18_300_000, deposit_idr: 1_500_000, status: "AUTO_CLEARED", stage: "AUTO_CLEARED", days_in_stage: 2, submitted_at: "2026-05-02T07:30:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.97, predicted_dtp_days: 9, agent_step: "End-to-end auto · adjudicating", risk_flag: null },
  { id: "c41", patient_id: "p41", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee (M17.1)", los_days: 4, gross_idr: 158_700_000, expected_reimb_idr: 142_900_000, deposit_idr: 11_000_000, status: "AUTO_CLEARED", stage: "AUTO_CLEARED", days_in_stage: 3, submitted_at: "2026-05-01T15:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.95, predicted_dtp_days: 13, agent_step: "End-to-end auto · clean pass", risk_flag: null },
  { id: "c42", patient_id: "p42", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy · acute (K35.8)", los_days: 2, gross_idr: 18_300_000, expected_reimb_idr: 15_700_000, deposit_idr: 1_500_000, status: "AUTO_CLEARED", stage: "AUTO_CLEARED", days_in_stage: 4, submitted_at: "2026-04-30T11:45:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.96, predicted_dtp_days: 10, agent_step: "End-to-end auto · ack received", risk_flag: null },

  // AT_RISK (4) — low confidence, flagged for human attention
  { id: "c23", patient_id: "p23", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Revision THR · prosthetic loosening (T84.030)", los_days: 8, gross_idr: 248_700_000, expected_reimb_idr: 198_900_000, deposit_idr: 18_000_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.42, predicted_dtp_days: 28, agent_step: "Pre-auth implant model mismatch", risk_flag: "PA_MISMATCH" },
  { id: "c24", patient_id: "p24", payor_id: "bpjs", hospital_id: "h4", drg: "INA-CBG O-6-13-I", dx: "TLH · endometriosis · no MRI on file", los_days: 4, gross_idr: 36_800_000, expected_reimb_idr: 31_200_000, deposit_idr: 2_500_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 2, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.51, predicted_dtp_days: 26, agent_step: "Missing MRI · rule r1 unmet", risk_flag: "MISSING_DOC" },
  { id: "c25", patient_id: "p25", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "PCI · NSTEMI · no SYNTAX", los_days: 3, gross_idr: 156_400_000, expected_reimb_idr: 118_900_000, deposit_idr: 9_000_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.58, predicted_dtp_days: 24, agent_step: "Missing SYNTAX score · rule r5 unmet", risk_flag: "MISSING_DOC" },
  { id: "c26", patient_id: "p26", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG E-4-10-I", dx: "Pneumonia · LOS exceeds DRG cap by 2d", los_days: 9, gross_idr: 33_200_000, expected_reimb_idr: 23_800_000, deposit_idr: 1_500_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.49, predicted_dtp_days: 30, agent_step: "LOS variance · extension request drafted", risk_flag: "LOS_VARIANCE" },

  // Closed (paid + denied) — historical context
  { id: "c3", patient_id: "p3", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "C-section · primigravida (O82)", los_days: 3, gross_idr: 21_900_000, expected_reimb_idr: 18_600_000, deposit_idr: 1_500_000, status: "PAID", stage: "PAID", days_in_stage: 0, submitted_at: "2026-04-12T08:11:00Z", paid_at: "2026-04-26T10:00:00Z", denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 14, agent_step: null, risk_flag: null },
  { id: "c27", patient_id: "p27", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · post-op (M17.1)", los_days: 5, gross_idr: 168_500_000, expected_reimb_idr: 152_300_000, deposit_idr: 12_000_000, status: "PAID", stage: "PAID", days_in_stage: 0, submitted_at: "2026-04-08T09:32:00Z", paid_at: "2026-04-29T14:18:00Z", denial_reason: null, acceptance_score: 0.91, predicted_dtp_days: 21, agent_step: null, risk_flag: null },
  { id: "c4", patient_id: "p4", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee (M17.1)", los_days: 5, gross_idr: 168_500_000, expected_reimb_idr: 0, deposit_idr: 12_000_000, status: "DENIED", stage: "DENIED", days_in_stage: 0, submitted_at: "2026-04-08T09:32:00Z", paid_at: null, denial_reason: "Pre-auth scope mismatch — implant not pre-approved", acceptance_score: 0.36, predicted_dtp_days: null, agent_step: null, risk_flag: null },
  { id: "c28", patient_id: "p28", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", los_days: 4, gross_idr: 24_700_000, expected_reimb_idr: 21_300_000, deposit_idr: 2_000_000, status: "PAID", stage: "PAID", days_in_stage: 0, submitted_at: "2026-04-15T11:00:00Z", paid_at: "2026-04-30T09:00:00Z", denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 15, agent_step: null, risk_flag: null },
];

// ── Ayu Lestari (p43) · sparse-context intake built from uploaded scans ─────
// Inserted separately because it carries the `source` column ('DOC_UPLOAD').
const docDrivenClaims = [
  { id: "c43", patient_id: "p43", payor_id: "pru", hospital_id: "h1", drg: "PRIV-GYN-HYST-S", dx: "Planned laparoscopic hysterectomy · symptomatic fibroid uterus (D25)", los_days: 4, gross_idr: 96_000_000, expected_reimb_idr: 84_000_000, deposit_idr: 10_000_000, status: "PREAUTH_BUILDING", stage: "PREAUTH_BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.69, predicted_dtp_days: 18, agent_step: "Outside-clinic packet arriving as scanned documents", risk_flag: null, source: "DOC_UPLOAD" },
];

// 24 realistic rules across BPJS / Prudential Indonesia / AIA Indonesia.
// Sourced from: Permenkes 26/2021 & 3/2023, BPJS verifier manual (PERSI 2018),
// PRUSolusi Sehat brochure, cashless review guidance, AIA TPA workflow,
// Lockton/OJK SEOJK 7/2025 health-product reform notes.
// Ordered descending by lift_pct.
const payorRules = [
  { id: "pru-fin-02", payor_id: "pru", category: "financial", kind: "evidence", drg_pattern: "*", description: "Pre-existing condition (PED) waiting period 12 months from policy commencement — chronic / specific conditions may extend per OJK SEOJK 7/2025.", threshold_value: "12 months PED", source_confidence: "extracted", evidence_url: "https://global.lockton.com/us/en/news-insights/indonesia-to-reform-health-insurance-products-for-enhanced-risk-management", evidence_threads: 168, lift_pct: 0.16, added_by: "system" },
  { id: "bpjs-doc-04", payor_id: "bpjs", category: "documentation", kind: "documentation", drg_pattern: "INA-CBG O-6-13", description: "Attach pre-op pelvic MRI report alongside ultrasound — MRI presence raises pass rate by 11.4 pts on this hysterectomy DRG cluster.", threshold_value: "MRI mandatory pre-op", source_confidence: "promoted_from_denial", evidence_url: "", evidence_threads: 184, lift_pct: 0.15, added_by: "RR" },
  { id: "pru-fin-03", payor_id: "pru", category: "financial", kind: "evidence", drg_pattern: "*", description: "Specific procedure waiting period 12 months: cataract, hernia, kidney stone, hemorrhoids, tonsillectomy, hysterectomy (non-cancer).", threshold_value: "12 months specific", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 78, lift_pct: 0.14, added_by: "system" },
  { id: "aia-fin-03", payor_id: "aia", category: "financial", kind: "evidence", drg_pattern: "*", description: "PED waiting 12 months (24 months for some critical-illness riders per OJK 2025 reform).", threshold_value: "12 months PED", source_confidence: "extracted", evidence_url: "https://global.lockton.com/us/en/news-insights/indonesia-to-reform-health-insurance-products-for-enhanced-risk-management", evidence_threads: 152, lift_pct: 0.13, added_by: "system" },
  { id: "pru-fin-01", payor_id: "pru", category: "financial", kind: "evidence", drg_pattern: "*", description: "Room rate exceeds plan tier → prorate deduction applied to all eligible charges (plan_rate / actual_rate ratio).", threshold_value: "prorate_ratio", source_confidence: "industry_typical", evidence_url: "https://asuransinow.com/ketentuan-prorata-asuransi-kesehatan-di-indonesia/", evidence_threads: 86, lift_pct: 0.12, added_by: "system" },
  { id: "bpjs-fin-03", payor_id: "bpjs", category: "financial", kind: "evidence", drg_pattern: "*", description: "Coordination of Benefits: BPJS pays first up to INA-CBG tariff; private (AKT) insurer pays the excess only. Per KMK HK.01.07/MENKES/1117/2025.", threshold_value: "BPJS primary up to INA-CBG", source_confidence: "extracted", evidence_url: "https://www.badankebijakan.kemkes.go.id/penataan-kebijakan-selisih-biaya-melalui-koordinasi-antar-penyelenggara-jaminan-dalam-program-jkn-resmi-diluncurkan/", evidence_threads: 198, lift_pct: 0.11, added_by: "system" },
  { id: "aia-doc-03", payor_id: "aia", category: "documentation", kind: "documentation", drg_pattern: "PRIV-CARDIO-*", description: "Specialist endorsement note (board-certified cardiologist) materially shifts adjudication — peers without endorsement see 28% partial-pay.", threshold_value: "specialist sign-off required", source_confidence: "promoted_from_denial", evidence_url: "", evidence_threads: 142, lift_pct: 0.11, added_by: "RR" },
  { id: "bpjs-fin-01", payor_id: "bpjs", category: "financial", kind: "evidence", drg_pattern: "INA-CBG *", description: "Reimbursement is INA-CBG case-mix tariff — 1,077 groups (789 inpatient + 288 outpatient) per Permenkes 26/2021.", threshold_value: "INA-CBG tariff lookup", source_confidence: "extracted", evidence_url: "https://manuver.tireg7.net/wp-content/uploads/2022/08/Permenkes-26-Tahun-2021-PEDOMAN-INDONESIAN-CASE-BASE-GROUPS-INA-CBG.pdf", evidence_threads: 412, lift_pct: 0.10, added_by: "system" },
  { id: "aia-doc-04", payor_id: "aia", category: "documentation", kind: "evidence", drg_pattern: "PRIV-CARDIO-PCI-*", description: "Attach SYNTAX score worksheet for any single- or multi-vessel PCI claim. Improves first-pass acceptance from 71% to 89% historically.", threshold_value: "SYNTAX worksheet on PCI", source_confidence: "promoted_from_denial", evidence_url: "", evidence_threads: 89, lift_pct: 0.10, added_by: "RR" },
  { id: "bpjs-fin-02", payor_id: "bpjs", category: "financial", kind: "evidence", drg_pattern: "INA-CBG *", description: "Tariff differs by Kelas Rawat I/II/III plus Regional 1–5 per Permenkes 3/2023.", threshold_value: "Kelas I/II/III × Regional 1-5", source_confidence: "extracted", evidence_url: "https://peraturan.bpk.go.id/Details/275518/permenkes-no-3-tahun-2023", evidence_threads: 268, lift_pct: 0.09, added_by: "system" },
  { id: "aia-fin-02", payor_id: "aia", category: "financial", kind: "evidence", drg_pattern: "*", description: "ICU cap typically 2× standard room rate per day; max 30 days/year.", threshold_value: "2× standard / 30d/yr", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 64, lift_pct: 0.09, added_by: "system" },
  { id: "pru-doc-01", payor_id: "pru", category: "documentation", kind: "documentation", drg_pattern: "*", description: "Initial Medical Report (Laporan Medis Awal) must reach the cashless review desk before GL issuance — must include diagnosis, planned treatment, estimated LOS.", threshold_value: "LMA pre-GL mandatory", source_confidence: "extracted", evidence_url: "https://www.allianz.co.id/content/dam/onemarketing/azli/wwwallianzcoid/layanan/klaim/klaim-asuransi-kesehatan/V1-5-FAQ-Prosedur-Cashless.pdf", evidence_threads: 134, lift_pct: 0.09, added_by: "system" },
  { id: "aia-doc-01", payor_id: "aia", category: "documentation", kind: "documentation", drg_pattern: "*", description: "LMA from hospital is the trigger for GL issuance — without it, no GL is released.", threshold_value: "LMA mandatory pre-GL", source_confidence: "extracted", evidence_url: "http://www.aia-financial.co.id/id/help-support/TPA.html", evidence_threads: 128, lift_pct: 0.09, added_by: "system" },
  { id: "bpjs-doc-01", payor_id: "bpjs", category: "documentation", kind: "format", drg_pattern: "*", description: "SEP must be issued and printed within 3×24h of admission; otherwise claim rejected on receipt.", threshold_value: "3×24h post-admission", source_confidence: "industry_typical", evidence_url: "https://www.persi.or.id/wp-content/uploads/2018/03/panduan_verifikasi_inacbg.pdf", evidence_threads: 312, lift_pct: 0.08, added_by: "system" },
  { id: "bpjs-proc-02", payor_id: "bpjs", category: "process", kind: "pre-auth", drg_pattern: "INA-CBG *", description: "Re-admission with same diagnosis < 7 days post-discharge bundled as one episode (single INA-CBG payment).", threshold_value: "<7d same-dx bundle", source_confidence: "extracted", evidence_url: "https://www.persi.or.id/wp-content/uploads/2018/03/panduan_verifikasi_inacbg.pdf", evidence_threads: 156, lift_pct: 0.08, added_by: "system" },
  { id: "bpjs-doc-03", payor_id: "bpjs", category: "documentation", kind: "format", drg_pattern: "INA-CBG *", description: "Diagnosis coding via ICD-10 (2010); procedures via ICD-9-CM (2010) per Permenkes 26/2021.", threshold_value: "ICD-10 2010 / ICD-9-CM 2010", source_confidence: "extracted", evidence_url: "https://manuver.tireg7.net/wp-content/uploads/2022/08/Permenkes-26-Tahun-2021-PEDOMAN-INDONESIAN-CASE-BASE-GROUPS-INA-CBG.pdf", evidence_threads: 224, lift_pct: 0.08, added_by: "system" },
  { id: "pru-proc-02", payor_id: "pru", category: "process", kind: "pre-auth", drg_pattern: "*", description: "GL top-up / addendum required when intra-op scope expands (e.g. laparoscopic→open cholecystectomy, additional procedure); revised LMA within 24h.", threshold_value: "LMA addendum within 24h", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 72, lift_pct: 0.08, added_by: "system" },
  { id: "aia-fin-01", payor_id: "aia", category: "financial", kind: "evidence", drg_pattern: "*", description: "Room and board cap per day per plan tier; prorate when actual exceeds plan rate.", threshold_value: "plan-tier dependent", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 70, lift_pct: 0.08, added_by: "system" },
  { id: "pru-proc-03", payor_id: "pru", category: "process", kind: "pre-auth", drg_pattern: "*", description: "Reimbursement claim must be submitted within 60 days of discharge; decision TAT 14 working days from complete file.", threshold_value: "60d submit / 14wd decide", source_confidence: "extracted", evidence_url: "https://www.prudential.co.id/id/claims-support/claim/klaim-rawat-inap/", evidence_threads: 118, lift_pct: 0.07, added_by: "system" },
  { id: "aia-proc-02", payor_id: "aia", category: "process", kind: "pre-auth", drg_pattern: "*", description: "GL extension/amendment if LOS exceeds initial estimate by >24h or scope expands; hospital files Laporan Medis Lanjutan.", threshold_value: "LMLanjutan if LOS+24h", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 58, lift_pct: 0.07, added_by: "system" },
  { id: "pru-doc-02", payor_id: "pru", category: "documentation", kind: "documentation", drg_pattern: "*", description: "Reimbursement claims need original kuitansi + perincian biaya + resume medis + KTP/KK + bank details.", threshold_value: "5-doc reimbursement bundle", source_confidence: "extracted", evidence_url: "https://www.prudential.co.id/id/claims-support/claim/klaim-rawat-inap/", evidence_threads: 96, lift_pct: 0.07, added_by: "system" },
  { id: "bpjs-proc-01", payor_id: "bpjs", category: "process", kind: "pre-auth", drg_pattern: "INA-CBG *", description: "Hospital must submit claim batch monthly via VClaim/E-Klaim within 6 months from discharge; late filings stamped 'kadaluarsa' and rejected.", threshold_value: "monthly batch / 6mo cap", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 88, lift_pct: 0.06, added_by: "system" },
  { id: "bpjs-doc-02", payor_id: "bpjs", category: "documentation", kind: "documentation", drg_pattern: "*", description: "Resume Medis must be signed by DPJP — unsigned resumes returned as 'berkas tidak lengkap'.", threshold_value: "DPJP signature required", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 76, lift_pct: 0.06, added_by: "system" },
  { id: "pru-proc-01", payor_id: "pru", category: "process", kind: "pre-auth", drg_pattern: "*", description: "Cashless GL request routed through the payor review desk; SLA 2-4h elective, 1h emergency.", threshold_value: "2-4h elective / 1h emergency", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 54, lift_pct: 0.05, added_by: "system" },
  { id: "aia-proc-01", payor_id: "aia", category: "process", kind: "pre-auth", drg_pattern: "*", description: "Pre-auth routed through the payor review desk; SLA 2-4h elective / 1h emergency.", threshold_value: "2-4h elective / 1h emergency", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 48, lift_pct: 0.05, added_by: "system" },
  { id: "aia-doc-02", payor_id: "aia", category: "documentation", kind: "documentation", drg_pattern: "*", description: "Reimbursement requires original receipts + perincian + resume medis + lab/radiology reports supporting diagnosis.", threshold_value: "lab/radiology corroborating", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 52, lift_pct: 0.05, added_by: "system" },
  { id: "aia-proc-03", payor_id: "aia", category: "process", kind: "pre-auth", drg_pattern: "*", description: "Reimbursement submission within 60 days of discharge; processing TAT 14 working days.", threshold_value: "60d submit / 14wd decide", source_confidence: "industry_typical", evidence_url: "", evidence_threads: 44, lift_pct: 0.04, added_by: "system" },
];

// `body` is the full email text we'll show in the drawer.
// `highlight` is the exact substring within body that justifies the learned rule —
// rendered as a champagne <mark> in the drawer to make the rule's evidence visible.
const threads = [
  // ── r1 · BPJS · pre-op pelvic MRI ────────────────────────────────────────
  { id: "t1", payor_id: "bpjs", subject: "Re: Klaim 2026-03-744 — endometriosis · permintaan dokumen tambahan", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…mohon dilampirkan hasil MRI pelvis pra-operasi. Tanpa dokumen ini, klaim akan ditolak per ketentuan pasal 3.4…",
    body: "Yth. RS Cendana Jakarta,\n\nMenindaklanjuti pengajuan klaim no. 2026-03-744 (DRG INA-CBG O-6-13-I, Dx N80.9), kami menemukan bahwa berkas pendukung pencitraan belum lengkap. Mohon dilampirkan hasil MRI pelvis pra-operasi sebagai justifikasi indikasi histerektomi. Tanpa dokumen ini, klaim akan ditolak per ketentuan pasal 3.4 buku panduan klaim BPJS.\n\nMohon resubmisi dalam 5 hari kerja.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "mohon dilampirkan hasil MRI pelvis pra-operasi",
    outcome: "approved_after_mri", learned_rule: "bpjs-doc-04", ts: "2026-04-21T09:14:00Z" },
  { id: "t1b", payor_id: "bpjs", subject: "Klaim 2026-04-118 — disetujui setelah resubmit MRI", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…setelah lampiran MRI pelvis tertanggal 2026-04-12 diterima, klaim diadjudikasi ulang dan disetujui penuh…",
    body: "Yth. RS Cendana Surabaya,\n\nKlaim 2026-04-118 atas nama pasien dengan DRG INA-CBG O-6-13-I telah diadjudikasi ulang. Setelah lampiran MRI pelvis tertanggal 2026-04-12 diterima, klaim diadjudikasi ulang dan disetujui penuh sebesar IDR 34.100.000.\n\nMohon mempertahankan praktik melampirkan MRI untuk DRG O-6-13 cluster guna menghindari delay adjudikasi.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "lampiran MRI pelvis",
    outcome: "approved_after_mri", learned_rule: "bpjs-doc-04", ts: "2026-04-14T08:11:00Z" },
  { id: "t1c", payor_id: "bpjs", subject: "Klaim ditolak — D25 myomectomy — MRI tidak ada", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…hanya hasil USG abdomen yang dilampirkan. MRI pelvis pra-operasi adalah lampiran wajib pada cluster DRG ini…",
    body: "Yth. RS Cendana Bandung,\n\nKlaim atas tindakan myomectomy ditolak. Hanya hasil USG abdomen yang dilampirkan. MRI pelvis pra-operasi adalah lampiran wajib pada cluster DRG ini sesuai pedoman 2024.\n\nMohon resubmisi dengan kelengkapan MRI agar adjudikasi dapat dilakukan.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "MRI pelvis pra-operasi adalah lampiran wajib pada cluster DRG ini",
    outcome: "denied", learned_rule: "bpjs-doc-04", ts: "2026-04-08T15:42:00Z" },

  // ── r2 · BPJS · conservative-management failure narrative ────────────────
  { id: "t2", payor_id: "bpjs", subject: "Klaim ditolak — N80.9 — Cendana", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…medical necessity tidak terpenuhi. Mohon disertakan riwayat terapi hormonal minimal 6 bulan sebelum operasi…",
    body: "Yth. RS Cendana Jakarta,\n\nKlaim ditolak atas dasar adjudikasi klinis. Medical necessity tidak terpenuhi. Mohon disertakan riwayat terapi hormonal minimal 6 bulan sebelum operasi sebagai bukti kegagalan terapi konservatif (per pedoman PERKUMI 2024 §3.2).\n\nResubmisi dapat dilakukan dengan narasi kegagalan terapi konservatif sebagai pembuka berkas.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "riwayat terapi hormonal minimal 6 bulan sebelum operasi",
    outcome: "denied_resubmitted_won", learned_rule: "bpjs-doc-04", ts: "2026-03-30T11:02:00Z" },
  { id: "t2b", payor_id: "bpjs", subject: "Re: Klaim 2026-04-201 — narasi konservatif diterima", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…dengan narasi kegagalan 8 bulan terapi hormonal di awal berkas, klaim diadjudikasi penuh. Praktik baik untuk dipertahankan…",
    body: "Yth. RS Cendana Jakarta,\n\nKlaim 2026-04-201 (Dx N80.9, DRG O-6-13-I) telah diadjudikasi penuh. Dengan narasi kegagalan 8 bulan terapi hormonal di awal berkas, klaim diadjudikasi penuh. Praktik baik untuk dipertahankan pada cluster DRG ini.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "narasi kegagalan 8 bulan terapi hormonal di awal berkas",
    outcome: "approved", learned_rule: "bpjs-doc-04", ts: "2026-04-19T10:48:00Z" },
  { id: "t2c", payor_id: "bpjs", subject: "Klaim ditolak — N80.0 — Cendana Medan", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…tidak ditemukan dokumentasi kegagalan terapi konservatif. Necessity tidak dapat ditegakkan tanpa hal tersebut…",
    body: "Yth. RS Cendana Medan,\n\nKlaim hysterektomi atas dasar endometriosis ditolak. Tidak ditemukan dokumentasi kegagalan terapi konservatif. Necessity tidak dapat ditegakkan tanpa hal tersebut.\n\nMohon resubmisi dengan riwayat terapi yang terdokumentasi.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "kegagalan terapi konservatif",
    outcome: "denied", learned_rule: "bpjs-doc-04", ts: "2026-04-05T13:21:00Z" },

  // ── r3 · BPJS · SEP page-1 top-right format ──────────────────────────────
  { id: "t3a", payor_id: "bpjs", subject: "Berkas ditolak pada penerimaan — SEP tidak terbaca", sender: "berkas.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…SEP number tidak ditemukan pada halaman 1 bagian kanan-atas. Berkas dikembalikan tanpa adjudikasi…",
    body: "Yth. RS Cendana Jakarta,\n\nBerkas klaim 2026-03-921 dikembalikan pada tahap intake. SEP number tidak ditemukan pada halaman 1 bagian kanan-atas. Berkas dikembalikan tanpa adjudikasi.\n\nMohon perbaikan format dan pengajuan ulang.\n\nSalam,\nTim Penerimaan Berkas BPJS",
    highlight: "SEP number tidak ditemukan pada halaman 1 bagian kanan-atas",
    outcome: "denied", learned_rule: "bpjs-doc-01", ts: "2026-03-18T14:02:00Z" },
  { id: "t3b", payor_id: "bpjs", subject: "Berkas diterima — SEP placement OK", sender: "berkas.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…SEP terbaca pada header halaman 1, berkas masuk antrian adjudikasi standar (TAT 4-7 hari)…",
    body: "Yth. RS Cendana Surabaya,\n\nBerkas klaim 2026-04-009 diterima. SEP terbaca pada header halaman 1, berkas masuk antrian adjudikasi standar (TAT 4-7 hari).\n\nSalam,\nTim Penerimaan Berkas BPJS",
    highlight: "SEP terbaca pada header halaman 1",
    outcome: "approved", learned_rule: "bpjs-doc-01", ts: "2026-04-02T09:18:00Z" },

  // ── r4 · AIA · specialist endorsement note ───────────────────────────────
  { id: "t3", payor_id: "aia", subject: "RE: Claim 22-IDN-49901 NSTEMI PCI — partial payment", sender: "claims.id@aia.com",
    excerpt: "…we have applied a 22% line reduction in the absence of a board-certified cardiologist endorsement note for the procedure.",
    body: "Dear Cendana Jakarta TPA Desk,\n\nClaim 22-IDN-49901 (NSTEMI · single-vessel PCI) has been adjudicated with adjustment. We have applied a 22% line reduction in the absence of a board-certified cardiologist endorsement note for the procedure.\n\nSubsequent submissions on this claim cluster should include the endorsement note signed by a board-certified specialist. Reconsideration is possible upon receipt.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "22% line reduction in the absence of a board-certified cardiologist endorsement note",
    outcome: "partial_paid", learned_rule: "aia-doc-03", ts: "2026-04-02T16:21:00Z" },
  { id: "t4b", payor_id: "aia", subject: "Claim 22-IDN-50402 — endorsement received, paid full", sender: "claims.id@aia.com",
    excerpt: "…thank you for the cardiologist endorsement letter (Dr. Riza Anandita, SpJP). Claim adjudicated at full contracted rate…",
    body: "Dear Cendana Jakarta TPA Desk,\n\nReferring to claim 22-IDN-50402 (PRIV-CARDIO-PCI-S). Thank you for the cardiologist endorsement letter (Dr. Riza Anandita, SpJP). Claim adjudicated at full contracted rate without line reduction.\n\nKindly continue this practice on PRIV-CARDIO-* cluster going forward.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "thank you for the cardiologist endorsement letter (Dr. Riza Anandita, SpJP)",
    outcome: "approved", learned_rule: "aia-doc-03", ts: "2026-04-22T12:08:00Z" },
  { id: "t4c", payor_id: "aia", subject: "Claim 22-IDN-49788 — partial · no specialist sign-off", sender: "claims.id@aia.com",
    excerpt: "…procedure note signed by general physician only. AIA cardiology coverage policy 4.2 requires specialist endorsement for full pay…",
    body: "Dear Cendana Bandung TPA Desk,\n\nClaim 22-IDN-49788 has been part-paid. Procedure note signed by general physician only. AIA cardiology coverage policy 4.2 requires specialist endorsement for full pay.\n\nReconsideration available upon receipt of board-certified specialist endorsement.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "AIA cardiology coverage policy 4.2 requires specialist endorsement for full pay",
    outcome: "partial_paid", learned_rule: "aia-doc-03", ts: "2026-03-28T15:54:00Z" },

  // ── r5 · AIA · SYNTAX score worksheet for PCI ────────────────────────────
  { id: "t4", payor_id: "aia", subject: "Claim approved — 22-IDN-50117", sender: "claims.id@aia.com",
    excerpt: "…thank you for the SYNTAX score worksheet, claim approved at full contracted rate.",
    body: "Dear Cendana Jakarta TPA Desk,\n\nClaim 22-IDN-50117 (PRIV-CARDIO-PCI-S) has been adjudicated. Thank you for the SYNTAX score worksheet, claim approved at full contracted rate.\n\nKindly continue including the SYNTAX score worksheet on PCI submissions.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "thank you for the SYNTAX score worksheet, claim approved at full contracted rate",
    outcome: "approved", learned_rule: "aia-doc-04", ts: "2026-04-18T14:49:00Z" },
  { id: "t5b", payor_id: "aia", subject: "Claim 22-IDN-49502 — SYNTAX missing — denied", sender: "claims.id@aia.com",
    excerpt: "…multi-vessel PCI submission lacks the SYNTAX score worksheet. Coverage policy 4.2 lists this as required evidence…",
    body: "Dear Cendana Jakarta TPA Desk,\n\nClaim 22-IDN-49502 has been denied. Multi-vessel PCI submission lacks the SYNTAX score worksheet. Coverage policy 4.2 lists this as required evidence for adjudication.\n\nResubmission with the worksheet is encouraged.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "lacks the SYNTAX score worksheet",
    outcome: "denied", learned_rule: "aia-doc-04", ts: "2026-03-12T09:33:00Z" },

  // ── Prudential cashless threads ─────────────────────────────────────────
  { id: "t-pru-01", payor_id: "pru", subject: "Permintaan Kelengkapan Berkas Klaim — Joko Mulyadi / GL PRU-2025-44871", sender: "claims@prudential.co.id",
    excerpt: "…mohon dilengkapi resume medis yang ditandatangani oleh DPJP. Berkas tidak dapat diproses tanpa kelengkapan tersebut…",
    body: "Yth. Tim TPA RS Cendana Jakarta,\n\nMenindaklanjuti pengajuan klaim atas nama Bp. Joko Mulyadi (Polis PRU-44-998-122, GL PRU-2025-44871), kami menemukan bahwa resume medis yang dilampirkan belum memuat tanda tangan DPJP. Mohon dilengkapi resume medis yang ditandatangani oleh DPJP. Berkas tidak dapat diproses tanpa kelengkapan tersebut.\n\nMohon resubmisi dalam 7 hari kerja. Status klaim akan kami tahan sementara di antrian incomplete.\n\nHormat kami,\nTim Klaim Prudential Indonesia",
    highlight: "resume medis yang ditandatangani oleh DPJP",
    outcome: "denied_resubmitted_won", learned_rule: "pru-doc-01", ts: "2026-04-14T10:24:00Z" },
  { id: "t-pru-02", payor_id: "pru", subject: "Permohonan Perpanjangan Surat Jaminan (GL Top-Up) — Disetujui", sender: "claims@prudential.co.id",
    excerpt: "…amendment GL disetujui untuk perluasan tindakan intra-op (laparoskopi → laparotomi konversi). Plafon tambahan IDR 28.5 juta…",
    body: "Yth. Tim TPA RS Cendana Surabaya,\n\nKami mengkonfirmasi bahwa permohonan perpanjangan Surat Jaminan (GL Top-Up) untuk Bp. Wahyu Santoso (Polis PRU-44-991-770) telah disetujui. Amendment GL disetujui untuk perluasan tindakan intra-op (laparoskopi → laparotomi konversi). Plafon tambahan IDR 28.5 juta atas dasar Laporan Medis Lanjutan tertanggal 2026-04-21.\n\nLaporan operasi final dan resume medis dapat dikirimkan setelah pasien pulang.\n\nHormat kami,\nTim Pre-auth Prudential Indonesia",
    highlight: "amendment GL disetujui untuk perluasan tindakan intra-op",
    outcome: "approved_after_topup", learned_rule: "pru-proc-02", ts: "2026-04-22T14:08:00Z" },
  { id: "t-pru-03", payor_id: "pru", subject: "Klaim Sebagian — Limit Kamar Terlampaui", sender: "claims@prudential.co.id",
    excerpt: "…pasien dirawat di kamar Deluxe (IDR 2.4 juta/hari) sementara plafon polis adalah Standard (IDR 1.2 juta/hari). Prorate diterapkan ratio 0.5…",
    body: "Yth. Tim TPA RS Cendana Jakarta,\n\nKlaim atas nama Bp. Faisal Rahman (Polis PRU-44-330-119) telah diadjudikasi sebagian. Pasien dirawat di kamar Deluxe (IDR 2.4 juta/hari) sementara plafon polis adalah Standard (IDR 1.2 juta/hari). Prorate diterapkan ratio 0.5 pada seluruh tagihan eligible (kamar, dokter, obat, lab) sesuai ketentuan polis pasal 8.3.\n\nNet pembayaran: IDR 79.4 juta dari IDR 158.8 juta tagihan. Selisih menjadi tanggungan pasien.\n\nHormat kami,\nTim Adjudikasi Prudential Indonesia",
    highlight: "Prorate diterapkan ratio 0.5 pada seluruh tagihan eligible",
    outcome: "partial_paid", learned_rule: "pru-fin-01", ts: "2026-04-08T11:42:00Z" },
  { id: "t-pru-04", payor_id: "pru", subject: "Klaim Disetujui — Reimbursement", sender: "claims@prudential.co.id",
    excerpt: "…berkas reimbursement diterima lengkap 2026-04-05. TAT 14 hari kerja terpenuhi. Pembayaran ditransfer ke rekening tertanggal 2026-04-19…",
    body: "Yth. Tim TPA RS Cendana Bandung,\n\nKlaim reimbursement atas nama Bp. Bagus Pradana (Polis PRU-44-228-117) telah disetujui penuh. Berkas reimbursement diterima lengkap 2026-04-05. TAT 14 hari kerja terpenuhi. Pembayaran ditransfer ke rekening tertanggal 2026-04-19 sebesar IDR 152.3 juta.\n\nKami berterima kasih atas kelengkapan berkas (kuitansi asli, perincian biaya, resume medis bertanda DPJP, KTP/KK, dan rekening bank) yang dilampirkan sejak pengajuan awal.\n\nHormat kami,\nTim Adjudikasi Prudential Indonesia",
    highlight: "TAT 14 hari kerja terpenuhi",
    outcome: "approved", learned_rule: "pru-proc-03", ts: "2026-04-19T15:33:00Z" },
  { id: "t-pru-05", payor_id: "pru", subject: "Pengingat — Batas Waktu Pengajuan Klaim", sender: "claims@prudential.co.id",
    excerpt: "…tanggal pulang pasien 2026-01-28 dan pengajuan baru diterima 2026-03-30 (61 hari). Klaim ditolak karena melewati batas 60 hari…",
    body: "Yth. Tim TPA RS Cendana Medan,\n\nMohon diperhatikan bahwa pengajuan klaim atas nama Bp. Hendra Wibowo (Polis PRU-44-552-117) telah kami terima di luar batas waktu yang ditentukan. Tanggal pulang pasien 2026-01-28 dan pengajuan baru diterima 2026-03-30 (61 hari). Klaim ditolak karena melewati batas 60 hari sebagaimana diatur pasal 11.2 polis.\n\nApabila terdapat keadaan khusus (force majeure / sistem downtime), mohon disertakan dokumentasi pendukung dalam pengajuan banding.\n\nHormat kami,\nTim Klaim Prudential Indonesia",
    highlight: "Klaim ditolak karena melewati batas 60 hari",
    outcome: "denied", learned_rule: "pru-proc-03", ts: "2026-03-30T09:15:00Z" },
];

// 30 days of cashflow (most recent last)
const cashflow: Array<Record<string, number | string>> = (() => {
  const out: Array<Record<string, number | string>> = [];
  const start = new Date("2026-04-01T00:00:00Z").getTime();
  for (let i = 0; i < 30; i++) {
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
    const baseline = 850_000_000 + Math.round(Math.sin(i / 3) * 90_000_000);
    const billed = baseline + Math.round((Math.random() - 0.5) * 80_000_000);
    const denied = Math.round(billed * (0.06 + Math.random() * 0.04));
    const collected = Math.round(billed * (0.78 + Math.random() * 0.06));
    out.push({ d, billed_idr: billed, collected_idr: collected, denied_idr: denied });
  }
  return out;
})();

// ── Eligibility checks (Module A) ─────────────────────────────────────────
// 12 records — overnight batch sweep + today's walk-up checks.
// TAT distribution: live-API typically 40-95s, cached 4-12s, one slow disputed.
const eligibilityChecks = [
  { id: "e1", patient_id: "p1", payor_id: "bpjs", hospital_id: "h1", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T07:14:08Z", completed_at: "2026-05-03T07:15:32Z", tat_seconds: 84, annual_limit_remaining_idr: 41_200_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class I", pre_auth_required: 1, pre_auth_status: "ATTACHED · PA-77821", cob_primary_payor: "bpjs", dispute_risk_score: 0.04, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T08:00:00Z", planned_procedure: "INA-CBG O-6-13-I" },
  { id: "e2", patient_id: "p2", payor_id: "aia", hospital_id: "h1", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T06:47:11Z", completed_at: "2026-05-03T06:48:13Z", tat_seconds: 62, annual_limit_remaining_idr: 720_000_000, annual_limit_total_idr: 1_500_000_000, room_class_entitlement: "Private", pre_auth_required: 1, pre_auth_status: "PENDING", cob_primary_payor: "aia", dispute_risk_score: 0.07, exclusions_json: "[\"cosmetic\"]", scheduled_admission_at: "2026-05-03T07:30:00Z", planned_procedure: "PRIV-CARDIO-PCI-S" },
  { id: "e3", patient_id: "p5", payor_id: "bpjs", hospital_id: "h1", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T08:02:55Z", completed_at: "2026-05-03T08:04:18Z", tat_seconds: 83, annual_limit_remaining_idr: 38_900_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class I", pre_auth_required: 0, pre_auth_status: "NOT_REQUIRED", cob_primary_payor: "bpjs", dispute_risk_score: 0.03, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T08:30:00Z", planned_procedure: "INA-CBG K-1-15-II" },
  { id: "e4", patient_id: "p6", payor_id: "aia", hospital_id: "h2", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T08:14:02Z", completed_at: "2026-05-03T08:15:21Z", tat_seconds: 79, annual_limit_remaining_idr: 1_100_000_000, annual_limit_total_idr: 2_000_000_000, room_class_entitlement: "Private", pre_auth_required: 1, pre_auth_status: "ATTACHED", cob_primary_payor: "aia", dispute_risk_score: 0.05, exclusions_json: "[\"experimental\"]", scheduled_admission_at: "2026-05-03T09:00:00Z", planned_procedure: "PRIV-CARDIO-PCI-S" },
  { id: "e5", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", status: "ACTIVE", source: "CACHED", started_at: "2026-05-02T22:01:00Z", completed_at: "2026-05-02T22:01:08Z", tat_seconds: 8, annual_limit_remaining_idr: 47_400_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class II", pre_auth_required: 0, pre_auth_status: "NOT_REQUIRED", cob_primary_payor: "bpjs", dispute_risk_score: 0.02, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T10:00:00Z", planned_procedure: "INA-CBG E-4-10-I" },
  { id: "e6", patient_id: "p11", payor_id: "bpjs", hospital_id: "h3", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T09:21:34Z", completed_at: "2026-05-03T09:22:51Z", tat_seconds: 77, annual_limit_remaining_idr: 49_800_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class I", pre_auth_required: 1, pre_auth_status: "PENDING", cob_primary_payor: "bpjs", dispute_risk_score: 0.06, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T11:00:00Z", planned_procedure: "INA-CBG K-2-13-I" },
  { id: "e7", patient_id: "p13", payor_id: "aia", hospital_id: "h1", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T09:33:11Z", completed_at: "2026-05-03T09:34:22Z", tat_seconds: 71, annual_limit_remaining_idr: 1_840_000_000, annual_limit_total_idr: 2_500_000_000, room_class_entitlement: "Private", pre_auth_required: 1, pre_auth_status: "ATTACHED", cob_primary_payor: "aia", dispute_risk_score: 0.04, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T11:30:00Z", planned_procedure: "PRIV-NEURO-CRANI" },
  { id: "e8", patient_id: "p23", payor_id: "pru", hospital_id: "h1", status: "DISPUTED", source: "LIVE_API", started_at: "2026-05-03T10:08:41Z", completed_at: "2026-05-03T10:11:14Z", tat_seconds: 153, annual_limit_remaining_idr: 280_000_000, annual_limit_total_idr: 1_200_000_000, room_class_entitlement: "Private", pre_auth_required: 1, pre_auth_status: "MISMATCH", cob_primary_payor: "pru", dispute_risk_score: 0.71, exclusions_json: "[\"revision-implant-substitution\"]", scheduled_admission_at: "2026-05-03T13:00:00Z", planned_procedure: "PRIV-ORTHO-HIP" },
  { id: "e9", patient_id: "p24", payor_id: "bpjs", hospital_id: "h4", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T10:42:09Z", completed_at: "2026-05-03T10:43:18Z", tat_seconds: 69, annual_limit_remaining_idr: 32_500_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class III", pre_auth_required: 1, pre_auth_status: "PENDING", cob_primary_payor: "bpjs", dispute_risk_score: 0.18, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T14:00:00Z", planned_procedure: "INA-CBG O-6-13-I" },
  { id: "e10", patient_id: "p27", payor_id: "pru", hospital_id: "h1", status: "LAPSED", source: "LIVE_API", started_at: "2026-05-03T11:01:18Z", completed_at: "2026-05-03T11:02:31Z", tat_seconds: 73, annual_limit_remaining_idr: 0, annual_limit_total_idr: 1_000_000_000, room_class_entitlement: "Private", pre_auth_required: 0, pre_auth_status: "DECLINED", cob_primary_payor: null, dispute_risk_score: 0.93, exclusions_json: "[\"policy-lapsed-2026-04-28\"]", scheduled_admission_at: "2026-05-03T15:00:00Z", planned_procedure: "PRIV-ORTHO-TKR" },
  { id: "e11", patient_id: "p28", payor_id: "bpjs", hospital_id: "h2", status: "ACTIVE", source: "CACHED", started_at: "2026-05-03T11:18:02Z", completed_at: "2026-05-03T11:18:09Z", tat_seconds: 7, annual_limit_remaining_idr: 28_400_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class I", pre_auth_required: 1, pre_auth_status: "ATTACHED", cob_primary_payor: "bpjs", dispute_risk_score: 0.05, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T16:00:00Z", planned_procedure: "INA-CBG O-6-15-I" },
  { id: "e12", patient_id: "p4", payor_id: "pru", hospital_id: "h1", status: "WAITING_PERIOD", source: "LIVE_API", started_at: "2026-05-03T11:34:17Z", completed_at: "2026-05-03T11:35:22Z", tat_seconds: 65, annual_limit_remaining_idr: 1_000_000_000, annual_limit_total_idr: 1_000_000_000, room_class_entitlement: "Private", pre_auth_required: 0, pre_auth_status: "BLOCKED · WAITING_PERIOD", cob_primary_payor: "pru", dispute_risk_score: 0.62, exclusions_json: "[\"36-month-waiting-period-pre-existing\"]", scheduled_admission_at: "2026-05-03T17:30:00Z", planned_procedure: "PRIV-ORTHO-TKR" },
];

// ── Denials (Module E) ─────────────────────────────────────────────────────
// 14 records spread across categories. Some have appeal_drafts.
const denials = [
  { id: "d1", claim_id: "c4", payor_id: "pru", hospital_id: "h1", category: "ADMINISTRATIVE", reason_code: "PA-MISMATCH-001", reason_text: "Pre-auth scope mismatch — implant model on operative report does not match pre-auth letter", denied_amount_idr: 168_500_000, denied_at: "2026-04-22T14:11:00Z", appeal_deadline_at: "2026-05-22T23:59:00Z", appeal_status: "DRAFTING", success_probability: 0.72, root_cause_step: "Pre-auth · implant lot not cross-checked", recurring_pattern_id: "rp1" },
  { id: "d2", claim_id: "c19", payor_id: "pru", hospital_id: "h2", category: "ADMINISTRATIVE", reason_code: "PA-MISSING-002", reason_text: "Pre-auth not on file for second-stage TKR", denied_amount_idr: 142_700_000, denied_at: "2026-04-30T11:21:00Z", appeal_deadline_at: "2026-05-30T23:59:00Z", appeal_status: "READY", success_probability: 0.66, root_cause_step: "Stage-2 PA not requested before procedure", recurring_pattern_id: null },
  { id: "d3", claim_id: "c16", payor_id: "bpjs", hospital_id: "h1", category: "CLINICAL", reason_code: "MN-NECESSITY-1A", reason_text: "Medical necessity not established — adenomyosis grade requires 6mo failed hormonal therapy documentation", denied_amount_idr: 35_200_000, denied_at: "2026-05-02T09:08:00Z", appeal_deadline_at: "2026-06-01T23:59:00Z", appeal_status: "DRAFTING", success_probability: 0.81, root_cause_step: "Builder · narrative rule r2 not fired", recurring_pattern_id: "rp2" },
  { id: "d4", claim_id: "c25", payor_id: "aia", hospital_id: "h2", category: "CLINICAL", reason_code: "MN-EVIDENCE-2B", reason_text: "PCI claim missing SYNTAX score worksheet — required per AIA cardiology coverage policy 4.2", denied_amount_idr: 156_400_000, denied_at: "2026-04-28T16:42:00Z", appeal_deadline_at: "2026-05-28T23:59:00Z", appeal_status: "READY", success_probability: 0.88, root_cause_step: "Builder · SYNTAX rule r5 inactive", recurring_pattern_id: "rp3" },
  { id: "d5", claim_id: "c20", payor_id: "bpjs", hospital_id: "h4", category: "TECHNICAL", reason_code: "CODE-UNBUNDLE-3A", reason_text: "Procedure codes 0UT9-0ZZ + 10D17ZZ flagged as unbundled — CCI edit pair", denied_amount_idr: 19_400_000, denied_at: "2026-04-29T10:15:00Z", appeal_deadline_at: "2026-05-13T23:59:00Z", appeal_status: "NEW", success_probability: 0.61, root_cause_step: "Coder-AI · CCI rule not applied", recurring_pattern_id: null },
  { id: "d6", claim_id: "c17", payor_id: "aia", hospital_id: "h2", category: "TECHNICAL", reason_code: "CODE-MOD-3B", reason_text: "Modifier 59 missing — distinct procedural service not flagged", denied_amount_idr: 218_500_000, denied_at: "2026-04-25T13:08:00Z", appeal_deadline_at: "2026-05-09T23:59:00Z", appeal_status: "SUBMITTED", success_probability: 0.79, root_cause_step: "Coder-AI · modifier suggestion suppressed", recurring_pattern_id: null },
  { id: "d7", claim_id: "c21", payor_id: "aia", hospital_id: "h1", category: "CLINICAL", reason_code: "MN-EXP-2C", reason_text: "Glioblastoma adjuvant protocol deemed experimental — peer-reviewed evidence requested", denied_amount_idr: 348_900_000, denied_at: "2026-04-23T14:55:00Z", appeal_deadline_at: "2026-05-07T23:59:00Z", appeal_status: "READY", success_probability: 0.74, root_cause_step: "Builder · experimental flag triggered", recurring_pattern_id: null },
  { id: "d8", claim_id: "c11", payor_id: "bpjs", hospital_id: "h3", category: "ADMINISTRATIVE", reason_code: "TIMELY-FILE-4A", reason_text: "Claim received 2 days past contractual filing window", denied_amount_idr: 31_500_000, denied_at: "2026-04-21T08:31:00Z", appeal_deadline_at: "2026-05-05T23:59:00Z", appeal_status: "DRAFTING", success_probability: 0.43, root_cause_step: "Submission queue · 11-day delay between discharge and filing", recurring_pattern_id: null },
  { id: "d9", claim_id: "c2", payor_id: "aia", hospital_id: "h1", category: "CONTRACTUAL", reason_code: "RATE-DISPUTE-5A", reason_text: "Line rate paid at out-of-network rate despite in-panel status", denied_amount_idr: 14_200_000, denied_at: "2026-04-26T09:14:00Z", appeal_deadline_at: "2026-05-26T23:59:00Z", appeal_status: "NEW", success_probability: 0.91, root_cause_step: "Payor system · stale provider directory", recurring_pattern_id: null },
  { id: "d10", claim_id: "c12", payor_id: "bpjs", hospital_id: "h2", category: "CLINICAL", reason_code: "MN-EVIDENCE-1C", reason_text: "Myomectomy claim missing pre-op MRI — pelvic imaging mandatory under DRG O-6-15-I", denied_amount_idr: 26_800_000, denied_at: "2026-05-01T14:18:00Z", appeal_deadline_at: "2026-05-31T23:59:00Z", appeal_status: "DRAFTING", success_probability: 0.83, root_cause_step: "Builder · rule r1 should have fired but DRG pattern matcher missed", recurring_pattern_id: "rp1" },
  { id: "d11", claim_id: "c14", payor_id: "bpjs", hospital_id: "h2", category: "TECHNICAL", reason_code: "DUPLICATE-3C", reason_text: "Claim flagged as duplicate of c14a (CBD exploration line item)", denied_amount_idr: 4_300_000, denied_at: "2026-04-27T16:01:00Z", appeal_deadline_at: "2026-05-11T23:59:00Z", appeal_status: "WON", success_probability: 0.95, root_cause_step: "Submission · concurrent file by ward + OT", recurring_pattern_id: null },
  { id: "d12", claim_id: "c18", payor_id: "bpjs", hospital_id: "h3", category: "CLINICAL", reason_code: "MN-NECESSITY-1B", reason_text: "Acute appendicitis — peritoneal signs not adequately documented", denied_amount_idr: 17_900_000, denied_at: "2026-04-29T09:42:00Z", appeal_deadline_at: "2026-05-29T23:59:00Z", appeal_status: "READY", success_probability: 0.77, root_cause_step: "EMR · physician note missing physical exam findings", recurring_pattern_id: null },
  { id: "d13", claim_id: "c22", payor_id: "bpjs", hospital_id: "h3", category: "CONTRACTUAL", reason_code: "BENEFIT-EXCL-5B", reason_text: "CBD exploration listed under exclusion clause 4.7 (covered case-by-case)", denied_amount_idr: 8_400_000, denied_at: "2026-05-02T11:23:00Z", appeal_deadline_at: "2026-06-01T23:59:00Z", appeal_status: "NEW", success_probability: 0.55, root_cause_step: "Payor contract · ambiguous exclusion language", recurring_pattern_id: null },
  { id: "d14", claim_id: "c9", payor_id: "pru", hospital_id: "h1", category: "ADMINISTRATIVE", reason_code: "ELIG-DISPUTE-4B", reason_text: "Patient eligibility disputed — payor records show coverage gap 2026-04-15 to 2026-04-20", denied_amount_idr: 198_400_000, denied_at: "2026-04-24T10:11:00Z", appeal_deadline_at: "2026-05-08T23:59:00Z", appeal_status: "LOST", success_probability: 0.21, root_cause_step: "Eligibility check · cached result was stale by 3 days", recurring_pattern_id: null },
];

// ── Appeal drafts (Module E) — drafted letters for some denials ────────────
const appealDrafts = [
  { id: "ad1", denial_id: "d1", letter_md: "**To:** Prudential Indonesia · Claims Adjudication\n**Re:** Claim 2026-04-08/c4 · Pre-auth implant model substitution\n\n**Background.** On 2026-04-08, Mr. Joko Mulyadi (MRN-734341, Policy PRU-44-998-122) underwent right total knee arthroplasty at Cendana Jakarta. Pre-auth letter PA-66102 dated 2026-04-04 approved the procedure with implant model **Smith+Nephew Genesis II PS**. Intraoperative findings required substitution to **Genesis II CR** (lot 70-9912) due to ligament integrity confirmed only after exposure.\n\n**Argument.** Under Prudential Coverage Schedule §7.3, implant substitution within the same manufacturer family for clinical indication is a covered event, provided the substitution is documented in the operative note and an addendum is filed within 14 days. Both conditions are satisfied. The operative note (attached) states: *'Genesis II PS unsuitable due to PCL competence; CR variant placed.'* Addendum filed 2026-04-09 (3 days post-op).\n\n**Remedy requested.** Reverse denial in full and pay at contracted rate IDR 168,500,000.\n\n**Authoritative basis.** ASIPS-IPS Indonesia 2024 Position Statement on Intraoperative Implant Decision-Making.\n\n— Cendana Jakarta TPA Desk · drafted by TatvaCare RCM workflow · reviewed by Dr. Andi Permadi", attachments_json: "[\"OT-record-c4.pdf\",\"Implant-addendum-2026-04-09.pdf\",\"Coverage-Schedule-7-3.pdf\",\"ASIPS-IPS-2024-stmt.pdf\"]", drafted_at: "2026-05-03T08:42:00Z", submitted_at: null, outcome: null },
  { id: "ad2", denial_id: "d2", letter_md: "**To:** Prudential Indonesia\n**Re:** Claim 2026-04-30/c19 · Bilateral staged TKR · Pre-auth not on file\n\n**Background.** Mrs. Faisal's bilateral staged TKR was authorized as a single course under PA-66318 (2026-03-12). The pre-auth letter explicitly references *'staged bilateral, both knees, 60-day interval acceptable.'*\n\n**Argument.** The claim was rejected on the grounds that the second knee lacked its own PA. This contradicts the PA letter language. We attach the original PA, the operative note for both procedures, and the contract appendix §4.1 defining 'staged bilateral' as a single authorization event.\n\n**Remedy requested.** Reverse denial; pay second-stage at contracted rate IDR 142,700,000.", attachments_json: "[\"PA-66318.pdf\",\"OT-stage-1.pdf\",\"OT-stage-2.pdf\",\"Contract-appendix-4-1.pdf\"]", drafted_at: "2026-05-03T09:11:00Z", submitted_at: null, outcome: null },
  { id: "ad3", denial_id: "d3", letter_md: "**To:** BPJS Kesehatan · Klaim Adjudikasi\n**Re:** Klaim 2026-05-02/c16 · TAH adenomyosis\n\n**Latar.** Ny. Citra Maharani menjalani TAH untuk adenomiosis derajat berat (G3 Mansell). Klaim ditolak dengan alasan *'medical necessity not established'*.\n\n**Bukti yang dilampirkan:**\n- Riwayat 8 bulan terapi hormonal (medroxyprogesterone, dienogest) tanpa respon — catatan klinik 2025-09-12 hingga 2026-04-22.\n- Kuesioner kualitas hidup pre-operasi: skor SF-12 fisik 28, mental 31 (signifikan terganggu).\n- USG transvaginal 2026-04-15: dinding uterus 38mm, vaskularisasi tinggi.\n- MRI pelvis 2026-04-26: konfirmasi adenomiosis difus.\n\n**Argumen.** Per pedoman PERKUMI 2024 §3.2, kegagalan terapi konservatif minimal 6 bulan + bukti pencitraan = indikasi histerektomi.\n\n**Permintaan.** Mohon dilakukan re-adjudikasi dan klaim disetujui penuh sebesar IDR 35,200,000.", attachments_json: "[\"Hormonal-Tx-Records.pdf\",\"SF-12-Pre-Op.pdf\",\"USG-2026-04-15.pdf\",\"MRI-2026-04-26.pdf\",\"PERKUMI-2024-Guideline.pdf\"]", drafted_at: "2026-05-03T10:04:00Z", submitted_at: null, outcome: null },
  { id: "ad4", denial_id: "d10", letter_md: "**To:** BPJS Kesehatan · Klaim Adjudikasi\n**Re:** Klaim 2026-05-01/c12 · Mioma uteri myomectomy\n\n**Latar.** Ny. Lestari Dewi menjalani mioma uteri myomectomy (D25) di Cendana Surabaya 2026-04-30. Klaim ditolak karena *'pre-op pelvic MRI tidak terlampir'* — namun MRI memang dilakukan dan tersedia di RIS hospital.\n\n**Argumen.** MRI pelvis dilakukan 2026-04-22 (laporan terlampir). Lampiran tidak ditambahkan ke berkas pengajuan asli karena kekeliruan rule-pattern matcher pada Builder agent (sudah diperbaiki via push-back ke rule library).\n\n**Permintaan.** Mohon klaim diadjudikasi ulang dengan MRI sebagai lampiran tambahan; nilai klaim IDR 26,800,000.", attachments_json: "[\"MRI-Pelvis-2026-04-22.pdf\",\"Klaim-Asli-c12.pdf\"]", drafted_at: "2026-05-03T10:31:00Z", submitted_at: null, outcome: null },
  { id: "ad5", denial_id: "d8", letter_md: "**To:** BPJS Kesehatan\n**Re:** Klaim c11 · TURP · Timely filing\n\n**Latar.** Klaim diajukan 2 hari di luar jendela pengajuan kontraktual (14 hari pasca-discharge). Discharge: 2026-04-04. Pengajuan: 2026-04-20.\n\n**Argumen — keadaan luar biasa.** Sistem submission RS Cendana Bandung mengalami downtime 2026-04-13 hingga 2026-04-17 (insiden tiket TICK-449212, log terlampir). Pengajuan dilakukan pada hari pertama sistem kembali online.\n\n**Permintaan.** Pengabaian timely-filing per klausul kontrak §11.4 (force majeure / system unavailability).", attachments_json: "[\"System-Downtime-Log.pdf\",\"TICK-449212.pdf\",\"Contract-11-4.pdf\"]", drafted_at: "2026-05-02T17:11:00Z", submitted_at: null, outcome: null },
];

// ── Clearances (Module B) ──────────────────────────────────────────────────
// 14 records — admissions awaiting / past financial clearance.
const clearances = [
  // Patient with active eligibility check (Sari) — cleared, GOP attached
  { id: "fc1", patient_id: "p1", payor_id: "bpjs", hospital_id: "h1", status: "CLEARED", drg: "INA-CBG O-6-13-I", dx: "Laparoscopic hysterectomy · endometriosis (N80.9)", scheduled_admission_at: "2026-05-03T08:00:00Z", los_predicted: 4.2, los_ci_low: 3.5, los_ci_high: 5.6, episode_cost_idr: 38_400_000, expected_reimb_idr: 32_900_000, patient_liability_idr: 5_500_000, deposit_required_idr: 2_500_000, deposit_collected_idr: 2_500_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T07:32:00Z", cost_breakdown_json: "{\"room\":11500000,\"procedures\":18800000,\"drugs\":2700000,\"implants\":0,\"labs\":3400000,\"other\":2000000}" },
  // Cardiac PCI — cleared but GOP submitted not yet approved
  { id: "fc2", patient_id: "p2", payor_id: "aia", hospital_id: "h1", status: "CONDITIONAL", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · NSTEMI (I21.4)", scheduled_admission_at: "2026-05-03T07:30:00Z", los_predicted: 2.8, los_ci_low: 2.0, los_ci_high: 4.1, episode_cost_idr: 142_300_000, expected_reimb_idr: 128_700_000, patient_liability_idr: 13_600_000, deposit_required_idr: 8_000_000, deposit_collected_idr: 8_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "SUBMITTED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T06:55:00Z", cost_breakdown_json: "{\"room\":18400000,\"procedures\":68900000,\"drugs\":12100000,\"implants\":34800000,\"labs\":4500000,\"other\":3600000}" },
  // Walk-up appendectomy — pending GOP
  { id: "fc3", patient_id: "p5", payor_id: "bpjs", hospital_id: "h1", status: "PENDING", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy · acute (K35.8)", scheduled_admission_at: "2026-05-03T08:30:00Z", los_predicted: 2.1, los_ci_low: 1.5, los_ci_high: 3.0, episode_cost_idr: 18_700_000, expected_reimb_idr: 16_200_000, patient_liability_idr: 2_500_000, deposit_required_idr: 1_500_000, deposit_collected_idr: 0, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "DRAFTED", gop_letter_md: "**To:** BPJS Kesehatan · Klaim Adjudikasi\n**Re:** Pre-auth/GOP request · MRN-734362 · Aditya Pratama\n\n**Permintaan.** Mohon disetujui Letter of Guarantee (LOG) untuk laparoscopic appendectomy (K35.8) di RS Cendana Jakarta tanggal 2026-05-03. Estimasi biaya episode IDR 18.7 juta · estimasi reimbursement BPJS IDR 16.2 juta · liabilitas pasien IDR 2.5 juta.\n\n**Pendukung.**\n- Rujukan FKTP dilampirkan\n- USG abdomen confirms acute appendicitis with peri-appendiceal collection\n- WBC 18.2 · CRP 84\n\n**Kelas perawatan.** Class I sesuai kepesertaan PBPU.\n\n**Mohon konfirmasi LOG dalam 4 jam** untuk memungkinkan operasi same-day.\n\n— RS Cendana Jakarta · TPA desk · drafted by TatvaCare RCM workflow", consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":4200000,\"procedures\":9800000,\"drugs\":1600000,\"implants\":0,\"labs\":1800000,\"other\":1300000}" },
  // PCI Surabaya — cleared
  { id: "fc4", patient_id: "p6", payor_id: "aia", hospital_id: "h2", status: "CLEARED", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · stable angina (I20.0)", scheduled_admission_at: "2026-05-03T09:00:00Z", los_predicted: 2.4, los_ci_low: 1.8, los_ci_high: 3.3, episode_cost_idr: 138_900_000, expected_reimb_idr: 124_400_000, patient_liability_idr: 14_500_000, deposit_required_idr: 6_000_000, deposit_collected_idr: 6_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T08:08:00Z", cost_breakdown_json: "{\"room\":16200000,\"procedures\":62100000,\"drugs\":9800000,\"implants\":36400000,\"labs\":4500000,\"other\":9900000}" },
  // Pneumonia BPJS Bandung — conditional, awaiting deposit waiver decision
  { id: "fc5", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", status: "CONDITIONAL", drg: "INA-CBG E-4-10-I", dx: "Severe community-acquired pneumonia (J18.9)", scheduled_admission_at: "2026-05-03T10:00:00Z", los_predicted: 6.4, los_ci_low: 4.8, los_ci_high: 9.1, episode_cost_idr: 27_600_000, expected_reimb_idr: 22_800_000, patient_liability_idr: 4_800_000, deposit_required_idr: 1_500_000, deposit_collected_idr: 0, bad_debt_risk_tier: "MEDIUM", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T09:10:00Z", cost_breakdown_json: "{\"room\":11800000,\"procedures\":4200000,\"drugs\":7900000,\"implants\":0,\"labs\":2200000,\"other\":1500000}" },
  // TURP Bandung — pending PA, deposit not collected, medium risk
  { id: "fc6", patient_id: "p11", payor_id: "bpjs", hospital_id: "h3", status: "PENDING", drg: "INA-CBG K-2-13-I", dx: "TURP · BPH (N40)", scheduled_admission_at: "2026-05-03T11:00:00Z", los_predicted: 3.0, los_ci_low: 2.4, los_ci_high: 4.0, episode_cost_idr: 31_500_000, expected_reimb_idr: 27_200_000, patient_liability_idr: 4_300_000, deposit_required_idr: 2_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "MEDIUM", payment_mode: "CASHLESS_INSURED", gop_status: "SUBMITTED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":7200000,\"procedures\":15400000,\"drugs\":3100000,\"implants\":0,\"labs\":2900000,\"other\":2900000}" },
  // Glioma craniotomy AIA — cleared, high cost
  { id: "fc7", patient_id: "p13", payor_id: "aia", hospital_id: "h1", status: "CLEARED", drg: "PRIV-NEURO-CRANI", dx: "Elective craniotomy · meningioma (D32.0)", scheduled_admission_at: "2026-05-03T11:30:00Z", los_predicted: 7.2, los_ci_low: 5.8, los_ci_high: 10.5, episode_cost_idr: 312_700_000, expected_reimb_idr: 281_400_000, patient_liability_idr: 31_300_000, deposit_required_idr: 22_000_000, deposit_collected_idr: 22_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T10:18:00Z", cost_breakdown_json: "{\"room\":48200000,\"procedures\":124800000,\"drugs\":31800000,\"implants\":68000000,\"labs\":12200000,\"other\":27700000}" },
  // Revision THR Prudential — disputed eligibility, NOT_CLEARED
  { id: "fc8", patient_id: "p23", payor_id: "pru", hospital_id: "h1", status: "NOT_CLEARED", drg: "PRIV-ORTHO-HIP", dx: "Revision THR · prosthetic loosening (T84.030)", scheduled_admission_at: "2026-05-03T13:00:00Z", los_predicted: 8.5, los_ci_low: 6.2, los_ci_high: 12.8, episode_cost_idr: 248_700_000, expected_reimb_idr: 180_400_000, patient_liability_idr: 68_300_000, deposit_required_idr: 35_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "HIGH", payment_mode: "CASHLESS_INSURED", gop_status: "REJECTED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":42500000,\"procedures\":78400000,\"drugs\":18900000,\"implants\":78000000,\"labs\":11400000,\"other\":19500000}" },
  // Walk-in BPJS — TLH without MRI on file (at risk on builder)
  { id: "fc9", patient_id: "p24", payor_id: "bpjs", hospital_id: "h4", status: "CONDITIONAL", drg: "INA-CBG O-6-13-I", dx: "TLH · endometriosis · no MRI on file", scheduled_admission_at: "2026-05-03T14:00:00Z", los_predicted: 4.0, los_ci_low: 3.0, los_ci_high: 5.5, episode_cost_idr: 36_800_000, expected_reimb_idr: 31_200_000, patient_liability_idr: 5_600_000, deposit_required_idr: 2_500_000, deposit_collected_idr: 1_500_000, bad_debt_risk_tier: "MEDIUM", payment_mode: "CASHLESS_INSURED", gop_status: "DRAFTED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":11200000,\"procedures\":17600000,\"drugs\":2800000,\"implants\":0,\"labs\":3400000,\"other\":1800000}" },
  // Lapsed Prudential — NOT_CLEARED, self-pay payment plan
  { id: "fc10", patient_id: "p27", payor_id: "pru", hospital_id: "h1", status: "NOT_CLEARED", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee (M17.1) — policy lapsed 2026-04-28", scheduled_admission_at: "2026-05-03T15:00:00Z", los_predicted: 5.1, los_ci_low: 4.0, los_ci_high: 7.0, episode_cost_idr: 168_500_000, expected_reimb_idr: 0, patient_liability_idr: 168_500_000, deposit_required_idr: 50_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "HIGH", payment_mode: "SELF_PAY", gop_status: "NOT_NEEDED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":18400000,\"procedures\":62500000,\"drugs\":11200000,\"implants\":48000000,\"labs\":9300000,\"other\":19100000}" },
  // BPJS myomectomy — cleared
  { id: "fc11", patient_id: "p28", payor_id: "bpjs", hospital_id: "h2", status: "CLEARED", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", scheduled_admission_at: "2026-05-03T16:00:00Z", los_predicted: 4.0, los_ci_low: 3.2, los_ci_high: 5.4, episode_cost_idr: 24_700_000, expected_reimb_idr: 21_300_000, patient_liability_idr: 3_400_000, deposit_required_idr: 2_000_000, deposit_collected_idr: 2_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T14:55:00Z", cost_breakdown_json: "{\"room\":7200000,\"procedures\":10400000,\"drugs\":2800000,\"implants\":0,\"labs\":2100000,\"other\":2200000}" },
  // Waiting period Prudential — NOT_CLEARED, exclusion applies
  { id: "fc12", patient_id: "p4", payor_id: "pru", hospital_id: "h1", status: "NOT_CLEARED", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee · in 36-month waiting period for pre-existing", scheduled_admission_at: "2026-05-03T17:30:00Z", los_predicted: 5.0, los_ci_low: 4.0, los_ci_high: 7.0, episode_cost_idr: 168_500_000, expected_reimb_idr: 0, patient_liability_idr: 168_500_000, deposit_required_idr: 50_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "HIGH", payment_mode: "SELF_PAY", gop_status: "NOT_NEEDED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":18400000,\"procedures\":62500000,\"drugs\":11200000,\"implants\":48000000,\"labs\":9300000,\"other\":19100000}" },
  // C-section BPJS — cleared
  { id: "fc13", patient_id: "p8", payor_id: "bpjs", hospital_id: "h1", status: "CLEARED", drg: "INA-CBG O-6-10-I", dx: "Elective C-section · breech (O64)", scheduled_admission_at: "2026-05-03T13:30:00Z", los_predicted: 3.0, los_ci_low: 2.5, los_ci_high: 4.0, episode_cost_idr: 22_400_000, expected_reimb_idr: 19_100_000, patient_liability_idr: 3_300_000, deposit_required_idr: 1_500_000, deposit_collected_idr: 1_500_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T11:42:00Z", cost_breakdown_json: "{\"room\":7800000,\"procedures\":9500000,\"drugs\":1900000,\"implants\":0,\"labs\":1800000,\"other\":1400000}" },
  // Onco chemo — cleared, recurring cycle
  { id: "fc14", patient_id: "p10", payor_id: "aia", hospital_id: "h2", status: "CLEARED", drg: "PRIV-ONCO-CHEMO-D", dx: "Cycle 4 · breast Ca chemo (C50.9)", scheduled_admission_at: "2026-05-03T08:30:00Z", los_predicted: 1.0, los_ci_low: 1.0, los_ci_high: 1.0, episode_cost_idr: 41_200_000, expected_reimb_idr: 38_700_000, patient_liability_idr: 2_500_000, deposit_required_idr: 2_000_000, deposit_collected_idr: 2_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T07:48:00Z", cost_breakdown_json: "{\"room\":2400000,\"procedures\":4800000,\"drugs\":31200000,\"implants\":0,\"labs\":1900000,\"other\":900000}" },
];

// ── Inpatients (Module D) ─────────────────────────────────────────────────
// 14 active inpatients across the chain. Mix of LOS variance, acuity, auth status.
const inpatients = [
  // Day 4 of 5 authorized — improving, on track
  { id: "ip1", patient_id: "p1", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-13-I", dx: "Post-laparoscopic hysterectomy · endometriosis", ward_class: "Class I", attending_physician: "Dr. Andi Permadi", admission_date: "2026-04-29T08:30:00Z", day_of_stay: 4, authorized_days: 5, los_drg_benchmark: 4.2, los_variance_pct: -4.8, acuity: "IMPROVING", medical_necessity_score: 0.94, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.78, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 6 of 5 authorized — over benchmark, extension drafted
  { id: "ip2", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG E-4-10-I", dx: "Severe community-acquired pneumonia · awaiting cultures", ward_class: "Class II", attending_physician: "Dr. Maya Suharto", admission_date: "2026-04-27T15:30:00Z", day_of_stay: 6, authorized_days: 5, los_drg_benchmark: 5.8, los_variance_pct: 3.4, acuity: "WATCH", medical_necessity_score: 0.71, medical_necessity_gaps_json: "[\"Quantitative oxygen saturation trend not documented past day 4\",\"IV antibiotic continuation rationale lacks objective markers (CRP, WBC trend)\"]", auth_extension_status: "DRAFTED", auth_extension_letter_md: "**To:** BPJS Kesehatan · Utilisasi Manajemen\n**Re:** Permintaan perpanjangan otorisasi · MRN-734395 · Reza Firmansyah\n\n**Justifikasi klinis hari ke-7+.**\n\nPasien laki-laki 66 tahun dengan severe CAP (J18.9) telah dirawat sejak 2026-04-27 dengan terapi IV ceftriaxone + azithromycin. Status klinis hari ke-6:\n- SpO₂ 92% pada 2 LPM nasal · belum mencapai target 95% room air\n- WBC menurun dari 22 → 14 (hari ke-3 → hari ke-6) · masih di atas normal\n- CRP menurun dari 168 → 64 · positif tapi belum stabil\n- Demam intermiten · hari ke-5 puncak 38.4°C\n\n**Permintaan.** Perpanjangan 3 hari otorisasi (hingga 2026-05-06) untuk:\n1. Lanjutkan IV antibiotik sampai 5 hari afebris\n2. Step-down ke oral setelah CRP &lt; 30\n3. Rencana discharge dengan home antibiotic\n\n**Risiko jika discharge dini.** Tinggi · readmission rate untuk severe CAP discharged dengan CRP &gt; 50 adalah 18% dalam 7 hari (data internal Cendana Bandung 2024).\n\n— Dr. Maya Suharto, SpPD-KP · co-signed by TatvaCare RCM workflow · routed for medical director review", discharge_readiness_score: 0.42, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 3 of 3 authorized — ready for discharge
  { id: "ip3", patient_id: "p2", payor_id: "aia", hospital_id: "h1", drg: "PRIV-CARDIO-PCI-S", dx: "Post single-vessel PCI · NSTEMI · stable", ward_class: "Private", attending_physician: "Dr. Riza Anandita, SpJP", admission_date: "2026-04-30T11:14:00Z", day_of_stay: 3, authorized_days: 3, los_drg_benchmark: 2.8, los_variance_pct: 7.1, acuity: "STABLE", medical_necessity_score: 0.91, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.94, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 2 of 3 — elective C-section, on benchmark
  { id: "ip4", patient_id: "p3", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "Post-C-section · primigravida · stable", ward_class: "Class II", attending_physician: "Dr. Sari Hapsari, SpOG", admission_date: "2026-05-01T10:00:00Z", day_of_stay: 2, authorized_days: 3, los_drg_benchmark: 3.0, los_variance_pct: -33.3, acuity: "IMPROVING", medical_necessity_score: 0.95, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.71, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 5 of 5 — TKR, holding for transport
  { id: "ip5", patient_id: "p4", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Post right TKR · OA knee · awaiting family transport", ward_class: "Private", attending_physician: "Dr. Bambang Wirawan, SpOT", admission_date: "2026-04-28T07:30:00Z", day_of_stay: 5, authorized_days: 5, los_drg_benchmark: 5.0, los_variance_pct: 0.0, acuity: "STABLE", medical_necessity_score: 0.78, medical_necessity_gaps_json: "[\"PT progress notes for last 24h missing — needed to support PT-justified additional day\"]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.88, avoidable_day_flag: 1, avoidable_day_reason: "Awaiting family transport · social, not clinical" },
  // Day 5 of 7 authorized — multi-vessel PCI, watch
  { id: "ip6", patient_id: "p17", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Post multi-vessel PCI · STEMI · day 5 · CHF watch", ward_class: "Private", attending_physician: "Dr. Hanin Mahmud, SpJP", admission_date: "2026-04-28T17:11:00Z", day_of_stay: 5, authorized_days: 7, los_drg_benchmark: 4.5, los_variance_pct: 11.1, acuity: "WATCH", medical_necessity_score: 0.84, medical_necessity_gaps_json: "[\"BNP / NT-proBNP trend not documented to support CHF watch indication\"]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.55, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 4 of 4 — appendectomy, ready
  { id: "ip7", patient_id: "p18", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-15-II", dx: "Post laparoscopic appendectomy · uncomplicated", ward_class: "Class I", attending_physician: "Dr. Iwan Santoso, SpB", admission_date: "2026-04-30T09:30:00Z", day_of_stay: 4, authorized_days: 4, los_drg_benchmark: 2.5, los_variance_pct: 60.0, acuity: "STABLE", medical_necessity_score: 0.62, medical_necessity_gaps_json: "[\"Wound check note absent for days 2-3\",\"Justification for extended LOS beyond DRG benchmark not documented\"]", auth_extension_status: "REJECTED", auth_extension_letter_md: null, discharge_readiness_score: 0.92, avoidable_day_flag: 1, avoidable_day_reason: "Discharge planning not started until day 3" },
  // Day 3 of 7 — bilateral TKR, on track
  { id: "ip8", patient_id: "p19", payor_id: "pru", hospital_id: "h2", drg: "PRIV-ORTHO-TKR", dx: "Post bilateral TKR staged · day 3 of 7", ward_class: "Private", attending_physician: "Dr. Joko Santoso, SpOT", admission_date: "2026-04-30T10:45:00Z", day_of_stay: 3, authorized_days: 7, los_drg_benchmark: 7.0, los_variance_pct: -57.1, acuity: "IMPROVING", medical_necessity_score: 0.93, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.31, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 4 of 4 — emergency C-section, ready
  { id: "ip9", patient_id: "p20", payor_id: "bpjs", hospital_id: "h4", drg: "INA-CBG O-6-10-I", dx: "Post emergency C-section · fetal distress · stable", ward_class: "Class II", attending_physician: "Dr. Nia Pratiwi, SpOG", admission_date: "2026-04-29T07:00:00Z", day_of_stay: 4, authorized_days: 4, los_drg_benchmark: 3.5, los_variance_pct: 14.3, acuity: "STABLE", medical_necessity_score: 0.89, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.86, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 8 of 9 — glioma craniotomy, critical
  { id: "ip10", patient_id: "p21", payor_id: "aia", hospital_id: "h1", drg: "PRIV-NEURO-CRANI", dx: "Post craniotomy · glioblastoma · ICU step-down day 8", ward_class: "Private", attending_physician: "Dr. Arman Khusaini, SpBS", admission_date: "2026-04-25T16:20:00Z", day_of_stay: 8, authorized_days: 9, los_drg_benchmark: 8.5, los_variance_pct: -5.9, acuity: "CRITICAL", medical_necessity_score: 0.96, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.18, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 7 of 5 authorized — over auth, extension critical
  { id: "ip11", patient_id: "p9", payor_id: "pru", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Post right THR · OA hip · day 7 · wound oversight", ward_class: "Private", attending_physician: "Dr. Krisna Adi, SpOT", admission_date: "2026-04-26T14:32:00Z", day_of_stay: 7, authorized_days: 5, los_drg_benchmark: 5.0, los_variance_pct: 40.0, acuity: "WATCH", medical_necessity_score: 0.68, medical_necessity_gaps_json: "[\"Wound exudate culture pending — needed to support continued IV abx\",\"Inflammatory markers (CRP, ESR) not trended\"]", auth_extension_status: "DRAFTED", auth_extension_letter_md: "**To:** Prudential Indonesia · Utilization Management\n**Re:** Auth extension request · PRU-44-991-770 · Wahyu Santoso\n\n**Clinical justification for continued stay (days 6-9).**\n\n54-yo male post right THR (M16.1) admitted 2026-04-26. Course initially uncomplicated until day 5 when surgical wound demonstrated exudate with surrounding erythema. Cultures sent 2026-04-30; antibiotics empirically started.\n\n**Day 7 status:**\n- Wound: persistent exudate, erythema reducing\n- Mobility: assisted transfers only\n- Inflammatory markers: CRP 68 (down from 102 day 5)\n- Cultures: preliminary GPCs · final pending\n\n**Plan and clinical evidence for additional days:**\n1. Continue IV cefazolin pending culture sensitivity (3 days)\n2. PT mobilisation BID — current barrier to discharge\n3. Discharge target: day 10 with home IV plan if cultures permit\n\n**Why this exceeds DRG benchmark.** Surgical site infection risk · clinical urgency clear · attached cultures and CRP trend support continued IV access.\n\n— Dr. Krisna Adi, SpOT · drafted by TatvaCare RCM workflow · routed for utilization review", discharge_readiness_score: 0.34, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 1 of 4 — chemo cycle, just admitted
  { id: "ip12", patient_id: "p10", payor_id: "aia", hospital_id: "h2", drg: "PRIV-ONCO-CHEMO-D", dx: "Cycle 4 · breast Ca chemo · day 1", ward_class: "Private", attending_physician: "Dr. Ratu Anjarwati, SpOnk", admission_date: "2026-05-03T07:30:00Z", day_of_stay: 1, authorized_days: 1, los_drg_benchmark: 1.0, los_variance_pct: 0.0, acuity: "STABLE", medical_necessity_score: 0.97, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.94, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 6 of 5 — TURP over auth
  { id: "ip13", patient_id: "p11", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-2-13-I", dx: "Post-TURP · BPH · urinary retention day 6", ward_class: "Class I", attending_physician: "Dr. Hapsah Ramli, SpU", admission_date: "2026-04-28T11:00:00Z", day_of_stay: 6, authorized_days: 5, los_drg_benchmark: 4.0, los_variance_pct: 50.0, acuity: "WATCH", medical_necessity_score: 0.74, medical_necessity_gaps_json: "[\"Voiding trial result not documented\",\"PVR (post-void residual) trend missing\"]", auth_extension_status: "SUBMITTED", auth_extension_letter_md: null, discharge_readiness_score: 0.49, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 5 of 5 — myomectomy ready
  { id: "ip14", patient_id: "p12", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-15-I", dx: "Post myomectomy · uterine fibroid · ready for discharge", ward_class: "Class II", attending_physician: "Dr. Mira Adelina, SpOG", admission_date: "2026-04-29T15:00:00Z", day_of_stay: 5, authorized_days: 5, los_drg_benchmark: 4.0, los_variance_pct: 25.0, acuity: "STABLE", medical_necessity_score: 0.86, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.91, avoidable_day_flag: 1, avoidable_day_reason: "Pharmacy delay · TTOs not ready until evening day 4" },
];

const pipeline = [
  { id: "pp1", label: "Building", count: 38, value_idr: 982_000_000, sort: 1 },
  { id: "pp2", label: "Awaiting pre-auth", count: 22, value_idr: 1_410_000_000, sort: 2 },
  { id: "pp3", label: "Submitted", count: 91, value_idr: 4_220_000_000, sort: 3 },
  { id: "pp4", label: "Acknowledged", count: 78, value_idr: 3_780_000_000, sort: 4 },
  { id: "pp5", label: "Adjudicated", count: 56, value_idr: 2_410_000_000, sort: 5 },
  { id: "pp6", label: "Paid", count: 124, value_idr: 5_980_000_000, sort: 6 },
  { id: "pp7", label: "Denied · in appeal", count: 19, value_idr: 880_000_000, sort: 7 },
];

// ── Denial codes (per-payor × code grid) ────────────────────────────────
// Bahasa-Indonesian phrasing matches what cashless review desks and BPJS verifiers use on
// real returned berkas. Each row is one (payor, code) pair with the share of
// denials of that type seen at that payor. Rows omitted for payors that don't
// use the code (e.g., re-admisi <7d bundling and limit-kamar prorate are
// BPJS-only / private-only respectively in the way listed below).
const denialCodes = [
  // ── BPJS — full set, 14 codes ──────────────────────────────────────────
  { id: "dc-bpjs-tec01", payor_id: "bpjs", bucket: "technical", code: "TEC-01", phrasing: "Berkas tidak lengkap — resume medis tidak ditandatangani DPJP", frequency_pct: 0.18 },
  { id: "dc-bpjs-tec02", payor_id: "bpjs", bucket: "technical", code: "TEC-02", phrasing: "Koding ICD-10/9-CM tidak sesuai dengan resume medis", frequency_pct: 0.11 },
  { id: "dc-bpjs-tec03", payor_id: "bpjs", bucket: "technical", code: "TEC-03", phrasing: "SEP/GL belum terbit pada saat pelayanan", frequency_pct: 0.07 },
  { id: "dc-bpjs-cln01", payor_id: "bpjs", bucket: "clinical", code: "CLN-01", phrasing: "Tindakan tidak medically necessary berdasarkan PPK/CP", frequency_pct: 0.10 },
  { id: "dc-bpjs-cln02", payor_id: "bpjs", bucket: "clinical", code: "CLN-02", phrasing: "Length of stay melebihi standar klinis untuk diagnosis", frequency_pct: 0.06 },
  { id: "dc-bpjs-cln03", payor_id: "bpjs", bucket: "clinical", code: "CLN-03", phrasing: "Pemeriksaan penunjang berlebihan / tidak indikatif", frequency_pct: 0.04 },
  { id: "dc-bpjs-con01", payor_id: "bpjs", bucket: "contractual", code: "CON-01", phrasing: "Diagnosis termasuk pengecualian polis (kongenital/kosmetik)", frequency_pct: 0.05 },
  { id: "dc-bpjs-con02", payor_id: "bpjs", bucket: "contractual", code: "CON-02", phrasing: "Masa tunggu (waiting period) belum terpenuhi", frequency_pct: 0.08 },
  { id: "dc-bpjs-con03", payor_id: "bpjs", bucket: "contractual", code: "CON-03", phrasing: "Pre-existing condition tidak terdeklarasi", frequency_pct: 0.06 },
  { id: "dc-bpjs-con04", payor_id: "bpjs", bucket: "contractual", code: "CON-04", phrasing: "Limit kamar terlampaui — prorate diterapkan", frequency_pct: 0.09 },
  { id: "dc-bpjs-adm01", payor_id: "bpjs", bucket: "administrative", code: "ADM-01", phrasing: "Klaim diajukan melewati batas waktu (kadaluarsa)", frequency_pct: 0.04 },
  { id: "dc-bpjs-adm02", payor_id: "bpjs", bucket: "administrative", code: "ADM-02", phrasing: "Peserta non-aktif / premi menunggak", frequency_pct: 0.03 },
  { id: "dc-bpjs-adm03", payor_id: "bpjs", bucket: "administrative", code: "ADM-03", phrasing: "Duplikasi klaim — sudah dibayar episode sebelumnya", frequency_pct: 0.05 },
  { id: "dc-bpjs-adm04", payor_id: "bpjs", bucket: "administrative", code: "ADM-04", phrasing: "Re-admisi < 7 hari dianggap satu episode (BPJS)", frequency_pct: 0.04 },

  // ── Prudential — subset of 12 codes (no re-admission bundling, ICU/SEP-style codes adapted) ─────────
  { id: "dc-pru-tec01", payor_id: "pru", bucket: "technical", code: "TEC-01", phrasing: "Berkas tidak lengkap — resume medis tidak ditandatangani DPJP", frequency_pct: 0.16 },
  { id: "dc-pru-tec02", payor_id: "pru", bucket: "technical", code: "TEC-02", phrasing: "Koding ICD-10/9-CM tidak sesuai dengan resume medis", frequency_pct: 0.09 },
  { id: "dc-pru-cln01", payor_id: "pru", bucket: "clinical", code: "CLN-01", phrasing: "Tindakan tidak medically necessary berdasarkan PPK/CP", frequency_pct: 0.08 },
  { id: "dc-pru-cln02", payor_id: "pru", bucket: "clinical", code: "CLN-02", phrasing: "Length of stay melebihi standar klinis untuk diagnosis", frequency_pct: 0.05 },
  { id: "dc-pru-con01", payor_id: "pru", bucket: "contractual", code: "CON-01", phrasing: "Diagnosis termasuk pengecualian polis (kongenital/kosmetik)", frequency_pct: 0.06 },
  { id: "dc-pru-con02", payor_id: "pru", bucket: "contractual", code: "CON-02", phrasing: "Masa tunggu (waiting period) belum terpenuhi", frequency_pct: 0.10 },
  { id: "dc-pru-con03", payor_id: "pru", bucket: "contractual", code: "CON-03", phrasing: "Pre-existing condition tidak terdeklarasi", frequency_pct: 0.07 },
  { id: "dc-pru-con04", payor_id: "pru", bucket: "contractual", code: "CON-04", phrasing: "Limit kamar terlampaui — prorate diterapkan", frequency_pct: 0.13 },
  { id: "dc-pru-adm01", payor_id: "pru", bucket: "administrative", code: "ADM-01", phrasing: "Klaim diajukan melewati batas waktu (kadaluarsa)", frequency_pct: 0.05 },
  { id: "dc-pru-adm02", payor_id: "pru", bucket: "administrative", code: "ADM-02", phrasing: "Peserta non-aktif / premi menunggak", frequency_pct: 0.04 },
  { id: "dc-pru-adm03", payor_id: "pru", bucket: "administrative", code: "ADM-03", phrasing: "Duplikasi klaim — sudah dibayar episode sebelumnya", frequency_pct: 0.04 },

  // ── AIA — subset of 12 codes (mirrors PRU) ─────────────────────────────
  { id: "dc-aia-tec01", payor_id: "aia", bucket: "technical", code: "TEC-01", phrasing: "Berkas tidak lengkap — resume medis tidak ditandatangani DPJP", frequency_pct: 0.15 },
  { id: "dc-aia-tec02", payor_id: "aia", bucket: "technical", code: "TEC-02", phrasing: "Koding ICD-10/9-CM tidak sesuai dengan resume medis", frequency_pct: 0.08 },
  { id: "dc-aia-cln01", payor_id: "aia", bucket: "clinical", code: "CLN-01", phrasing: "Tindakan tidak medically necessary berdasarkan PPK/CP", frequency_pct: 0.09 },
  { id: "dc-aia-cln02", payor_id: "aia", bucket: "clinical", code: "CLN-02", phrasing: "Length of stay melebihi standar klinis untuk diagnosis", frequency_pct: 0.06 },
  { id: "dc-aia-con01", payor_id: "aia", bucket: "contractual", code: "CON-01", phrasing: "Diagnosis termasuk pengecualian polis (kongenital/kosmetik)", frequency_pct: 0.05 },
  { id: "dc-aia-con02", payor_id: "aia", bucket: "contractual", code: "CON-02", phrasing: "Masa tunggu (waiting period) belum terpenuhi", frequency_pct: 0.09 },
  { id: "dc-aia-con03", payor_id: "aia", bucket: "contractual", code: "CON-03", phrasing: "Pre-existing condition tidak terdeklarasi", frequency_pct: 0.06 },
  { id: "dc-aia-con04", payor_id: "aia", bucket: "contractual", code: "CON-04", phrasing: "Limit kamar terlampaui — prorate diterapkan", frequency_pct: 0.12 },
  { id: "dc-aia-adm01", payor_id: "aia", bucket: "administrative", code: "ADM-01", phrasing: "Klaim diajukan melewati batas waktu (kadaluarsa)", frequency_pct: 0.04 },
  { id: "dc-aia-adm02", payor_id: "aia", bucket: "administrative", code: "ADM-02", phrasing: "Peserta non-aktif / premi menunggak", frequency_pct: 0.03 },
  { id: "dc-aia-adm03", payor_id: "aia", bucket: "administrative", code: "ADM-03", phrasing: "Duplikasi klaim — sudah dibayar episode sebelumnya", frequency_pct: 0.04 },
];

// ── P5 deep-seed: Budi / Siti / Ravi end-to-end ──────────────────────────
// Three patients seeded across claims, denials, appeals, GL submissions,
// uploaded policy docs, and patient-specific email threads. The first two
// columns mirror the rest of the seed; downstream tables get separate ins()
// calls so the column-shape contract is preserved per group.

// Three claims — Budi PAID (cardiac surgery with top-up), Siti AWAITING_PREAUTH (C-section),
// Ravi BUILDING (PCI · denial row drives PD_DENIED in worklist).
const deepClaims = [
  // Budi · post-discharge · GL top-up approved · final claim settled
  { id: "c-budi", patient_id: "p-budi", payor_id: "bpjs", hospital_id: "h1",
    drg: "PRIV-CARDIO-CABG-S", dx: "CABG · 4-vessel · with pre-existing T2DM/HTN (I25.10)",
    los_days: 9, gross_idr: 322_000_000, expected_reimb_idr: 315_000_000, deposit_idr: 12_000_000,
    // AUTO_CLEARED keeps Budi visible in the post-discharge silo with a "Verdict — Approved" label.
    status: "AUTO_CLEARED", stage: "AUTO_CLEARED", days_in_stage: 0,
    submitted_at: "2026-04-28T11:20:00Z", paid_at: "2026-05-04T08:14:00Z", denial_reason: null,
    acceptance_score: 0.92, predicted_dtp_days: 6, agent_step: null,
    risk_flag: null, source: "EMR" },
  // Siti · pre-admission · packet submitted and under review (BPJS C-section)
  { id: "c-siti", patient_id: "p-siti", payor_id: "bpjs", hospital_id: "h2",
    drg: "INA-CBG O-6-10-I", dx: "Planned repeat C-section · breech presentation with prior scar (O64)",
    los_days: 3, gross_idr: 24_800_000, expected_reimb_idr: 21_400_000, deposit_idr: 1_500_000,
    status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 1,
    submitted_at: "2026-05-04T09:30:00Z", paid_at: null, denial_reason: null,
    acceptance_score: 0.84, predicted_dtp_days: 9, agent_step: "Initial BPJS C-section packet under review",
    risk_flag: null, source: "EMR" },
  // Ravi · post-discharge · partial denial → appeal in flight (denial row below)
  { id: "c-ravi", patient_id: "p-ravi", payor_id: "aia", hospital_id: "h1",
    drg: "PRIV-CARDIO-PCI-S", dx: "PCI · LAD lesion with unstable angina (I20.0)",
    los_days: 5, gross_idr: 178_500_000, expected_reimb_idr: 142_800_000, deposit_idr: 8_000_000,
    status: "BUILDING", stage: "BUILDING", days_in_stage: 2,
    submitted_at: "2026-04-26T10:00:00Z", paid_at: null,
    denial_reason: "Room rent cap exceeded — monitored cardiac room IDR 3.2M/day vs plan IDR 2.0M/day. Prorate applied across all line items.",
    acceptance_score: 0.68, predicted_dtp_days: 14,
    agent_step: "Drafting appeal letter for monitored cardiac room medical necessity",
    risk_flag: "RoomRentCap", source: "EMR" },
];

// One denial — Ravi's prorate; this triggers PD_DENIED sub-stage in the aggregator.
const deepDenials = [
  { id: "d-ravi", claim_id: "c-ravi", payor_id: "aia", hospital_id: "h1",
    category: "contractual", reason_code: "CON-04",
    reason_text: "Limit kamar terlampaui — monitored cardiac room IDR 3.2M/day melebihi plan tier-3 cap IDR 2.0M/day. Prorate IDR 142.8M ÷ ratio 0.625 = IDR 89.25M.",
    denied_amount_idr: 53_550_000,
    denied_at: "2026-04-30T14:22:00Z",
    appeal_deadline_at: "2026-05-30T23:59:59Z",
    appeal_status: "DRAFTED", success_probability: 0.68,
    root_cause_step: "Room class booking · plan tier-3 cap not enforced at admission",
    recurring_pattern_id: null },
];

// One appeal draft — Ravi's medical-necessity rebuttal.
const deepAppealDrafts = [
  { id: "ad-ravi", denial_id: "d-ravi",
    letter_md: "Dear AIA Indonesia Adjudication Team,\n\nWe respectfully contest the prorate deduction applied to claim 22-IDN-RAVI per CON-04...\n\n[Justification: the monitored cardiac room was clinically necessary after PCI because the patient remained on arrhythmia-watch protocol and required telemetry access not available in the standard multi-bed room.]\n\nWe attach: (1) monitored-room medical necessity letter by Dr. Albert Santoso, (2) cardiac monitored-room protocol §4.7, (3) comparable cases approved historically.\n\nKindly reconsider for full settlement at IDR 142.8M.\n\nRegards,\nMayapada Hospital · RCM",
    attachments_json: '["monitored_room_medical_necessity_letter.pdf","infection_control_protocol_§4.7.pdf","historical_cases_table.xlsx"]',
    drafted_at: "2026-05-02T09:30:00Z",
    submitted_at: null,
    outcome: null },
];

// GL submissions — full lifecycle per patient.
const glSubmissions = [
  // Budi: initial → top-up → final
  { id: "gl-budi-1", patient_id: "p-budi", kind: "initial", state: "approved",
    amount_idr: 270_000_000, drafted_at: "2026-04-18T08:00:00Z",
    submitted_at: "2026-04-19T09:00:00Z", decided_at: "2026-04-19T13:30:00Z",
    decision_note: "Initial GL approved · IDR 270M · valid through 2026-04-30" },
  { id: "gl-budi-2", patient_id: "p-budi", kind: "topup", state: "approved",
    amount_idr: 55_000_000, drafted_at: "2026-04-22T11:18:00Z",
    submitted_at: "2026-04-22T11:32:00Z", decided_at: "2026-04-22T13:55:00Z",
    decision_note: "Top-up approved · intra-op 4th-vessel graft scope expansion" },
  { id: "gl-budi-3", patient_id: "p-budi", kind: "final", state: "approved",
    amount_idr: 322_000_000, drafted_at: "2026-04-27T14:00:00Z",
    submitted_at: "2026-04-28T11:20:00Z", decided_at: "2026-05-04T08:14:00Z",
    decision_note: "Final claim settled · approved with amendment" },
  // Siti: initial in flight, downstream packets not started yet
  { id: "gl-siti-1", patient_id: "p-siti", kind: "initial", state: "submitted",
    amount_idr: 19_800_000, drafted_at: "2026-05-03T15:00:00Z",
    submitted_at: "2026-05-04T09:30:00Z", decided_at: null,
    decision_note: null },
  { id: "gl-siti-2", patient_id: "p-siti", kind: "topup", state: "not_started",
    amount_idr: null, drafted_at: null, submitted_at: null, decided_at: null, decision_note: null },
  { id: "gl-siti-3", patient_id: "p-siti", kind: "final", state: "not_started",
    amount_idr: null, drafted_at: null, submitted_at: null, decided_at: null, decision_note: null },
  // Ravi: initial approved, final partial → contesting
  { id: "gl-ravi-1", patient_id: "p-ravi", kind: "initial", state: "approved",
    amount_idr: 142_800_000, drafted_at: "2026-04-19T08:00:00Z",
    submitted_at: "2026-04-19T11:00:00Z", decided_at: "2026-04-19T15:00:00Z",
    decision_note: "Initial GL approved · IDR 142.8M" },
  { id: "gl-ravi-2", patient_id: "p-ravi", kind: "final", state: "partial",
    amount_idr: 89_250_000, drafted_at: "2026-04-25T10:00:00Z",
    submitted_at: "2026-04-26T10:00:00Z", decided_at: "2026-04-30T14:22:00Z",
    decision_note: "Partial settlement · CON-04 prorate · IDR 89.25M (vs claimed 142.8M) · contest in progress" },
  // Ayu: packet build in progress from uploaded outside-clinic evidence
  { id: "gl-ayu-1", patient_id: "p43", kind: "initial", state: "drafting",
    amount_idr: null, drafted_at: "2026-05-04T09:15:00Z",
    submitted_at: null, decided_at: null,
    decision_note: "Packet build in progress from uploaded outside-clinic documents" },
  { id: "gl-ayu-2", patient_id: "p43", kind: "topup", state: "not_started",
    amount_idr: null, drafted_at: null, submitted_at: null, decided_at: null, decision_note: null },
  { id: "gl-ayu-3", patient_id: "p43", kind: "final", state: "not_started",
    amount_idr: null, drafted_at: null, submitted_at: null, decided_at: null, decision_note: null },
];

// Patient-specific email threads (drama beats) — Budi top-up TPA query, Ravi prorate notice.
const patientThreads = [
  { id: "t-budi-1", payor_id: "bpjs", patient_id: "p-budi",
    subject: "Permohonan Perpanjangan Surat Jaminan (GL Top-Up) — Budi Santoso / GL BPJS-2026-00341",
    sender: "review@bpjsdesk.co.id",
    excerpt: "Mohon dilampirkan intraoperative finding note + revised cost estimate untuk justifikasi penambahan IDR 55.000.000…",
    body: "Yth. Mayapada Hospital,\n\nMohon dilampirkan intraoperative finding note yang ditandatangani DPJP (Dr. Wijaya, SpBTKV) serta revised cost estimate untuk justifikasi penambahan IDR 55.000.000 atas tindakan tambahan vessel graft ke-4. Tanpa kelengkapan tersebut, GL top-up tidak dapat diproses.\n\nSalam,\nBPJS review desk",
    highlight: "intraoperative finding note + revised cost estimate",
    outcome: "approved_after_topup", learned_rule: "bpjs-proc-02",
    ts: "2026-04-22T11:55:00Z" },
  { id: "t-ravi-1", payor_id: "aia", patient_id: "p-ravi",
    subject: "Klaim Sebagian — Limit Kamar Terlampaui · Ravi Subramaniam · Claim 22-IDN-RAVI",
    sender: "claims.id@aia.com",
    excerpt: "We have applied a prorate deduction at ratio 0.625 for monitored-room charges exceeding the plan tier-3 cap (IDR 3.2M/day vs plan IDR 2.0M/day)…",
    body: "Dear Mayapada Hospital RCM,\n\nClaim 22-IDN-RAVI (PRIV-CARDIO-PCI-S · PCI) adjudicated with adjustment. We have applied a prorate deduction at ratio 0.625 for monitored-room charges exceeding the plan tier-3 cap (IDR 3.2M/day vs plan IDR 2.0M/day). Final settlement: IDR 89,250,000.\n\nReconsideration is possible upon receipt of medical-necessity justification for the higher room class.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "prorate deduction at ratio 0.625 for monitored-room charges exceeding the plan tier-3 cap",
    outcome: "partial_paid", learned_rule: "aia-fin-01",
    ts: "2026-04-30T14:30:00Z" },
  { id: "t-ayu-1", payor_id: "pru", patient_id: "p43",
    subject: "Permintaan kelengkapan awal cashless — Ayu Lestari / planned hysterectomy",
    sender: "medical.review@prudential.co.id",
    excerpt: "Mohon unggah surat rujukan SpOG, MRI pelvis, serta pre-op anaesthesia note agar pre-auth dapat diproses…",
    body: "Yth. RCM Mayapada Hospital,\n\nUntuk pengajuan cashless Ayu Lestari (planned laparoscopic hysterectomy), mohon lampirkan surat rujukan SpOG, MRI pelvis, hasil lab pra-operasi, dan pre-op anaesthesia note. Setelah dokumen lengkap, pre-auth dapat direview pada hari yang sama.\n\nSalam,\nPrudential medical review",
    highlight: "surat rujukan SpOG, MRI pelvis, hasil lab pra-operasi, dan pre-op anaesthesia note",
    outcome: "pending", learned_rule: "pru-doc-01",
    ts: "2026-05-04T09:10:00Z" },
];

// Uploaded documents — policy certificates + per-stage paper.
const deepUploadedDocs = [
  // Policy certificates — present for Budi + Siti; Ravi has none yet.
  { id: "doc-budi-policy", owner_kind: "patient", owner_id: "p-budi", patient_id: "p-budi",
    kind: "policy_certificate", filename: "BPJS_cardiac_benefits_Budi.pdf",
    source_clinic: "BPJS benefits schedule · policy on file",
    uploaded_by: "RCM Auto", uploaded_at: "2026-04-15T08:00:00Z",
    pages: 12, ocr_excerpt: "BPJS cardiac surgical benefits · CABG requires pre-auth form, angiography evidence, and top-up addendum for intra-op scope expansion.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 0 },
  { id: "doc-siti-policy", owner_kind: "patient", owner_id: "p-siti", patient_id: "p-siti",
    kind: "policy_certificate", filename: "BPJS_obstetric_benefits_Siti.pdf",
    source_clinic: "BPJS obstetric benefits · policy on file",
    uploaded_by: "RCM Auto", uploaded_at: "2026-05-02T08:15:00Z",
    pages: 10, ocr_excerpt: "BPJS obstetric pre-auth schedule · planned C-section requires OB consult, breech evidence, CTG, and anaesthesia clearance.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 0 },

  // Budi · stage paper (consult → discharge), with intra-op note that drives top-up
  { id: "doc-budi-consult", owner_kind: "patient", owner_id: "p-budi", patient_id: "p-budi",
    kind: "consult_note", filename: "consult_cardiothoracic_2026-04-12.pdf",
    source_clinic: "Mayapada Hospital · CTVS",
    uploaded_by: "Dr. Wijaya, SpBTKV", uploaded_at: "2026-04-12T10:00:00Z",
    pages: 3, ocr_excerpt: "58M HTN/T2DM · CCS class III angina · angiogram triple-vessel disease 80%/75%/70% · plan elective CABG.",
    extracted_icd: "I25.10", extracted_cpt: null, extracted_drg: "PRIV-CARDIO-CABG-S",
    status: "handed_to_packet", sort: 1 },
  { id: "doc-budi-labs", owner_kind: "patient", owner_id: "p-budi", patient_id: "p-budi",
    kind: "lab_result", filename: "preop_labs_panel_2026-04-15.pdf",
    source_clinic: "Mayapada Hospital · Lab",
    uploaded_by: "Lab", uploaded_at: "2026-04-15T07:00:00Z",
    pages: 2, ocr_excerpt: "HbA1c 7.1, eGFR 76, troponin <0.01, INR 1.0, CXR clear. Cleared for surgery.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 2 },
  { id: "doc-budi-intraop", owner_kind: "patient", owner_id: "p-budi", patient_id: "p-budi",
    kind: "op_report", filename: "intraop_finding_note_4thvessel.pdf",
    source_clinic: "Mayapada Hospital · OT-2",
    uploaded_by: "Dr. Wijaya, SpBTKV", uploaded_at: "2026-04-22T11:10:00Z",
    pages: 4, ocr_excerpt: "Intra-op identified critically stenosed 4th vessel (PDA) not visible on pre-op angio. Decision to graft additional vessel. CPB time +90 min. Total grafts: LIMA-LAD, SVG-OM1, SVG-RCA, SVG-PDA.",
    extracted_icd: "I25.10", extracted_cpt: "33533", extracted_drg: "PRIV-CARDIO-CABG-S",
    status: "handed_to_packet", sort: 3 },
  { id: "doc-budi-discharge", owner_kind: "patient", owner_id: "p-budi", patient_id: "p-budi",
    kind: "discharge_summary", filename: "discharge_summary_budi.pdf",
    source_clinic: "Mayapada Hospital · CTVS",
    uploaded_by: "Dr. Wijaya, SpBTKV", uploaded_at: "2026-04-27T14:30:00Z",
    pages: 3, ocr_excerpt: "Discharged day 9 post-CABG. Stable, ambulating, wound clean. Home with statin/aspirin/metoprolol/metformin. F/U 2 weeks.",
    extracted_icd: "I25.10", extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 4 },
  { id: "doc-budi-invoice", owner_kind: "patient", owner_id: "p-budi", patient_id: "p-budi",
    kind: "invoice", filename: "final_invoice_budi_322M.pdf",
    source_clinic: "Mayapada Hospital · Billing",
    uploaded_by: "Billing", uploaded_at: "2026-04-28T10:00:00Z",
    pages: 2, ocr_excerpt: "Total IDR 322,000,000 · OT IDR 178M · ICU IDR 64M · Drugs/Implants IDR 52M · Room IDR 18M · Other IDR 10M.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 5 },

  // Siti · stage paper (consult + OB imaging + pre-auth packet)
  { id: "doc-siti-consult", owner_kind: "patient", owner_id: "p-siti", patient_id: "p-siti",
    kind: "consult_note", filename: "consult_obgyn_siti.pdf",
    source_clinic: "RS Cendana Jakarta · Obgyn",
    uploaded_by: "Dr. Ratna Dewi, SpOG", uploaded_at: "2026-05-02T09:00:00Z",
    pages: 2, ocr_excerpt: "34F · breech presentation at term with prior C-section scar · plan repeat C-section.",
    extracted_icd: "O64", extracted_cpt: null, extracted_drg: "INA-CBG O-6-10-I",
    status: "handed_to_packet", sort: 1 },
  { id: "doc-siti-usg", owner_kind: "patient", owner_id: "p-siti", patient_id: "p-siti",
    kind: "lab_result", filename: "obstetric_ultrasound_siti.pdf",
    source_clinic: "RS Cendana Jakarta · Fetomaternal",
    uploaded_by: "Radiology", uploaded_at: "2026-05-02T11:00:00Z",
    pages: 2, ocr_excerpt: "Obstetric ultrasound: singleton pregnancy, breech presentation, reassuring fetal profile. CTG reactive. CBC WNL.",
    extracted_icd: "O64", extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 2 },
  { id: "doc-siti-preauth", owner_kind: "patient", owner_id: "p-siti", patient_id: "p-siti",
    kind: "preauth_form", filename: "BPJS_csection_preauth_siti.pdf",
    source_clinic: "RS Cendana Jakarta · RCM",
    uploaded_by: "RCM Auto", uploaded_at: "2026-05-04T09:00:00Z",
    pages: 1, ocr_excerpt: "BPJS C-section packet · breech presentation + prior scar · Class I · INA-CBG O-6-10-I.",
    extracted_icd: "O64", extracted_cpt: null, extracted_drg: "INA-CBG O-6-10-I",
    status: "handed_to_packet", sort: 3 },

  // Ravi · stage paper + appeal supporting docs
  { id: "doc-ravi-consult", owner_kind: "patient", owner_id: "p-ravi", patient_id: "p-ravi",
    kind: "consult_note", filename: "consult_cardiology_ravi.pdf",
    source_clinic: "Mayapada Hospital · Cardiology",
    uploaded_by: "Dr. Albert Santoso, SpJP", uploaded_at: "2026-04-15T10:00:00Z",
    pages: 3, ocr_excerpt: "51M · unstable angina · critical LAD lesion with diagonal involvement · plan PCI. HTN controlled.",
    extracted_icd: "I20.0", extracted_cpt: null, extracted_drg: "PRIV-CARDIO-PCI-S",
    status: "handed_to_packet", sort: 1 },
  { id: "doc-ravi-opreport", owner_kind: "patient", owner_id: "p-ravi", patient_id: "p-ravi",
    kind: "op_report", filename: "cathlab_report_pci_ravi.pdf",
    source_clinic: "Mayapada Hospital · Cath Lab",
    uploaded_by: "Dr. Albert Santoso, SpJP", uploaded_at: "2026-04-21T16:00:00Z",
    pages: 4, ocr_excerpt: "PCI to LAD with drug-eluting stent placement · TIMI 3 flow post-procedure · no complications.",
    extracted_icd: "I20.0", extracted_cpt: "92928", extracted_drg: "PRIV-CARDIO-PCI-S",
    status: "handed_to_packet", sort: 2 },
  { id: "doc-ravi-discharge", owner_kind: "patient", owner_id: "p-ravi", patient_id: "p-ravi",
    kind: "discharge_summary", filename: "discharge_summary_ravi.pdf",
    source_clinic: "Mayapada Hospital · Cardiology",
    uploaded_by: "Dr. Albert Santoso, SpJP", uploaded_at: "2026-04-25T14:00:00Z",
    pages: 2, ocr_excerpt: "Discharged day 5 post-PCI. Haemodynamically stable, chest-pain free, dual antiplatelet started.",
    extracted_icd: "I20.0", extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 3 },
  { id: "doc-ravi-invoice", owner_kind: "patient", owner_id: "p-ravi", patient_id: "p-ravi",
    kind: "invoice", filename: "final_invoice_ravi_178M.pdf",
    source_clinic: "Mayapada Hospital · Billing",
    uploaded_by: "Billing", uploaded_at: "2026-04-26T09:00:00Z",
    pages: 2, ocr_excerpt: "Total IDR 178,500,000 · Cath-lab + stent IDR 118M · monitored room 5d IDR 16M · drugs IDR 21M · other IDR 23.5M.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 4 },
  // Appeal supporting docs (kind=other; surface in appeal attachments)
  { id: "doc-ravi-ssirisk", owner_kind: "patient", owner_id: "p-ravi", patient_id: "p-ravi",
    kind: "other", filename: "monitored_room_medical_necessity_letter.pdf",
    source_clinic: "Mayapada Hospital · Cardiology",
    uploaded_by: "Dr. Albert Santoso, SpJP", uploaded_at: "2026-05-01T09:00:00Z",
    pages: 2, ocr_excerpt: "Medical necessity note · post-PCI monitoring required due to lesion complexity and arrhythmia-watch protocol · single monitored room recommended.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 5 },
  { id: "doc-ravi-icp", owner_kind: "patient", owner_id: "p-ravi", patient_id: "p-ravi",
    kind: "other", filename: "infection_control_protocol_§4.7.pdf",
    source_clinic: "Mayapada Hospital · Cardiac Services",
    uploaded_by: "Quality", uploaded_at: "2026-05-01T09:30:00Z",
    pages: 4, ocr_excerpt: "Cardiac monitored-room protocol §4.7 — post-PCI patients with arrhythmia-watch indications should be placed in a monitored single room when feasible.",
    extracted_icd: null, extracted_cpt: null, extracted_drg: null,
    status: "handed_to_packet", sort: 6 },
];

export const SEED_SQL = [
  ins("hospitals", hospitals),
  ins("payors", payors),
  ins("patients", patients),
  ins("claims", claims),
  ins("payor_rules", payorRules),
  ins("denial_codes", denialCodes),
  ins("email_threads", threads),
  ins("cashflow_days", cashflow),
  ins("pipeline_buckets", pipeline),
  ins("eligibility_checks", eligibilityChecks),
  ins("denials", denials),
  ins("appeal_drafts", appealDrafts),
  ins("clearances", clearances),
  ins("inpatients", inpatients),
  ins("claims", docDrivenClaims),
  // P5 deep-seed showcase group — four patients across the intended demo variants.
  ins("claims", deepClaims),
  ins("denials", deepDenials),
  ins("appeal_drafts", deepAppealDrafts),
  ins("gl_submissions", glSubmissions),
  ins("email_threads", patientThreads),
  ins("uploaded_docs", deepUploadedDocs),
].join("\n");
