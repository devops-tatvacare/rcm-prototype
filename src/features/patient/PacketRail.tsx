import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  CircleCheck,
  FileText,
  HelpCircle,
  Info,
  ScanSearch,
  Sparkles,
  Upload,
  ShieldCheck,
  ScrollText,
  Loader2,
} from "lucide-react";
import { Panel, PanelDivider, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Gauge } from "@/components/ui/Gauge";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { query } from "@/lib/db";
import type { StageKey } from "./JourneyTimeline";
import { UploadedDocsPanel, getPickableDocs, type Pickable } from "@/features/worklist/UploadedDocsPanel";
import type { ClaimContextRow, GlSubmissionRow } from "./PatientPage";

// Three packet "buckets" — each maps to a stage in the patient journey and
// to a real-world insurer interaction (initial GL, mid-stay top-up, final
// claim). The rail's required-docs checklist is grouped by these three.
type BucketKey = "gl" | "topup" | "final";

type DocItem = { id: string; label: string; clause?: string };
type DocStatus = "clean" | "missing";

const BUCKET_LABEL: Record<BucketKey, string> = {
  gl: "GL set",
  topup: "Top-up set",
  final: "Final claim set",
};

// ── Mocked extracted policy (Mode A) ─────────────────────────────────────
// A realistic-looking object the demo can present as "rules extracted from
// patient's PRUSolusi Sehat Tier-3 policy PDF". P5 may swap this per
// patient; for P4 it's a single shared mock so the flip looks real.
type ExtractedProfile = {
  payorLabel: string;
  docsByBucket: Record<BucketKey, DocItem[]>;
};

const DEFAULT_EXTRACTED_PROFILE: ExtractedProfile = {
  payorLabel: "PRUSolusi Sehat Tier-3",
  docsByBucket: {
    gl: [
      { id: "preauth", label: "Pre-auth Form", clause: "Page 7, clause 4.3" },
      { id: "lma", label: "LMA", clause: "Page 8, clause 4.4.1" },
      { id: "lmn", label: "Letter of Medical Necessity", clause: "Page 8, clause 4.4.2" },
      { id: "preopanaes", label: "Pre-op Anaesthesia Note", clause: "Page 9, clause 4.5" },
    ],
    topup: [
      { id: "intraop", label: "Intraoperative Finding Note", clause: "Page 11, clause 5.2" },
      { id: "addlma", label: "Top-up LMA addendum", clause: "Page 11, clause 5.3" },
      { id: "rce", label: "Revised Cost Estimate", clause: "Page 12, clause 5.4" },
    ],
    final: [
      { id: "opnote", label: "Op Note", clause: "Page 14, clause 6.1" },
      { id: "ds", label: "Discharge Summary", clause: "Page 14, clause 6.2" },
      { id: "inv", label: "Final Itemised Invoice", clause: "Page 15, clause 6.3" },
    ],
  } as Record<BucketKey, DocItem[]>,
};

const PATIENT_EXTRACTED_PROFILES: Record<string, ExtractedProfile> = {
  "p-budi": {
    payorLabel: "BPJS Cardiac Surgical Benefits",
    docsByBucket: {
      gl: [
        { id: "preauth", label: "BPJS surgical pre-auth form", clause: "Page 4, clause 2.1" },
        { id: "lmn", label: "Cardiothoracic medical necessity letter", clause: "Page 4, clause 2.2" },
        { id: "angio", label: "Coronary angiography report", clause: "Page 5, clause 2.4" },
        { id: "preopanaes", label: "Pre-op anaesthesia clearance", clause: "Page 5, clause 2.5" },
      ],
      topup: [
        { id: "intraop", label: "Intraoperative finding note", clause: "Page 7, clause 3.1" },
        { id: "addlma", label: "Top-up clinical addendum", clause: "Page 7, clause 3.2" },
        { id: "rce", label: "Revised cost estimate", clause: "Page 8, clause 3.4" },
      ],
      final: [
        { id: "opnote", label: "Operative report", clause: "Page 9, clause 4.1" },
        { id: "ds", label: "Discharge summary", clause: "Page 9, clause 4.2" },
        { id: "inv", label: "Final itemised invoice", clause: "Page 10, clause 4.4" },
      ],
    },
  },
  "p-siti": {
    payorLabel: "BPJS Obstetric Pre-auth Schedule",
    docsByBucket: {
      gl: [
        { id: "preauth", label: "BPJS obstetric pre-auth form", clause: "Page 3, clause 1.2" },
        { id: "obgyn", label: "OB-GYN consult note", clause: "Page 3, clause 1.4" },
        { id: "usg", label: "Fetal ultrasound + breech evidence", clause: "Page 4, clause 1.6" },
        { id: "anc", label: "Ante-natal summary + CTG", clause: "Page 4, clause 1.7" },
      ],
      topup: [
        { id: "opnote", label: "C-section operative note", clause: "Page 6, clause 2.1" },
        { id: "nicu", label: "Neonatal observation note", clause: "Page 6, clause 2.4" },
        { id: "rce", label: "Updated cost estimate if stay extends", clause: "Page 6, clause 2.5" },
      ],
      final: [
        { id: "ds", label: "Mother discharge summary", clause: "Page 8, clause 3.1" },
        { id: "inv", label: "Final obstetric invoice", clause: "Page 8, clause 3.2" },
        { id: "receipt", label: "SEP / settlement receipt", clause: "Page 8, clause 3.4" },
      ],
    },
  },
  p43: {
    payorLabel: "PRUSolusi Sehat Tier-3",
    docsByBucket: {
      gl: [
        { id: "preauth", label: "Pre-auth request form", clause: "Page 6, clause 3.1" },
        { id: "lmn", label: "Specialist medical necessity letter", clause: "Page 6, clause 3.2" },
        { id: "imaging", label: "Supporting MRI / imaging", clause: "Page 7, clause 3.4" },
        { id: "preopanaes", label: "Pre-op anaesthesia note", clause: "Page 7, clause 3.5" },
      ],
      topup: [
        { id: "opnote", label: "Operative finding note", clause: "Page 9, clause 4.1" },
        { id: "rce", label: "Revised cost estimate", clause: "Page 9, clause 4.3" },
        { id: "addlma", label: "Clinical addendum", clause: "Page 9, clause 4.4" },
      ],
      final: [
        { id: "ds", label: "Discharge summary", clause: "Page 11, clause 5.1" },
        { id: "inv", label: "Final itemised invoice", clause: "Page 11, clause 5.2" },
        { id: "receipt", label: "Settlement receipt", clause: "Page 11, clause 5.4" },
      ],
    },
  },
};

