import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ClipboardList, AlertTriangle, Clock, UserRound, ArrowRight, Sparkles, FileWarning, Building2, ScanLine, Activity, Wallet, ShieldAlert, TrendingUp } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { fmtCompactIDR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useWorklist } from "@/store/useWorklist";
import { RecentActivity } from "./RecentActivity";

export function Dashboard() {
  const { items, loaded, load } = useWorklist();
  const navigate = useNavigate();

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const total = items.length;
    const onYou = items.filter((i) => i.awaiting_human);
    const atRisk = items.filter((i) => i.riskLabel);
    const slaSoon = items.filter((i) => i.sla_hours != null && i.sla_hours <= 24);
    const auto = items.filter((i) => i.subStage === "PD_AUTO" || i.subStage === "PA_AUTO");
    const dollarsOnYou = onYou.reduce((s, i) => s + i.amount_idr, 0);
    const queueValue = items.reduce((s, i) => s + i.amount_idr, 0);
    const atRiskValue = atRisk.reduce((s, i) => s + i.amount_idr, 0);
    const autoValue = auto.reduce((s, i) => s + i.amount_idr, 0);
    return {
      total,
      onYou: onYou.length,
      atRisk: atRisk.length,
      slaSoon: slaSoon.length,
      dollarsOnYou,
      queueValue,
      atRiskValue,
      autoValue,
      preauth: items.filter((i) => i.silo === "preauth").length,
      concurrent: items.filter((i) => i.silo === "concurrent").length,
      postdischarge: items.filter((i) => i.silo === "postdischarge").length,
    };
  }, [items]);

  return (
    <>
      <TopBar title="Command Center" />

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-4 [&>*]:shrink-0">
        {/* KPI strip — counts */}
        <div className="grid grid-cols-4 gap-3">
          <Tile
            icon={ClipboardList}
            tone="ink"
            label="Today's queue"
            value={kpis.total}
            note={`${kpis.preauth} pre-auth · ${kpis.concurrent} concurrent · ${kpis.postdischarge} post-discharge`}
          />
          <Tile
            icon={UserRound}
            tone="champagne"
            label="Awaiting me"
            value={kpis.onYou}
            note={loaded ? fmtCompactIDR(kpis.dollarsOnYou) : "—"}
          />
          <Tile
            icon={AlertTriangle}
            tone="coral"
            label="At risk"
            value={kpis.atRisk}
            note="needs review"
          />
          <Tile
            icon={Clock}
            tone="amber"
            label="SLA <24h"
            value={kpis.slaSoon}
            note="action today"
          />
        </div>

        {/* KPI strip — revenue */}
        <div className="grid grid-cols-4 gap-3">
          <Money icon={Wallet}      tone="ink"       label="$ in queue"          value={kpis.queueValue}     note="all silos" />
          <Money icon={ShieldAlert} tone="coral"     label="$ at risk"           value={kpis.atRiskValue}    note="if denied / lost" />
          <Money icon={Sparkles}    tone="champagne" label="$ auto-cleared"      value={kpis.autoValue}      note="zero touch" />
          <Money icon={TrendingUp}  tone="emerald"   label="$ recovered · today" value={48_300_000}          note="appeals + remediation" />
        </div>

        {/* Quick actions */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Quick actions · pick a stack and go"
            title="What needs me first"
          />
          <div className="hairline-x mx-5" />
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-6">
            <ActionChip
              icon={UserRound}
              tone="champagne"
              label="Awaiting me"
              sub="post-discharge"
              count={items.filter((i) => i.silo === "postdischarge" && i.awaiting_human).length}
              onClick={() => navigate("/worklist?silo=postdischarge&filter=awaitingHuman")}
            />
            <ActionChip
              icon={AlertTriangle}
              tone="coral"
              label="At-risk"
              sub="post-discharge"
              count={items.filter((i) => i.silo === "postdischarge" && i.riskLabel).length}
              onClick={() => navigate("/worklist?silo=postdischarge&filter=atRisk")}
            />
            <ActionChip
              icon={Clock}
              tone="amber"
              label="Pre-auth aging"
              sub="past 48h"
              count={items.filter((i) => i.subStage === "PA_AGING").length}
              onClick={() => navigate("/worklist?silo=preauth&subStage=PA_AGING")}
            />
            <ActionChip
              icon={FileWarning}
              tone="violet"
              label="Denials"
              sub="needing appeal"
              count={items.filter((i) => i.subStage === "PD_DENIED").length}
              onClick={() => navigate("/worklist?silo=postdischarge&subStage=PD_DENIED")}
            />
            <ActionChip
              icon={Activity}
              tone="info"
              label="Extensions"
              sub="concurrent · drafted"
              count={items.filter((i) => i.subStage === "C_WATCH_EXTENSION").length}
              onClick={() => navigate("/worklist?silo=concurrent&subStage=C_WATCH_EXTENSION")}
            />
            <ActionChip
              icon={ScanLine}
              tone="ink"
              label="Ready to submit"
              sub="post-discharge"
              count={items.filter((i) => i.subStage === "PD_READY").length}
              onClick={() => navigate("/worklist?silo=postdischarge&subStage=PD_READY")}
            />
          </div>
        </Panel>

        {/* Bottom row */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-7">
            <RecentActivity />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <AgentDayPanel />
          </div>
        </div>
      </div>
    </>
  );
}

function Money({ icon: Icon, label, value, note, tone }: {
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
        className="flex items-start gap-2.5 px-3 py-2.5"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}
        >
          <Icon size={13} strokeWidth={1.6} />
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="eyebrow truncate">{label}</span>
          <span className="numeric font-display text-[18px] leading-none mt-0.5" style={{ color }}>
            {fmtCompactIDR(value)}
          </span>
          <span className="font-mono-tight text-[10px] text-ink-faint mt-0.5 truncate">{note}</span>
        </div>
      </motion.div>
    </Panel>
  );
}

