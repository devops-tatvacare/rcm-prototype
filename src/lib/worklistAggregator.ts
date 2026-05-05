import { query } from "@/lib/db";

export type Silo = "preauth" | "concurrent" | "postdischarge";

export type SubStage =
  | "PA_BUILDING" | "PA_SUBMITTED" | "PA_AGING" | "PA_AT_RISK" | "PA_AUTO"
  | "C_IN_STAY" | "C_WATCH_EXTENSION" | "C_DISCHARGE_READY"
  | "PD_BUILDING" | "PD_READY" | "PD_SUBMITTED" | "PD_AT_RISK" | "PD_DENIED" | "PD_PAID" | "PD_AUTO";

export type OpenTarget =
  | { kind: "claim"; id: string }
  | { kind: "inpatient"; id: string }
  | { kind: "denial"; id: string };

export type PatientItem = {
  rowId: string;
  source: "claim" | "inpatient" | "denial";
  data_origin: "EMR" | "DOC_UPLOAD";
  patient_name: string;
  hospital_name: string;
  hospital_initial: string;
  payor_id: string;
  payor_name: string;
  drg: string;
  dx: string;
  amount_idr: number;
  silo: Silo;
  subStage: SubStage;
  stageLabel: string;
  riskLabel: string | null;
  sla_hours: number | null;
  sla_label: string | null;
  ai_pct: number;
  agent_step: string | null;
  awaiting_human: boolean;
  open_target: OpenTarget;
};

const RISK_FLAG_LABEL: Record<string, string> = {
  PA_MISMATCH: "Pre-auth scope mismatch",
  MISSING_DOC: "Missing supporting document",
  LOS_VARIANCE: "LOS exceeds DRG cap",
  AGING_PA: "Pre-auth aging beyond SLA",
};

const SUB_STAGE_LABEL: Record<SubStage, string> = {
  PA_BUILDING: "Building",
  PA_SUBMITTED: "Submitted",
  PA_AGING: "Aging",
  PA_AT_RISK: "At risk",
  PA_AUTO: "AI auto-cleared",
  C_IN_STAY: "In stay",
  C_WATCH_EXTENSION: "Watch · extension",
  C_DISCHARGE_READY: "Discharge ready",
  PD_BUILDING: "Building",
  PD_READY: "Ready",
  PD_SUBMITTED: "Submitted",
  PD_AT_RISK: "At risk",
  PD_DENIED: "Denied · appeal",
  PD_PAID: "Paid",
  PD_AUTO: "AI auto-cleared",
};

function initial(s: string): string {
  return s ? s.trim()[0].toUpperCase() : "·";
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 3_600_000);
}

function aiPctFor(sub: SubStage): number {
  switch (sub) {
    case "PA_BUILDING": return 70;
    case "PA_SUBMITTED": return 95;
    case "PA_AGING": return 80;
    case "PA_AT_RISK": return 50;
    case "PA_AUTO": return 100;
    case "C_IN_STAY": return 90;
    case "C_WATCH_EXTENSION": return 60;
    case "C_DISCHARGE_READY": return 85;
    case "PD_BUILDING": return 70;
    case "PD_READY": return 90;
    case "PD_SUBMITTED": return 95;
    case "PD_AT_RISK": return 50;
    case "PD_DENIED": return 70;
    case "PD_PAID": return 100;
    case "PD_AUTO": return 100;
  }
}

function awaitingHumanFor(sub: SubStage): boolean {
  return (
    sub === "PD_READY" ||
    sub === "PD_AT_RISK" ||
    sub === "PD_DENIED" ||
    sub === "PA_AT_RISK" ||
    sub === "C_DISCHARGE_READY" ||
    sub === "C_WATCH_EXTENSION"
  );
}

type ClaimRow = {
  id: string;
  patient_name: string;
  hospital_name: string;
  payor_id: string;
  payor_name: string;
  drg: string;
  dx: string;
  gross_idr: number;
  expected_reimb_idr: number;
  stage: string;
  days_in_stage: number;
  risk_flag: string | null;
  agent_step: string | null;
  submitted_at: string | null;
  source: string | null;
};