// Map active stage → which bucket is "current". Drives the default-expanded
// section, action button label, and per-doc status stubs.
function bucketForStage(stage: StageKey): BucketKey {
  if (stage === "consultation" || stage === "diagnostics" || stage === "preadmission") return "gl";
  if (stage === "admission" || stage === "surgery") return "topup";
  return "final"; // postop, discharge
}

const BUCKET_ORDER: BucketKey[] = ["gl", "topup", "final"];

// Stub per-doc status. For P3.3 we mark active-bucket docs as 60% clean / 40%
// missing, pre-active buckets as all clean, post-active as all missing. P5
// will wire to real per-patient packet readiness data.
function statusFor(bucket: BucketKey, active: BucketKey, idx: number, total: number): DocStatus {
  const order = BUCKET_ORDER.indexOf(bucket);
  const activeIdx = BUCKET_ORDER.indexOf(active);
  if (order < activeIdx) return "clean";
  if (order > activeIdx) return "missing";
  // Active bucket: ~60% clean, ~40% missing. Take the first 60% as clean.
  const cleanCount = Math.ceil(total * 0.6);
  return idx < cleanCount ? "clean" : "missing";
}

function actionLabelFor(stage: StageKey): string {
  if (stage === "consultation" || stage === "diagnostics" || stage === "preadmission") return "Submit GL";
  if (stage === "admission" || stage === "surgery") return "Submit top-up";
  return "Submit final claim";
}

type GlState =
  | "not_started"
  | "drafting"
  | "submitted"
  | "approved"
  | "rejected"
  | "partial";

type RailScenario = {
  acceptanceProbability: number;
  blockers: string[];
  sla: {
    elapsedPct: number;
    remainingLabel: string;
    tone: "ok" | "warn" | "danger";
  };
};

function buildGlStateMap(rows: GlSubmissionRow[]): Record<BucketKey, GlState> {
  const byKind: Record<BucketKey, GlState> = {
    gl: "not_started",
    topup: "not_started",
    final: "not_started",
  };
  for (const row of rows) {
    const next = (row.state as GlState) ?? "not_started";
    if (row.kind === "initial") byKind.gl = next;
    if (row.kind === "topup") byKind.topup = next;
    if (row.kind === "final") byKind.final = next;
  }
  return byKind;
}

function actionLabelForRail(stage: StageKey, rows: GlSubmissionRow[]): string {
  const gl = buildGlStateMap(rows);
  if (gl.gl !== "approved") return "Submit GL";
  if (gl.topup !== "not_started" && gl.topup !== "approved") return "Submit top-up";
  if (gl.final === "partial" || gl.final === "rejected") return "Send appeal";
  if (gl.final === "approved") return "Mark closed";
  return actionLabelFor(stage);
}

function actionGuidanceForRail(
  stage: StageKey,
  rows: GlSubmissionRow[],
  hasActiveDenial: boolean,
): { action: string; instruction: string } {
  const gl = buildGlStateMap(rows);
  const action = actionLabelForRail(stage, rows);
  if (hasActiveDenial || gl.final === "partial" || gl.final === "rejected") {
    return {
      action,
      instruction:
        "Attach the missing rebuttal evidence, confirm the linked rule, and send the appeal back to the insurer.",
    };
  }
  if (gl.gl !== "approved") {
    return {
      action,
      instruction:
        "Confirm the minimum pre-auth packet for this stage, clear missing evidence, and send the initial authorization request.",
    };
  }
  if (stage === "admission" || stage === "surgery") {
    return {
      action,
      instruction:
        "Review any scope, stay, or cost changes since the approved GL and raise the top-up request if coverage needs to be extended.",
    };
  }
  if (gl.final === "approved") {
    return {
      action,
      instruction: "Settlement is complete. Reconcile the case summary and close the file.",
    };
  }
  return {
    action,
    instruction:
      "Reconcile the discharge summary, operative documents, and final invoice, then send the completed claim bundle.",
  };
}

