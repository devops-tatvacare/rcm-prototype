import { cn } from "@/lib/cn";

// 7 stages, in order, from the v3 narrative.
export const STAGES = [
  { key: "consultation", label: "Consultation" },
  { key: "diagnostics", label: "Diagnostics" },
  { key: "preadmission", label: "Pre-admission" },
  { key: "admission", label: "Admission (IPD)" },
  { key: "surgery", label: "In surgery" },
  { key: "postop", label: "Post-operative care (ICU)" },
  { key: "discharge", label: "Discharge" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

// Active-stage derivation. Inputs are limited in P3.1 — we use the latest
// claim.stage if present, else fall back to inpatient.day_of_stay heuristics.
// Will evolve in P3.2 / P5 as more state lands.
export function deriveActiveStage(
  claimStage: string | null,
  ipDayOfStay: number | null,
): StageKey {
  if (claimStage) {
    if (claimStage.startsWith("PREAUTH_") || claimStage === "AWAITING_PREAUTH") {
      return "preadmission";
    }
    if (
      claimStage === "BUILDING" ||
      claimStage === "READY" ||
      claimStage === "SUBMITTED" ||
      claimStage === "PAID" ||
      claimStage === "AT_RISK" ||
      claimStage === "AUTO_CLEARED" ||
      claimStage === "DENIED"
    ) {
      return "discharge";
    }
  }
  if (ipDayOfStay !== null) {
    if (ipDayOfStay <= 1) return "admission";
    return "postop";
  }
  return "preadmission";
}

type StageStatus = "past" | "active" | "future";

function statusFor(active: StageKey, idx: number): StageStatus {
  const activeIdx = STAGES.findIndex((s) => s.key === active);
  if (idx < activeIdx) return "past";
  if (idx === activeIdx) return "active";
  return "future";
}

export function JourneyTimeline({
  activeStage,
  onSelectStage,
}: {
  activeStage: StageKey;
  onSelectStage?: (key: StageKey) => void;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-panel shadow-quiet">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <span className="eyebrow">Patient journey</span>
        <span className="font-mono-tight text-[10px] text-ink-faint">7 stages</span>
      </div>
      <div className="h-px w-full bg-[var(--color-line-soft)]" />
      <ol className="relative flex flex-col px-3 py-3">
        {STAGES.map((stage, idx) => {
          const status = statusFor(activeStage, idx);
          const isLast = idx === STAGES.length - 1;
          return (
            <li key={stage.key} className="relative">
              {/* Vertical connector to next row (rendered behind the badge) */}
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[19px] top-7 h-[calc(100%-12px)] w-px",
                    status === "past"
                      ? "bg-[var(--color-emerald)]/50"
                      : "bg-[var(--color-line-soft)]",
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => onSelectStage?.(stage.key)}
                className={cn(
                  "relative z-[1] flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                  status === "active" &&
                    "bg-[var(--color-champagne)]/10 ring-1 ring-[var(--color-champagne)]/30",
                  status !== "active" && "hover:bg-[var(--color-panel-2)]/40",
                )}
              >
                <StageNumberBadge index={idx + 1} status={status} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[12.5px] tracking-tight",
                      status === "active"
                        ? "text-ink"
                        : status === "past"
                          ? "text-ink-soft"
                          : "text-ink-mute",
                    )}
                  >
                    {stage.label}
                  </span>
                </span>
                <ProgressDot status={status} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageNumberBadge({ index, status }: { index: number; status: StageStatus }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono-tight text-[10.5px] tabular-nums",
        status === "active" &&
          "border-[var(--color-champagne)]/45 bg-[var(--color-champagne)]/15 text-[var(--color-champagne)]",
        status === "past" &&
          "border-[var(--color-emerald)]/40 bg-[var(--color-emerald)]/12 text-[var(--color-emerald)]",
        status === "future" &&
          "border-[var(--color-line-soft)] bg-[var(--color-panel-2)]/40 text-ink-faint",
      )}
    >
      {index}
    </span>
  );
}

function ProgressDot({ status }: { status: StageStatus }) {
  const cls =
    status === "past"
      ? "bg-[var(--color-emerald)]"
      : status === "active"
        ? "bg-[var(--color-amber)]"
        : "bg-[var(--color-line-soft)]";
  return (
    <span
      aria-hidden
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cls)}
    />
  );
}
