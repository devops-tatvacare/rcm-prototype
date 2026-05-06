import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleCheck, HelpCircle, Info } from "lucide-react";
import { Panel, PanelDivider, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Gauge } from "@/components/ui/Gauge";
import { cn } from "@/lib/cn";
import { query } from "@/lib/db";
import type { StageKey } from "./JourneyTimeline";

// Three packet "buckets" — each maps to a stage in the patient journey and
// to a real-world insurer interaction (initial GL, mid-stay top-up, final
// claim). The rail's required-docs checklist is grouped by these three.
type BucketKey = "gl" | "topup" | "final";

type DocItem = { id: string; label: string };
type DocStatus = "clean" | "missing";

const BUCKET_LABEL: Record<BucketKey, string> = {
  gl: "GL set",
  topup: "Top-up set",
  final: "Final claim set",
};

const BUCKET_DOCS: Record<BucketKey, DocItem[]> = {
  gl: [
    { id: "preauth", label: "Pre-auth Form" },
    { id: "lma", label: "LMA" },
    { id: "lmn", label: "Letter of Medical Necessity" },
    { id: "preopanaes", label: "Pre-op Anaesthesia Note" },
    { id: "inscard", label: "Insurance Card" },
  ],
  topup: [
    { id: "intraop", label: "Intraoperative Finding Note" },
    { id: "anaes", label: "Anaesthesia Chart" },
    { id: "rce", label: "Revised Cost Estimate" },
    { id: "topuplma", label: "Top-up LMA addendum" },
  ],
  final: [
    { id: "ds", label: "Discharge Summary" },
    { id: "inv", label: "Final Itemised Invoice" },
    { id: "icunote", label: "ICU Daily Notes" },
    { id: "mar", label: "MAR" },
    { id: "rec", label: "Discharge Receipt" },
  ],
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

type Mode = "A" | "B";

export function PacketRail({
  patientId,
  payorId: _payorId,
  activeStage,
}: {
  patientId: string;
  payorId: string | null;
  activeStage: StageKey;
}) {
  const [mode, setMode] = useState<Mode>("B");

  // Mode resolution: Mode A iff this patient has uploaded a policy_certificate.
  // For P3.3 no patient does, so all render as Mode B. Query is in place so
  // P4 can flip patients to Mode A by seeding a policy_certificate doc.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM uploaded_docs
          WHERE owner_kind = 'patient'
            AND owner_id = ?
            AND kind = 'policy_certificate'`,
        [patientId],
      );
      if (cancelled) return;
      const n = rows[0]?.n ?? 0;
      setMode(n > 0 ? "A" : "B");
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const activeBucket = useMemo(() => bucketForStage(activeStage), [activeStage]);

  function onSubmit() {
    // Mock action surface for P3.3. Real wiring lands in later phases when
    // packet readiness/submission flows are connected to the drilldown.
    const label = actionLabelFor(activeStage);
    // Simple visible feedback without pulling in a toast lib.
    console.info(`[packet-rail] mocked: ${label.toLowerCase()}`);
    if (typeof window !== "undefined") {
      window.alert(`Mocked: ${label.replace(/^Submit /, "")} submitted`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode badge */}
      <Panel tone="raised">
        <PanelHeader
          eyebrow="Rule mode"
          title="Operating mode"
          density="compact"
          right={<Info size={12} className="text-ink-faint" />}
        />
        <PanelDivider />
        <div className="px-4 py-3">
          <ModeBadge mode={mode} />
        </div>
      </Panel>

      {/* Acceptance gauge */}
      <Panel>
        <PanelHeader eyebrow="Readiness" title="Acceptance probability" density="compact" />
        <PanelDivider />
        <div className="flex flex-col items-center gap-1 px-4 py-3">
          <Gauge value={78} />
          <div className="font-mono-tight text-[10.5px] text-ink-faint">
            Acceptance probability
          </div>
        </div>
      </Panel>

      {/* SLA bar */}
      <Panel>
        <PanelHeader eyebrow="SLA" title="Time remaining" density="compact" />
        <PanelDivider />
        <div className="flex flex-col gap-2 px-4 py-3">
          <SlaBar elapsedPct={60} remainingLabel="18h remaining" tone="ok" />
        </div>
      </Panel>

      {/* Required-docs checklist */}
      <Panel>
        <PanelHeader eyebrow="Checklist" title="Required documents" density="compact" />
        <PanelDivider />
        <div className="flex flex-col">
          <ChecklistAccordion activeBucket={activeBucket} />
        </div>
      </Panel>

      {/* Blockers */}
      <Panel>
        <PanelHeader eyebrow="Blockers" title="What's holding things up" density="compact" />
        <PanelDivider />
        <ul className="flex flex-col gap-1.5 px-4 py-3 font-mono-tight text-[11px] leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="mt-[5px] inline-block h-1 w-1 rounded-full bg-[var(--color-coral)]" />
            <span>Awaiting signed Pre-op Anaesthesia Note</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-[5px] inline-block h-1 w-1 rounded-full bg-[var(--color-coral)]" />
            <span>Pending CBC freshness — re-order if delayed past 14:00</span>
          </li>
        </ul>
      </Panel>

      {/* Action */}
      <div>
        <Button variant="primary" size="lg" className="w-full" onClick={onSubmit}>
          {actionLabelFor(activeStage)}
        </Button>
      </div>
    </div>
  );
}

// ── Mode badge ────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: Mode }) {
  const isA = mode === "A";
  const tooltip = isA
    ? "Mode A: rules extracted from your uploaded policy PDF."
    : "Mode B: rules from your hospital's payor intelligence library — built from prior cases.";
  return (
    <div
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
        Mode {mode}
      </span>
      <span className="font-mono-tight text-[11px] text-ink-soft">
        {isA ? "Policy on file" : "Payor Intelligence"}
      </span>
    </div>
  );
}

// ── SLA bar ───────────────────────────────────────────────────────────────
function SlaBar({
  elapsedPct,
  remainingLabel,
  tone,
}: {
  elapsedPct: number;
  remainingLabel: string;
  tone: "ok" | "warn" | "danger";
}) {
  const fill =
    tone === "ok"
      ? "bg-[var(--color-emerald)]"
      : tone === "warn"
        ? "bg-[var(--color-champagne)]"
        : "bg-[var(--color-coral)]";
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="font-mono-tight text-[11px] text-ink-soft">{remainingLabel}</span>
        <span className="font-mono-tight text-[10px] text-ink-faint">
          {Math.round(elapsedPct)}% elapsed
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", fill)}
          style={{ width: `${Math.max(0, Math.min(100, elapsedPct))}%` }}
        />
      </div>
    </>
  );
}

// ── Checklist accordion ───────────────────────────────────────────────────
function ChecklistAccordion({ activeBucket }: { activeBucket: BucketKey }) {
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
        const docs = BUCKET_DOCS[b];
        const cleanCount = docs.reduce(
          (acc, _d, idx) => acc + (statusFor(b, activeBucket, idx, docs.length) === "clean" ? 1 : 0),
          0,
        );
        const open = openSet[b];
        return (
          <div key={b} className={cn(i > 0 && "border-t border-line-soft")}>
            <button
              type="button"
              onClick={() => toggle(b)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40"
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
              <ul className="flex flex-col gap-1 px-4 pb-3">
                {docs.map((doc, idx) => {
                  const status = statusFor(b, activeBucket, idx, docs.length);
                  return (
                    <li
                      key={doc.id}
                      className="flex items-center gap-2 font-mono-tight text-[11px] text-ink-soft"
                    >
                      {status === "clean" ? (
                        <CircleCheck size={12} className="text-[var(--color-emerald)]" />
                      ) : (
                        <HelpCircle size={12} className="text-ink-faint" />
                      )}
                      <span className={cn(status === "missing" && "text-ink-mute")}>{doc.label}</span>
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
