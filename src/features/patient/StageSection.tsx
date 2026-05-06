import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  Clock,
  FileText,
  HelpCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { STAGES, type StageKey } from "./JourneyTimeline";
import { CorrespondencePanel } from "./CorrespondencePanel";

export type DocStatus = "clean" | "missing" | "flagged" | "freshness_expired";

export type StageDoc = {
  id: string;
  label: string;
  source: string;
  status: DocStatus;
};

export type StageContent = {
  stage: StageKey;
  narrative: string;
  agentActions: string[];
  documents: StageDoc[];
  hasComplicationBanner?: boolean;
};

type StageStatus = "past" | "active" | "future";

function statusFor(active: StageKey, key: StageKey): StageStatus {
  const activeIdx = STAGES.findIndex((s) => s.key === active);
  const idx = STAGES.findIndex((s) => s.key === key);
  if (idx < activeIdx) return "past";
  if (idx === activeIdx) return "active";
  return "future";
}

const STAGE_PILL: Record<StageStatus, { tone: "good" | "champagne" | "neutral"; label: string }> = {
  past: { tone: "good", label: "Done" },
  active: { tone: "champagne", label: "In progress" },
  future: { tone: "neutral", label: "Pending" },
};

// Stages that should display the inline insurer-correspondence panel.
const CORRESPONDENCE_STAGES: ReadonlySet<StageKey> = new Set<StageKey>([
  "preadmission",
  "admission",
  "surgery",
  "postop",
  "discharge",
]);

export function StageSection({
  content,
  activeStage,
  payorId,
  patientId,
}: {
  content: StageContent;
  activeStage: StageKey;
  payorId: string | null;
  patientId?: string | null;
}) {
  const status = statusFor(activeStage, content.stage);
  const stageMeta = STAGES.find((s) => s.key === content.stage)!;
  const stageNumber = STAGES.findIndex((s) => s.key === content.stage) + 1;
  const pill = STAGE_PILL[status];
  const showCorrespondence = CORRESPONDENCE_STAGES.has(content.stage) && payorId;

  return (
    <section
      id={`stage-${content.stage}`}
      className={cn(
        "relative scroll-mt-3 rounded-xl border border-line-soft bg-panel shadow-quiet",
        status === "active" && "ring-1 ring-[var(--color-champagne)]/35",
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <StageNumberBadge index={stageNumber} status={status} />
          <div className="min-w-0">
            <span className="eyebrow">Stage {stageNumber}</span>
            <h3 className="truncate font-display text-[15px] tracking-tight text-ink">
              {stageMeta.label}
            </h3>
          </div>
        </div>
        <Pill tone={pill.tone} size="sm" dot className="shrink-0">
          {pill.label}
        </Pill>
      </div>

      <div className="h-px w-full bg-[var(--color-line-soft)]" />

      <div className="flex flex-col gap-3 px-4 py-3">
        {/* Narrative */}
        <p className="font-display text-[13.5px] leading-relaxed tracking-tight text-ink-soft">
          {content.narrative}
        </p>

        {/* Complication banner — only on Surgery when content flag is on */}
        {content.hasComplicationBanner === true && content.stage === "surgery" && (
          <ComplicationBanner />
        )}

        {/* Agent actions */}
        {content.agentActions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Agent actions</span>
            <ul className="flex flex-col gap-1">
              {content.agentActions.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 font-mono-tight text-[11.5px] leading-snug text-ink-soft"
                >
                  {idx === 0 ? (
                    <Sparkles
                      size={11}
                      className="mt-[3px] shrink-0 text-[var(--color-champagne)]"
                    />
                  ) : (
                    <span className="mt-[7px] block h-1 w-1 shrink-0 rounded-full bg-[var(--color-line-strong)]" />
                  )}
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Documents */}
        {content.documents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Documents collected at this stage</span>
            <div className="flex flex-wrap gap-1.5">
              {content.documents.map((doc) => (
                <DocumentChip key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        )}

        {/* Insurer correspondence (inline) */}
        {showCorrespondence && payorId && (
          <CorrespondencePanel payorId={payorId} patientId={patientId ?? null} />
        )}
      </div>
    </section>
  );
}

function StageNumberBadge({
  index,
  status,
}: {
  index: number;
  status: StageStatus;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono-tight text-[11px] tabular-nums",
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

const DOC_STATUS_META: Record<
  DocStatus,
  {
    Icon: typeof CircleCheck;
    color: string;
    label: string;
  }
> = {
  clean: {
    Icon: CircleCheck,
    color: "text-[var(--color-emerald)]",
    label: "Clean",
  },
  missing: {
    Icon: HelpCircle,
    color: "text-ink-faint",
    label: "Missing",
  },
  flagged: {
    Icon: CircleAlert,
    color: "text-[var(--color-coral)]",
    label: "Flagged",
  },
  freshness_expired: {
    Icon: Clock,
    color: "text-[var(--color-amber)]",
    label: "Freshness expired",
  },
};

function DocumentChip({ doc }: { doc: StageDoc }) {
  const meta = DOC_STATUS_META[doc.status];
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      title={`${doc.source} · ${meta.label}`}
      className={cn(
        "group inline-flex h-[26px] items-center gap-1.5 rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/40 px-2.5 font-mono-tight text-[11px] text-ink-soft transition-colors",
        "hover:border-[var(--color-champagne)]/40 hover:text-ink",
      )}
    >
      <FileText size={11} className="text-ink-faint" />
      <span className="truncate max-w-[200px]">{doc.label}</span>
      <Icon size={11} className={cn("shrink-0", meta.color)} />
    </button>
  );
}

function ComplicationBanner() {
  const [confirm, setConfirm] = useState<string | null>(null);
  function handleDraft() {
    setConfirm("GL top-up draft created · P3.3 wires this to the right rail");
    setTimeout(() => setConfirm(null), 2800);
  }
  return (
    <div className="rounded-md border border-[var(--color-coral)]/40 bg-[var(--color-coral)]/10 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle
            size={14}
            className="mt-0.5 shrink-0 text-[var(--color-coral)]"
          />
          <div className="min-w-0">
            <div className="font-display text-[13px] tracking-tight text-[var(--color-coral)]">
              Complication identified
            </div>
            <div className="mt-0.5 font-mono-tight text-[11px] leading-snug text-ink-soft">
              4th vessel grafted intra-op · +55M IDR · exceeds GL
            </div>
          </div>
        </div>
        <Button size="sm" variant="primary" onClick={handleDraft}>
          <Wand2 size={11} />
          Draft GL Top-Up amendment
        </Button>
      </div>
      <AnimatePresence>
        {confirm && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="mt-2 font-mono-tight text-[10.5px] text-[var(--color-emerald)]"
          >
            {confirm}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
