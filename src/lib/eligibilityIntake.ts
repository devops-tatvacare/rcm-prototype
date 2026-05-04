// Insurance card bank + plan builders for the "+ New verification" flow.
// Each card exercises a different branch of A.6 / A.10:
//   1. happy_path     — BPJS active · pre-auth required · clean clearance
//   2. dispute_risk   — AIA active · pre-existing pattern · elevated dispute score
//   3. lapsed         — Allianz lapsed policy · A.6 step 10 (self-pay path)
//   4. family_plan    — BPJS dependent · A.10 edge case 2 (disambiguation)
//
// Each card produces (a) a step-by-step LIVE_PLAN trace with text driven by the
// card's actual data, and (b) the persisted eligibility_checks row that lands
// in the queue once verification completes.

export type Scenario = "happy_path" | "dispute_risk" | "lapsed" | "family_plan";
export type SimMode = "live" | "cached";

export type SampleCard = {
  id: string;
  scenario: Scenario;
  // Patient
  patient_id: string;
  mrn: string;
  patient_name: string;
  patient_age: number;
  patient_sex: "F" | "M";
  ward_class: string;
  // Card OCR
  policy_number: string;
  national_id_masked: string;
  validity: string;
  group_code: string;
  // Payor + site
  payor_id: string;
  payor_name: string;
  payor_color: string;
  payor_kind: "gov" | "private" | "tpa";
  hospital_id: string;
  hospital_name: string;
  // Encounter
  planned_procedure: string;
  ina_cbg: string;
  scheduled_admission_at: string;
  // Headline tag for the card UI
  tag: string;
  tag_tone: "good" | "warn" | "bad" | "info";
  // What the live verification will resolve to
  result: {
    status: "ACTIVE" | "DISPUTED" | "LAPSED" | "WAITING_PERIOD" | "SUSPENDED";
    annual_limit_remaining_idr: number;
    annual_limit_total_idr: number;
    room_class_entitlement: string;
    pre_auth_required: 0 | 1;
    pre_auth_status: string;
    cob_primary_payor: string | null;
    dispute_risk_score: number;
    exclusions: string[];
    summary_headline: string;
  };
};

export type LiveStep = {
  id: string;
  label: string;
  detail: string;
  ms: number;
  source: string;
};

// ── Sample cards ──────────────────────────────────────────────────────────

