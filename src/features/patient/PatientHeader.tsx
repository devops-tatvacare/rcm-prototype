import { ArrowLeft, Stethoscope, ShieldCheck } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  subStageLabel,
  type SubStage,
} from "@/lib/worklistAggregator";
import type {
  ClaimContextRow,
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

type GlSlot = {
  label: string;
  state: "submitted" | "not_started" | "in_progress" | "approved";
};

const GL_TRIO: GlSlot[] = [
  { label: "Initial GL", state: "submitted" },
  { label: "Top-up", state: "not_started" },
  { label: "Final claim", state: "not_started" },
];

const GL_STATE_TONE: Record<GlSlot["state"], "neutral" | "champagne" | "info" | "good"> = {
  submitted: "info",
  not_started: "neutral",
  in_progress: "champagne",
  approved: "good",
};

const GL_STATE_LABEL: Record<GlSlot["state"], string> = {
  submitted: "Submitted",
  not_started: "Not started",
  in_progress: "Building",
  approved: "Approved",
};

export function PatientHeader({
  patient,
  claim,
  inpatient,
  hospital,
  onBack,
}: {
  patient: PatientRow;
  claim: ClaimContextRow | null;
  inpatient: InpatientContextRow | null;
  hospital: HospitalRow | null;
  onBack: () => void;
}) {
  const initial = patient.name.trim()[0]?.toUpperCase() ?? "·";
  const drg = claim?.drg ?? inpatient?.drg ?? null;
  const dx = claim?.dx ?? inpatient?.dx ?? null;
  const sub = subStageForClaimStage(claim?.stage ?? null);
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
            <div className="mt-0.5 flex items-center gap-2">
              <h2 className="truncate font-display text-[22px] tracking-tight text-ink">
                {patient.name}
              </h2>
              <PreExistingChips />
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

        {/* Right cluster: status + GL trio + primary action */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Pill tone={statusTone} size="sm" dot className="shrink-0">
              {statusLabel}
            </Pill>
            <Button variant="primary" size="sm">
              Submit GL
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            {GL_TRIO.map((slot) => (
              <GlPill key={slot.label} slot={slot} />
            ))}
          </div>
          <SlaBarStub />
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
        slot.state === "submitted" &&
          "border-[var(--color-azure)]/30 bg-[var(--color-azure)]/12 text-[var(--color-azure)]",
        slot.state === "in_progress" &&
          "border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/12 text-[var(--color-champagne)]",
        slot.state === "approved" &&
          "border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/12 text-[var(--color-emerald)]",
      )}
      title={`${slot.label} · ${GL_STATE_LABEL[slot.state]}`}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          slot.state === "not_started" && "bg-[var(--color-line-soft)]",
          slot.state === "submitted" && "bg-[var(--color-azure)]",
          slot.state === "in_progress" && "bg-[var(--color-champagne)]",
          slot.state === "approved" && "bg-[var(--color-emerald)]",
        )}
      />
      <span className="text-ink-soft">{slot.label}</span>
      <span className="text-ink-faint">·</span>
      <span>{GL_STATE_LABEL[slot.state]}</span>
    </span>
  );
}

function SlaBarStub() {
  return (
    <div className="flex items-center gap-2 font-mono-tight text-[10px] text-ink-faint">
      <span className="h-1 w-24 overflow-hidden rounded-full bg-[var(--color-line-soft)]/50">
        <span
          className="block h-full rounded-full bg-[var(--color-champagne)]/40"
          style={{ width: "42%" }}
        />
      </span>
      <span>SLA bar · P3.3</span>
    </div>
  );
}

// Empty stub — pre-existing-conditions chips will be wired in P3.2 once the
// patients table carries this data.
export function PreExistingChips() {
  return null;
}