function scenarioForPatient(
  patientId: string,
  claim: ClaimContextRow | null,
  hasActiveDenial: boolean,
): RailScenario {
  const acceptanceProbability = Math.round((claim?.acceptance_score ?? 0.78) * 100);
  if (patientId === "p-budi") {
    return {
      acceptanceProbability,
      blockers: ["No active blockers — all three submissions were approved and settled."],
      sla: {
        elapsedPct: 100,
        remainingLabel: "SLA met · settled in 6d",
        tone: "ok",
      },
    };
  }
  if (patientId === "p-siti") {
    return {
      acceptanceProbability,
      blockers: [
        "Awaiting BPJS pre-auth review on the initial C-section packet.",
        "OR slot release depends on insurer approval inside the 48h window.",
      ],
      sla: {
        elapsedPct: 37.5,
        remainingLabel: "18h elapsed of 48h",
        tone: "warn",
      },
    };
  }
  if (patientId === "p-ravi" || hasActiveDenial) {
    return {
      acceptanceProbability,
      blockers: [
        "Appeal letter is still in draft and has not been submitted to AIA.",
        "Need the medical-necessity evidence pack attached to rebut the prorate.",
      ],
      sla: {
        elapsedPct: 13.3,
        remainingLabel: "Appeal SLA · 26d remaining of 30d",
        tone: "ok",
      },
    };
  }
  if (patientId === "p43") {
    return {
      acceptanceProbability,
      blockers: [
        "Outside-clinic evidence still needs to be uploaded and extracted.",
        "Cashless request cannot be sent until referral, imaging, and anaesthesia support are attached.",
      ],
      sla: {
        elapsedPct: 12.5,
        remainingLabel: "Packet build · waiting on uploaded evidence",
        tone: "warn",
      },
    };
  }
  return {
    acceptanceProbability,
    blockers: [
      "Awaiting signed Pre-op Anaesthesia Note",
      "Pending CBC freshness — re-order if delayed past 14:00",
    ],
    sla: {
      elapsedPct: 60,
      remainingLabel: "18h remaining",
      tone: "ok",
    },
  };
}

type Mode = "A" | "B";

// ── Mode B: payor rule rows from DB ──────────────────────────────────────
type PayorRuleRow = {
  id: string;
  payor_id: string;
  category: string;
  description: string;
  threshold_value: string;
  source_confidence: string;
  evidence_threads: number;
  lift_pct: number;
};

type PayorMeta = { name: string };

type UploadedDocRow = {
  id: string;
  owner_kind: string;
  kind: string;
  filename: string;
  status: string;
  ocr_excerpt: string;
  extracted_icd: string | null;
  extracted_cpt: string | null;
  extracted_drg: string | null;
};

type DerivationKind = "extracted" | "industry_typical" | "admin_added" | "promoted_from_denial";

const DERIV_META: Record<
  DerivationKind,
  { label: string; tone: "champagne" | "neutral" | "info" | "good"; tooltip: string }
> = {
  extracted: {
    label: "Extracted",
    tone: "champagne",
    tooltip: "Extracted from official payor policy / regulation source.",
  },
  industry_typical: {
    label: "Industry-typical",
    tone: "neutral",
    tooltip: "Industry-typical rule observed across Indonesian payors.",
  },
  admin_added: {
    label: "Admin",
    tone: "info",
    tooltip: "Hospital admin added this rule from local experience.",
  },
  promoted_from_denial: {
    label: "Learned",
    tone: "good",
    tooltip: "Auto-learned from prior denial outcomes at this payor.",
  },
};

const DOC_STATUS_TONE: Record<string, "neutral" | "info" | "champagne" | "good"> = {
  uploaded: "neutral",
  ocr_running: "info",
  ocr_done: "champagne",
  coded: "champagne",
  handed_to_packet: "good",
};

const DOC_KIND_LABEL: Record<string, string> = {
  policy_certificate: "Policy PDF",
  handwritten_referral: "Handwritten referral",
  handwritten_progress: "Handwritten note",
  handwritten_anesthesia: "Anaesthesia note",
  consult_note: "Consult note",
  ed_note: "ED note",
  lab_result: "Lab result",
  imaging: "Imaging",
  discharge_summary: "Discharge summary",
  op_report: "Procedure note",
  preauth_form: "Pre-auth form",
  invoice: "Invoice",
  other: "Supporting file",
};

type MatchRow = {
  id: string;
  signal: string;
  result: string;
  tone: "info" | "champagne" | "good";
};

