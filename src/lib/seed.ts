// Schema + seed for the RCM prototype, persisted in browser via sql.js.
// Cendana Health Group — 4 hospitals across Indonesia.
// Three payors: BPJS Kesehatan (gov), AIA Indonesia (private), Allianz Care (private).

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
  national_id TEXT, policy_number TEXT, payor_id TEXT, ward_class TEXT
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY, patient_id TEXT, payor_id TEXT, hospital_id TEXT, drg TEXT, dx TEXT,
  los_days INTEGER, gross_idr INTEGER, expected_reimb_idr INTEGER, deposit_idr INTEGER,
  status TEXT, stage TEXT, days_in_stage INTEGER,
  submitted_at TEXT, paid_at TEXT, denial_reason TEXT,
  acceptance_score REAL, predicted_dtp_days INTEGER, agent_step TEXT, risk_flag TEXT
);
CREATE TABLE IF NOT EXISTS payor_rules (
  id TEXT PRIMARY KEY, payor_id TEXT, drg_pattern TEXT, kind TEXT,
  description TEXT, evidence_threads INTEGER, lift_pct REAL
);
CREATE TABLE IF NOT EXISTS email_threads (
  id TEXT PRIMARY KEY, payor_id TEXT, subject TEXT, sender TEXT,
  excerpt TEXT, body TEXT, highlight TEXT, outcome TEXT, learned_rule TEXT, ts TEXT
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
  { id: "h1", name: "Cendana Jakarta", city: "Jakarta", country: "ID", beds: 320 },
  { id: "h2", name: "Cendana Surabaya", city: "Surabaya", country: "ID", beds: 240 },
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
    id: "alli",
    name: "Allianz Care",
    kind: "private",
    country: "ID",
    clean_claim_rate: 0.78,
    avg_dtp_days: 27,
    denial_rate: 0.14,
    threads_ingested: 1_604,
    monthly_volume_idr: 4_200_000_000,
    color: "#a78bfa",
  },
];

// Patients — 28 total across the 4 sites
const patients = [
  { id: "p1", mrn: "MRN-734291", name: "Sari Wulandari", age: 47, sex: "F", national_id: "317301**********", policy_number: "0001-2099-447-188", payor_id: "bpjs", ward_class: "Class I" },
  { id: "p2", mrn: "MRN-734302", name: "Budi Hartono", age: 62, sex: "M", national_id: "317304**********", policy_number: "AIA-IDN-22-118-901", payor_id: "aia", ward_class: "Private" },
  { id: "p3", mrn: "MRN-734318", name: "Putri Anggraini", age: 34, sex: "F", national_id: "317306**********", policy_number: "0001-2031-901-882", payor_id: "bpjs", ward_class: "Class II" },
  { id: "p4", mrn: "MRN-734341", name: "Joko Mulyadi", age: 58, sex: "M", national_id: "317308**********", policy_number: "ALLI-44-998-122", payor_id: "alli", ward_class: "Private" },
  { id: "p5", mrn: "MRN-734362", name: "Aditya Pratama", age: 51, sex: "M", national_id: "351002**********", policy_number: "0001-3122-118-441", payor_id: "bpjs", ward_class: "Class I" },
  { id: "p6", mrn: "MRN-734381", name: "Dian Kusuma", age: 39, sex: "F", national_id: "351008**********", policy_number: "AIA-IDN-22-309-117", payor_id: "aia", ward_class: "Private" },
  { id: "p7", mrn: "MRN-734395", name: "Reza Firmansyah", age: 66, sex: "M", national_id: "320409**********", policy_number: "0001-4471-002-919", payor_id: "bpjs", ward_class: "Class II" },
  { id: "p8", mrn: "MRN-734410", name: "Yulia Sari", age: 28, sex: "F", national_id: "320411**********", policy_number: "0001-4499-018-220", payor_id: "bpjs", ward_class: "Class III" },
  { id: "p9", mrn: "MRN-734428", name: "Wahyu Santoso", age: 54, sex: "M", national_id: "121707**********", policy_number: "ALLI-44-991-770", payor_id: "alli", ward_class: "Private" },
  { id: "p10", mrn: "MRN-734441", name: "Indah Permata", age: 43, sex: "F", national_id: "121711**********", policy_number: "AIA-IDN-22-622-441", payor_id: "aia", ward_class: "Private" },
  { id: "p11", mrn: "MRN-734457", name: "Krisna Wijaya", age: 71, sex: "M", national_id: "317314**********", policy_number: "0001-5510-117-228", payor_id: "bpjs", ward_class: "Class I" },
  { id: "p12", mrn: "MRN-734471", name: "Lestari Dewi", age: 36, sex: "F", national_id: "351019**********", policy_number: "0001-5571-208-039", payor_id: "bpjs", ward_class: "Class II" },
  { id: "p13", mrn: "MRN-734489", name: "Hadi Nugroho", age: 49, sex: "M", national_id: "317320**********", policy_number: "AIA-IDN-22-880-117", payor_id: "aia", ward_class: "Private" },
  { id: "p14", mrn: "MRN-734502", name: "Rini Setiawati", age: 31, sex: "F", national_id: "320418**********", policy_number: "0001-6620-441-552", payor_id: "bpjs", ward_class: "Class I" },
  { id: "p15", mrn: "MRN-734518", name: "Bayu Anggara", age: 45, sex: "M", national_id: "317329**********", policy_number: "ALLI-44-110-882", payor_id: "alli", ward_class: "Private" },
  { id: "p16", mrn: "MRN-734534", name: "Citra Maharani", age: 53, sex: "F", national_id: "351027**********", policy_number: "0001-7741-002-118", payor_id: "bpjs", ward_class: "Class II" },
  { id: "p17", mrn: "MRN-734549", name: "Eko Saputra", age: 60, sex: "M", national_id: "121719**********", policy_number: "AIA-IDN-22-901-330", payor_id: "aia", ward_class: "Private" },
  { id: "p18", mrn: "MRN-734564", name: "Maya Hartati", age: 41, sex: "F", national_id: "320424**********", policy_number: "0001-8870-118-449", payor_id: "bpjs", ward_class: "Class I" },
  { id: "p19", mrn: "MRN-734578", name: "Faisal Rahman", age: 56, sex: "M", national_id: "317336**********", policy_number: "ALLI-44-330-119", payor_id: "alli", ward_class: "Private" },
  { id: "p20", mrn: "MRN-734591", name: "Devi Lestari", age: 33, sex: "F", national_id: "351034**********", policy_number: "0001-9921-441-118", payor_id: "bpjs", ward_class: "Class II" },
  { id: "p21", mrn: "MRN-734604", name: "Arif Hidayat", age: 48, sex: "M", national_id: "121723**********", policy_number: "AIA-IDN-22-117-880", payor_id: "aia", ward_class: "Private" },
  { id: "p22", mrn: "MRN-734618", name: "Nina Yuliani", age: 38, sex: "F", national_id: "320431**********", policy_number: "0001-2210-001-117", payor_id: "bpjs", ward_class: "Class I" },
  { id: "p23", mrn: "MRN-734631", name: "Bagus Pradana", age: 64, sex: "M", national_id: "317344**********", policy_number: "ALLI-44-228-117", payor_id: "alli", ward_class: "Private" },
  { id: "p24", mrn: "MRN-734647", name: "Rara Anjani", age: 29, sex: "F", national_id: "351041**********", policy_number: "0001-3340-119-228", payor_id: "bpjs", ward_class: "Class III" },
  { id: "p25", mrn: "MRN-734660", name: "Galih Prasetya", age: 52, sex: "M", national_id: "317352**********", policy_number: "AIA-IDN-22-558-117", payor_id: "aia", ward_class: "Private" },
  { id: "p26", mrn: "MRN-734674", name: "Sinta Andini", age: 44, sex: "F", national_id: "320438**********", policy_number: "0001-4470-119-552", payor_id: "bpjs", ward_class: "Class II" },
  { id: "p27", mrn: "MRN-734687", name: "Pandu Wirawan", age: 67, sex: "M", national_id: "121728**********", policy_number: "ALLI-44-447-002", payor_id: "alli", ward_class: "Private" },
  { id: "p28", mrn: "MRN-734702", name: "Maharani Indah", age: 35, sex: "F", national_id: "317359**********", policy_number: "0001-5580-118-441", payor_id: "bpjs", ward_class: "Class I" },
];