export const SAMPLE_CARDS: SampleCard[] = [
  // 1 ─── BPJS happy path ─────────────────────────────────────────────────
  {
    id: "samp1",
    scenario: "happy_path",
    patient_id: "samp1",
    mrn: "MRN-901128",
    patient_name: "Ratna Setyawati",
    patient_age: 38,
    patient_sex: "F",
    ward_class: "Class I",
    policy_number: "0001-2055-883-217",
    national_id_masked: "317201**********",
    validity: "2025-04 → 2026-04",
    group_code: "BPJS-PBI-NA",
    payor_id: "bpjs",
    payor_name: "BPJS Kesehatan",
    payor_color: "#e7c08a",
    payor_kind: "gov",
    hospital_id: "h1",
    hospital_name: "Cendana Jakarta",
    planned_procedure: "Laparoscopic hysterectomy · endometriosis",
    ina_cbg: "INA-CBG O-6-13-I",
    scheduled_admission_at: "2026-05-04T14:30:00Z",
    tag: "Active · pre-auth required",
    tag_tone: "good",
    result: {
      status: "ACTIVE",
      annual_limit_remaining_idr: 41_200_000,
      annual_limit_total_idr: 50_000_000,
      room_class_entitlement: "Class I",
      pre_auth_required: 1,
      pre_auth_status: "ATTACHED · scope match",
      cob_primary_payor: null,
      dispute_risk_score: 0.04,
      exclusions: [],
      summary_headline: "Cleared for Class I admission · pre-auth attached",
    },
  },

  // 2 ─── AIA dispute-risk ────────────────────────────────────────────────
  {
    id: "samp2",
    scenario: "dispute_risk",
    patient_id: "samp2",
    mrn: "MRN-901214",
    patient_name: "Putra Wijaya",
    patient_age: 58,
    patient_sex: "M",
    ward_class: "Private",
    policy_number: "AIA-IDN-22-118-901",
    national_id_masked: "317202**********",
    validity: "2024-09 → 2025-09",
    group_code: "AIA-CORP-PERTAMINA",
    payor_id: "aia",
    payor_name: "AIA Indonesia",
    payor_color: "#a78bfa",
    payor_kind: "private",
    hospital_id: "h2",
    hospital_name: "Cendana Surabaya",
    planned_procedure: "Single-vessel PCI · NSTEMI",
    ina_cbg: "PRIV-CARDIO-PCI-S",
    scheduled_admission_at: "2026-05-05T08:00:00Z",
    tag: "Active · dispute risk elevated",
    tag_tone: "warn",
    result: {
      status: "ACTIVE",
      annual_limit_remaining_idr: 280_000_000,
      annual_limit_total_idr: 500_000_000,
      room_class_entitlement: "Private (1-bed)",
      pre_auth_required: 1,
      pre_auth_status: "PENDING · cardiology endorsement queued",
      cob_primary_payor: null,
      dispute_risk_score: 0.42,
      exclusions: ["pre-existing cardiac condition · 18mo waiting period (relevant)"],
      summary_headline: "Active · supplementary documentation queued · dispute risk 0.42",
    },
  },

  // 3 ─── Allianz LAPSED ─────────────────────────────────────────────────
  {
    id: "samp3",
    scenario: "lapsed",
    patient_id: "samp3",
    mrn: "MRN-901307",
    patient_name: "Maya Hartono",
    patient_age: 44,
    patient_sex: "F",
    ward_class: "Class II",
    policy_number: "ALZ-IDN-91-440-118",
    national_id_masked: "317203**********",
    validity: "2024-03 → 2025-03 (lapsed)",
    group_code: "ALZ-INDIVIDUAL",
    payor_id: "alli",
    payor_name: "Allianz Care",
    payor_color: "#fb7185",
    payor_kind: "private",
    hospital_id: "h3",
    hospital_name: "Cendana Bandung",
    planned_procedure: "Oncology consult · staging workup",
    ina_cbg: "—",
    scheduled_admission_at: "2026-05-04T10:00:00Z",
    tag: "Lapsed · 47d overdue",
    tag_tone: "bad",
    result: {
      status: "LAPSED",
      annual_limit_remaining_idr: 0,
      annual_limit_total_idr: 0,
      room_class_entitlement: "—",
      pre_auth_required: 0,
      pre_auth_status: "N/A · policy inactive",
      cob_primary_payor: null,
      dispute_risk_score: 0.0,
      exclusions: [],
      summary_headline: "Policy lapsed · routed to self-pay path · case manager notified",
    },
  },

  // 4 ─── BPJS dependent / family plan ───────────────────────────────────
  {
    id: "samp4",
    scenario: "family_plan",
    patient_id: "samp4",
    mrn: "MRN-901419",
    patient_name: "Budi Santoso",
    patient_age: 11,
    patient_sex: "M",
    ward_class: "Class II",
    policy_number: "0001-2099-447-188",
    national_id_masked: "317204**********",
    validity: "2025-01 → 2026-01",
    group_code: "BPJS-PBPU-FAMILY",
    payor_id: "bpjs",
    payor_name: "BPJS Kesehatan",
    payor_color: "#e7c08a",
    payor_kind: "gov",
    hospital_id: "h4",
    hospital_name: "Cendana Medan",
    planned_procedure: "Pediatric appendectomy · acute",
    ina_cbg: "INA-CBG K-1-30-II",
    scheduled_admission_at: "2026-05-04T18:30:00Z",
    tag: "Active · dependent verified",
    tag_tone: "info",
    result: {
      status: "ACTIVE",
      annual_limit_remaining_idr: 22_400_000,
      annual_limit_total_idr: 30_000_000,
      room_class_entitlement: "Class II",
      pre_auth_required: 1,
      pre_auth_status: "ATTACHED · pediatric scope confirmed",
      cob_primary_payor: null,
      dispute_risk_score: 0.07,
      exclusions: [],
      summary_headline: "Cleared as dependent · policy holder Ibu Santoso confirmed",
    },
  },
];