type PacketRequirement = {
  id: string;
  label: string;
  status: "received" | "pending";
  basis: string;
  support: string;
};

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function docKindLabel(kind: string): string {
  return DOC_KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

function docKindIcon(kind: string) {
  if (kind === "policy_certificate") return ShieldCheck;
  if (kind.startsWith("handwritten") || kind === "consult_note" || kind === "ed_note") return ScrollText;
  return FileText;
}

function buildMatchRows({
  mode,
  docs,
  claim,
  activeBucket,
  extractedProfile,
  rulesByBucket,
}: {
  mode: Mode;
  docs: UploadedDocRow[];
  claim: ClaimContextRow | null;
  activeBucket: BucketKey;
  extractedProfile: ExtractedProfile;
  rulesByBucket: Record<BucketKey, PayorRuleRow[]>;
}): MatchRow[] {
  const icd = uniqueNonEmpty(docs.map((d) => d.extracted_icd))[0] ?? null;
  const drg = uniqueNonEmpty([claim?.drg, ...docs.map((d) => d.extracted_drg)])[0] ?? null;
  const hasPolicy = docs.some((d) => d.kind === "policy_certificate");
  const handwrittenDoc = docs.find(
    (d) => d.kind.startsWith("handwritten") || d.kind === "consult_note" || d.kind === "ed_note",
  );
  const activeRule = rulesByBucket[activeBucket]?.[0] ?? null;
  const activeRuleCount = rulesByBucket[activeBucket]?.length ?? 0;
  const activeDocs = extractedProfile.docsByBucket[activeBucket] ?? [];

  if (mode === "A") {
    return [
      hasPolicy
        ? {
            id: "policy",
            signal: "Policy PDF on file",
            result: `${extractedProfile.payorLabel} loaded for live clause matching.`,
            tone: "champagne",
          }
        : null,
      drg
        ? {
            id: "drg",
            signal: drg,
            result: `${BUCKET_LABEL[activeBucket]} selected from extracted patient context.`,
            tone: "info",
          }
        : null,
      icd
        ? {
            id: "icd",
            signal: `ICD ${icd}`,
            result: `${activeDocs.length} insurer requirements mapped to this episode.`,
            tone: "good",
          }
        : null,
      handwrittenDoc
        ? {
            id: "ocr",
            signal: docKindLabel(handwrittenDoc.kind),
            result: "OCR pulled clinical facts into the packet matcher.",
            tone: "good",
          }
        : null,
    ].filter((row): row is MatchRow => row !== null);
  }

  return [
    drg
      ? {
          id: "drg",
          signal: drg,
          result: `Matched ${activeRuleCount} learned ${BUCKET_LABEL[activeBucket].toLowerCase()} rules.`,
          tone: "info",
        }
      : null,
    icd && activeRule
      ? {
          id: "icd",
          signal: `ICD ${icd}`,
          result: truncate(activeRule.description, 56),
          tone: "champagne",
        }
      : null,
    handwrittenDoc
      ? {
          id: "ocr",
          signal: docKindLabel(handwrittenDoc.kind),
          result: "Scanned note strengthened the evidence used for rule matching.",
          tone: "good",
        }
      : null,
  ].filter((row): row is MatchRow => row !== null);
}

function packetLabelForBucket(bucket: BucketKey, hasActiveDenial: boolean): string {
  if (hasActiveDenial || bucket === "final") return hasActiveDenial ? "Appeal packet" : "Final claim packet";
  if (bucket === "topup") return "Top-up packet";
  return "Initial GL packet";
}

function supportingKindsForRequirement(requirementId: string, label: string): string[] {
  const text = `${requirementId} ${label}`.toLowerCase();
  if (text.includes("preauth")) return ["preauth_form"];
  if (text.includes("anaes")) return ["handwritten_anesthesia"];
  if (text.includes("angio") || text.includes("ultrasound") || text.includes("usg") || text.includes("imaging") || text.includes("mri") || text.includes("echo")) {
    return ["imaging", "echo_report"];
  }
  if (text.includes("lab") || text.includes("cbc") || text.includes("ctg")) return ["lab_result"];
  if (text.includes("op note") || text.includes("operative") || text.includes("intraoperative") || text.includes("finding")) {
    return ["op_report"];
  }
  if (text.includes("invoice") || text.includes("estimate") || text.includes("receipt")) return ["invoice"];
  if (text.includes("discharge")) return ["discharge_summary"];
  if (text.includes("medical necessity") || text.includes("consult") || text.includes("referral") || text.includes("ob-gyn") || text.includes("ante-natal") || text.includes("clinical addendum")) {
    return ["handwritten_referral", "consult_note", "handwritten_progress"];
  }
  return [];
}

function findSupportingDoc(requirementId: string, label: string, docs: UploadedDocRow[]) {
  const kinds = supportingKindsForRequirement(requirementId, label);
  return docs.find((doc) => kinds.includes(doc.kind)) ?? null;
}

function buildPacketRequirements({
  mode,
  patientId,
  claim,
  activeBucket,
  extractedProfile,
  rulesByBucket,
  uploadedDocs,
  payorName,
}: {
  mode: Mode;
  patientId: string;
  claim: ClaimContextRow | null;
  activeBucket: BucketKey;
  extractedProfile: ExtractedProfile;
  rulesByBucket: Record<BucketKey, PayorRuleRow[]>;
  uploadedDocs: UploadedDocRow[];
  payorName: string;
}): PacketRequirement[] {
  if (patientId === "p43" && activeBucket === "gl") {
    const requiredUploads = getPickableDocs("patient", patientId).filter((doc) => doc.kind !== "policy_certificate");
    return requiredUploads.map((doc) => {
      const supportingDoc = uploadedDocs.find((row) => row.kind === doc.kind) ?? null;
      return {
        id: `upload-${doc.kind}`,
        label: docKindLabel(doc.kind),
        status: supportingDoc ? "received" : "pending",
        basis: uploadRequirementBasis(doc),
        support: supportingDoc ? `${docKindLabel(supportingDoc.kind)} uploaded` : "Pending upload",
      };
    });
  }
  const requirementDocs = extractedProfile.docsByBucket[activeBucket] ?? [];
  const prefersUploadedEvidence = patientId === "p43" || claim?.source === "DOC_UPLOAD";
  return requirementDocs.map((doc, idx) => {
    const supportingDoc = findSupportingDoc(doc.id, doc.label, uploadedDocs);
    const syntheticStatus = prefersUploadedEvidence ? "missing" : statusFor(activeBucket, activeBucket, idx, requirementDocs.length);
    const received = Boolean(supportingDoc) || syntheticStatus === "clean";
    const supportingLabel = supportingDoc
      ? `${docKindLabel(supportingDoc.kind)} uploaded`
      : received
        ? "Connected records available"
        : "Pending";
    const learnedRule = rulesByBucket[activeBucket]?.[idx]?.description ?? null;
    return {
      id: doc.id,
      label: doc.label,
      status: received ? "received" : "pending",
      basis:
        mode === "A"
          ? doc.clause ?? `Required by ${extractedProfile.payorLabel}`
          : truncate(learnedRule ?? `Observed in prior ${payorName} cases`, 88),
      support: supportingLabel,
    };
  });
}

function uploadRequirementBasis(doc: Pickable): string {
  switch (doc.kind) {
    case "handwritten_referral":
      return "Needed to confirm specialist referral and planned procedure.";
    case "imaging":
      return "Needed to support diagnosis and surgical indication.";
    case "lab_result":
      return "Needed to confirm pre-op clinical readiness.";
    case "handwritten_anesthesia":
      return "Needed to confirm anaesthesia clearance for the request.";
    default:
      return "Needed to complete the current packet.";
  }
}

// Map payor_rules.category → display bucket
function bucketForCategory(cat: string): BucketKey {
  if (cat === "documentation") return "gl";
  if (cat === "financial") return "topup";
  return "final"; // 'process' and any other
}

const POLL_INTERVAL_MS = 1500;
const ANIM_DURATION_MS = 1500;

export function PacketRail({
  patientId,
  payorId,
  activeStage,
  claim,
  glSubmissions,
  hasActiveDenial = false,
}: {
  patientId: string;
  payorId: string | null;
  activeStage: StageKey;
  claim: ClaimContextRow | null;
  glSubmissions: GlSubmissionRow[];
  hasActiveDenial?: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [animState, setAnimState] = useState<"idle" | "animating" | "ready">("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocRow[]>([]);
  const animTimer = useRef<number | null>(null);

  // Mode resolution: Mode A iff this patient has uploaded a policy_certificate.
  // Polls every ~1.5s so an upload (or the dev toggle) flips the rail live.
  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      const rows = await query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM uploaded_docs
          WHERE owner_kind = 'patient'
            AND owner_id = ?
            AND kind = 'policy_certificate'`,
        [patientId],
      );
      if (cancelled) return;
      const n = rows[0]?.n ?? 0;
      const next: Mode = n > 0 ? "A" : "B";
      setMode((prev) => {
        if (prev === next) return prev;
        // Trigger extraction animation only on the 0→1 transition during
        // this session — not on first mount when policy was already there.
        if (prev === "B" && next === "A") {
          setAnimState("animating");
          if (animTimer.current) window.clearTimeout(animTimer.current);
          animTimer.current = window.setTimeout(() => {
            setAnimState("ready");
          }, ANIM_DURATION_MS);
        } else if (next === "A") {
          // First load with policy already present — skip animation.
          setAnimState("ready");
        } else {
          setAnimState("idle");
        }
        return next;
      });
    }
    fetchOnce();
    const interval = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (animTimer.current) window.clearTimeout(animTimer.current);
    };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDocs() {
      const rows = await query<UploadedDocRow>(
        `SELECT id, owner_kind, kind, filename, status, ocr_excerpt, extracted_icd, extracted_cpt, extracted_drg
           FROM uploaded_docs
          WHERE patient_id = ?
          ORDER BY CASE owner_kind
                     WHEN 'patient' THEN 1
                     WHEN 'claim' THEN 2
                     WHEN 'inpatient' THEN 3
                     ELSE 4
                   END, sort ASC`,
        [patientId],
      );
      if (!cancelled) setUploadedDocs(rows);
    }
    fetchDocs();
    const interval = window.setInterval(fetchDocs, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [patientId]);

  const activeBucket = useMemo(() => bucketForStage(activeStage), [activeStage]);
  const extractedProfile = PATIENT_EXTRACTED_PROFILES[patientId] ?? DEFAULT_EXTRACTED_PROFILE;
  const extractedRuleCount = useMemo(
    () =>
      extractedProfile.docsByBucket.gl.length +
      extractedProfile.docsByBucket.topup.length +
      extractedProfile.docsByBucket.final.length,
    [extractedProfile],
  );
  const scenario = useMemo(
    () => scenarioForPatient(patientId, claim, hasActiveDenial),
    [patientId, claim, hasActiveDenial],
  );

  // ── Mode B: load payor rules + meta ────────────────────────────────────
  const [payorRules, setPayorRules] = useState<PayorRuleRow[]>([]);
  const [payorMeta, setPayorMeta] = useState<PayorMeta | null>(null);
  useEffect(() => {
    if (!payorId) return;
    let cancelled = false;
    (async () => {
      const [rules, payors] = await Promise.all([
        query<PayorRuleRow>(
          `SELECT id, payor_id, category, description, threshold_value,
                  source_confidence, evidence_threads, lift_pct
             FROM payor_rules
            WHERE payor_id = ?
            ORDER BY lift_pct DESC`,
          [payorId],
        ),
        query<PayorMeta>(`SELECT name FROM payors WHERE id = ?`, [payorId]),
      ]);
      if (cancelled) return;
      setPayorRules(rules);
      setPayorMeta(payors[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [payorId]);

  // Group rules by display bucket, ordered by lift_pct desc, capped at 10.
  const rulesByBucket = useMemo(() => {
    const out: Record<BucketKey, PayorRuleRow[]> = { gl: [], topup: [], final: [] };
    for (const r of payorRules) out[bucketForCategory(r.category)].push(r);
    (Object.keys(out) as BucketKey[]).forEach((k) => {
      out[k] = out[k].slice(0, 10);
    });
    return out;
  }, [payorRules]);

  const totalThreads = useMemo(
    () => payorRules.reduce((acc, r) => acc + (r.evidence_threads ?? 0), 0),
    [payorRules],
  );
  const guidance = useMemo(
    () => actionGuidanceForRail(activeStage, glSubmissions, Boolean(hasActiveDenial)),
    [activeStage, glSubmissions, hasActiveDenial],
  );
  const packetRequirements = useMemo(
    () =>
      buildPacketRequirements({
        mode: mode ?? "B",
        patientId,
        claim,
        activeBucket,
        extractedProfile,
        rulesByBucket,
        uploadedDocs,
        payorName: payorMeta?.name ?? "this payor",
      }),
    [mode, patientId, claim, activeBucket, extractedProfile, rulesByBucket, uploadedDocs, payorMeta?.name],
  );
  const receivedCount = packetRequirements.filter((item) => item.status === "received").length;
  const pendingCount = packetRequirements.length - receivedCount;
  const readyToSubmit = pendingCount === 0 || guidance.action === "Mark closed";

  function onSubmit() {
    const label = actionLabelForRail(activeStage, glSubmissions);
    setActionMessage(`${label} queued.`);
    window.setTimeout(() => setActionMessage(null), 2400);
  }

  if (mode === null) {
    return (
      <div className="flex flex-col gap-3">
        <Panel tone="raised">
          <div className="px-4 py-3 font-mono-tight text-[11px] text-ink-faint">Loading…</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <Panel tone="raised">
        <PanelHeader
          eyebrow={packetLabelForBucket(activeBucket, Boolean(hasActiveDenial))}
          title={guidance.action}
          density="compact"
        />
        <PanelDivider />
        <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{guidance.instruction}</p>
            <div className="flex flex-wrap gap-1.5">
              <ActionBadge label={`Stage · ${activeBucket === "gl" ? "Pre-auth" : activeBucket === "topup" ? "Top-up" : hasActiveDenial ? "Appeal" : "Final claim"}`} />
              <ActionBadge label={`SLA · ${scenario.sla.remainingLabel}`} />
              <ActionBadge label={`${receivedCount}/${packetRequirements.length} requirements ready`} />
              <ActionBadge label={mode === "A" ? "Requirements from uploaded policy" : `Requirements learned from ${payorMeta?.name ?? "prior cases"}`} />
            </div>
            {scenario.blockers.length > 0 && (
              <div className="rounded-lg border border-line-soft bg-[var(--color-panel-2)]/24 px-3 py-3">
                <div className="font-mono-tight text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  Blocking this submission
                </div>
                <ul className="mt-2 flex flex-col gap-1.5 font-mono-tight text-[11px] leading-relaxed text-ink-soft">
                  {scenario.blockers.map((blocker) => (
                    <li key={blocker} className="flex gap-2">
                      <span className="mt-[5px] inline-block h-1 w-1 rounded-full bg-[var(--color-coral)]" />
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-line-soft bg-[var(--color-panel-2)]/24 px-3 py-3">
              <div className="font-mono-tight text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                Submission readiness
              </div>
              <div className="mt-1 text-[16px] tracking-tight text-ink-soft">
                {readyToSubmit ? "Ready to send" : `${pendingCount} requirement${pendingCount === 1 ? "" : "s"} pending`}
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-ink-faint">
                {readyToSubmit
                  ? "The packet has the required evidence for this stage."
                  : "Complete the pending checklist items before sending this packet."}
              </div>
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={onSubmit} disabled={!readyToSubmit}>
              {guidance.action}
            </Button>
            {actionMessage && (
              <div className="text-center font-mono-tight text-[10.5px] text-[var(--color-emerald)]">
                {actionMessage}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Required for this packet"
            title="Requirements"
            density="compact"
            right={<Info size={12} className="text-ink-faint" />}
          />
          <PanelDivider />
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-1">
                <ModeBadge mode={mode} />
                <ModeSubBanner
                  mode={mode}
                  animState={animState}
                  ruleCount={extractedRuleCount}
                  payorLabel={extractedProfile.payorLabel}
                  payorName={payorMeta?.name ?? "this payor"}
                  threadCount={totalThreads}
                />
              </div>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                {receivedCount} received · {pendingCount} pending
              </span>
            </div>
            <div className="border-t border-line-soft">
              {packetRequirements.map((item) => (
                <PacketRequirementRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        </Panel>

        <UploadedDocsPanel ownerKind="patient" ownerId={patientId} patientId={patientId} />
      </div>
    </div>
  );
}

// ── Rule-source badge ─────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: Mode }) {
  const isA = mode === "A";
  const tooltip = isA
    ? "Rules are being read from the patient's uploaded policy document."
    : "Rules are coming from the hospital's learned payor intelligence.";
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 4, scale: 0.98 }}
        animate={
          isA
            ? {
                opacity: 1,
                y: 0,
                scale: 1,
                boxShadow: [
                  "0 0 0 0 rgba(0,0,0,0)",
                  "0 0 0 6px var(--color-champagne, #d4a574)40",
                  "0 0 0 0 rgba(0,0,0,0)",
                ],
              }
            : { opacity: 1, y: 0, scale: 1 }
        }
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
        title={tooltip}
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-3 py-1.5",
          isA
            ? "border-[var(--color-champagne)]/40 bg-[var(--color-champagne)]/12"
            : "border-[var(--color-violet)]/40 bg-[var(--color-violet)]/12",
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full px-2 font-mono-tight text-[10px] font-semibold uppercase tracking-wider",
            isA
              ? "bg-[var(--color-champagne)] text-[var(--color-canvas-deep)]"
              : "bg-[var(--color-violet)] text-[var(--color-canvas-deep)]",
            )}
        >
          {isA ? "Policy-derived" : "Case-learned"}
        </span>
        <span className="font-mono-tight text-[11px] text-ink-soft">
          {isA ? "Uploaded policy" : "Historical payor rules"}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Rule-source sub-banner ───────────────────────────────────────────────
function ModeSubBanner({
  mode,
  animState,
  ruleCount,
  payorLabel,
  payorName,
  threadCount,
}: {
  mode: Mode;
  animState: "idle" | "animating" | "ready";
  ruleCount: number;
  payorLabel: string;
  payorName: string;
  threadCount: number;
}) {
  if (mode === "B") {
    return (
      <div className="font-mono-tight text-[10.5px] leading-snug text-ink-faint">
        Learned from <span className="text-ink-soft">{threadCount.toLocaleString()}</span> prior cases at{" "}
        <span className="text-ink-soft">{payorName}</span>
      </div>
    );
  }
  if (animState === "animating") {
    return (
      <motion.div
        key="animating"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1.5 font-mono-tight text-[10.5px] text-[var(--color-champagne)]"
      >
        <Sparkles size={11} className="animate-pulse" />
        <Loader2 size={10} className="animate-spin" />
        <span>Extracting rules from uploaded policy…</span>
      </motion.div>
    );
  }
  return (
    <motion.div
      key="ready"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-faint"
    >
      <Sparkles size={11} className="text-[var(--color-champagne)]" />
      <span>
        Loaded <span className="text-ink-soft">{ruleCount}</span> rules from{" "}
        <span className="text-ink-soft">{payorLabel}</span>
      </span>
    </motion.div>
  );
}

function StatusPanel({
  acceptanceProbability,
  elapsedPct,
  remainingLabel,
  tone,
}: {
  acceptanceProbability: number;
  elapsedPct: number;
  remainingLabel: string;
  tone: "ok" | "warn" | "danger";
}) {
  return (
    <Panel>
      <PanelHeader eyebrow="Status" title="Readiness and timing" density="compact" />
      <PanelDivider />
      <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
        <MetricTile label="Acceptance probability" value={`${acceptanceProbability}%`} />
        <div className="rounded-lg border border-line-soft bg-[var(--color-panel-2)]/30 px-3 py-2.5">
          <div className="font-mono-tight text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
            Time remaining
          </div>
          <div className="mt-1 text-[12px] leading-snug text-ink-soft">{remainingLabel}</div>
          <div className="mt-2">
            <SlaBar elapsedPct={elapsedPct} remainingLabel="" tone={tone} compact />
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ── SLA bar ───────────────────────────────────────────────────────────────
function SlaBar({
  elapsedPct,
  remainingLabel,
  tone,
  compact = false,
}: {
  elapsedPct: number;
  remainingLabel: string;
  tone: "ok" | "warn" | "danger";
  compact?: boolean;
}) {
  const fill =
    tone === "ok"
      ? "bg-[var(--color-emerald)]"
      : tone === "warn"
        ? "bg-[var(--color-champagne)]"
        : "bg-[var(--color-coral)]";
  return (
    <>
      {remainingLabel ? (
        <div className="flex items-baseline justify-between">
          <span className="font-mono-tight text-[11px] text-ink-soft">{remainingLabel}</span>
          <span className="font-mono-tight text-[10px] text-ink-faint">
            {Math.round(elapsedPct)}% elapsed
          </span>
        </div>
      ) : (
        <div className="mb-1 flex justify-end">
          <span className="font-mono-tight text-[10px] text-ink-faint">
            {Math.round(elapsedPct)}% elapsed
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
        <div
          className={cn("rounded-full transition-[width] duration-500", fill, compact ? "h-1.5" : "h-full")}
          style={{ width: `${Math.max(0, Math.min(100, elapsedPct))}%` }}
        />
      </div>
    </>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-[var(--color-panel-2)]/30 px-3 py-2.5">
      <div className="font-mono-tight text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div className="mt-1 text-[16px] tracking-tight text-ink-soft">{value}</div>
    </div>
  );
}

function FlowStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line-soft bg-[var(--color-panel-2)]/30 px-3 py-2">
      <div className="flex items-center gap-1.5 font-mono-tight text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[12px] text-ink-soft">{value}</div>
    </div>
  );
}

function MatchRowCard({ row }: { row: MatchRow }) {
  const toneClass =
    row.tone === "good"
      ? "border-[var(--color-emerald)]/20 bg-[var(--color-emerald)]/6"
      : row.tone === "champagne"
        ? "border-[var(--color-champagne)]/20 bg-[var(--color-champagne)]/6"
        : "border-[var(--color-azure)]/20 bg-[var(--color-azure)]/6";
  return (
    <div className={cn("rounded-lg border px-3 py-2", toneClass)}>
      <div className="font-mono-tight text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
        {row.signal}
      </div>
      <div className="mt-1 text-[11.5px] leading-snug text-ink-soft">{row.result}</div>
    </div>
  );
}

function ActionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line-soft bg-[var(--color-panel-2)]/30 px-2.5 py-1 font-mono-tight text-[10px] text-ink-soft">
      {label}
    </span>
  );
}

function PacketRequirementRow({ item }: { item: PacketRequirement }) {
  return (
    <div className="border-t border-line-soft px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {item.status === "received" ? (
            <CircleCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-emerald)]" />
          ) : (
            <HelpCircle size={14} className="mt-0.5 shrink-0 text-[var(--color-amber)]" />
          )}
          <div className="min-w-0">
            <div className="text-[12.5px] text-ink">{item.label}</div>
            <div className="mt-0.5 font-mono-tight text-[10.5px] leading-snug text-ink-faint">
              {item.basis}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 font-mono-tight text-[10px]",
            item.status === "received"
              ? "bg-[var(--color-emerald)]/10 text-[var(--color-emerald)]"
              : "bg-[var(--color-amber)]/10 text-[var(--color-amber)]",
          )}
        >
          {item.status === "received" ? "Received" : "Pending"}
        </span>
      </div>
      <div className="mt-2 pl-6">
        <span className="font-mono-tight text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          Evidence
        </span>
        <div className="mt-1 text-[11.5px] leading-snug text-ink-soft">{item.support}</div>
      </div>
    </div>
  );
}

// ── Checklist accordion — Mode A (extracted policy) ──────────────────────
function ChecklistAccordionA({
  activeBucket,
  profile,
}: {
  activeBucket: BucketKey;
  profile: ExtractedProfile;
}) {
  const [openSet, setOpenSet] = useState<Record<BucketKey, boolean>>({
    gl: activeBucket === "gl",
    topup: activeBucket === "topup",
    final: activeBucket === "final",
  });

  function toggle(b: BucketKey) {
    setOpenSet((prev) => ({ ...prev, [b]: !prev[b] }));
  }

  return (
    <div className="flex flex-col">
      {BUCKET_ORDER.map((b, i) => {
        const docs = profile.docsByBucket[b];
        const cleanCount = docs.reduce(
          (acc, _d, idx) => acc + (statusFor(b, activeBucket, idx, docs.length) === "clean" ? 1 : 0),
          0,
        );
        const open = openSet[b];
        return (
          <div key={b} id={`checklist-bucket-${b}`} className={cn(i > 0 && "border-t border-line-soft")}>
            <button
              type="button"
              onClick={() => toggle(b)}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[var(--color-panel-2)]/40"
            >
              <span className="flex items-center gap-2">
                <ChevronDown
                  size={12}
                  className={cn("text-ink-faint transition-transform", !open && "-rotate-90")}
                />
                <span className="font-mono-tight text-[11.5px] text-ink-soft">
                  {BUCKET_LABEL[b]}
                </span>
              </span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                {cleanCount} of {docs.length}
              </span>
            </button>
            {open && (
              <ul className="flex flex-col gap-1 px-3 pb-2.5">
                {docs.map((doc, idx) => {
                  const status = statusFor(b, activeBucket, idx, docs.length);
                  return (
                    <li
                      key={doc.id}
                      id={`checklist-item-${doc.id}`}
                      title={doc.clause}
                      className="flex items-center gap-2 rounded-md border border-line-soft bg-[var(--color-panel-2)]/20 px-2.5 py-1.5 font-mono-tight text-[10.5px] text-ink-soft"
                    >
                      {status === "clean" ? (
                        <CircleCheck size={12} className="text-[var(--color-emerald)]" />
                      ) : (
                        <HelpCircle size={12} className="text-ink-faint" />
                      )}
                      <span className={cn("min-w-0 flex-1 truncate", status === "missing" && "text-ink-mute")}>
                        {doc.label}
                      </span>
                      {doc.clause && (
                        <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                          {truncate(doc.clause.replace("Page ", "p."), 16)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Checklist accordion — Mode B (payor rules with derivation badges) ────
function ChecklistAccordionB({
  activeBucket,
  rulesByBucket,
}: {
  activeBucket: BucketKey;
  rulesByBucket: Record<BucketKey, PayorRuleRow[]>;
}) {
  const [openSet, setOpenSet] = useState<Record<BucketKey, boolean>>({
    gl: activeBucket === "gl",
    topup: activeBucket === "topup",
    final: activeBucket === "final",
  });

  function toggle(b: BucketKey) {
    setOpenSet((prev) => ({ ...prev, [b]: !prev[b] }));
  }

  return (
    <div className="flex flex-col">
      {BUCKET_ORDER.map((b, i) => {
        const rules = rulesByBucket[b] ?? [];
        const open = openSet[b];
        return (
          <div key={b} id={`checklist-bucket-${b}`} className={cn(i > 0 && "border-t border-line-soft")}>
            <button
              type="button"
              onClick={() => toggle(b)}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[var(--color-panel-2)]/40"
            >
              <span className="flex items-center gap-2">
                <ChevronDown
                  size={12}
                  className={cn("text-ink-faint transition-transform", !open && "-rotate-90")}
                />
                <span className="font-mono-tight text-[11.5px] text-ink-soft">
                  {BUCKET_LABEL[b]}
                </span>
              </span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                {rules.length} rules
              </span>
            </button>
            {open && (
              <ul className="flex flex-col gap-1 px-3 pb-2.5">
                {rules.length === 0 && (
                  <li className="font-mono-tight text-[10.5px] text-ink-faint">
                    No rules in this bucket.
                  </li>
                )}
                {rules.map((r) => {
                  const kind = (r.source_confidence as DerivationKind) ?? "industry_typical";
                  const meta = DERIV_META[kind] ?? DERIV_META.industry_typical;
                  return (
                    <li
                      key={r.id}
                      id={`checklist-item-${r.id}`}
                      className="flex items-center gap-2 rounded-md border border-line-soft bg-[var(--color-panel-2)]/20 px-2.5 py-1.5"
                    >
                      <div
                        title={meta.tooltip}
                        className="shrink-0"
                      >
                        <Pill tone={meta.tone} size="xs">
                          {meta.label}
                        </Pill>
                      </div>
                      <span
                        className="min-w-0 flex-1 truncate font-mono-tight text-[10.5px] text-ink-soft"
                        title={r.description}
                      >
                        {r.description}
                      </span>
                      <span
                        className="shrink-0 font-mono-tight text-[9.5px] uppercase tracking-[0.08em] text-ink-faint"
                        title={r.threshold_value}
                      >
                        {truncate(r.threshold_value, 16)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