function Tile({ icon: Icon, label, value, note, tone }: {
  icon: any;
  label: string;
  value: number;
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
        className="flex items-start gap-2.5 px-3 py-2.5"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}
        >
          <Icon size={13} strokeWidth={1.6} />
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="eyebrow truncate">{label}</span>
          <span className="numeric font-display text-[20px] text-ink leading-none mt-0.5">{value}</span>
          <span className="font-mono-tight text-[10px] text-ink-faint mt-0.5 truncate">{note}</span>
        </div>
      </motion.div>
    </Panel>
  );
}

function ActionChip({ icon: Icon, label, sub, count, onClick, tone }: {
  icon: any;
  label: string;
  sub: string;
  count: number;
  onClick: () => void;
  tone: "champagne" | "coral" | "amber" | "violet" | "info" | "ink";
}) {
  const color =
    tone === "champagne" ? "var(--color-champagne)" :
    tone === "coral" ? "var(--color-coral)" :
    tone === "amber" ? "var(--color-amber)" :
    tone === "violet" ? "var(--color-violet)" :
    tone === "info" ? "var(--color-azure)" : "var(--color-ink)";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5 text-left transition-colors hover:border-[var(--color-champagne)]/40",
      )}
    >
      <ArrowRight size={11} className="absolute right-2.5 top-2.5 text-ink-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-80" />
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border"
          style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}
        >
          <Icon size={12} strokeWidth={1.7} />
        </span>
        <span className="numeric font-display text-[18px] leading-none" style={{ color }}>{count}</span>
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="truncate text-[11.5px] text-ink">{label}</span>
        <span className="truncate font-mono-tight text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">{sub}</span>
      </div>
    </button>
  );
}

function AgentDayPanel() {
  const wins = [
    { title: "Auto-coded 14 claims", note: "ICD-10 + DRG · ready for review", value: "−2.3h saved" },
    { title: "Drafted 4 appeal letters", note: "you decide before sending", value: "IDR 264 M at stake" },
    { title: "Polled 7 payor portals", note: "ack received · trace updated", value: "no manual checks" },
  ];
  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        eyebrow="What the agent did for you today"
        title="AI did 60% of the work"
        right={<span className="font-mono-tight text-[10px] text-ink-faint">since 09:00</span>}
      />
      <div className="hairline-x mx-5" />
      <div className="flex flex-col gap-2 p-4">
        {wins.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, type: "spring", stiffness: 220, damping: 24 }}
            className="flex items-start gap-3 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3.5 py-3"
          >
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/10 text-[var(--color-champagne)]">
              <Sparkles size={13} strokeWidth={1.6} />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-[12.5px] font-medium text-ink">{w.title}</span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">{w.note}</span>
            </div>
            <span className="numeric text-[11.5px] text-[var(--color-emerald)] whitespace-nowrap">{w.value}</span>
          </motion.div>
        ))}
        {/* gentle nudge */}
        <div className="mt-1 flex items-center gap-2 rounded-md border border-[var(--color-azure)]/25 bg-[var(--color-azure)]/[0.06] px-3 py-2">
          <Building2 size={11} className="text-[var(--color-azure)]" />
          <span className="font-mono-tight text-[10.5px] text-[var(--color-azure)]">
            Your turn · the 40% that needs human judgment is in the worklist.
          </span>
        </div>
      </div>
    </Panel>
  );
}
