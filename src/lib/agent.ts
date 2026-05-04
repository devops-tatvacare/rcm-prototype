// Mock agentic engine. Streams a sequence of decisions for a claim packet build.
// Each step has narration, optional artifact attachment, and a probability delta.

export type AgentStepKind =
  | "init"
  | "fetch"
  | "code"
  | "rule"
  | "compose"
  | "validate"
  | "ready"
  | "dispatch"
  | "ack"
  | "tracking"
  | "poll"
  | "block"
  | "remediate"
  | "intake";

export type Artifact = {
  id: string;
  label: string;
  source: string;
  kind: "clinical" | "admin" | "evidence" | "narrative" | "policy";
  bytes?: string; // human-readable size
  required?: boolean;
};

export type AgentStep = {
  id: string;
  kind: AgentStepKind;
  narration: string;
  artifact?: Artifact;
  ruleId?: string;
  probDelta: number; // additive to acceptance probability
  ms: number; // delay before this step fires (cumulative will be applied externally)
};

// Hysterectomy / BPJS scenario — Sari Wulandari, claim c1.
export const HYSTERECTOMY_BPJS_PLAN: AgentStep[] = [
  {
    id: "s0",
    kind: "init",
    narration:
      "Initializing agent · Patient MRN-734291 · INA-CBG O-6-13-I · BPJS Kesehatan. Pulling baseline acceptance from 612 historical threads on this DRG.",
    probDelta: 0,
    ms: 600,
  },
  {
    id: "s1",
    kind: "fetch",
    narration: "Pulling discharge summary from EMR (Cerner module) — locking after attending physician sign-off.",
    artifact: { id: "a1", label: "Discharge Summary", source: "EMR · Cerner", kind: "clinical", bytes: "112 KB", required: true },
    probDelta: 3,
    ms: 700,
  },
  {
    id: "s2",
    kind: "code",
    narration: "Coding — primary Dx N80.9 endometriosis, procedure 0UT90ZZ total laparoscopic hysterectomy. INA-CBG group locked.",
    artifact: { id: "a2", label: "ICD-10 + Procedure Codes", source: "Coder-AI · BERT-clinical", kind: "clinical", bytes: "4 KB" },
    probDelta: 3,
    ms: 700,
  },
  {
    id: "s3",
    kind: "fetch",
    narration:
      "Pulling 3 pre-op lab reports from LIS — BPJS template requires reference ranges, attaching as structured data (not scanned PDF).",
    artifact: { id: "a3", label: "Pre-op Labs (CBC, Coag, Beta-hCG)", source: "LIS · Roche", kind: "evidence", bytes: "38 KB" },
    probDelta: 3,
    ms: 750,
  },
  {
    id: "s4",
    kind: "rule",
    ruleId: "r1",
    narration:
      "Payor rule fired · 184 historical threads on this DRG show MRI presence raises pass rate by 11.4 pts. Pulling pelvic MRI from RIS · Carestream.",
    artifact: { id: "a4", label: "Pelvic MRI Report", source: "RIS · Carestream", kind: "evidence", bytes: "1.2 MB" },
    probDelta: 11.4,
    ms: 800,
  },
  {
    id: "s5",
    kind: "rule",
    ruleId: "r2",
    narration:
      "Payor rule fired · 213 threads suggest leading with conservative-management failure narrative. Drafting from gynaec progress notes.",
    artifact: { id: "a5", label: "Medical Necessity Narrative", source: "Auto-Document Engine", kind: "narrative", bytes: "9 KB" },
    probDelta: 8.3,
    ms: 850,
  },
  {
    id: "s6",
    kind: "fetch",
    narration: "Pulling OT record + anaesthesia log + implant ledger (no implant for this case — confirmed nil).",
    artifact: { id: "a6", label: "OT Record + Anaesthesia Log", source: "OT Mgmt · Surgicare", kind: "clinical", bytes: "76 KB" },
    probDelta: 3,
    ms: 700,
  },
  {
    id: "s7",
    kind: "validate",
    narration: "Pre-auth #PA-77821 cross-reference verified — scope and procedure match. Validity window 14 days remaining.",
    artifact: { id: "a7", label: "Pre-Auth Letter PA-77821", source: "Pre-auth desk", kind: "policy", bytes: "16 KB" },
    probDelta: 4,
    ms: 600,
  },
  {
    id: "s8",
    kind: "rule",
    ruleId: "r3",
    narration: "Format compliance · placing SEP number on page 1, top-right per BPJS submission convention (612 threads).",
    artifact: { id: "a8", label: "SEP Number Header", source: "Auto-Document Engine", kind: "admin", bytes: "1 KB" },
    probDelta: 5,
    ms: 600,
  },
  {
    id: "s9",
    kind: "compose",
    narration:
      "Composing claim packet — 12 artifacts, BPJS submission template v4.2. Running 312 scrubbing rules against the assembled bundle.",
    probDelta: 2,
    ms: 850,
  },
  {
    id: "s10",
    kind: "validate",
    narration: "Scrubbing complete · 0 critical · 1 advisory (LOS 4d sits at 75th percentile for INA-CBG O-6-13-I, within tolerance).",
    probDelta: 1.3,
    ms: 700,
  },
  {
    id: "s11",
    kind: "ready",
    narration:
      "Packet ready. Predicted first-pass acceptance 92%. Predicted days-to-payment 11. Submission channel: BPJS V-Claim REST. Awaiting human approval.",
    probDelta: 1,
    ms: 600,
  },
];