export function getCard(id: string): SampleCard | null {
  return SAMPLE_CARDS.find((c) => c.id === id) ?? null;
}

// ── Live plan builder (A.6 happy path with branching per scenario) ───────

export function buildLivePlan(c: SampleCard): LiveStep[] {
  const sourceForApi =
    c.payor_kind === "gov" ? "BPJS V-Claim" : c.payor_name + " API";

  // Step 1+2 are common to every card (registration → OCR → ID cross-check).
  const head: LiveStep[] = [
    {
      id: "s1",
      label: "OCR card scan",
      detail: `Insurance card · 4 fields extracted (policy ${c.policy_number}, insurer ${c.payor_name}, group ${c.group_code}, validity ${c.validity})`,
      ms: 1500,
      source: "OCR",
    },
    {
      id: "s2",
      label: "National ID cross-check",
      detail: `NIK ${c.national_id_masked} verified against Dukcapil mock`,
      ms: 1200,
      source: "Dukcapil",
    },
  ];

  // Family-plan cards add a dependent verification step (A.10 edge case 2).
  const dependentStep: LiveStep[] =
    c.scenario === "family_plan"
      ? [
          {
            id: "s2b",
            label: "Dependent verification",
            detail:
              "Registered as son of policy holder Ibu Santoso · DOB 2014-08-12 matches Dukcapil · KK-family number aligned",
            ms: 1100,
            source: "Dependent",
          },
        ]
      : [];

  // ── LAPSED path branches at step 3: short-circuit to step 10 (self-pay) ──
  if (c.scenario === "lapsed") {
    return [
      ...head,
      {
        id: "s3",
        label: `${sourceForApi} · membership query`,
        detail:
          "Policy LAPSED · last premium 2025-12-18 · grace period exited 2026-04-12 · 47d overdue",
        ms: 2000,
        source: sourceForApi,
      },
      {
        id: "s4",
        label: "Coverage gap detected",
        detail: "0 IDR remaining · annual limit forfeit · admission cannot proceed cashless",
        ms: 900,
        source: "Internal",
      },
      {
        id: "s5",
        label: "Lapse notice auto-generated",
        detail:
          "Lapse summary attached to chart · financial assistance form drafted · means-test queued",
        ms: 1200,
        source: "Internal",
      },
      {
        id: "s6",
        label: "Case manager notified",
        detail:
          "Notification routed · admission proceeds with deposit collection · payment plan options offered",
        ms: 900,
        source: "Workflow",
      },
      {
        id: "s7",
        label: "Routed to Financial Clearance · self-pay",
        detail: "All eligibility data passed to Module B · self-pay workflow opened (A.6 step 10)",
        ms: 800,
        source: "Done",
      },
    ];
  }

  // ── HAPPY / DISPUTE-RISK / FAMILY-PLAN — full A.6 flow ─────────────────
  const disputeDetail =
    c.scenario === "dispute_risk"
      ? `${c.result.dispute_risk_score.toFixed(2)} — elevated · pre-existing cardiac pattern matched in 11 historical denials · documentation supplements queued`
      : `${c.result.dispute_risk_score.toFixed(2)} — low risk · no historical pattern matches`;

  const summaryDetail =
    c.scenario === "dispute_risk"
      ? `Routed to chart ${c.mrn} · pre-auth draft routed to billing · cardiology endorsement note flagged as required attachment`
      : `Routed to chart ${c.mrn} · pre-auth draft routed to billing`;

  return [
    ...head,
    ...dependentStep,
    {
      id: "s3",
      label: `${sourceForApi} dispatch`,
      detail: `Membership status · class · benefits · annual limit remaining · returned in real time`,
      ms: 3200,
      source: sourceForApi,
    },
    {
      id: "s4",
      label: "Coordination of Benefits resolved",
      detail: "Single payor · " + c.payor_name + " primary · no secondary policy on file",
      ms: 1100,
      source: "Internal",
    },
    {
      id: "s5",
      label: "Coverage object normalized",
      detail: `Active · ${c.result.room_class_entitlement} · ${(c.result.annual_limit_remaining_idr / 1_000_000).toFixed(1)}M of ${(c.result.annual_limit_total_idr / 1_000_000).toFixed(0)}M remaining · ${c.result.exclusions.length} exclusions relevant`,
      ms: 1300,
      source: "Internal",
    },
    {
      id: "s6",
      label: "Pre-auth gap matrix evaluated",
      detail:
        c.result.pre_auth_required === 1
          ? `${c.ina_cbg} requires PA · ${c.result.pre_auth_status}`
          : "Not required for this DRG",
      ms: 1700,
      source: "Internal",
    },
    {
      id: "s7",
      label: "Coverage Dispute Risk scored",
      detail: disputeDetail,
      ms: 1100,
      source: "ML",
    },
    {
      id: "s8",
      label: "Eligibility Summary auto-attached",
      detail: summaryDetail,
      ms: 1300,
      source: "Internal",
    },
    {
      id: "s9",
      label: "Complete",
      detail: c.result.summary_headline,
      ms: 700,
      source: "Done",
    },
  ];
}