type DataOrigin = "EMR" | "DOC_UPLOAD";
function originOf(s: string | null | undefined): DataOrigin {
  return s === "DOC_UPLOAD" ? "DOC_UPLOAD" : "EMR";
}

type InpatientRow = {
  id: string;
  patient_name: string;
  hospital_name: string;
  payor_id: string;
  payor_name: string;
  drg: string;
  dx: string;
  acuity: string;
  los_variance_pct: number;
  authorized_days: number;
  day_of_stay: number;
  auth_extension_status: string;
  discharge_readiness_score: number;
  avoidable_day_flag: number;
};

type DenialRow = {
  id: string;
  claim_id: string;
  patient_name: string;
  hospital_name: string;
  payor_id: string;
  payor_name: string;
  drg: string;
  dx: string;
  category: string;
  reason_text: string;
  denied_amount_idr: number;
  appeal_deadline_at: string;
  appeal_status: string;
};

function buildPreAuthItem(c: ClaimRow, now: Date, _docOwners: Set<string>): PatientItem {
  let sub: SubStage = "PA_SUBMITTED";
  let slaLabel: string | null = null;
  let slaHours: number | null = null;
  if (c.stage === "AT_RISK") {
    sub = "PA_AT_RISK";
  } else if (c.stage === "PREAUTH_BUILDING") {
    sub = "PA_BUILDING";
    slaLabel = c.agent_step ? "Building…" : null;
  } else if (c.stage === "PREAUTH_APPROVED") {
    sub = "PA_AUTO";
    slaLabel = "Approved · zero touch";
  } else if (c.risk_flag === "AGING_PA" || c.days_in_stage >= 2) {
    sub = "PA_AGING";
    slaHours = Math.max(0, 48 - c.days_in_stage * 24);
    slaLabel = `PA aging · ${c.days_in_stage}d in queue`;
  } else if (c.submitted_at) {
    sub = "PA_SUBMITTED";
    const submitted = new Date(c.submitted_at);
    const ackBy = new Date(submitted.getTime() + 48 * 3_600_000);
    slaHours = Math.max(0, hoursBetween(now, ackBy));
    slaLabel = `Ack expected in ${slaHours}h`;
  }
  return {
    rowId: `claim:${c.id}`,
    source: "claim",
    patient_name: c.patient_name,
    hospital_name: c.hospital_name,
    hospital_initial: initial(c.hospital_name),
    payor_id: c.payor_id,
    payor_name: c.payor_name,
    drg: c.drg,
    dx: c.dx,
    amount_idr: c.expected_reimb_idr || c.gross_idr,
    silo: "preauth",
    subStage: sub,
    stageLabel: SUB_STAGE_LABEL[sub],
    riskLabel: c.risk_flag ? RISK_FLAG_LABEL[c.risk_flag] ?? c.risk_flag : null,
    sla_hours: slaHours,
    sla_label: slaLabel,
    ai_pct: aiPctFor(sub),
    agent_step: c.agent_step,
    awaiting_human: awaitingHumanFor(sub),
    open_target: { kind: "claim", id: c.id },
    data_origin: originOf(c.source),
  };
}

function buildPostDischargeItem(c: ClaimRow): PatientItem {
  let sub: SubStage;
  switch (c.stage) {
    case "BUILDING": sub = "PD_BUILDING"; break;
    case "READY": sub = "PD_READY"; break;
    case "SUBMITTED": sub = "PD_SUBMITTED"; break;
    case "AT_RISK": sub = "PD_AT_RISK"; break;
    case "PAID": sub = "PD_PAID"; break;
    case "AUTO_CLEARED": sub = "PD_AUTO"; break;
    default: sub = "PD_BUILDING";
  }
  return {
    rowId: `claim:${c.id}`,
    source: "claim",
    patient_name: c.patient_name,
    hospital_name: c.hospital_name,
    hospital_initial: initial(c.hospital_name),
    payor_id: c.payor_id,
    payor_name: c.payor_name,
    drg: c.drg,
    dx: c.dx,
    amount_idr: c.expected_reimb_idr || c.gross_idr,
    silo: "postdischarge",
    subStage: sub,
    stageLabel: SUB_STAGE_LABEL[sub],
    riskLabel: c.risk_flag ? RISK_FLAG_LABEL[c.risk_flag] ?? c.risk_flag : null,
    sla_hours: null,
    sla_label: c.days_in_stage > 0 ? `${c.days_in_stage}d in stage` : null,
    ai_pct: aiPctFor(sub),
    agent_step: c.agent_step,
    awaiting_human: awaitingHumanFor(sub),
    open_target: { kind: "claim", id: c.id },
    data_origin: originOf(c.source),
  };
}

