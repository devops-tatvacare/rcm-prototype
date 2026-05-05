import { useMemo } from "react";
import { AlertTriangle, Clock, UserRound, ScrollText } from "lucide-react";
import { useWorklist, applyFilters } from "@/store/useWorklist";
import { fmtCompactIDR } from "@/lib/format";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import type { PatientItem } from "@/lib/worklistAggregator";
import { AiHumanBar } from "./AiHumanBar";

function slaTone(hours: number | null): "good" | "warn" | "bad" | "neutral" {
  if (hours == null) return "neutral";
  if (hours <= 24) return "bad";
  if (hours <= 72) return "warn";
  return "good";
}

export function WorklistTable({ onOpen }: { onOpen: (i: PatientItem) => void }) {
  const { items, silo, filters, search, subStage } = useWorklist();
  const filtered = useMemo(
    () => applyFilters(items, { silo, filters, search, subStage }),
    [items, silo, filters, search, subStage],
  );

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-4">
      <div className="overflow-y-auto rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 z-[1] bg-[var(--color-canvas-deep)]/95 backdrop-blur-md">
            <tr className="text-ink-faint font-mono-tight text-[10.5px] uppercase tracking-[0.12em]">
              <Th>Patient</Th>
              <Th>DRG · Dx</Th>
              <Th>Payor · Hospital</Th>
              <Th align="right">Amount</Th>
              <Th>Stage</Th>
              <Th>Risk / Flag</Th>
              <Th>SLA</Th>
              <Th>AI · You</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center font-mono-tight text-[11px] text-ink-faint">
                  Nothing matches these filters
                </td>
              </tr>
            )}
            {filtered.map((i) => {
              const tone = slaTone(i.sla_hours);
              return (
                <tr
                  key={i.rowId}
                  onClick={() => onOpen(i)}
                  className="group cursor-pointer border-t border-line-soft hover:bg-[var(--color-panel)]/40"
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-line-soft bg-[var(--color-canvas-deep)]/60 text-[9.5px] font-mono-tight text-ink-mute">
                        {i.hospital_initial}
                      </span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink">{i.patient_name}</span>
                          {i.data_origin === "DOC_UPLOAD" && (
                            <span title="Source data was uploaded paper / handwritten documents — handled by the Clinical extractor agent" className="inline-flex items-center gap-0.5 rounded-sm border border-[var(--color-violet)]/30 bg-[var(--color-violet)]/10 px-1 py-px font-mono-tight text-[9px] text-[var(--color-violet)]">
                              <ScrollText size={8} /> paper
                            </span>
                          )}
                        </div>
                        {i.awaiting_human && (
                          <span className="flex items-center gap-1 font-mono-tight text-[10px] text-[var(--color-champagne)]">
                            <UserRound size={9} />
                            on you
                          </span>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-mono-tight text-[10.5px] text-[var(--color-champagne)]">
                        {i.drg.replace(/^(INA-CBG|PRIV-)/, "")}
                      </span>
                      <span className="text-ink-mute truncate max-w-[260px]" title={i.dx}>{i.dx}</span>
                    </div>
                  </Td>
                  <Td className="text-ink-mute">
                    <div className="flex flex-col">
                      <span>{i.payor_name}</span>
                      <span className="font-mono-tight text-[10.5px] text-ink-faint truncate max-w-[180px]">{i.hospital_name}</span>
                    </div>
                  </Td>
                  <Td align="right">
                    {i.amount_idr > 0
                      ? <span className="numeric text-ink">{fmtCompactIDR(i.amount_idr)}</span>
                      : <span className="font-mono-tight text-[10.5px] text-ink-faint">—</span>}
                  </Td>
                  <Td>
                    <Pill size="xs">{i.stageLabel}</Pill>
                  </Td>
                  <Td>
                    {i.riskLabel ? (
                      <Pill tone="bad" size="xs">
                        <AlertTriangle size={9} className="-ml-0.5" />
                        {i.riskLabel}
                      </Pill>
                    ) : (
                      <span className="font-mono-tight text-[10.5px] text-ink-faint">clean</span>
                    )}
                  </Td>
                  <Td>
                    {i.sla_label ? (
                      <span className={cn(
                        "flex items-center gap-1 font-mono-tight text-[10.5px] whitespace-nowrap",
                        tone === "bad" ? "text-[var(--color-coral)]" :
                        tone === "warn" ? "text-[var(--color-amber)]" :
                        tone === "good" ? "text-[var(--color-emerald)]" : "text-ink-faint",
                      )}>
                        <Clock size={9} />
                        {i.sla_label}
                      </span>
                    ) : (
                      <span className="font-mono-tight text-[10.5px] text-ink-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <AiHumanBar aiPct={i.ai_pct} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}>{children}</th>
  );
}
function Td({ children, className, align = "left" }: { children: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <td className={cn("px-3 py-2 align-middle", align === "right" && "text-right", className)}>{children}</td>
  );
}
