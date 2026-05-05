import { motion } from "motion/react";
import { AlertTriangle, Clock, UserRound, ScrollText } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { fmtCompactIDR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PatientItem } from "@/lib/worklistAggregator";
import { AiHumanBar } from "./AiHumanBar";

function slaTone(hours: number | null): "good" | "warn" | "bad" | "neutral" {
  if (hours == null) return "neutral";
  if (hours <= 24) return "bad";
  if (hours <= 72) return "warn";
  return "good";
}

export function PatientCard({ item, onOpen }: { item: PatientItem; onOpen: (i: PatientItem) => void }) {
  const tone = slaTone(item.sla_hours);
  return (
    <motion.button
      type="button"
      layout
      onClick={() => onOpen(item)}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-lg border border-line-soft bg-[var(--color-panel)]/70 p-3 text-left transition-colors hover:border-[var(--color-champagne)]/50",
      )}
    >
      {/* Row 1 — patient + amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 text-[10px] font-mono-tight text-ink-mute">
            {item.hospital_initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium text-ink">{item.patient_name}</div>
            <div className="font-mono-tight text-[10px] text-ink-faint truncate">{item.payor_name}</div>
          </div>
        </div>
        {item.amount_idr > 0 && (
          <div className="numeric text-[11.5px] text-ink-soft whitespace-nowrap pt-0.5">
            {fmtCompactIDR(item.amount_idr)}
          </div>
        )}
      </div>

      {/* Row 2 — DRG + dx */}
      <div className="font-mono-tight text-[10.5px] text-ink-mute truncate" title={item.dx}>
        <span className="text-[var(--color-champagne)]">{item.drg.replace(/^(INA-CBG|PRIV-)/, "")}</span>
        <span className="opacity-40 mx-1">·</span>
        <span>{item.dx}</span>
      </div>

      {/* Row 3 — pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.riskLabel && (
          <Pill tone="bad" size="xs">
            <AlertTriangle size={9} className="-ml-0.5" />
            {item.riskLabel}
          </Pill>
        )}
        {item.awaiting_human && (
          <Pill tone="champagne" size="xs">
            <UserRound size={9} className="-ml-0.5" />
            On you
          </Pill>
        )}
        {item.data_origin === "DOC_UPLOAD" && (
          <Pill tone="violet" size="xs" title="Source data was uploaded paper / handwritten documents — handled by the Clinical extractor agent">
            <ScrollText size={9} className="-ml-0.5" />
            Paper docs
          </Pill>
        )}
      </div>

      {/* Row 4 — AI/You bar + SLA */}
      <div className="flex items-center justify-between gap-2 pt-1 min-w-0">
        <AiHumanBar aiPct={item.ai_pct} compact />
        {item.sla_label && (
          <span
            title={item.sla_label}
            className={cn(
              "inline-flex max-w-[55%] items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono-tight text-[10px]",
              tone === "bad"  ? "border-[var(--color-coral)]/30 bg-[var(--color-coral)]/10 text-[var(--color-coral)]" :
              tone === "warn" ? "border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 text-[var(--color-amber)]" :
              tone === "good" ? "border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/10 text-[var(--color-emerald)]" :
                                "border-line-soft bg-[var(--color-canvas-deep)]/50 text-ink-faint",
            )}
          >
            <Clock size={9} className="shrink-0" />
            <span className="truncate">{item.sla_label}</span>
          </span>
        )}
      </div>
    </motion.button>
  );
}
