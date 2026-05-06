import { useMemo } from "react";
import { useWorklist, applyFilters } from "@/store/useWorklist";
import { stageOrderForSilo, subStageLabel, subStageTooltip, type PatientItem, type SubStage } from "@/lib/worklistAggregator";
import { PatientCard } from "./PatientCard";
import { Pill } from "@/components/ui/Pill";

// Tone mapped to the universal vocabulary semantics:
//   Building → champagne (in-progress)
//   Submitted → info (sent, waiting)
//   In Review with insurer → info (insurer working, not on us)
//   Asked for docs → warn (action needed)
//   Verdict — Approved → good
//   Verdict — Approved/Rejected (contesting) → bad
//   Verdict — Rejected → bad (no current SubStage feeds this)
function stageTone(sub: SubStage): "neutral" | "info" | "warn" | "bad" | "champagne" | "good" {
  switch (sub) {
    case "PA_BUILDING":
    case "PD_BUILDING":
    case "C_DISCHARGE_READY":
      return "champagne";
    case "PA_SUBMITTED":
    case "PD_SUBMITTED":
    case "PD_READY":
    case "PA_AGING":
    case "PD_AT_RISK":
      return "info";
    case "PA_AT_RISK":
    case "C_WATCH_EXTENSION":
      return "warn";
    case "PA_AUTO":
    case "PD_PAID":
    case "PD_AUTO":
    case "C_IN_STAY":
      return "good";
    case "PD_DENIED":
      return "bad";
    default:
      return "neutral";
  }
}

export function WorklistKanban({ onOpen }: { onOpen: (i: PatientItem) => void }) {
  const { items, silo, filters, search, subStage } = useWorklist();
  const filtered = useMemo(
    () => applyFilters(items, { silo, filters, search, subStage }),
    [items, silo, filters, search, subStage],
  );
  const order = stageOrderForSilo(silo);
  const grouped = useMemo(() => {
    const m: Record<string, PatientItem[]> = {};
    for (const sub of order) m[sub] = [];
    for (const it of filtered) (m[it.subStage] ??= []).push(it);
    return m;
  }, [filtered, order]);

  return (
    <div className="grid h-full min-h-0 gap-3 overflow-x-auto px-4 pb-4" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(260px, 1fr))` }}>
      {order.map((sub) => {
        const list = grouped[sub] ?? [];
        return (
          <div key={sub} className="flex h-full min-h-0 flex-col rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40">
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2" title={subStageTooltip(sub)}>
              <Pill tone={stageTone(sub)} size="xs">{subStageLabel(sub)}</Pill>
              <span className="font-mono-tight text-[10px] text-ink-faint">{list.length}</span>
            </div>
            <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto p-2">
              {list.length === 0 && (
                <div className="flex h-16 items-center justify-center font-mono-tight text-[10.5px] text-ink-faint">
                  Nothing here
                </div>
              )}
              {list.map((it) => (
                <PatientCard key={it.rowId} item={it} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
