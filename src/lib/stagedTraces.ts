// Per-stage trace builders. The Building stage runs LIVE (with timer); every
// other stage shows a FROZEN trace that's already happened, plus a stage-
// appropriate left panel and primary action.
//
// Spec mapping:
//   READY                 → C.5.4 HITL final review · awaiting human submit
//   AWAITING_PREAUTH      → C.6 step 9 · status tracking begins (pre-auth ack pending)
//   SUBMITTED (Adjudicating) → C.6 step 10 · remittance pending; status polling active
//   AT_RISK               → C.5.4 HITL · pre-submission scrub blocked

import type { AgentStep } from "./agent";

export type ClaimLike = {
  id: string;
  patient_name: string;
  drg: string;
  dx: string;
  los_days: number;
  gross_idr: number;
  expected_reimb_idr: number;
  payor_id: string;
  payor_name: string;
  hospital_name: string;
  ward_class: string;
  policy_number: string;
  acceptance_score: number;
  predicted_dtp_days: number | null;
  stage: string;
  days_in_stage: number;
  agent_step: string | null;
  risk_flag: string | null;
  submitted_at: string | null;
  source?: string | null;
};

const shortDx = (dx: string) => dx.split(" · ")[0].split(" — ")[0];
const ack = (prefix: string) => `${prefix}${new Date().getFullYear()}-${String(Math.abs(hashId(prefix)) % 999999).padStart(6, "0")}`;
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return h;
}

