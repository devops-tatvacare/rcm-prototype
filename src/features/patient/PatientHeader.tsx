import { ArrowLeft, Stethoscope, ShieldCheck } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import {
  subStageLabel,
  type SubStage,
} from "@/lib/worklistAggregator";
import type {
  ClaimContextRow,
  GlSubmissionRow,
  HospitalRow,
  InpatientContextRow,
  PatientRow,
} from "./PatientPage";

// Map a raw claim.stage string to a SubStage so we can reuse the universal
// vocabulary helper. Limited to the stages the seed actually emits.
function subStageForClaimStage(stage: string | null): SubStage | null {
  if (!stage) return null;
  switch (stage) {
    case "PREAUTH_BUILDING":
      return "PA_BUILDING";
    case "PREAUTH_APPROVED":
      return "PA_AUTO";
    case "AWAITING_PREAUTH":
      return "PA_SUBMITTED";
    case "BUILDING":
      return "PD_BUILDING";
    case "READY":
      return "PD_READY";
    case "SUBMITTED":
      return "PD_SUBMITTED";
    case "AT_RISK":
      return "PD_AT_RISK";
    case "PAID":
      return "PD_PAID";
    case "AUTO_CLEARED":
      return "PD_AUTO";
    case "DENIED":
      return "PD_DENIED";
    default:
      return null;
  }
}

function displaySubStageForClaimStage(stage: string | null, hasActiveDenial: boolean): SubStage | null {
  if (hasActiveDenial) return "PD_DENIED";
  return subStageForClaimStage(stage);
}

function toneForSubStage(sub: SubStage | null): "neutral" | "champagne" | "info" | "warn" | "good" | "bad" {
  if (!sub) return "neutral";
  if (sub.endsWith("BUILDING")) return "champagne";
  if (sub === "PA_SUBMITTED" || sub === "PD_SUBMITTED" || sub === "PD_READY") return "info";
  if (sub === "PA_AGING" || sub === "PD_AT_RISK") return "info";
  if (sub === "PA_AT_RISK" || sub === "C_WATCH_EXTENSION") return "warn";
  if (sub === "PA_AUTO" || sub === "PD_PAID" || sub === "PD_AUTO" || sub === "C_IN_STAY") return "good";
  if (sub === "PD_DENIED") return "bad";
  if (sub === "C_DISCHARGE_READY") return "champagne";
  return "neutral";
}

type GlState =
  | "not_started"
  | "drafting"
  | "submitted"
  | "approved"
  | "rejected"
  | "partial";

type GlSlot = {
  kind: "initial" | "topup" | "final";
  label: string;
  state: GlState;
  present: boolean;
};

const GL_KIND_LABEL: Record<GlSlot["kind"], string> = {
  initial: "Initial GL",
  topup: "Top-up",
  final: "Final claim",
};

const GL_STATE_LABEL: Record<GlState, string> = {
  not_started: "Not started",
  drafting: "Drafting",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  partial: "Partial",
};

// Build the trio from the gl_submissions rows. We always show three pills in
// a stable order (initial → topup → final). Missing rows render as
// `not_started` so the patient header has consistent shape across patients.
function buildGlTrio(rows: GlSubmissionRow[]): GlSlot[] {
  const byKind = new Map<GlSlot["kind"], GlState>();
  const present = new Set<GlSlot["kind"]>();
  for (const r of rows) {
    if (r.kind === "initial" || r.kind === "topup" || r.kind === "final") {
      present.add(r.kind);
      byKind.set(r.kind, (r.state as GlState) ?? "not_started");
    }
  }
  return (["initial", "topup", "final"] as const).map((kind) => ({
    kind,
    label: GL_KIND_LABEL[kind],
    state: byKind.get(kind) ?? "not_started",
    present: present.has(kind),
  }));
}