// ── Cached / outage plan (A.6 step 4 + A.10 edge case 1) ─────────────────

export function buildCachedPlan(c: SampleCard): LiveStep[] {
  const sourceForApi =
    c.payor_kind === "gov" ? "BPJS V-Claim" : c.payor_name + " API";

  return [
    {
      id: "c1",
      label: "OCR card scan",
      detail: `Insurance card · 4 fields extracted (policy ${c.policy_number}, insurer ${c.payor_name}, group ${c.group_code}, validity ${c.validity})`,
      ms: 1500,
      source: "OCR",
    },
    {
      id: "c2",
      label: `${sourceForApi} · timeout`,
      detail:
        "No response in 5s · circuit breaker opened · failing over to cached eligibility cache",
      ms: 1900,
      source: "Failover",
    },
    {
      id: "c3",
      label: "Cached eligibility lookup",
      detail: `Last-known-good from overnight batch 2026-05-02T22:00 — ${c.result.status === "LAPSED" ? "INACTIVE (T−12h)" : "Active · " + c.result.room_class_entitlement + " · " + (c.result.annual_limit_remaining_idr / 1_000_000).toFixed(1) + "M remaining (T−12h)"}`,
      ms: 1200,
      source: "Cache",
    },
    {
      id: "c4",
      label: "Manual confirmation flagged",
      detail:
        "Confidence reduced · TPA desk to phone-confirm with " +
        (c.payor_kind === "gov" ? "BPJS hotline" : c.payor_name + " agent") +
        " before admission · ticket auto-created in workqueue",
      ms: 1100,
      source: "Workflow",
    },
    {
      id: "c5",
      label: "Pre-auth gap matrix · cached rules",
      detail:
        c.result.pre_auth_required === 1
          ? `${c.ina_cbg} requires PA · scope validated against cached payor rules v4.2`
          : "Not required for this DRG · cached rules v4.2",
      ms: 1500,
      source: "Internal",
    },
    {
      id: "c6",
      label: "Provisional clearance issued",
      detail:
        "Patient cleared to admit under provisional eligibility · claim risk score elevated +0.18 · audit trail logged",
      ms: 900,
      source: "Done",
    },
  ];
}

// Total elapsed time for a plan (used to drive the persisted tat_seconds value
// when the user has not let the simulation run to completion).
export function planTotalSeconds(plan: LiveStep[]): number {
  return Math.round(plan.reduce((a, s) => a + s.ms, 0) / 1000);
}
