import { AlertTriangle, Clock, UserRound, Wallet, Search, X, Filter } from "lucide-react";
import { useWorklist, type FilterKey } from "@/store/useWorklist";
import { subStageLabel } from "@/lib/worklistAggregator";
import { cn } from "@/lib/cn";

const CHIPS: { key: FilterKey; label: string; Icon: any; tone: string }[] = [
  { key: "atRisk", label: "At risk", Icon: AlertTriangle, tone: "var(--color-coral)" },
  { key: "slaSoon", label: "SLA <24h", Icon: Clock, tone: "var(--color-amber)" },
  { key: "awaitingHuman", label: "Awaiting me", Icon: UserRound, tone: "var(--color-champagne)" },
  { key: "highValue", label: "≥100M IDR", Icon: Wallet, tone: "var(--color-emerald)" },
];

export function WorklistFilters() {
  const { filters, toggleFilter, search, setSearch, clearFilters, subStage, setSubStage } = useWorklist();
  const anyOn = Object.values(filters).some(Boolean) || search.length > 0 || subStage != null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name · DRG · payor"
          className="h-7 w-56 rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/60 pl-7 pr-3 text-[12px] text-ink placeholder:text-ink-faint outline-none focus:border-[var(--color-champagne)]/40"
        />
      </div>

      {CHIPS.map(({ key, label, Icon, tone }) => {
        const active = filters[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggleFilter(key)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono-tight text-[11px] transition-colors",
              active
                ? "border-transparent text-ink"
                : "border-line-soft text-ink-mute hover:text-ink-soft",
            )}
            style={active ? { background: `color-mix(in oklab, ${tone} 18%, transparent)`, borderColor: `color-mix(in oklab, ${tone} 35%, transparent)`, color: tone } : undefined}
          >
            <Icon size={11} />
            {label}
          </button>
        );
      })}

      {subStage && (
        <span
          className="flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/[0.08] px-2.5 font-mono-tight text-[11px] text-[var(--color-champagne)]"
        >
          <Filter size={10} />
          Stage · {subStageLabel(subStage)}
          <button
            type="button"
            onClick={() => setSubStage(null)}
            className="ml-0.5 text-[var(--color-champagne)]/70 hover:text-[var(--color-champagne)]"
            aria-label="Clear stage filter"
          >
            <X size={11} />
          </button>
        </span>
      )}

      {anyOn && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex h-7 items-center gap-1 rounded-full text-ink-faint hover:text-ink-mute font-mono-tight text-[11px] px-1.5"
        >
          <X size={11} />
          Clear
        </button>
      )}
    </div>
  );
}
