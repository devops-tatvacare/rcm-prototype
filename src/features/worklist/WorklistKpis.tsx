import { useMemo } from "react";
import { motion } from "motion/react";
import { ClipboardList, AlertTriangle, UserRound, Clock, Wallet, TrendingUp, Sparkles, ShieldAlert } from "lucide-react";
import { useWorklist } from "@/store/useWorklist";
import { fmtCompactIDR } from "@/lib/format";
import { Panel } from "@/components/ui/Panel";

export function WorklistKpis() {
  const { items } = useWorklist();
  const kpis = useMemo(() => {
    const all = items;
    const onYou = all.filter((i) => i.awaiting_human);
    const atRisk = all.filter((i) => i.riskLabel);
    const slaSoon = all.filter((i) => i.sla_hours != null && i.sla_hours <= 24);
    const autoCleared = all.filter((i) => i.subStage === "PD_AUTO" || i.subStage === "PA_AUTO");
    const queueValue = all.reduce((s, i) => s + i.amount_idr, 0);
    const onYouValue = onYou.reduce((s, i) => s + i.amount_idr, 0);
    const atRiskValue = atRisk.reduce((s, i) => s + i.amount_idr, 0);
    const autoValue = autoCleared.reduce((s, i) => s + i.amount_idr, 0);
    return {
      total: all.length,
      onYou: onYou.length,
      atRisk: atRisk.length,
      slaSoon: slaSoon.length,
      queueValue,
      onYouValue,
      atRiskValue,
      autoValue,
    };
  }, [items]);

  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      <div className="grid grid-cols-4 gap-3">
        <Tile icon={ClipboardList} label="Queue" value={kpis.total} unit="patients" note={`${fmtCompactIDR(kpis.queueValue)} in flight`} tone="ink" />
        <Tile icon={UserRound} label="Awaiting me" value={kpis.onYou} unit="patients" note={fmtCompactIDR(kpis.onYouValue)} tone="champagne" />
        <Tile icon={AlertTriangle} label="At risk" value={kpis.atRisk} unit="patients" note={fmtCompactIDR(kpis.atRiskValue)} tone="coral" />
        <Tile icon={Clock} label="SLA <24h" value={kpis.slaSoon} unit="patients" note="act today" tone="amber" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Money icon={Wallet} label="$ in queue" value={kpis.queueValue} note="all silos" tone="ink" />
        <Money icon={ShieldAlert} label="$ at risk" value={kpis.atRiskValue} note="if denied / lost" tone="coral" />
        <Money icon={Sparkles} label="$ auto-cleared" value={kpis.autoValue} note="zero touch" tone="champagne" />
        <Money icon={TrendingUp} label="$ recovered · today" value={48_300_000} note="appeals + remediation" tone="emerald" />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon, label, value, unit, note, tone,
}: {
  icon: any;
  label: string;
  value: number;
  unit?: string;
  note: string;
  tone: "ink" | "champagne" | "coral" | "amber";
}) {
  const color =
    tone === "champagne" ? "var(--color-champagne)" :
    tone === "coral" ? "var(--color-coral)" :
    tone === "amber" ? "var(--color-amber)" : "var(--color-ink)";
  return (
    <Panel className="overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-3 p-3.5"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}
        >
          <Icon size={14} strokeWidth={1.6} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="eyebrow">{label}</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="numeric font-display text-[24px] text-ink leading-none">{value}</span>
            {unit && <span className="font-mono-tight text-[10px] text-ink-faint">{unit}</span>}
          </div>
          <span className="font-mono-tight text-[10.5px] text-ink-faint mt-1">{note}</span>
        </div>
      </motion.div>
    </Panel>
  );
}

function Money({
  icon: Icon, label, value, note, tone,
}: {
  icon: any;
  label: string;
  value: number;
  note: string;
  tone: "ink" | "champagne" | "coral" | "emerald";
}) {
  const color =
    tone === "champagne" ? "var(--color-champagne)" :
    tone === "coral" ? "var(--color-coral)" :
    tone === "emerald" ? "var(--color-emerald)" : "var(--color-ink)";
  return (
    <Panel className="overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-3 p-3.5"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}
        >
          <Icon size={14} strokeWidth={1.6} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="eyebrow">{label}</span>
          <span className="numeric font-display text-[20px] leading-none mt-1" style={{ color }}>
            {fmtCompactIDR(value)}
          </span>
          <span className="font-mono-tight text-[10.5px] text-ink-faint mt-1">{note}</span>
        </div>
      </motion.div>
    </Panel>
  );
}
