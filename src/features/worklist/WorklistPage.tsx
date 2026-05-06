import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/cn";
import { useWorklist } from "@/store/useWorklist";
import { usePacketBuilder } from "@/store/usePacketBuilder";
import { useDenials } from "@/store/useDenials";
import { type PatientItem, type Silo } from "@/lib/worklistAggregator";
import { WorklistFilters } from "./WorklistFilters";
import { WorklistKanban } from "./WorklistKanban";
import { WorklistTable } from "./WorklistTable";
import { WorklistKpis } from "./WorklistKpis";

const SILOS: { value: Silo; label: string; sub: string }[] = [
  { value: "preauth", label: "Pre-Auth", sub: "Admission" },
  { value: "concurrent", label: "Concurrent", sub: "In hospital" },
  { value: "postdischarge", label: "Post-Discharge", sub: "Claim" },
];

export function WorklistPage() {
  const { items, loaded, silo, viewMode, setSilo, setViewMode, setFilters, setSubStage, clearFilters, load } = useWorklist();
  // We still subscribe to the upstream "tick" counters so the worklist
  // reloads when claims are submitted or appeals drafted from elsewhere
  // (e.g. inside the patient drilldown stages, in later phases).
  const refreshTick = usePacketBuilder((s) => s.boardRefreshTick);
  const draftTick = useDenials((s) => s.draftTick);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initial load + react to upstream changes (claim submit, draft created).
  useEffect(() => { load(); }, [load, refreshTick, draftTick]);

  // Quick-action chips on Command Center deep-link with URL params:
  //   ?silo=…&filter=…&subStage=…
  // Reset state every time the URL changes so chips always land on a clean view.
  useEffect(() => {
    clearFilters();
    const s = searchParams.get("silo") as Silo | null;
    if (s === "preauth" || s === "concurrent" || s === "postdischarge") {
      if (s !== silo) setSilo(s);
    }
    const f = searchParams.get("filter");
    if (f === "atRisk") setFilters({ atRisk: true });
    else if (f === "slaSoon") setFilters({ slaSoon: true });
    else if (f === "awaitingHuman") setFilters({ awaitingHuman: true });
    else if (f === "highValue") setFilters({ highValue: true });
    const ss = searchParams.get("subStage");
    if (ss) setSubStage(ss as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleOpen(item: PatientItem) {
    // Drilldown route. The patient_id is pre-computed by the aggregator so
    // this is a single navigation, no DB round-trip on click.
    navigate(`/patient/${item.patient_id}`);
  }

  function selectSilo(s: Silo) {
    setSilo(s);
    const next = new URLSearchParams(searchParams);
    next.set("silo", s);
    setSearchParams(next, { replace: true });
  }

  const siloCounts = useMemo(() => {
    const m: Record<Silo, number> = { preauth: 0, concurrent: 0, postdischarge: 0 };
    for (const i of items) m[i.silo] += 1;
    return m;
  }, [items]);

  return (
    <>
      <TopBar title="My queue" />

      <div className="flex flex-1 min-h-0 flex-col">
        <WorklistKpis />

        {/* Silo tabs + view toggle */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div className="flex items-center gap-1 rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/60 p-0.5">
            {SILOS.map((s) => {
              const active = silo === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => selectSilo(s.value)}
                  className={cn(
                    "relative flex h-8 items-center gap-2 rounded-full px-3.5 transition-colors",
                    active ? "text-ink" : "text-ink-mute hover:text-ink-soft",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="silo-active"
                      className="absolute inset-0 -z-[1] rounded-full bg-[var(--color-panel-2)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="text-[12.5px] font-medium tracking-tight">{s.label}</span>
                  <span className="font-mono-tight text-[10px] text-ink-faint">{siloCounts[s.value]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/60 p-0.5">
            <ViewBtn active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} icon={<LayoutGrid size={12} />} label="Kanban" />
            <ViewBtn active={viewMode === "table"} onClick={() => setViewMode("table")} icon={<Rows3 size={12} />} label="Table" />
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pt-3 pb-3">
          <WorklistFilters />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {!loaded ? (
            <div className="flex h-full items-center justify-center font-mono-tight text-[11px] text-ink-faint">
              Loading queue…
            </div>
          ) : viewMode === "kanban" ? (
            <WorklistKanban onOpen={handleOpen} />
          ) : (
            <WorklistTable onOpen={handleOpen} />
          )}
        </div>
      </div>

    </>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full px-3 transition-colors",
        active ? "bg-[var(--color-champagne)] text-[var(--color-canvas-deep)]" : "text-ink-mute hover:text-ink-soft",
      )}
    >
      {icon}
      <span className="text-[11.5px] font-medium">{label}</span>
    </button>
  );
}