function buildConcurrentItem(ip: InpatientRow, docOwners: Set<string>): PatientItem {
  let sub: SubStage = "C_IN_STAY";
  if (ip.discharge_readiness_score >= 0.85) sub = "C_DISCHARGE_READY";
  else if (
    ip.acuity === "WATCH" ||
    ip.auth_extension_status === "DRAFTED" ||
    ip.auth_extension_status === "SUBMITTED" ||
    ip.auth_extension_status === "REJECTED"
  ) sub = "C_WATCH_EXTENSION";
  const remaining = ip.authorized_days - ip.day_of_stay;
  const slaLabel = remaining >= 0
    ? `${remaining}d auth remaining · day ${ip.day_of_stay}/${ip.authorized_days}`
    : `${Math.abs(remaining)}d past auth`;
  let risk: string | null = null;
  if (ip.los_variance_pct > 30) risk = "LOS exceeds DRG cap";
  else if (ip.auth_extension_status === "REJECTED") risk = "Extension rejected";
  else if (ip.avoidable_day_flag) risk = "Avoidable day flagged";
  return {
    rowId: `ip:${ip.id}`,
    source: "inpatient",
    patient_name: ip.patient_name,
    hospital_name: ip.hospital_name,
    hospital_initial: initial(ip.hospital_name),
    payor_id: ip.payor_id,
    payor_name: ip.payor_name,
    drg: ip.drg,
    dx: ip.dx,
    amount_idr: 0,
    silo: "concurrent",
    subStage: sub,
    stageLabel: SUB_STAGE_LABEL[sub],
    riskLabel: risk,
    sla_hours: remaining * 24,
    sla_label: slaLabel,
    ai_pct: aiPctFor(sub),
    agent_step: null,
    awaiting_human: awaitingHumanFor(sub),
    open_target: { kind: "inpatient", id: ip.id },
    data_origin: docOwners.has(ip.id) ? "DOC_UPLOAD" : "EMR",
  };
}

function buildDenialItem(d: DenialRow, now: Date, docOwners: Set<string>): PatientItem {
  const deadline = new Date(d.appeal_deadline_at);
  const hours = Math.max(0, hoursBetween(now, deadline));
  const days = Math.round(hours / 24);
  const slaLabel = `Appeal due in ${days}d`;
  const sub: SubStage = "PD_DENIED";
  return {
    rowId: `denial:${d.id}`,
    source: "denial",
    patient_name: d.patient_name,
    hospital_name: d.hospital_name,
    hospital_initial: initial(d.hospital_name),
    payor_id: d.payor_id,
    payor_name: d.payor_name,
    drg: d.drg,
    dx: d.dx,
    amount_idr: d.denied_amount_idr,
    silo: "postdischarge",
    subStage: sub,
    stageLabel: SUB_STAGE_LABEL[sub],
    riskLabel: d.category === "CLINICAL"
      ? "Clinical denial"
      : d.category === "TECHNICAL"
        ? "Technical denial"
        : d.category === "CONTRACTUAL"
          ? "Contractual denial"
          : "Administrative denial",
    sla_hours: hours,
    sla_label: slaLabel,
    ai_pct: aiPctFor(sub),
    agent_step: `Appeal · ${d.appeal_status.toLowerCase()}`,
    awaiting_human: true,
    open_target: { kind: "denial", id: d.id },
    data_origin: docOwners.has(d.claim_id) ? "DOC_UPLOAD" : "EMR",
  };
}

