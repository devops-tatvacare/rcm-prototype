import { useMemo } from "react";
import { useWorklist, applyFilters } from "@/store/useWorklist";
import { subStageLabel, type PatientItem } from "@/lib/worklistAggregator";
import { PatientCard } from "./PatientCard";
import { Pill } from "@/components/ui/Pill";

const KANBAN_COLUMNS = [
  {
    label: "Building",
    tone: "champagne" as const,
    tooltip: "AI is assembling the packet",
  },
  {
    label: "Submitted",
    tone: "info" as const,
    tooltip: "Sent to insurer, awaiting acknowledgment",
  },
  {
    label: "In Review with insurer",
    tone: "info" as const,
    tooltip: "Insurer is adjudicating",
  },
  {
    label: "Asked for docs",
    tone: "warn" as const,
    tooltip: "Insurer queried, AI is gap-filling",
  },
  {
    label: "Verdict — Approved",
    tone: "good" as const,
    tooltip: "Closed, no contest",
  },
  {
    label: "Verdict — Approved/Rejected (contesting)",
    tone: "bad" as const,
    tooltip: "Partial outcome, agent drafting appeal",
  },
  {
    label: "Verdict — Rejected",
    tone: "bad" as const,
    tooltip: "Closed, no contest",
  },
] satisfies ReadonlyArray<{
  label: string;
  tone: "neutral" | "info" | "warn" | "bad" | "champagne" | "good";
  tooltip: string;
}>;

function columnLabelFor(item: PatientItem): string {
  return subStageLabel(item.subStage);
}

export function WorklistKanban({ onOpen }: { onOpen: (i: PatientItem) => void }) {
  const { items, silo, filters, search, subStage } = useWorklist();
  const filtered = useMemo(
    () => applyFilters(items, { silo, filters, search, subStage }),
    [items, silo, filters, search, subStage],
  );
  const grouped = useMemo(() => {
    const m: Record<string, PatientItem[]> = {};
    for (const col of KANBAN_COLUMNS) m[col.label] = [];
    for (const it of filtered) (m[columnLabelFor(it)] ??= []).push(it);
    return m;
  }, [filtered]);

  return (
    <div className="grid h-full min-h-0 gap-3 overflow-x-auto px-4 pb-4" style={{ gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(260px, 1fr))` }}>
      {KANBAN_COLUMNS.map((column) => {
        const list = grouped[column.label] ?? [];
        return (
          <div key={column.label} className="flex h-full min-h-0 flex-col rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40">
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2" title={column.tooltip}>
              <Pill tone={column.tone} size="xs">{column.label}</Pill>
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