// Stage taxonomy: BUILDING · AWAITING_PREAUTH · READY · SUBMITTED · AT_RISK · DENIED · PAID
// 28 claims spread across the chain
const claims = [
  // BUILDING (4) — agents reasoning right now
  { id: "c1", patient_id: "p1", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-13-I", dx: "Laparoscopic hysterectomy · endometriosis (N80.9)", los_days: 4, gross_idr: 38_400_000, expected_reimb_idr: 32_900_000, deposit_idr: 2_500_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.92, predicted_dtp_days: 11, agent_step: "Composing packet · 12 artifacts", risk_flag: null },
  { id: "c5", patient_id: "p5", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy · acute (K35.8)", los_days: 2, gross_idr: 18_700_000, expected_reimb_idr: 16_200_000, deposit_idr: 1_500_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 13, agent_step: "Pulling OT record + anaesthesia log", risk_flag: null },
  { id: "c6", patient_id: "p6", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · stable angina (I20.0)", los_days: 2, gross_idr: 138_900_000, expected_reimb_idr: 124_400_000, deposit_idr: 6_000_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.79, predicted_dtp_days: 17, agent_step: "Drafting SYNTAX score worksheet", risk_flag: null },
  { id: "c7", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG E-4-10-I", dx: "Severe community-acquired pneumonia (J18.9)", los_days: 6, gross_idr: 27_600_000, expected_reimb_idr: 22_800_000, deposit_idr: 1_500_000, status: "BUILDING", stage: "BUILDING", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.74, predicted_dtp_days: 18, agent_step: "Auto-coding ICD-10 from progress notes", risk_flag: null },

  // AWAITING_PREAUTH (5) — submitted, waiting on insurer
  { id: "c8", patient_id: "p8", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "Elective C-section · breech (O64)", los_days: 3, gross_idr: 22_400_000, expected_reimb_idr: 19_100_000, deposit_idr: 1_500_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 1, submitted_at: "2026-05-02T09:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.83, predicted_dtp_days: 16, agent_step: "Pre-auth ack · awaiting approval", risk_flag: null },
  { id: "c9", patient_id: "p9", payor_id: "alli", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Right THR · OA hip (M16.1)", los_days: 5, gross_idr: 198_400_000, expected_reimb_idr: 178_900_000, deposit_idr: 14_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 2, submitted_at: "2026-05-01T14:32:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.71, predicted_dtp_days: 22, agent_step: "Implant lot match verified · pending PA", risk_flag: null },
  { id: "c10", patient_id: "p10", payor_id: "aia", hospital_id: "h2", drg: "PRIV-ONCO-CHEMO-D", dx: "Cycle 4 · breast Ca chemo (C50.9)", los_days: 1, gross_idr: 41_200_000, expected_reimb_idr: 38_700_000, deposit_idr: 2_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 0, submitted_at: "2026-05-03T10:15:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 10, agent_step: "Treatment-protocol ref attached", risk_flag: null },
  { id: "c11", patient_id: "p11", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-2-13-I", dx: "TURP · BPH (N40)", los_days: 3, gross_idr: 31_500_000, expected_reimb_idr: 27_200_000, deposit_idr: 2_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 3, submitted_at: "2026-04-30T11:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.77, predicted_dtp_days: 19, agent_step: "PA aging · auto-followup queued", risk_flag: "AGING_PA" },
  { id: "c12", patient_id: "p12", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", los_days: 4, gross_idr: 26_800_000, expected_reimb_idr: 22_400_000, deposit_idr: 2_000_000, status: "AWAITING_PREAUTH", stage: "AWAITING_PREAUTH", days_in_stage: 1, submitted_at: "2026-05-02T15:21:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.81, predicted_dtp_days: 17, agent_step: "MRI evidence attached", risk_flag: null },

  // READY (3) — passed scrubbing, awaiting human submit
  { id: "c13", patient_id: "p13", payor_id: "aia", hospital_id: "h1", drg: "PRIV-NEURO-CRANI", dx: "Elective craniotomy · meningioma (D32.0)", los_days: 7, gross_idr: 312_700_000, expected_reimb_idr: 281_400_000, deposit_idr: 22_000_000, status: "READY", stage: "READY", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.94, predicted_dtp_days: 14, agent_step: "Ready · 0 critical · 1 advisory", risk_flag: null },
  { id: "c14", patient_id: "p14", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG K-1-14-I", dx: "Open cholecystectomy · cholelithiasis (K80)", los_days: 4, gross_idr: 24_900_000, expected_reimb_idr: 21_400_000, deposit_idr: 1_500_000, status: "READY", stage: "READY", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.91, predicted_dtp_days: 12, agent_step: "Ready for review", risk_flag: null },
  { id: "c15", patient_id: "p15", payor_id: "alli", hospital_id: "h4", drg: "PRIV-ORTHO-TKR", dx: "Left TKR · OA knee (M17.1)", los_days: 5, gross_idr: 172_300_000, expected_reimb_idr: 154_800_000, deposit_idr: 12_000_000, status: "READY", stage: "READY", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.89, predicted_dtp_days: 18, agent_step: "Ready · implant lot verified", risk_flag: null },

  // SUBMITTED (8) — in payor adjudication
  { id: "c2", patient_id: "p2", payor_id: "aia", hospital_id: "h1", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · NSTEMI (I21.4)", los_days: 3, gross_idr: 142_300_000, expected_reimb_idr: 128_700_000, deposit_idr: 8_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 4, submitted_at: "2026-04-29T11:14:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.91, predicted_dtp_days: 19, agent_step: "Acknowledged · adjudication", risk_flag: null },
  { id: "c16", patient_id: "p16", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-13-I", dx: "Total abdominal hysterectomy · adenomyosis", los_days: 5, gross_idr: 35_200_000, expected_reimb_idr: 30_100_000, deposit_idr: 2_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 7, submitted_at: "2026-04-26T09:30:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 13, agent_step: "Adjudicated · awaiting payment", risk_flag: null },
  { id: "c17", patient_id: "p17", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Multi-vessel PCI · STEMI (I21.0)", los_days: 4, gross_idr: 218_500_000, expected_reimb_idr: 197_800_000, deposit_idr: 12_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 3, submitted_at: "2026-04-30T17:11:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.93, predicted_dtp_days: 17, agent_step: "Acknowledged", risk_flag: null },
  { id: "c18", patient_id: "p18", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy", los_days: 2, gross_idr: 17_900_000, expected_reimb_idr: 15_400_000, deposit_idr: 1_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 5, submitted_at: "2026-04-28T13:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 11, agent_step: "Adjudicated", risk_flag: null },
  { id: "c19", patient_id: "p19", payor_id: "alli", hospital_id: "h2", drg: "PRIV-ORTHO-TKR", dx: "Bilateral TKR staged · OA knee", los_days: 7, gross_idr: 285_400_000, expected_reimb_idr: 256_800_000, deposit_idr: 18_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 6, submitted_at: "2026-04-27T10:45:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.84, predicted_dtp_days: 22, agent_step: "Acknowledged · 1 query open", risk_flag: null },
  { id: "c20", patient_id: "p20", payor_id: "bpjs", hospital_id: "h4", drg: "INA-CBG O-6-10-I", dx: "Emergency C-section · fetal distress (O68)", los_days: 3, gross_idr: 19_400_000, expected_reimb_idr: 16_800_000, deposit_idr: 1_500_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 9, submitted_at: "2026-04-24T07:00:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.82, predicted_dtp_days: 14, agent_step: "Adjudicated · DRG accepted", risk_flag: null },
  { id: "c21", patient_id: "p21", payor_id: "aia", hospital_id: "h1", drg: "PRIV-NEURO-CRANI", dx: "Craniotomy · glioblastoma (C71.9)", los_days: 9, gross_idr: 348_900_000, expected_reimb_idr: 312_500_000, deposit_idr: 25_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 8, submitted_at: "2026-04-25T16:20:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.87, predicted_dtp_days: 23, agent_step: "Adjudicated · pending oncology review", risk_flag: null },
  { id: "c22", patient_id: "p22", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-14-I", dx: "Open cholecystectomy + CBD exploration", los_days: 5, gross_idr: 28_700_000, expected_reimb_idr: 24_600_000, deposit_idr: 2_000_000, status: "SUBMITTED", stage: "SUBMITTED", days_in_stage: 2, submitted_at: "2026-05-01T08:15:00Z", paid_at: null, denial_reason: null, acceptance_score: 0.85, predicted_dtp_days: 13, agent_step: "Acknowledged", risk_flag: null },

  // AT_RISK (4) — low confidence, flagged for human attention
  { id: "c23", patient_id: "p23", payor_id: "alli", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Revision THR · prosthetic loosening (T84.030)", los_days: 8, gross_idr: 248_700_000, expected_reimb_idr: 198_900_000, deposit_idr: 18_000_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.42, predicted_dtp_days: 28, agent_step: "Pre-auth implant model mismatch", risk_flag: "PA_MISMATCH" },
  { id: "c24", patient_id: "p24", payor_id: "bpjs", hospital_id: "h4", drg: "INA-CBG O-6-13-I", dx: "TLH · endometriosis · no MRI on file", los_days: 4, gross_idr: 36_800_000, expected_reimb_idr: 31_200_000, deposit_idr: 2_500_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 2, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.51, predicted_dtp_days: 26, agent_step: "Missing MRI · rule r1 unmet", risk_flag: "MISSING_DOC" },
  { id: "c25", patient_id: "p25", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "PCI · NSTEMI · no SYNTAX", los_days: 3, gross_idr: 156_400_000, expected_reimb_idr: 118_900_000, deposit_idr: 9_000_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 1, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.58, predicted_dtp_days: 24, agent_step: "Missing SYNTAX score · rule r5 unmet", risk_flag: "MISSING_DOC" },
  { id: "c26", patient_id: "p26", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG E-4-10-I", dx: "Pneumonia · LOS exceeds DRG cap by 2d", los_days: 9, gross_idr: 33_200_000, expected_reimb_idr: 23_800_000, deposit_idr: 1_500_000, status: "AT_RISK", stage: "AT_RISK", days_in_stage: 0, submitted_at: null, paid_at: null, denial_reason: null, acceptance_score: 0.49, predicted_dtp_days: 30, agent_step: "LOS variance · extension request drafted", risk_flag: "LOS_VARIANCE" },

  // Closed (paid + denied) — historical context
  { id: "c3", patient_id: "p3", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "C-section · primigravida (O82)", los_days: 3, gross_idr: 21_900_000, expected_reimb_idr: 18_600_000, deposit_idr: 1_500_000, status: "PAID", stage: "PAID", days_in_stage: 0, submitted_at: "2026-04-12T08:11:00Z", paid_at: "2026-04-26T10:00:00Z", denial_reason: null, acceptance_score: 0.88, predicted_dtp_days: 14, agent_step: null, risk_flag: null },
  { id: "c27", patient_id: "p27", payor_id: "alli", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · post-op (M17.1)", los_days: 5, gross_idr: 168_500_000, expected_reimb_idr: 152_300_000, deposit_idr: 12_000_000, status: "PAID", stage: "PAID", days_in_stage: 0, submitted_at: "2026-04-08T09:32:00Z", paid_at: "2026-04-29T14:18:00Z", denial_reason: null, acceptance_score: 0.91, predicted_dtp_days: 21, agent_step: null, risk_flag: null },
  { id: "c4", patient_id: "p4", payor_id: "alli", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee (M17.1)", los_days: 5, gross_idr: 168_500_000, expected_reimb_idr: 0, deposit_idr: 12_000_000, status: "DENIED", stage: "DENIED", days_in_stage: 0, submitted_at: "2026-04-08T09:32:00Z", paid_at: null, denial_reason: "Pre-auth scope mismatch — implant not pre-approved", acceptance_score: 0.36, predicted_dtp_days: null, agent_step: null, risk_flag: null },
  { id: "c28", patient_id: "p28", payor_id: "bpjs", hospital_id: "h2", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", los_days: 4, gross_idr: 24_700_000, expected_reimb_idr: 21_300_000, deposit_idr: 2_000_000, status: "PAID", stage: "PAID", days_in_stage: 0, submitted_at: "2026-04-15T11:00:00Z", paid_at: "2026-04-30T09:00:00Z", denial_reason: null, acceptance_score: 0.86, predicted_dtp_days: 15, agent_step: null, risk_flag: null },
];

const payorRules = [
  { id: "r1", payor_id: "bpjs", drg_pattern: "INA-CBG O-6-13", kind: "documentation", description: "Attach pre-op pelvic MRI report alongside ultrasound — MRI presence raises pass rate by 11.4 pts on this DRG cluster.", evidence_threads: 184, lift_pct: 0.114 },
  { id: "r2", payor_id: "bpjs", drg_pattern: "INA-CBG O-6-13", kind: "narrative", description: "Lead with conservative-management failure narrative (≥6 months hormonal therapy). Without this, denials cite 'medical necessity not established'.", evidence_threads: 213, lift_pct: 0.083 },
  { id: "r3", payor_id: "bpjs", drg_pattern: "INA-CBG *", kind: "format", description: "SEP number must appear on page 1, top-right. Threads with SEP in body or page 2 saw 22% reject-on-receipt.", evidence_threads: 612, lift_pct: 0.062 },
  { id: "r4", payor_id: "aia", drg_pattern: "PRIV-CARDIO-*", kind: "documentation", description: "Specialist endorsement note (board-certified cardiologist) materially shifts adjudication — peers without endorsement see 28% partial-pay.", evidence_threads: 142, lift_pct: 0.097 },
  { id: "r5", payor_id: "aia", drg_pattern: "PRIV-CARDIO-PCI-*", kind: "evidence", description: "Attach SYNTAX score worksheet for any single- or multi-vessel PCI claim. Improves first-pass acceptance from 71% to 89% historically.", evidence_threads: 89, lift_pct: 0.18 },
  { id: "r6", payor_id: "alli", drg_pattern: "PRIV-ORTHO-TKR", kind: "pre-auth", description: "Implant brand + model + lot must match pre-auth letter exactly. Substitution without addendum is the #1 denial reason on this DRG.", evidence_threads: 67, lift_pct: 0.21 },
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
    outcome: "approved_after_mri", learned_rule: "r1", ts: "2026-04-21T09:14:00Z" },
  { id: "t1b", payor_id: "bpjs", subject: "Klaim 2026-04-118 — disetujui setelah resubmit MRI", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…setelah lampiran MRI pelvis tertanggal 2026-04-12 diterima, klaim diadjudikasi ulang dan disetujui penuh…",
    body: "Yth. RS Cendana Surabaya,\n\nKlaim 2026-04-118 atas nama pasien dengan DRG INA-CBG O-6-13-I telah diadjudikasi ulang. Setelah lampiran MRI pelvis tertanggal 2026-04-12 diterima, klaim diadjudikasi ulang dan disetujui penuh sebesar IDR 34.100.000.\n\nMohon mempertahankan praktik melampirkan MRI untuk DRG O-6-13 cluster guna menghindari delay adjudikasi.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "lampiran MRI pelvis",
    outcome: "approved_after_mri", learned_rule: "r1", ts: "2026-04-14T08:11:00Z" },
  { id: "t1c", payor_id: "bpjs", subject: "Klaim ditolak — D25 myomectomy — MRI tidak ada", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…hanya hasil USG abdomen yang dilampirkan. MRI pelvis pra-operasi adalah lampiran wajib pada cluster DRG ini…",
    body: "Yth. RS Cendana Bandung,\n\nKlaim atas tindakan myomectomy ditolak. Hanya hasil USG abdomen yang dilampirkan. MRI pelvis pra-operasi adalah lampiran wajib pada cluster DRG ini sesuai pedoman 2024.\n\nMohon resubmisi dengan kelengkapan MRI agar adjudikasi dapat dilakukan.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "MRI pelvis pra-operasi adalah lampiran wajib pada cluster DRG ini",
    outcome: "denied", learned_rule: "r1", ts: "2026-04-08T15:42:00Z" },

  // ── r2 · BPJS · conservative-management failure narrative ────────────────
  { id: "t2", payor_id: "bpjs", subject: "Klaim ditolak — N80.9 — Cendana", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…medical necessity tidak terpenuhi. Mohon disertakan riwayat terapi hormonal minimal 6 bulan sebelum operasi…",
    body: "Yth. RS Cendana Jakarta,\n\nKlaim ditolak atas dasar adjudikasi klinis. Medical necessity tidak terpenuhi. Mohon disertakan riwayat terapi hormonal minimal 6 bulan sebelum operasi sebagai bukti kegagalan terapi konservatif (per pedoman PERKUMI 2024 §3.2).\n\nResubmisi dapat dilakukan dengan narasi kegagalan terapi konservatif sebagai pembuka berkas.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "riwayat terapi hormonal minimal 6 bulan sebelum operasi",
    outcome: "denied_resubmitted_won", learned_rule: "r2", ts: "2026-03-30T11:02:00Z" },
  { id: "t2b", payor_id: "bpjs", subject: "Re: Klaim 2026-04-201 — narasi konservatif diterima", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…dengan narasi kegagalan 8 bulan terapi hormonal di awal berkas, klaim diadjudikasi penuh. Praktik baik untuk dipertahankan…",
    body: "Yth. RS Cendana Jakarta,\n\nKlaim 2026-04-201 (Dx N80.9, DRG O-6-13-I) telah diadjudikasi penuh. Dengan narasi kegagalan 8 bulan terapi hormonal di awal berkas, klaim diadjudikasi penuh. Praktik baik untuk dipertahankan pada cluster DRG ini.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "narasi kegagalan 8 bulan terapi hormonal di awal berkas",
    outcome: "approved", learned_rule: "r2", ts: "2026-04-19T10:48:00Z" },
  { id: "t2c", payor_id: "bpjs", subject: "Klaim ditolak — N80.0 — Cendana Medan", sender: "klaim.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…tidak ditemukan dokumentasi kegagalan terapi konservatif. Necessity tidak dapat ditegakkan tanpa hal tersebut…",
    body: "Yth. RS Cendana Medan,\n\nKlaim hysterektomi atas dasar endometriosis ditolak. Tidak ditemukan dokumentasi kegagalan terapi konservatif. Necessity tidak dapat ditegakkan tanpa hal tersebut.\n\nMohon resubmisi dengan riwayat terapi yang terdokumentasi.\n\nSalam,\nTim Adjudikasi BPJS Kesehatan",
    highlight: "kegagalan terapi konservatif",
    outcome: "denied", learned_rule: "r2", ts: "2026-04-05T13:21:00Z" },

  // ── r3 · BPJS · SEP page-1 top-right format ──────────────────────────────
  { id: "t3a", payor_id: "bpjs", subject: "Berkas ditolak pada penerimaan — SEP tidak terbaca", sender: "berkas.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…SEP number tidak ditemukan pada halaman 1 bagian kanan-atas. Berkas dikembalikan tanpa adjudikasi…",
    body: "Yth. RS Cendana Jakarta,\n\nBerkas klaim 2026-03-921 dikembalikan pada tahap intake. SEP number tidak ditemukan pada halaman 1 bagian kanan-atas. Berkas dikembalikan tanpa adjudikasi.\n\nMohon perbaikan format dan pengajuan ulang.\n\nSalam,\nTim Penerimaan Berkas BPJS",
    highlight: "SEP number tidak ditemukan pada halaman 1 bagian kanan-atas",
    outcome: "denied", learned_rule: "r3", ts: "2026-03-18T14:02:00Z" },
  { id: "t3b", payor_id: "bpjs", subject: "Berkas diterima — SEP placement OK", sender: "berkas.bpjs@bpjs-kesehatan.go.id",
    excerpt: "…SEP terbaca pada header halaman 1, berkas masuk antrian adjudikasi standar (TAT 4-7 hari)…",
    body: "Yth. RS Cendana Surabaya,\n\nBerkas klaim 2026-04-009 diterima. SEP terbaca pada header halaman 1, berkas masuk antrian adjudikasi standar (TAT 4-7 hari).\n\nSalam,\nTim Penerimaan Berkas BPJS",
    highlight: "SEP terbaca pada header halaman 1",
    outcome: "approved", learned_rule: "r3", ts: "2026-04-02T09:18:00Z" },

  // ── r4 · AIA · specialist endorsement note ───────────────────────────────
  { id: "t3", payor_id: "aia", subject: "RE: Claim 22-IDN-49901 NSTEMI PCI — partial payment", sender: "claims.id@aia.com",
    excerpt: "…we have applied a 22% line reduction in the absence of a board-certified cardiologist endorsement note for the procedure.",
    body: "Dear Cendana Jakarta TPA Desk,\n\nClaim 22-IDN-49901 (NSTEMI · single-vessel PCI) has been adjudicated with adjustment. We have applied a 22% line reduction in the absence of a board-certified cardiologist endorsement note for the procedure.\n\nSubsequent submissions on this claim cluster should include the endorsement note signed by a board-certified specialist. Reconsideration is possible upon receipt.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "22% line reduction in the absence of a board-certified cardiologist endorsement note",
    outcome: "partial_paid", learned_rule: "r4", ts: "2026-04-02T16:21:00Z" },
  { id: "t4b", payor_id: "aia", subject: "Claim 22-IDN-50402 — endorsement received, paid full", sender: "claims.id@aia.com",
    excerpt: "…thank you for the cardiologist endorsement letter (Dr. Riza Anandita, SpJP). Claim adjudicated at full contracted rate…",
    body: "Dear Cendana Jakarta TPA Desk,\n\nReferring to claim 22-IDN-50402 (PRIV-CARDIO-PCI-S). Thank you for the cardiologist endorsement letter (Dr. Riza Anandita, SpJP). Claim adjudicated at full contracted rate without line reduction.\n\nKindly continue this practice on PRIV-CARDIO-* cluster going forward.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "thank you for the cardiologist endorsement letter (Dr. Riza Anandita, SpJP)",
    outcome: "approved", learned_rule: "r4", ts: "2026-04-22T12:08:00Z" },
  { id: "t4c", payor_id: "aia", subject: "Claim 22-IDN-49788 — partial · no specialist sign-off", sender: "claims.id@aia.com",
    excerpt: "…procedure note signed by general physician only. AIA cardiology coverage policy 4.2 requires specialist endorsement for full pay…",
    body: "Dear Cendana Bandung TPA Desk,\n\nClaim 22-IDN-49788 has been part-paid. Procedure note signed by general physician only. AIA cardiology coverage policy 4.2 requires specialist endorsement for full pay.\n\nReconsideration available upon receipt of board-certified specialist endorsement.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "AIA cardiology coverage policy 4.2 requires specialist endorsement for full pay",
    outcome: "partial_paid", learned_rule: "r4", ts: "2026-03-28T15:54:00Z" },

  // ── r5 · AIA · SYNTAX score worksheet for PCI ────────────────────────────
  { id: "t4", payor_id: "aia", subject: "Claim approved — 22-IDN-50117", sender: "claims.id@aia.com",
    excerpt: "…thank you for the SYNTAX score worksheet, claim approved at full contracted rate.",
    body: "Dear Cendana Jakarta TPA Desk,\n\nClaim 22-IDN-50117 (PRIV-CARDIO-PCI-S) has been adjudicated. Thank you for the SYNTAX score worksheet, claim approved at full contracted rate.\n\nKindly continue including the SYNTAX score worksheet on PCI submissions.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "thank you for the SYNTAX score worksheet, claim approved at full contracted rate",
    outcome: "approved", learned_rule: "r5", ts: "2026-04-18T14:49:00Z" },
  { id: "t5b", payor_id: "aia", subject: "Claim 22-IDN-49502 — SYNTAX missing — denied", sender: "claims.id@aia.com",
    excerpt: "…multi-vessel PCI submission lacks the SYNTAX score worksheet. Coverage policy 4.2 lists this as required evidence…",
    body: "Dear Cendana Jakarta TPA Desk,\n\nClaim 22-IDN-49502 has been denied. Multi-vessel PCI submission lacks the SYNTAX score worksheet. Coverage policy 4.2 lists this as required evidence for adjudication.\n\nResubmission with the worksheet is encouraged.\n\nRegards,\nAIA Indonesia · Claims Adjudication",
    highlight: "lacks the SYNTAX score worksheet",
    outcome: "denied", learned_rule: "r5", ts: "2026-03-12T09:33:00Z" },

  // ── r6 · Allianz · implant brand+model+lot must match pre-auth ───────────
  { id: "t5", payor_id: "alli", subject: "Denial notice — 44-IDN-22812 — TKR", sender: "claims.id@allianz.com",
    excerpt: "…the implant model on the operative report does not match the pre-auth letter. Resubmit with addendum or expect denial.",
    body: "Dear Cendana Jakarta TPA Desk,\n\nReferring to claim 44-IDN-22812 (Total Knee Replacement). The implant model on the operative report does not match the pre-auth letter. PA-66102 lists 'Smith+Nephew Genesis II PS', operative note records 'Genesis II CR'.\n\nResubmit with addendum or expect denial. Implant substitution within manufacturer family is acceptable per Coverage Schedule §7.3 *only* if filed as an addendum within 14 days.\n\nRegards,\nAllianz Care Indonesia · Claims",
    highlight: "implant model on the operative report does not match the pre-auth letter",
    outcome: "denied", learned_rule: "r6", ts: "2026-03-22T10:11:00Z" },
  { id: "t6b", payor_id: "alli", subject: "Claim 44-IDN-22904 — addendum accepted", sender: "claims.id@allianz.com",
    excerpt: "…addendum filed within the 14-day window with new implant lot 70-9912. Claim approved at contracted rate…",
    body: "Dear Cendana Jakarta TPA Desk,\n\nReferring to claim 44-IDN-22904 (Total Knee Replacement). Addendum filed within the 14-day window with new implant lot 70-9912. Claim approved at contracted rate.\n\nThis is the expected pathway when intra-operative substitution is clinically necessary.\n\nRegards,\nAllianz Care Indonesia · Claims",
    highlight: "addendum filed within the 14-day window with new implant lot 70-9912",
    outcome: "approved", learned_rule: "r6", ts: "2026-04-11T11:55:00Z" },
  { id: "t6c", payor_id: "alli", subject: "Denial — 44-IDN-22988 — implant lot mismatch", sender: "claims.id@allianz.com",
    excerpt: "…lot number on operative report (lot 70-9921) does not match pre-auth (lot 70-9912). No addendum on file…",
    body: "Dear Cendana Surabaya TPA Desk,\n\nReferring to claim 44-IDN-22988. Lot number on operative report (lot 70-9921) does not match pre-auth (lot 70-9912). No addendum on file.\n\nClaim denied. Resubmit with addendum referencing the correct lot or expect repeat denial.\n\nRegards,\nAllianz Care Indonesia · Claims",
    highlight: "lot number on operative report (lot 70-9921) does not match pre-auth (lot 70-9912). No addendum on file",
    outcome: "denied", learned_rule: "r6", ts: "2026-04-03T13:42:00Z" },
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
  { id: "e8", patient_id: "p23", payor_id: "alli", hospital_id: "h1", status: "DISPUTED", source: "LIVE_API", started_at: "2026-05-03T10:08:41Z", completed_at: "2026-05-03T10:11:14Z", tat_seconds: 153, annual_limit_remaining_idr: 280_000_000, annual_limit_total_idr: 1_200_000_000, room_class_entitlement: "Private", pre_auth_required: 1, pre_auth_status: "MISMATCH", cob_primary_payor: "alli", dispute_risk_score: 0.71, exclusions_json: "[\"revision-implant-substitution\"]", scheduled_admission_at: "2026-05-03T13:00:00Z", planned_procedure: "PRIV-ORTHO-HIP" },
  { id: "e9", patient_id: "p24", payor_id: "bpjs", hospital_id: "h4", status: "ACTIVE", source: "LIVE_API", started_at: "2026-05-03T10:42:09Z", completed_at: "2026-05-03T10:43:18Z", tat_seconds: 69, annual_limit_remaining_idr: 32_500_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class III", pre_auth_required: 1, pre_auth_status: "PENDING", cob_primary_payor: "bpjs", dispute_risk_score: 0.18, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T14:00:00Z", planned_procedure: "INA-CBG O-6-13-I" },
  { id: "e10", patient_id: "p27", payor_id: "alli", hospital_id: "h1", status: "LAPSED", source: "LIVE_API", started_at: "2026-05-03T11:01:18Z", completed_at: "2026-05-03T11:02:31Z", tat_seconds: 73, annual_limit_remaining_idr: 0, annual_limit_total_idr: 1_000_000_000, room_class_entitlement: "Private", pre_auth_required: 0, pre_auth_status: "DECLINED", cob_primary_payor: null, dispute_risk_score: 0.93, exclusions_json: "[\"policy-lapsed-2026-04-28\"]", scheduled_admission_at: "2026-05-03T15:00:00Z", planned_procedure: "PRIV-ORTHO-TKR" },
  { id: "e11", patient_id: "p28", payor_id: "bpjs", hospital_id: "h2", status: "ACTIVE", source: "CACHED", started_at: "2026-05-03T11:18:02Z", completed_at: "2026-05-03T11:18:09Z", tat_seconds: 7, annual_limit_remaining_idr: 28_400_000, annual_limit_total_idr: 50_000_000, room_class_entitlement: "Class I", pre_auth_required: 1, pre_auth_status: "ATTACHED", cob_primary_payor: "bpjs", dispute_risk_score: 0.05, exclusions_json: "[]", scheduled_admission_at: "2026-05-03T16:00:00Z", planned_procedure: "INA-CBG O-6-15-I" },
  { id: "e12", patient_id: "p4", payor_id: "alli", hospital_id: "h1", status: "WAITING_PERIOD", source: "LIVE_API", started_at: "2026-05-03T11:34:17Z", completed_at: "2026-05-03T11:35:22Z", tat_seconds: 65, annual_limit_remaining_idr: 1_000_000_000, annual_limit_total_idr: 1_000_000_000, room_class_entitlement: "Private", pre_auth_required: 0, pre_auth_status: "BLOCKED · WAITING_PERIOD", cob_primary_payor: "alli", dispute_risk_score: 0.62, exclusions_json: "[\"36-month-waiting-period-pre-existing\"]", scheduled_admission_at: "2026-05-03T17:30:00Z", planned_procedure: "PRIV-ORTHO-TKR" },
];

// ── Denials (Module E) ─────────────────────────────────────────────────────
// 14 records spread across categories. Some have appeal_drafts.
const denials = [
  { id: "d1", claim_id: "c4", payor_id: "alli", hospital_id: "h1", category: "ADMINISTRATIVE", reason_code: "PA-MISMATCH-001", reason_text: "Pre-auth scope mismatch — implant model on operative report does not match pre-auth letter", denied_amount_idr: 168_500_000, denied_at: "2026-04-22T14:11:00Z", appeal_deadline_at: "2026-05-22T23:59:00Z", appeal_status: "DRAFTING", success_probability: 0.72, root_cause_step: "Pre-auth · implant lot not cross-checked", recurring_pattern_id: "rp1" },
  { id: "d2", claim_id: "c19", payor_id: "alli", hospital_id: "h2", category: "ADMINISTRATIVE", reason_code: "PA-MISSING-002", reason_text: "Pre-auth not on file for second-stage TKR", denied_amount_idr: 142_700_000, denied_at: "2026-04-30T11:21:00Z", appeal_deadline_at: "2026-05-30T23:59:00Z", appeal_status: "READY", success_probability: 0.66, root_cause_step: "Stage-2 PA not requested before procedure", recurring_pattern_id: null },
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
  { id: "d14", claim_id: "c9", payor_id: "alli", hospital_id: "h1", category: "ADMINISTRATIVE", reason_code: "ELIG-DISPUTE-4B", reason_text: "Patient eligibility disputed — payor records show coverage gap 2026-04-15 to 2026-04-20", denied_amount_idr: 198_400_000, denied_at: "2026-04-24T10:11:00Z", appeal_deadline_at: "2026-05-08T23:59:00Z", appeal_status: "LOST", success_probability: 0.21, root_cause_step: "Eligibility check · cached result was stale by 3 days", recurring_pattern_id: null },
];

// ── Appeal drafts (Module E) — drafted letters for some denials ────────────
const appealDrafts = [
  { id: "ad1", denial_id: "d1", letter_md: "**To:** Allianz Care Indonesia · Claims Adjudication\n**Re:** Claim 2026-04-08/c4 · Pre-auth implant model substitution\n\n**Background.** On 2026-04-08, Mr. Joko Mulyadi (MRN-734341, Policy ALLI-44-998-122) underwent right total knee arthroplasty at Cendana Jakarta. Pre-auth letter PA-66102 dated 2026-04-04 approved the procedure with implant model **Smith+Nephew Genesis II PS**. Intraoperative findings required substitution to **Genesis II CR** (lot 70-9912) due to ligament integrity confirmed only after exposure.\n\n**Argument.** Under Allianz Care Coverage Schedule §7.3, implant substitution within the same manufacturer family for clinical indication is a covered event, provided the substitution is documented in the operative note and an addendum is filed within 14 days. Both conditions are satisfied. The operative note (attached) states: *'Genesis II PS unsuitable due to PCL competence; CR variant placed.'* Addendum filed 2026-04-09 (3 days post-op).\n\n**Remedy requested.** Reverse denial in full and pay at contracted rate IDR 168,500,000.\n\n**Authoritative basis.** ASIPS-IPS Indonesia 2024 Position Statement on Intraoperative Implant Decision-Making.\n\n— Cendana Jakarta TPA Desk · drafted by TatvaCare agent · reviewed by Dr. Andi Permadi", attachments_json: "[\"OT-record-c4.pdf\",\"Implant-addendum-2026-04-09.pdf\",\"Coverage-Schedule-7-3.pdf\",\"ASIPS-IPS-2024-stmt.pdf\"]", drafted_at: "2026-05-03T08:42:00Z", submitted_at: null, outcome: null },
  { id: "ad2", denial_id: "d2", letter_md: "**To:** Allianz Care Indonesia\n**Re:** Claim 2026-04-30/c19 · Bilateral staged TKR · Pre-auth not on file\n\n**Background.** Mrs. Faisal's bilateral staged TKR was authorized as a single course under PA-66318 (2026-03-12). The pre-auth letter explicitly references *'staged bilateral, both knees, 60-day interval acceptable.'*\n\n**Argument.** The claim was rejected on the grounds that the second knee lacked its own PA. This contradicts the PA letter language. We attach the original PA, the operative note for both procedures, and the contract appendix §4.1 defining 'staged bilateral' as a single authorization event.\n\n**Remedy requested.** Reverse denial; pay second-stage at contracted rate IDR 142,700,000.", attachments_json: "[\"PA-66318.pdf\",\"OT-stage-1.pdf\",\"OT-stage-2.pdf\",\"Contract-appendix-4-1.pdf\"]", drafted_at: "2026-05-03T09:11:00Z", submitted_at: null, outcome: null },
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
  { id: "fc3", patient_id: "p5", payor_id: "bpjs", hospital_id: "h1", status: "PENDING", drg: "INA-CBG K-1-15-II", dx: "Laparoscopic appendectomy · acute (K35.8)", scheduled_admission_at: "2026-05-03T08:30:00Z", los_predicted: 2.1, los_ci_low: 1.5, los_ci_high: 3.0, episode_cost_idr: 18_700_000, expected_reimb_idr: 16_200_000, patient_liability_idr: 2_500_000, deposit_required_idr: 1_500_000, deposit_collected_idr: 0, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "DRAFTED", gop_letter_md: "**To:** BPJS Kesehatan · Klaim Adjudikasi\n**Re:** Pre-auth/GOP request · MRN-734362 · Aditya Pratama\n\n**Permintaan.** Mohon disetujui Letter of Guarantee (LOG) untuk laparoscopic appendectomy (K35.8) di RS Cendana Jakarta tanggal 2026-05-03. Estimasi biaya episode IDR 18.7 juta · estimasi reimbursement BPJS IDR 16.2 juta · liabilitas pasien IDR 2.5 juta.\n\n**Pendukung.**\n- Rujukan FKTP dilampirkan\n- USG abdomen confirms acute appendicitis with peri-appendiceal collection\n- WBC 18.2 · CRP 84\n\n**Kelas perawatan.** Class I sesuai kepesertaan PBPU.\n\n**Mohon konfirmasi LOG dalam 4 jam** untuk memungkinkan operasi same-day.\n\n— RS Cendana Jakarta · TPA desk · drafted by TatvaCare agent", consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":4200000,\"procedures\":9800000,\"drugs\":1600000,\"implants\":0,\"labs\":1800000,\"other\":1300000}" },
  // PCI Surabaya — cleared
  { id: "fc4", patient_id: "p6", payor_id: "aia", hospital_id: "h2", status: "CLEARED", drg: "PRIV-CARDIO-PCI-S", dx: "Single-vessel PCI · stable angina (I20.0)", scheduled_admission_at: "2026-05-03T09:00:00Z", los_predicted: 2.4, los_ci_low: 1.8, los_ci_high: 3.3, episode_cost_idr: 138_900_000, expected_reimb_idr: 124_400_000, patient_liability_idr: 14_500_000, deposit_required_idr: 6_000_000, deposit_collected_idr: 6_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T08:08:00Z", cost_breakdown_json: "{\"room\":16200000,\"procedures\":62100000,\"drugs\":9800000,\"implants\":36400000,\"labs\":4500000,\"other\":9900000}" },
  // Pneumonia BPJS Bandung — conditional, awaiting deposit waiver decision
  { id: "fc5", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", status: "CONDITIONAL", drg: "INA-CBG E-4-10-I", dx: "Severe community-acquired pneumonia (J18.9)", scheduled_admission_at: "2026-05-03T10:00:00Z", los_predicted: 6.4, los_ci_low: 4.8, los_ci_high: 9.1, episode_cost_idr: 27_600_000, expected_reimb_idr: 22_800_000, patient_liability_idr: 4_800_000, deposit_required_idr: 1_500_000, deposit_collected_idr: 0, bad_debt_risk_tier: "MEDIUM", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T09:10:00Z", cost_breakdown_json: "{\"room\":11800000,\"procedures\":4200000,\"drugs\":7900000,\"implants\":0,\"labs\":2200000,\"other\":1500000}" },
  // TURP Bandung — pending PA, deposit not collected, medium risk
  { id: "fc6", patient_id: "p11", payor_id: "bpjs", hospital_id: "h3", status: "PENDING", drg: "INA-CBG K-2-13-I", dx: "TURP · BPH (N40)", scheduled_admission_at: "2026-05-03T11:00:00Z", los_predicted: 3.0, los_ci_low: 2.4, los_ci_high: 4.0, episode_cost_idr: 31_500_000, expected_reimb_idr: 27_200_000, patient_liability_idr: 4_300_000, deposit_required_idr: 2_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "MEDIUM", payment_mode: "CASHLESS_INSURED", gop_status: "SUBMITTED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":7200000,\"procedures\":15400000,\"drugs\":3100000,\"implants\":0,\"labs\":2900000,\"other\":2900000}" },
  // Glioma craniotomy AIA — cleared, high cost
  { id: "fc7", patient_id: "p13", payor_id: "aia", hospital_id: "h1", status: "CLEARED", drg: "PRIV-NEURO-CRANI", dx: "Elective craniotomy · meningioma (D32.0)", scheduled_admission_at: "2026-05-03T11:30:00Z", los_predicted: 7.2, los_ci_low: 5.8, los_ci_high: 10.5, episode_cost_idr: 312_700_000, expected_reimb_idr: 281_400_000, patient_liability_idr: 31_300_000, deposit_required_idr: 22_000_000, deposit_collected_idr: 22_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T10:18:00Z", cost_breakdown_json: "{\"room\":48200000,\"procedures\":124800000,\"drugs\":31800000,\"implants\":68000000,\"labs\":12200000,\"other\":27700000}" },
  // Revision THR Allianz — disputed eligibility, NOT_CLEARED
  { id: "fc8", patient_id: "p23", payor_id: "alli", hospital_id: "h1", status: "NOT_CLEARED", drg: "PRIV-ORTHO-HIP", dx: "Revision THR · prosthetic loosening (T84.030)", scheduled_admission_at: "2026-05-03T13:00:00Z", los_predicted: 8.5, los_ci_low: 6.2, los_ci_high: 12.8, episode_cost_idr: 248_700_000, expected_reimb_idr: 180_400_000, patient_liability_idr: 68_300_000, deposit_required_idr: 35_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "HIGH", payment_mode: "CASHLESS_INSURED", gop_status: "REJECTED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":42500000,\"procedures\":78400000,\"drugs\":18900000,\"implants\":78000000,\"labs\":11400000,\"other\":19500000}" },
  // Walk-in BPJS — TLH without MRI on file (at risk on builder)
  { id: "fc9", patient_id: "p24", payor_id: "bpjs", hospital_id: "h4", status: "CONDITIONAL", drg: "INA-CBG O-6-13-I", dx: "TLH · endometriosis · no MRI on file", scheduled_admission_at: "2026-05-03T14:00:00Z", los_predicted: 4.0, los_ci_low: 3.0, los_ci_high: 5.5, episode_cost_idr: 36_800_000, expected_reimb_idr: 31_200_000, patient_liability_idr: 5_600_000, deposit_required_idr: 2_500_000, deposit_collected_idr: 1_500_000, bad_debt_risk_tier: "MEDIUM", payment_mode: "CASHLESS_INSURED", gop_status: "DRAFTED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":11200000,\"procedures\":17600000,\"drugs\":2800000,\"implants\":0,\"labs\":3400000,\"other\":1800000}" },
  // Lapsed Allianz — NOT_CLEARED, self-pay payment plan
  { id: "fc10", patient_id: "p27", payor_id: "alli", hospital_id: "h1", status: "NOT_CLEARED", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee (M17.1) — policy lapsed 2026-04-28", scheduled_admission_at: "2026-05-03T15:00:00Z", los_predicted: 5.1, los_ci_low: 4.0, los_ci_high: 7.0, episode_cost_idr: 168_500_000, expected_reimb_idr: 0, patient_liability_idr: 168_500_000, deposit_required_idr: 50_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "HIGH", payment_mode: "SELF_PAY", gop_status: "NOT_NEEDED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":18400000,\"procedures\":62500000,\"drugs\":11200000,\"implants\":48000000,\"labs\":9300000,\"other\":19100000}" },
  // BPJS myomectomy — cleared
  { id: "fc11", patient_id: "p28", payor_id: "bpjs", hospital_id: "h2", status: "CLEARED", drg: "INA-CBG O-6-15-I", dx: "Myomectomy · uterine fibroid (D25)", scheduled_admission_at: "2026-05-03T16:00:00Z", los_predicted: 4.0, los_ci_low: 3.2, los_ci_high: 5.4, episode_cost_idr: 24_700_000, expected_reimb_idr: 21_300_000, patient_liability_idr: 3_400_000, deposit_required_idr: 2_000_000, deposit_collected_idr: 2_000_000, bad_debt_risk_tier: "LOW", payment_mode: "CASHLESS_INSURED", gop_status: "APPROVED", gop_letter_md: null, consent_status: "SIGNED", consent_signed_at: "2026-05-03T14:55:00Z", cost_breakdown_json: "{\"room\":7200000,\"procedures\":10400000,\"drugs\":2800000,\"implants\":0,\"labs\":2100000,\"other\":2200000}" },
  // Waiting period Allianz — NOT_CLEARED, exclusion applies
  { id: "fc12", patient_id: "p4", payor_id: "alli", hospital_id: "h1", status: "NOT_CLEARED", drg: "PRIV-ORTHO-TKR", dx: "Right TKR · OA knee · in 36-month waiting period for pre-existing", scheduled_admission_at: "2026-05-03T17:30:00Z", los_predicted: 5.0, los_ci_low: 4.0, los_ci_high: 7.0, episode_cost_idr: 168_500_000, expected_reimb_idr: 0, patient_liability_idr: 168_500_000, deposit_required_idr: 50_000_000, deposit_collected_idr: 0, bad_debt_risk_tier: "HIGH", payment_mode: "SELF_PAY", gop_status: "NOT_NEEDED", gop_letter_md: null, consent_status: "PENDING", consent_signed_at: null, cost_breakdown_json: "{\"room\":18400000,\"procedures\":62500000,\"drugs\":11200000,\"implants\":48000000,\"labs\":9300000,\"other\":19100000}" },
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
  { id: "ip2", patient_id: "p7", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG E-4-10-I", dx: "Severe community-acquired pneumonia · awaiting cultures", ward_class: "Class II", attending_physician: "Dr. Maya Suharto", admission_date: "2026-04-27T15:30:00Z", day_of_stay: 6, authorized_days: 5, los_drg_benchmark: 5.8, los_variance_pct: 3.4, acuity: "WATCH", medical_necessity_score: 0.71, medical_necessity_gaps_json: "[\"Quantitative oxygen saturation trend not documented past day 4\",\"IV antibiotic continuation rationale lacks objective markers (CRP, WBC trend)\"]", auth_extension_status: "DRAFTED", auth_extension_letter_md: "**To:** BPJS Kesehatan · Utilisasi Manajemen\n**Re:** Permintaan perpanjangan otorisasi · MRN-734395 · Reza Firmansyah\n\n**Justifikasi klinis hari ke-7+.**\n\nPasien laki-laki 66 tahun dengan severe CAP (J18.9) telah dirawat sejak 2026-04-27 dengan terapi IV ceftriaxone + azithromycin. Status klinis hari ke-6:\n- SpO₂ 92% pada 2 LPM nasal · belum mencapai target 95% room air\n- WBC menurun dari 22 → 14 (hari ke-3 → hari ke-6) · masih di atas normal\n- CRP menurun dari 168 → 64 · positif tapi belum stabil\n- Demam intermiten · hari ke-5 puncak 38.4°C\n\n**Permintaan.** Perpanjangan 3 hari otorisasi (hingga 2026-05-06) untuk:\n1. Lanjutkan IV antibiotik sampai 5 hari afebris\n2. Step-down ke oral setelah CRP &lt; 30\n3. Rencana discharge dengan home antibiotic\n\n**Risiko jika discharge dini.** Tinggi · readmission rate untuk severe CAP discharged dengan CRP &gt; 50 adalah 18% dalam 7 hari (data internal Cendana Bandung 2024).\n\n— Dr. Maya Suharto, SpPD-KP · co-signed by TatvaCare agent · routed for medical director review", discharge_readiness_score: 0.42, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 3 of 3 authorized — ready for discharge
  { id: "ip3", patient_id: "p2", payor_id: "aia", hospital_id: "h1", drg: "PRIV-CARDIO-PCI-S", dx: "Post single-vessel PCI · NSTEMI · stable", ward_class: "Private", attending_physician: "Dr. Riza Anandita, SpJP", admission_date: "2026-04-30T11:14:00Z", day_of_stay: 3, authorized_days: 3, los_drg_benchmark: 2.8, los_variance_pct: 7.1, acuity: "STABLE", medical_necessity_score: 0.91, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.94, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 2 of 3 — elective C-section, on benchmark
  { id: "ip4", patient_id: "p3", payor_id: "bpjs", hospital_id: "h1", drg: "INA-CBG O-6-10-I", dx: "Post-C-section · primigravida · stable", ward_class: "Class II", attending_physician: "Dr. Sari Hapsari, SpOG", admission_date: "2026-05-01T10:00:00Z", day_of_stay: 2, authorized_days: 3, los_drg_benchmark: 3.0, los_variance_pct: -33.3, acuity: "IMPROVING", medical_necessity_score: 0.95, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.71, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 5 of 5 — TKR, holding for transport
  { id: "ip5", patient_id: "p4", payor_id: "alli", hospital_id: "h1", drg: "PRIV-ORTHO-TKR", dx: "Post right TKR · OA knee · awaiting family transport", ward_class: "Private", attending_physician: "Dr. Bambang Wirawan, SpOT", admission_date: "2026-04-28T07:30:00Z", day_of_stay: 5, authorized_days: 5, los_drg_benchmark: 5.0, los_variance_pct: 0.0, acuity: "STABLE", medical_necessity_score: 0.78, medical_necessity_gaps_json: "[\"PT progress notes for last 24h missing — needed to support PT-justified additional day\"]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.88, avoidable_day_flag: 1, avoidable_day_reason: "Awaiting family transport · social, not clinical" },
  // Day 5 of 7 authorized — multi-vessel PCI, watch
  { id: "ip6", patient_id: "p17", payor_id: "aia", hospital_id: "h2", drg: "PRIV-CARDIO-PCI-S", dx: "Post multi-vessel PCI · STEMI · day 5 · CHF watch", ward_class: "Private", attending_physician: "Dr. Hanin Mahmud, SpJP", admission_date: "2026-04-28T17:11:00Z", day_of_stay: 5, authorized_days: 7, los_drg_benchmark: 4.5, los_variance_pct: 11.1, acuity: "WATCH", medical_necessity_score: 0.84, medical_necessity_gaps_json: "[\"BNP / NT-proBNP trend not documented to support CHF watch indication\"]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.55, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 4 of 4 — appendectomy, ready
  { id: "ip7", patient_id: "p18", payor_id: "bpjs", hospital_id: "h3", drg: "INA-CBG K-1-15-II", dx: "Post laparoscopic appendectomy · uncomplicated", ward_class: "Class I", attending_physician: "Dr. Iwan Santoso, SpB", admission_date: "2026-04-30T09:30:00Z", day_of_stay: 4, authorized_days: 4, los_drg_benchmark: 2.5, los_variance_pct: 60.0, acuity: "STABLE", medical_necessity_score: 0.62, medical_necessity_gaps_json: "[\"Wound check note absent for days 2-3\",\"Justification for extended LOS beyond DRG benchmark not documented\"]", auth_extension_status: "REJECTED", auth_extension_letter_md: null, discharge_readiness_score: 0.92, avoidable_day_flag: 1, avoidable_day_reason: "Discharge planning not started until day 3" },
  // Day 3 of 7 — bilateral TKR, on track
  { id: "ip8", patient_id: "p19", payor_id: "alli", hospital_id: "h2", drg: "PRIV-ORTHO-TKR", dx: "Post bilateral TKR staged · day 3 of 7", ward_class: "Private", attending_physician: "Dr. Joko Santoso, SpOT", admission_date: "2026-04-30T10:45:00Z", day_of_stay: 3, authorized_days: 7, los_drg_benchmark: 7.0, los_variance_pct: -57.1, acuity: "IMPROVING", medical_necessity_score: 0.93, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.31, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 4 of 4 — emergency C-section, ready
  { id: "ip9", patient_id: "p20", payor_id: "bpjs", hospital_id: "h4", drg: "INA-CBG O-6-10-I", dx: "Post emergency C-section · fetal distress · stable", ward_class: "Class II", attending_physician: "Dr. Nia Pratiwi, SpOG", admission_date: "2026-04-29T07:00:00Z", day_of_stay: 4, authorized_days: 4, los_drg_benchmark: 3.5, los_variance_pct: 14.3, acuity: "STABLE", medical_necessity_score: 0.89, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.86, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 8 of 9 — glioma craniotomy, critical
  { id: "ip10", patient_id: "p21", payor_id: "aia", hospital_id: "h1", drg: "PRIV-NEURO-CRANI", dx: "Post craniotomy · glioblastoma · ICU step-down day 8", ward_class: "Private", attending_physician: "Dr. Arman Khusaini, SpBS", admission_date: "2026-04-25T16:20:00Z", day_of_stay: 8, authorized_days: 9, los_drg_benchmark: 8.5, los_variance_pct: -5.9, acuity: "CRITICAL", medical_necessity_score: 0.96, medical_necessity_gaps_json: "[]", auth_extension_status: "NOT_NEEDED", auth_extension_letter_md: null, discharge_readiness_score: 0.18, avoidable_day_flag: 0, avoidable_day_reason: null },
  // Day 7 of 5 authorized — over auth, extension critical
  { id: "ip11", patient_id: "p9", payor_id: "alli", hospital_id: "h1", drg: "PRIV-ORTHO-HIP", dx: "Post right THR · OA hip · day 7 · wound oversight", ward_class: "Private", attending_physician: "Dr. Krisna Adi, SpOT", admission_date: "2026-04-26T14:32:00Z", day_of_stay: 7, authorized_days: 5, los_drg_benchmark: 5.0, los_variance_pct: 40.0, acuity: "WATCH", medical_necessity_score: 0.68, medical_necessity_gaps_json: "[\"Wound exudate culture pending — needed to support continued IV abx\",\"Inflammatory markers (CRP, ESR) not trended\"]", auth_extension_status: "DRAFTED", auth_extension_letter_md: "**To:** Allianz Care Indonesia · Utilization Management\n**Re:** Auth extension request · ALLI-44-991-770 · Wahyu Santoso\n\n**Clinical justification for continued stay (days 6-9).**\n\n54-yo male post right THR (M16.1) admitted 2026-04-26. Course initially uncomplicated until day 5 when surgical wound demonstrated exudate with surrounding erythema. Cultures sent 2026-04-30; antibiotics empirically started.\n\n**Day 7 status:**\n- Wound: persistent exudate, erythema reducing\n- Mobility: assisted transfers only\n- Inflammatory markers: CRP 68 (down from 102 day 5)\n- Cultures: preliminary GPCs · final pending\n\n**Plan and clinical evidence for additional days:**\n1. Continue IV cefazolin pending culture sensitivity (3 days)\n2. PT mobilisation BID — current barrier to discharge\n3. Discharge target: day 10 with home IV plan if cultures permit\n\n**Why this exceeds DRG benchmark.** Surgical site infection risk · clinical urgency clear · attached cultures and CRP trend support continued IV access.\n\n— Dr. Krisna Adi, SpOT · drafted by TatvaCare agent · routed for utilization review", discharge_readiness_score: 0.34, avoidable_day_flag: 0, avoidable_day_reason: null },
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

export const SEED_SQL = [
  ins("hospitals", hospitals),
  ins("payors", payors),
  ins("patients", patients),
  ins("claims", claims),
  ins("payor_rules", payorRules),
  ins("email_threads", threads),
  ins("cashflow_days", cashflow),
  ins("pipeline_buckets", pipeline),
  ins("eligibility_checks", eligibilityChecks),
  ins("denials", denials),
  ins("appeal_drafts", appealDrafts),
  ins("clearances", clearances),
  ins("inpatients", inpatients),
].join("\n");
