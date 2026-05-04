import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Activity, Bot, ShieldAlert, Hourglass, Sparkles, Wallet } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { fmtCompactIDR } from "@/lib/format";
import { query } from "@/lib/db";

type Counts = {
  in_flight: number;
  building: number;
  preauth: number;
  ready: number;
  submitted: number;
  at_risk: number;
  in_flight_value: number;
  at_risk_value: number;
  avg_acceptance: number;
};

export function FloorKpis() {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    query<Counts>(
      `SELECT
         SUM(CASE WHEN stage IN ('BUILDING','AWAITING_PREAUTH','READY','SUBMITTED','AT_RISK') THEN 1 ELSE 0 END) AS in_flight,
         SUM(CASE WHEN stage='BUILDING' THEN 1 ELSE 0 END) AS building,
         SUM(CASE WHEN stage='AWAITING_PREAUTH' THEN 1 ELSE 0 END) AS preauth,
         SUM(CASE WHEN stage='READY' THEN 1 ELSE 0 END) AS ready,
         SUM(CASE WHEN stage='SUBMITTED' THEN 1 ELSE 0 END) AS submitted,
         SUM(CASE WHEN stage='AT_RISK' THEN 1 ELSE 0 END) AS at_risk,
         SUM(CASE WHEN stage IN ('BUILDING','AWAITING_PREAUTH','READY','SUBMITTED','AT_RISK') THEN expected_reimb_idr ELSE 0 END) AS in_flight_value,
         SUM(CASE WHEN stage='AT_RISK' THEN expected_reimb_idr ELSE 0 END) AS at_risk_value,
         AVG(CASE WHEN stage IN ('BUILDING','AWAITING_PREAUTH','READY','SUBMITTED','AT_RISK') THEN acceptance_score END) AS avg_acceptance
       FROM claims`,
    ).then((rows) => setC(rows[0] ?? null));
  }, []);

  // Touchless rate = stages BUILDING+READY+SUBMITTED handled by agent without intervention vs total in-flight
  const touchlessRate = useMemo(() => {
    if (!c) return 0;
    const handled = (c.building ?? 0) + (c.ready ?? 0) + (c.submitted ?? 0);
    const total = c.in_flight || 1;
    return Math.round((handled / total) * 100);
  }, [c]);

  if (!c) return <div className="h-[104px]" />;

  const kpis = [
    {
      eyebrow: "Claims in flight",
      Icon: Activity,
      value: c.in_flight,
      hint: `${fmtCompactIDR(c.in_flight_value ?? 0)} working capital`,
      delta: "+18 vs last wk",
      tone: "ink" as const,
    },
    {
      eyebrow: "Touchless rate",
      Icon: Bot,
      value: touchlessRate,
      suffix: "%",
      hint: `${(c.building ?? 0) + (c.ready ?? 0) + (c.submitted ?? 0)} of ${c.in_flight} no human review`,
      delta: "+12 pts",
      tone: "champagne" as const,
    },
    {
      eyebrow: "Avg acceptance",
      Icon: Sparkles,
      value: Math.round((c.avg_acceptance ?? 0) * 100),
      suffix: "%",
      hint: "live across in-flight",
      delta: "+9.4 pts",
      tone: "emerald" as const,
    },
    {
      eyebrow: "Pre-auth queue",
      Icon: Hourglass,
      value: c.preauth,
      hint: "1 aging > 72h",
      delta: "−4 vs yday",
      tone: "violet" as const,
      negativeDeltaIsGood: true,
    },
    {
      eyebrow: "At risk",
      Icon: ShieldAlert,
      value: c.at_risk,
      hint: `${fmtCompactIDR(c.at_risk_value ?? 0)} exposure`,
      delta: "−2 today",
      tone: "coral" as const,
      negativeDeltaIsGood: true,
    },
    {
      eyebrow: "Cash unlocked · 7d",
      Icon: Wallet,
      value: 1.42,
      decimals: 2,
      prefix: "IDR ",
      suffix: " B",
      hint: "vs same wk last month",
      delta: "+IDR 410 M",
      tone: "champagne" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {kpis.map((k, i) => (
        <Tile key={i} {...k} index={i} />
      ))}
    </div>
  );
}

function Tile({
  eyebrow, Icon, value, suffix, prefix, decimals, hint, delta, tone, index, negativeDeltaIsGood,
}: {
  eyebrow: string; Icon: any; value: number; suffix?: string; prefix?: string; decimals?: number;
  hint: string; delta: string; tone: "ink" | "champagne" | "emerald" | "violet" | "coral";
  index: number; negativeDeltaIsGood?: boolean;
}) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "emerald" ? "text-[var(--color-emerald)]"
    : tone === "violet" ? "text-[var(--color-violet)]"
    : tone === "coral" ? "text-[var(--color-coral)]"
    : "text-ink";

  const isUp = delta.startsWith("+");
  const TrendIcon = isUp ? ArrowUpRight : ArrowDownRight;
  const trendGood = (isUp && !negativeDeltaIsGood) || (!isUp && negativeDeltaIsGood);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, type: "spring", stiffness: 240, damping: 26 }}
    >
      <Panel className="overflow-hidden">
        <div className="flex h-full flex-col gap-2 p-3.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="eyebrow !tracking-[0.12em] flex-1 min-w-0 truncate" title={eyebrow}>{eyebrow}</span>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 ${c}`}>
              <Icon size={12} strokeWidth={1.7} />
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`numeric font-display text-[26px] leading-none ${c}`}>
              <MetricNumber value={value} decimals={decimals ?? 0} prefix={prefix} suffix={suffix} />
            </span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 text-[10.5px]">
            <span className="font-mono-tight text-ink-faint truncate">{hint}</span>
            <span className={`flex items-center gap-0.5 font-mono-tight whitespace-nowrap ${trendGood ? "text-[var(--color-emerald)]" : "text-[var(--color-coral)]"}`}>
              <TrendIcon size={10} />
              {delta.replace(/^[+−-]/, "")}
            </span>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}