// ─────────────────────────────────────────────────────────────────────────
// Generic build plan — a customisable 9-step arc that matches any claim.
// Used as the base for every stage's frozen trace.
// ─────────────────────────────────────────────────────────────────────────
function buildGenericBuildPlan(c: ClaimLike): AgentStep[] {
  const payorAbbrev = c.payor_id === "bpjs" ? "BPJS" : c.payor_id === "aia" ? "AIA" : "Allianz";
  const isDocUpload = c.source === "DOC_UPLOAD";

  // Source labels swap based on data origin so the trace matches what the
  // associate actually saw on screen. EMR-driven cases pull from EMR/LIS/RIS;
  // doc-upload cases pull from the Clinical extractor agent's coded output.
  const docSrc = isDocUpload ? "Extractor agent" : "EMR";
  const evidenceSrc = isDocUpload ? "Extractor agent · paper labs + imaging" : "EMR + LIS + RIS";

  return [
    {
      id: `${c.id}_s0`,
      kind: "init",
      narration: `Initializing packet build · ${c.patient_name} · ${c.drg} · ${c.payor_name}. ${
        isDocUpload
          ? "Reading the bundle handed off by the Clinical extractor agent (uploaded paper docs)."
          : "Pulling baseline acceptance from historical threads on this DRG."
      }`,
      probDelta: 0,
      ms: 600,
    },
    {
      id: `${c.id}_s1`,
      kind: "fetch",
      narration: isDocUpload
        ? "Loading clinical narrative from extracted paper records — handwritten ED note + GP referral OCR'd by the extractor."
        : "Pulling discharge summary from EMR — locking after attending physician sign-off.",
      artifact: {
        id: `${c.id}_a1`,
        label: isDocUpload ? "Extracted Clinical Narrative" : "Discharge Summary",
        source: docSrc,
        kind: "clinical",
        bytes: "112 KB",
        required: true,
      },
      probDelta: 3,
      ms: 700,
    },
    {
      id: `${c.id}_s2`,
      kind: "code",
      narration: isDocUpload
        ? `Reusing ICD-10 + CPT codes already extracted from paper docs · ${shortDx(c.dx)}. ${c.payor_id === "bpjs" ? "INA-CBG" : "DRG"} group locked.`
        : `Coding · ${shortDx(c.dx)}. ${c.payor_id === "bpjs" ? "INA-CBG" : "DRG"} group locked.`,
      artifact: {
        id: `${c.id}_a2`,
        label: "ICD-10 + Procedure Codes",
        source: isDocUpload ? "Extractor agent · already coded" : "Coder-AI",
        kind: "clinical",
        bytes: "4 KB",
      },
      probDelta: 3,
      ms: 700,
    },
    {
      id: `${c.id}_s3`,
      kind: "fetch",
      narration: isDocUpload
        ? "Reading uploaded paper evidence · scanned chest X-ray, paper CBC, blood culture printout."
        : "Pulling clinical evidence · pre-op labs, imaging, operative records.",
      artifact: {
        id: `${c.id}_a3`,
        label: isDocUpload ? "Uploaded Paper Evidence Bundle" : "Clinical Evidence Bundle",
        source: evidenceSrc,
        kind: "evidence",
        bytes: "1.6 MB",
      },
      probDelta: 4,
      ms: 800,
    },
    {
      id: `${c.id}_s4`,
      kind: "rule",
      narration: `Applying ${payorAbbrev} preference rules learned from prior submissions on this DRG cluster.`,
      artifact: { id: `${c.id}_a4`, label: `${payorAbbrev} Rule Library`, source: "Knowledge Graph", kind: "policy", bytes: "8 KB" },
      probDelta: 6,
      ms: 750,
    },
    {
      id: `${c.id}_s5`,
      kind: "validate",
      narration: isDocUpload
        ? "Cross-referencing extracted codes against payor pre-auth scope · checking nothing slipped during OCR."
        : "Pre-auth cross-reference verified · scope and procedure match.",
      artifact: { id: `${c.id}_a5`, label: "Pre-Auth Letter", source: "Pre-auth desk", kind: "admin", bytes: "16 KB" },
      probDelta: 4,
      ms: 700,
    },
    {
      id: `${c.id}_s6`,
      kind: "compose",
      narration: isDocUpload
        ? `Composing pre-auth packet from paper records · ${payorAbbrev} submission template. Running 312 scrubbing rules over OCR'd content.`
        : `Composing claim packet · 12 artifacts · ${payorAbbrev} submission template. Running 312 scrubbing rules.`,
      probDelta: 2,
      ms: 850,
    },
    {
      id: `${c.id}_s7`,
      kind: "validate",
      narration: isDocUpload
        ? `Scrubbing complete · 0 critical · OCR confidence ≥ 0.94 across all uploaded docs.`
        : `Scrubbing complete · 0 critical · ${c.acceptance_score >= 0.85 ? "1 advisory" : "issues flagged"} (LOS ${c.los_days}d vs DRG benchmark).`,
      probDelta: 1.3,
      ms: 700,
    },
    {
      id: `${c.id}_s8`,
      kind: "ready",
      narration: `Packet ready. Predicted first-pass acceptance ${Math.round(c.acceptance_score * 100)}%. Predicted days-to-payment ${c.predicted_dtp_days ?? 14}.`,
      probDelta: 1,
      ms: 600,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// READY — frozen build trace, ends at "ready", awaiting human submit.
// ─────────────────────────────────────────────────────────────────────────
export function buildReadyTrace(c: ClaimLike): AgentStep[] {
  return buildGenericBuildPlan(c);
}

// ─────────────────────────────────────────────────────────────────────────
// AWAITING_PREAUTH — build trace + pre-auth dispatch + waiting state.
// ─────────────────────────────────────────────────────────────────────────
export function buildPreAuthTrace(c: ClaimLike): AgentStep[] {
  const plan = buildGenericBuildPlan(c);
  const paAck = ack(c.payor_id === "bpjs" ? "PA-BPJS-" : c.payor_id === "aia" ? "PA-AIA-" : "PA-ALZ-");
  const submittedDays = c.days_in_stage;
  return [
    ...plan,
    {
      id: `${c.id}_pa1`,
      kind: "dispatch",
      narration: `Pre-auth letter dispatched · ${c.payor_name} · ${c.payor_id === "bpjs" ? "V-Claim PA endpoint" : "Provider portal"}. Reference ${paAck}.`,
      probDelta: 0,
      ms: 0,
    },
    {
      id: `${c.id}_pa2`,
      kind: "ack",
      narration: `Pre-auth acknowledged · ${c.payor_name} systems received the request. Adjudication queued.`,
      probDelta: 0,
      ms: 0,
    },
    ...buildPollEvents(c, submittedDays, "pre-auth"),
    {
      id: `${c.id}_pa_wait`,
      kind: "tracking",
      narration: `Awaiting pre-auth approval · ${submittedDays}d in queue · ${c.risk_flag === "AGING_PA" ? "auto-followup escalated to human" : "auto-followup scheduled at 24h"}.`,
      probDelta: 0,
      ms: 0,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMITTED (Adjudicating) — full build + dispatch + ack + tracking + polls.
// ─────────────────────────────────────────────────────────────────────────
export function buildAdjudicatingTrace(c: ClaimLike): AgentStep[] {
  const plan = buildGenericBuildPlan(c);
  const claimAck = ack(c.payor_id === "bpjs" ? "BPJS-ACK-" : c.payor_id === "aia" ? "AIA-CLM-" : "ALZ-RCV-");
  const channel = c.payor_id === "bpjs" ? "BPJS V-Claim REST API" : c.payor_id === "aia" ? "AIA Claims Portal · email cover" : "Allianz Provider Portal";
  return [
    ...plan,
    {
      id: `${c.id}_d1`,
      kind: "dispatch",
      narration: `Encrypting + signing packet · TLS 1.3. Dispatching to ${channel}.`,
      probDelta: 0,
      ms: 0,
    },
    {
      id: `${c.id}_d2`,
      kind: "ack",
      narration: `Acknowledgement received · ${claimAck}. Payor systems have logged the claim for adjudication.`,
      probDelta: 0,
      ms: 0,
    },
    {
      id: `${c.id}_d3`,
      kind: "tracking",
      narration: `Status tracking armed · adjudication SLA ${c.payor_id === "bpjs" ? 2 : c.payor_id === "aia" ? 3 : 4} days. Auto-escalation if no movement by day ${c.payor_id === "bpjs" ? 1 : c.payor_id === "aia" ? 2 : 3}.`,
      probDelta: 0,
      ms: 0,
    },
    ...buildPollEvents(c, c.days_in_stage, "adjudication"),
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// AT_RISK — build trace stops at the blocking step, rendered in coral.
// ─────────────────────────────────────────────────────────────────────────
export function buildAtRiskTrace(c: ClaimLike): AgentStep[] {
  const plan = buildGenericBuildPlan(c);
  // Cut the trace before the "ready" step and append a "block" with context.
  const truncated = plan.slice(0, plan.length - 2);
  const blockNarration = atRiskBlockNarration(c);
  return [
    ...truncated,
    {
      id: `${c.id}_block`,
      kind: "block",
      narration: blockNarration,
      probDelta: 0,
      ms: 0,
    },
  ];
}

function atRiskBlockNarration(c: ClaimLike): string {
  switch (c.risk_flag) {
    case "PA_MISMATCH":
      return `BLOCKED · source check · OT log queried · implant ${c.payor_name === "Allianz Care" ? "Genesis II CR" : "model"} differs from pre-auth approval. Addendum letter does NOT exist — substitution was an intra-op decision. Class A · must be generated or supplied.`;
    case "MISSING_DOC":
      if (c.drg.includes("CARDIO") || c.drg.includes("PCI")) {
        return `BLOCKED · source check · EMR + RIS + OT log queried · SYNTAX worksheet does NOT exist. Score is not reflexively dictated post-PCI by this site's cardiologists. ${c.payor_name} rule r5 requires it (lifts pass rate 71% → 89%). Class A · must be generated or supplied.`;
      }
      return `BLOCKED · source check · EMR + LIS + RIS queried · pre-op pelvic MRI exists in PACS but did NOT sync to EMR overnight. ${c.payor_name} rule r1 requires MRI alongside ultrasound (+11.4 pts). Class B · cross-pull or supply directly.`;
    case "LOS_VARIANCE":
      return `BLOCKED · source check · standard packet has no extension letter (admit-time stay was within DRG benchmark of ${c.drg}). LOS now ${c.los_days}d · extension needed retroactively. Class A · must be generated or supplied.`;
    case "AGING_PA":
      return `BLOCKED · pre-auth aging beyond payor SLA. Auto-followup sent twice · escalation queue. Human must call ${c.payor_name} pre-auth desk.`;
    default:
      return `BLOCKED · ${c.risk_flag ?? "unknown"} flag set · manual review required.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Polling events generator — for Adjudicating + Pre-auth.
// Models the spec's "claim status tracking begins · acknowledgement expected
// within payor's SLA". Each event is rendered as a `poll` step in the trace.
// ─────────────────────────────────────────────────────────────────────────
export type PollEvent = {
  ts: string;        // ISO timestamp
  status: string;    // e.g. "Acknowledged", "Adjudication queued", "Adjudication in progress"
  detail: string;
};

function buildPollEvents(c: ClaimLike, daysInStage: number, mode: "pre-auth" | "adjudication"): AgentStep[] {
  const events = generatePollEvents(c, daysInStage, mode);
  return events.map((e, i) => ({
    id: `${c.id}_poll${i}`,
    kind: "poll",
    narration: `${e.status} · ${e.detail}`,
    probDelta: 0,
    ms: 0,
  }));
}

export function generatePollEvents(c: ClaimLike, daysInStage: number, mode: "pre-auth" | "adjudication"): PollEvent[] {
  // Always show an initial poll on day 0 (immediately after dispatch).
  const out: PollEvent[] = [];
  const submittedAt = c.submitted_at ? new Date(c.submitted_at) : new Date(Date.now() - daysInStage * 86400000);
  const addEvent = (offsetDays: number, status: string, detail: string) => {
    const ts = new Date(submittedAt.getTime() + offsetDays * 86400000);
    out.push({ ts: ts.toISOString(), status, detail });
  };

  if (mode === "pre-auth") {
    if (daysInStage >= 0) addEvent(0, "Pre-auth ack", "Payor confirmed receipt · queued for utilization review");
    if (daysInStage >= 1) addEvent(1, "In review", "Utilization team reviewing clinical justification");
    if (daysInStage >= 2) addEvent(2, "Document request", "Payor requested referral note · auto-pulled from EMR");
    if (daysInStage >= 3) addEvent(3, "Auto-followup #1", "Beyond 48h SLA · agent sent followup with case summary");
    if (daysInStage >= 4) addEvent(4, "Escalation", "Aging beyond 4d · escalated to TPA desk supervisor");
  } else {
    if (daysInStage >= 0) addEvent(0, "Acknowledged", "Claim accepted into adjudication queue");
    if (daysInStage >= 1) addEvent(1, "Coder review", "Payor coder reviewing ICD/DRG against contract schedule");
    if (daysInStage >= 2) addEvent(2, "Medical review", "Medical reviewer cross-checking necessity vs supporting docs");
    if (daysInStage >= 3) addEvent(3, "Pricing applied", "Line-item pricing computed · awaiting adjudication signoff");
    if (daysInStage >= 4) addEvent(4, "Auto-followup #1", "Beyond clean-claim SLA · agent pinged claims line");
    if (daysInStage >= 5) addEvent(5, "Escalation", "Aging beyond 5d · escalated to claims supervisor");
  }
  return out;
}

// Last-polled / next-polled summary for the receipt panel.
export function lastPolledSummary(_c: ClaimLike, mode: "pre-auth" | "adjudication"): { lastPolled: string; nextPolled: string; checksToday: number } {
  const now = new Date();
  const last = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago
  const next = new Date(now.getTime() + 90 * 60 * 1000); // 90 min from now
  const fmt = (d: Date) => d.toTimeString().slice(0, 5);
  // Pre-auth polls every 30 min · adjudication polls every 2h. Per-day counts:
  const checksPerDay = mode === "pre-auth" ? 24 : 12;
  return {
    lastPolled: `${fmt(last)} today`,
    nextPolled: `${fmt(next)} today`,
    checksToday: checksPerDay,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// AT_RISK · remediation mini-flows. Each risk flag has a sub-plan that the
// user can run; on completion, the acceptance score lifts and the next-stage
// CTA becomes visible.
// ─────────────────────────────────────────────────────────────────────────
export type RemediationPlan = {
  steps: AgentStep[];
  liftPts: number;       // expected acceptance lift after remediation
  nextActionLabel: string;
  blurb: string;         // what the agent will do, shown in the "Run remediation" button caption
  // ── Human-assist path · same lift, different mechanism ──
  humanUploadLabel: string;     // e.g. "Upload signed addendum (PDF)"
  humanUploadHint: string;      // accepted file types / what the human needs in hand
  humanUploadSteps: AgentStep[]; // streamed when the human path is taken
};

export function buildRemediationPlan(c: ClaimLike): RemediationPlan | null {
  if (!c.risk_flag) return null;

  if (c.risk_flag === "PA_MISMATCH") {
    return {
      liftPts: 38,
      nextActionLabel: "Send addendum · resubmit",
      blurb: "Agent pulls OT log → composes implant-substitution addendum citing Allianz §7.3 manufacturer-family rule → cross-checks lot/serial → routes for OT director e-signature.",
      steps: [
        { id: `${c.id}_rm1`, kind: "fetch", narration: "Pulling operative note + intra-op imaging from OT Management System.", probDelta: 5, ms: 800,
          artifact: { id: `${c.id}_rma1`, label: "Operative Note + Imaging", source: "Surgicare", kind: "clinical", bytes: "186 KB" } },
        { id: `${c.id}_rm2`, kind: "remediate", narration: "Composing addendum letter · cites Allianz Coverage Schedule §7.3 · manufacturer family rule applied · intra-op decision rationale extracted from OT log narrative.", probDelta: 12, ms: 1100,
          artifact: { id: `${c.id}_rma2`, label: "Addendum Letter (draft)", source: "Auto-Document Engine", kind: "narrative", bytes: "12 KB" } },
        { id: `${c.id}_rm3`, kind: "validate", narration: "Cross-checking addendum against implant lot/serial in OT log · match verified.", probDelta: 9, ms: 700 },
        { id: `${c.id}_rm4`, kind: "compose", narration: "Bundling addendum + operative note + manufacturer letter into amended packet · routing for OT director e-signature.", probDelta: 7, ms: 800 },
        { id: `${c.id}_rm5`, kind: "ready", narration: "Amended packet ready · acceptance lifted to 80%. Awaiting OT director sign-off before resubmission.", probDelta: 5, ms: 500 },
      ],
      humanUploadLabel: "Upload signed addendum (PDF)",
      humanUploadHint: "If OT director already drafted one · accepted: PDF · DOCX",
      humanUploadSteps: [
        { id: `${c.id}_hu1`, kind: "intake", narration: "Implant-substitution addendum · 2 pages · uploaded by user (OT desk).",
          probDelta: 14, ms: 700,
          artifact: { id: `${c.id}_hua1`, label: "Addendum Letter (signed PDF)", source: "Human upload", kind: "narrative", bytes: "94 KB" } },
        { id: `${c.id}_hu2`, kind: "validate", narration: "Verifying e-signature · OT director Dr. Andi Permadi (cert 2026-03-12) · signature valid · lot 70-9912 referenced in body matches OT log.", probDelta: 14, ms: 900 },
        { id: `${c.id}_hu3`, kind: "compose", narration: "Bundling uploaded addendum into amended packet · audit trail logged (uploader · timestamp · file hash).", probDelta: 8, ms: 700 },
        { id: `${c.id}_hu4`, kind: "ready", narration: "Amended packet ready · acceptance lifted to 80% via human upload path.", probDelta: 2, ms: 400 },
      ],
    };
  }

  if (c.risk_flag === "MISSING_DOC") {
    if (c.drg.includes("CARDIO") || c.drg.includes("PCI")) {
      return {
        liftPts: 18,
        nextActionLabel: "Add SYNTAX · resubmit",
        blurb: "Agent reads angiogram via NLP → derives SYNTAX score from lesion grading → composes worksheet → routes for cardiologist co-sign.",
        steps: [
          { id: `${c.id}_rm1`, kind: "fetch", narration: "Pulling coronary angiogram report from RIS · vessel involvement parsed by NLP.", probDelta: 4, ms: 800,
            artifact: { id: `${c.id}_rma1`, label: "Angiogram Report", source: "RIS", kind: "evidence", bytes: "92 KB" } },
          { id: `${c.id}_rm2`, kind: "remediate", narration: "Computing SYNTAX score · LAD-mid 75% B2 + RCA-distal 90% C1 (bifurcation) + LCX-prox 60% A · score 22 (intermediate). Composing worksheet to AIA template v3.1.", probDelta: 10, ms: 1100,
            artifact: { id: `${c.id}_rma2`, label: "SYNTAX Worksheet (draft)", source: "Auto-Document Engine", kind: "evidence", bytes: "8 KB" } },
          { id: `${c.id}_rm3`, kind: "validate", narration: `Rule r5 satisfied · ${c.payor_name} pass rate lifts 71% → 89% historically (89 evidence threads).`, probDelta: 4, ms: 700 },
          { id: `${c.id}_rm4`, kind: "ready", narration: "Worksheet attached · packet ready · awaiting board-cardiologist co-sign.", probDelta: 0, ms: 500 },
        ],
        humanUploadLabel: "Upload signed SYNTAX worksheet",
        humanUploadHint: "If cardiologist already scored it · accepted: PDF · DOCX · structured form",
        humanUploadSteps: [
          { id: `${c.id}_hu1`, kind: "intake", narration: "SYNTAX worksheet · 1 page · uploaded by user (cath lab desk).",
            probDelta: 8, ms: 700,
            artifact: { id: `${c.id}_hua1`, label: "SYNTAX Worksheet (signed)", source: "Human upload", kind: "evidence", bytes: "104 KB" } },
          { id: `${c.id}_hu2`, kind: "validate", narration: "Verifying signature · interventional cardiologist Dr. Wira (BC-cardio · cert 2025-11-04) · valid. Score 22 cross-checked vs angiogram NLP parse · concordant.", probDelta: 6, ms: 900 },
          { id: `${c.id}_hu3`, kind: "compose", narration: "Attaching worksheet to AIA-template packet · audit trail logged.", probDelta: 4, ms: 600 },
          { id: `${c.id}_hu4`, kind: "ready", narration: "Packet ready · acceptance recovered via human upload.", probDelta: 0, ms: 400 },
        ],
      };
    }
    return {
      liftPts: 16,
      nextActionLabel: "Attach MRI · resubmit",
      blurb: "Agent opens direct PACS bridge (DICOM gateway · separate from nightly EMR sync) → matches study type/date window → attaches structured report.",
      steps: [
        { id: `${c.id}_rm1`, kind: "fetch", narration: "Opening direct PACS bridge (DICOM gateway, distinct from nightly EMR sync) · matching study type + date window · pelvic MRI 2026-04-22 located.", probDelta: 6, ms: 800,
          artifact: { id: `${c.id}_rma1`, label: "Pelvic MRI Report", source: "PACS bridge", kind: "evidence", bytes: "1.2 MB" } },
        { id: `${c.id}_rm2`, kind: "remediate", narration: "Attaching MRI report alongside ultrasound · formatting to BPJS lampiran convention.", probDelta: 7, ms: 900 },
        { id: `${c.id}_rm3`, kind: "validate", narration: `Rule r1 satisfied · pass rate lifts +11.4 pts on this DRG cluster (184 evidence threads).`, probDelta: 3, ms: 700 },
        { id: `${c.id}_rm4`, kind: "ready", narration: "Packet ready · acceptance recovered · awaiting human approval.", probDelta: 0, ms: 500 },
      ],
      humanUploadLabel: "Upload pelvic MRI report",
      humanUploadHint: "If you already pulled the report locally · accepted: PDF · DICOM zip",
      humanUploadSteps: [
        { id: `${c.id}_hu1`, kind: "intake", narration: "Pelvic MRI report · 4 pages · uploaded by user (radiology coordinator).",
          probDelta: 9, ms: 700,
          artifact: { id: `${c.id}_hua1`, label: "Pelvic MRI Report (uploaded)", source: "Human upload", kind: "evidence", bytes: "1.4 MB" } },
        { id: `${c.id}_hu2`, kind: "validate", narration: "DICOM hash verified · radiologist signature present (Dr. Suharto, RAD cert 2024-08) · study date 2026-04-22 within 30d window.", probDelta: 5, ms: 900 },
        { id: `${c.id}_hu3`, kind: "compose", narration: "Attaching as separate PDF lampiran · audit trail logged.", probDelta: 2, ms: 600 },
        { id: `${c.id}_hu4`, kind: "ready", narration: "Packet ready · acceptance recovered via human upload.", probDelta: 0, ms: 400 },
      ],
    };
  }

  if (c.risk_flag === "LOS_VARIANCE") {
    return {
      liftPts: 22,
      nextActionLabel: "Send LOS extension · resubmit",
      blurb: "Agent pulls day 8-9 clinical notes + inflammatory marker trends → composes LOS extension letter with objective markers → routes for medical director co-sign.",
      steps: [
        { id: `${c.id}_rm1`, kind: "fetch", narration: "Pulling clinical notes + inflammatory marker trends for days 8-9.", probDelta: 4, ms: 800,
          artifact: { id: `${c.id}_rma1`, label: "Clinical Notes Day 8-9", source: "EMR", kind: "clinical", bytes: "76 KB" } },
        { id: `${c.id}_rm2`, kind: "remediate", narration: "Composing LOS extension letter · clinical justification: persistent CRP elevation + IV antibiotic dependence + readmission risk profile.", probDelta: 11, ms: 1200,
          artifact: { id: `${c.id}_rma2`, label: "LOS Extension Letter (draft)", source: "Auto-Document Engine", kind: "narrative", bytes: "14 KB" } },
        { id: `${c.id}_rm3`, kind: "validate", narration: "Internal Cendana data: severe CAP discharged with CRP > 50 has 18% readmission within 7d. Clinical justification strong.", probDelta: 5, ms: 700 },
        { id: `${c.id}_rm4`, kind: "ready", narration: "Extension letter routed for medical director co-sign before submission.", probDelta: 2, ms: 500 },
      ],
      humanUploadLabel: "Upload signed LOS extension",
      humanUploadHint: "If medical director already drafted one · accepted: PDF · DOCX",
      humanUploadSteps: [
        { id: `${c.id}_hu1`, kind: "intake", narration: "LOS extension letter · 3 pages · uploaded by user (utilization-mgmt desk).",
          probDelta: 14, ms: 700,
          artifact: { id: `${c.id}_hua1`, label: "LOS Extension Letter (signed)", source: "Human upload", kind: "narrative", bytes: "118 KB" } },
        { id: `${c.id}_hu2`, kind: "validate", narration: "Verifying co-signatures · Dr. Maya Suharto SpPD-KP + medical director Dr. Hartono · both valid. CRP/WBC trend in body matches EMR data.", probDelta: 6, ms: 900 },
        { id: `${c.id}_hu3`, kind: "compose", narration: "Bundling extension letter into amended packet · audit trail logged.", probDelta: 2, ms: 600 },
        { id: `${c.id}_hu4`, kind: "ready", narration: "Packet ready · acceptance recovered via human upload.", probDelta: 0, ms: 400 },
      ],
    };
  }

  if (c.risk_flag === "AGING_PA") {
    return {
      liftPts: 0,
      nextActionLabel: "Escalate to TPA desk",
      blurb: "Agent compiles case summary → sends formal escalation to BPJS pre-auth supervisor → opens ticket in TPA workqueue.",
      steps: [
        { id: `${c.id}_rm1`, kind: "fetch", narration: "Compiling case summary · admission, planned procedure, urgency level.", probDelta: 0, ms: 800 },
        { id: `${c.id}_rm2`, kind: "remediate", narration: "Drafting formal escalation email to BPJS supervisor · cc TPA desk + medical director.", probDelta: 0, ms: 1000,
          artifact: { id: `${c.id}_rma1`, label: "Escalation Email", source: "Auto-Document Engine", kind: "narrative", bytes: "6 KB" } },
        { id: `${c.id}_rm3`, kind: "tracking", narration: "TPA workqueue ticket opened · phone call scheduled with BPJS hotline at next available slot.", probDelta: 0, ms: 600 },
      ],
      humanUploadLabel: "Upload BPJS phone-log notes",
      humanUploadHint: "If you already called the desk · log + outcome",
      humanUploadSteps: [
        { id: `${c.id}_hu1`, kind: "intake", narration: "BPJS phone-log notes uploaded by TPA desk · call duration 12m · supervisor name + outcome captured.",
          probDelta: 0, ms: 700,
          artifact: { id: `${c.id}_hua1`, label: "Phone-log Notes", source: "Human upload", kind: "narrative", bytes: "8 KB" } },
        { id: `${c.id}_hu2`, kind: "tracking", narration: "Workqueue ticket linked to phone-log · escalation status updated.", probDelta: 0, ms: 600 },
      ],
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Live build plan (used by the BUILDING stage Run-agent flow).
// ─────────────────────────────────────────────────────────────────────────
export function buildLivePlan(c: ClaimLike): AgentStep[] {
  // Pre-fill plausible per-step durations for the live timer.
  const plan = buildGenericBuildPlan(c);
  return plan.map((s, i) => ({ ...s, ms: i === 0 ? 600 : 700 + (i % 3) * 80 }));
}