export function PatientHeader({
  patient,
  claim,
  inpatient,
  hospital,
  glSubmissions,
  hasActiveDenial = false,
  onBack,
}: {
  patient: PatientRow;
  claim: ClaimContextRow | null;
  inpatient: InpatientContextRow | null;
  hospital: HospitalRow | null;
  glSubmissions: GlSubmissionRow[];
  hasActiveDenial?: boolean;
  onBack: () => void;
}) {
  const trio = buildGlTrio(glSubmissions);
  const initial = patient.name.trim()[0]?.toUpperCase() ?? "·";
  const drg = claim?.drg ?? inpatient?.drg ?? null;
  const dx = claim?.dx ?? inpatient?.dx ?? null;
  const sub = displaySubStageForClaimStage(claim?.stage ?? null, hasActiveDenial);
  const statusLabel = sub ? subStageLabel(sub) : claim?.stage ?? (inpatient ? "In stay" : "—");
  const statusTone = toneForSubStage(sub);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line-soft bg-panel-raised shadow-quiet">
      {/* Payor color stripe */}
      {patient.payor_color && (
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${patient.payor_color}, transparent)`,
          }}
        />
      )}

      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        {/* Back + identity */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to worklist"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-soft text-ink-mute transition-colors hover:border-[var(--color-champagne)]/40 hover:text-ink"
          >
            <ArrowLeft size={14} />
          </button>

          {/* Avatar */}
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/12 font-display text-[16px] tracking-tight text-[var(--color-champagne)]"
            aria-hidden
          >
            {initial}
          </span>

          {/* Identity block */}
          <div className="min-w-0">
            <div className="eyebrow">Patient</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-[22px] tracking-tight text-ink">
                {patient.name}
              </h2>
              <PreExistingChips raw={patient.pre_existing_conditions ?? null} />
            </div>
            <div className="mt-0.5 truncate font-mono-tight text-[11px] text-ink-faint">
              {patient.age}y · {patient.sex} · MRN {patient.mrn}
              {hospital ? ` · ${hospital.name}` : ""}
            </div>

            {/* Pills row */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {patient.payor_name && (
                <Pill tone="info" size="sm" className="shrink-0">
                  <ShieldCheck size={11} className="opacity-70" />
                  {patient.payor_name}
                </Pill>
              )}
              {drg && (
                <Pill tone="champagne" size="sm" className="shrink-0">
                  <Stethoscope size={11} className="opacity-70" />
                  <span className="font-mono-tight tracking-tight">{drg}</span>
                </Pill>
              )}
              {dx && (
                <span
                  className="max-w-[360px] truncate font-mono-tight text-[10.5px] text-ink-faint"
                  title={dx}
                >
                  {dx}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right cluster: status + GL trio */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Pill tone={statusTone} size="sm" dot className="shrink-0">
              {statusLabel}
            </Pill>
          </div>
          <div className="flex items-center gap-1.5">
            {trio.map((slot) => (
              <GlPill key={slot.kind} slot={slot} />
            ))}
          </div>
          <SlaBar patientId={patient.id} claim={claim} />
        </div>
      </div>
    </div>
  );
}

function GlPill({ slot }: { slot: GlSlot }) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center gap-1 rounded-full border px-2 font-mono-tight text-[10px]",
        slot.state === "not_started" &&
          "border-[var(--color-line-soft)] bg-[var(--color-panel-2)]/40 text-ink-faint",
        slot.state === "drafting" &&
          "border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/12 text-[var(--color-champagne)]",
        slot.state === "submitted" &&
          "border-[var(--color-azure)]/30 bg-[var(--color-azure)]/12 text-[var(--color-azure)]",
        slot.state === "approved" &&
          "border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/12 text-[var(--color-emerald)]",
        slot.state === "partial" &&
          "border-[var(--color-amber)]/30 bg-[var(--color-amber)]/12 text-[var(--color-amber)]",
        slot.state === "rejected" &&
          "border-[var(--color-coral)]/30 bg-[var(--color-coral)]/12 text-[var(--color-coral)]",
      )}
      title={`${slot.label} · ${GL_STATE_LABEL[slot.state]}`}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          slot.state === "not_started" && "bg-[var(--color-line-soft)]",
          slot.state === "drafting" && "bg-[var(--color-champagne)]",
          slot.state === "submitted" && "bg-[var(--color-azure)]",
          slot.state === "approved" && "bg-[var(--color-emerald)]",
          slot.state === "partial" && "bg-[var(--color-amber)]",
          slot.state === "rejected" && "bg-[var(--color-coral)]",
        )}
      />
      <span className="text-ink-soft">{slot.label}</span>
      <span className="text-ink-faint">·</span>
      <span>{GL_STATE_LABEL[slot.state]}</span>
    </span>
  );
}

// SLA bar — only renders for the three deeply-seeded patients we have real
// timeline data for. For everyone else returns null because the bar would
// otherwise be a fabricated placeholder.
function SlaBar({
  patientId,
  claim,
}: {
  patientId: string;
  claim: ClaimContextRow | null;
}) {
  type SlaState = {
    label: string;
    tone: "good" | "warn" | "bad";
    fillPct: number;
  };
  let s: SlaState | null = null;
  // Budi: case settled (PAID / AUTO_CLEARED). Either stage signals a closed
  // claim where we want to brag about meeting SLA.
  if (patientId === "p-budi" && (claim?.stage === "PAID" || claim?.stage === "AUTO_CLEARED")) {
    s = { label: "SLA met · settled in 6d", tone: "good", fillPct: 100 };
  } else if (patientId === "p-siti") {
    // Pre-auth in review: 18h elapsed of 48h target.
    s = { label: "SLA · 18h elapsed of 48h", tone: "warn", fillPct: (18 / 48) * 100 };
  } else if (patientId === "p-ravi") {
    // Appeal pending: 26d remaining of 30d.
    s = { label: "Appeal SLA · 26d remaining of 30d", tone: "good", fillPct: ((30 - 26) / 30) * 100 };
  }
  if (!s) return null;

  const tone = s.tone;
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono-tight text-[10px]",
        tone === "good" && "text-[var(--color-emerald)]",
        tone === "warn" && "text-[var(--color-amber)]",
        tone === "bad" && "text-[var(--color-coral)]",
      )}
      title={s.label}
    >
      <span className="h-1 w-24 overflow-hidden rounded-full bg-[var(--color-line-soft)]/50">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "good" && "bg-[var(--color-emerald)]/70",
            tone === "warn" && "bg-[var(--color-amber)]/70",
            tone === "bad" && "bg-[var(--color-coral)]/70",
          )}
          style={{ width: `${Math.max(2, Math.min(100, s.fillPct))}%` }}
        />
      </span>
      <span>{s.label}</span>
    </div>
  );
}

// Pre-existing-conditions chips — parses the JSON array string stored on the
// patients table and renders one champagne chip per condition. Returns null
// when the patient has no pre-existing conditions.
export function PreExistingChips({ raw }: { raw: string | null }) {
  if (!raw) return null;
  let conditions: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) conditions = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
  if (conditions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {conditions.map((c) => (
        <span
          key={c}
          className="inline-flex h-[18px] items-center rounded-full border border-[var(--color-coral)]/30 bg-[var(--color-coral)]/10 px-2 font-mono-tight text-[10px] text-[var(--color-coral)]"
          title={`Pre-existing · ${c}`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