export async function loadWorklist(now: Date = new Date()): Promise<PatientItem[]> {
  const claims = await query<ClaimRow>(
    `SELECT c.id, p.name AS patient_name, h.name AS hospital_name,
            c.payor_id, py.name AS payor_name,
            c.drg, c.dx, c.gross_idr, c.expected_reimb_idr,
            c.stage, c.days_in_stage, c.risk_flag, c.agent_step, c.submitted_at, c.source
       FROM claims c
       JOIN patients p ON p.id = c.patient_id
       JOIN payors py ON py.id = c.payor_id
       JOIN hospitals h ON h.id = c.hospital_id`,
  );

  // Collect inpatient ids that have any uploaded physical docs — used to mark concurrent rows as DOC_UPLOAD.
  const docRows = await query<{ owner_kind: string; owner_id: string }>(
    `SELECT owner_kind, owner_id FROM uploaded_docs`,
  );
  const inpatientDocOwners = new Set(docRows.filter((r) => r.owner_kind === "inpatient").map((r) => r.owner_id));
  const claimDocOwners = new Set(docRows.filter((r) => r.owner_kind === "claim").map((r) => r.owner_id));

  const inpatients = await query<InpatientRow>(
    `SELECT i.id, p.name AS patient_name, h.name AS hospital_name,
            i.payor_id, py.name AS payor_name,
            i.drg, i.dx, i.acuity, i.los_variance_pct,
            i.authorized_days, i.day_of_stay,
            i.auth_extension_status, i.discharge_readiness_score, i.avoidable_day_flag
       FROM inpatients i
       JOIN patients p ON p.id = i.patient_id
       JOIN payors py ON py.id = i.payor_id
       JOIN hospitals h ON h.id = i.hospital_id`,
  );

  const denials = await query<DenialRow>(
    `SELECT d.id, d.claim_id, p.name AS patient_name, h.name AS hospital_name,
            d.payor_id, py.name AS payor_name,
            c.drg, c.dx,
            d.category, d.reason_text, d.denied_amount_idr,
            d.appeal_deadline_at, d.appeal_status
       FROM denials d
       JOIN claims c ON c.id = d.claim_id
       JOIN patients p ON p.id = c.patient_id
       JOIN payors py ON py.id = d.payor_id
       JOIN hospitals h ON h.id = d.hospital_id
      WHERE d.appeal_status NOT IN ('WON','LOST')`,
  );

  // Skip claim rows that have an active denial — denial row represents them in the worklist.
  const claimsWithActiveDenial = new Set(denials.map((d) => d.claim_id));

  const items: PatientItem[] = [];

  for (const c of claims) {
    if (claimsWithActiveDenial.has(c.id)) continue;
    const isPreAuth =
      c.stage === "PREAUTH_BUILDING" ||
      c.stage === "PREAUTH_APPROVED" ||
      c.stage === "AWAITING_PREAUTH" ||
      (c.stage === "AT_RISK" && c.risk_flag === "PA_MISMATCH");
    if (isPreAuth) {
      items.push(buildPreAuthItem(c, now, claimDocOwners));
    } else if (c.stage === "PAID" || c.stage === "DENIED") {
      // Skip resolved claims from the worklist by default — they don't need action.
      continue;
    } else {
      items.push(buildPostDischargeItem(c));
    }
  }

  for (const ip of inpatients) items.push(buildConcurrentItem(ip, inpatientDocOwners));
  for (const d of denials) items.push(buildDenialItem(d, now, claimDocOwners));

  return items;
}

export const PA_STAGE_ORDER: SubStage[] = ["PA_BUILDING", "PA_SUBMITTED", "PA_AGING", "PA_AT_RISK", "PA_AUTO"];
export const C_STAGE_ORDER: SubStage[] = ["C_IN_STAY", "C_WATCH_EXTENSION", "C_DISCHARGE_READY"];
export const PD_STAGE_ORDER: SubStage[] = ["PD_BUILDING", "PD_READY", "PD_SUBMITTED", "PD_AT_RISK", "PD_DENIED", "PD_AUTO"];

export function stageOrderForSilo(silo: Silo): SubStage[] {
  if (silo === "preauth") return PA_STAGE_ORDER;
  if (silo === "concurrent") return C_STAGE_ORDER;
  return PD_STAGE_ORDER;
}

export function siloLabel(silo: Silo): string {
  if (silo === "preauth") return "Pre-Auth · Admission";
  if (silo === "concurrent") return "Concurrent · In hospital";
  return "Post-Discharge · Claim";
}

export function subStageLabel(sub: SubStage): string {
  return SUB_STAGE_LABEL[sub];
}
