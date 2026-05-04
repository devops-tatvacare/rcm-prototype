import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Wallet, ShieldCheck, AlertTriangle, Hourglass } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { fmtCompactIDR } from "@/lib/format";
import { query } from "@/lib/db";

type Counts = {
  total: number;
  cleared: number;
  conditional: number;
  pending: number;
  not_cleared: number;
  total_required: number;
  total_collected: number;
  high_risk_count: number;
  high_risk_amount: number;
  gop_pending: number;
};

export function ClearancesKpis() {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    query<Counts>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status='CLEARED' THEN 1 ELSE 0 END) AS cleared,
         SUM(CASE WHEN status='CONDITIONAL' THEN 1 ELSE 0 END) AS conditional,
         SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='NOT_CLEARED' THEN 1 ELSE 0 END) AS not_cleared,
         SUM(deposit_required_idr) AS total_required,
         SUM(deposit_collected_idr) AS total_collected,
         SUM(CASE WHEN bad_debt_risk_tier='HIGH' THEN 1 ELSE 0 END) AS high_risk_count,
         SUM(CASE WHEN bad_debt_risk_tier='HIGH' THEN patient_liability_idr ELSE 0 END) AS high_risk_amount,
         SUM(CASE WHEN gop_status IN ('DRAFTED','SUBMITTED') THEN 1 ELSE 0 END) AS gop_pending
       FROM clearances`,
    ).then((rows) => setC(rows[0] ?? null));
  }, []);

  if (!c) return <div className="h-[88px]" />;
  const collectionRate = c.total_required > 0 ? Math.round(((c.total_collected ?? 0) / c.total_required) * 100) : 0;
  const clearedRate = Math.round(((c.cleared ?? 0) / Math.max(1, c.total)) * 100);

  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="flex items-center justify-between gap-6 px-5 py-4">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1.5"
        >
          <span className="eyebrow">Deposit collection rate · today</span>
          <div className="flex items-baseline gap-2">
            <span className="numeric font-display text-[42px] leading-none text-ink">
              <MetricNumber value={collectionRate} suffix="%" />
            </span>
            <span className="font-mono-tight text-[12px] text-[var(--color-emerald)]">
              ↗ vs SEA baseline 60-70%
            </span>
          </div>
          <span className="font-mono-tight text-[11px] text-ink-mute">
            spec target &gt; 95% insured · {fmtCompactIDR(c.total_collected ?? 0)} of {fmtCompactIDR(c.total_required ?? 0)}
          </span>
        </motion.div>

        <div className="flex items-center gap-6 border-l border-line-soft pl-6">
          <Stat Icon={ShieldCheck} value={clearedRate} suffix="%" label="cleared today" sub={`${c.cleared}/${c.total} ready to admit`} tone="emerald" />
          <Stat Icon={Hourglass} value={c.gop_pending} label="GOP in flight" sub="awaiting payor approval" tone="champagne" />
          <Stat Icon={Wallet} value={c.conditional ?? 0} label="conditional" sub="admitted with deposit + monitoring" tone="champagne" />
          <Stat Icon={AlertTriangle} value={c.high_risk_count} label="high bad-debt risk" sub={fmtCompactIDR(c.high_risk_amount ?? 0) + " exposure"} tone={c.high_risk_count > 0 ? "coral" : "ink"} />
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  Icon, value, suffix, label, sub, tone = "ink",
}: { Icon: any; value: number; suffix?: string; label: string; sub: string; tone?: "ink" | "champagne" | "emerald" | "coral" }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "emerald" ? "text-[var(--color-emerald)]"
    : tone === "coral" ? "text-[var(--color-coral)]"
    : "text-ink";
  return (
    <div className="flex flex-col leading-tight">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className={c} />
        <span className={`numeric font-display text-[22px] ${c}`}>
          <MetricNumber value={value} suffix={suffix} />
        </span>
      </div>
      <span className="text-[11px] text-ink-soft">{label}</span>
      <span className="font-mono-tight text-[10px] text-ink-faint">{sub}</span>
    </div>
  );
}
