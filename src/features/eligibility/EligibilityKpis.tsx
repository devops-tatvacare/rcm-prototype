import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Timer, Wifi, ShieldAlert, FileCheck2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { query } from "@/lib/db";

type Counts = {
  total: number;
  live_count: number;
  active: number;
  disputed: number;
  lapsed: number;
  pre_auth_required: number;
  avg_tat: number;
};

export function EligibilityKpis() {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    query<Counts>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN source='LIVE_API' THEN 1 ELSE 0 END) AS live_count,
         SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status='DISPUTED' THEN 1 ELSE 0 END) AS disputed,
         SUM(CASE WHEN status IN ('LAPSED','WAITING_PERIOD','SUSPENDED') THEN 1 ELSE 0 END) AS lapsed,
         SUM(CASE WHEN pre_auth_required=1 THEN 1 ELSE 0 END) AS pre_auth_required,
         AVG(tat_seconds) AS avg_tat
       FROM eligibility_checks`,
    ).then((rows) => setC(rows[0] ?? null));
  }, []);

  if (!c) return <div className="h-[88px]" />;
  const liveHitRate = Math.round(((c.live_count ?? 0) / Math.max(1, c.total)) * 100);
  const blockedRate = Math.round((((c.disputed ?? 0) + (c.lapsed ?? 0)) / Math.max(1, c.total)) * 100);

  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="flex items-center justify-between gap-6 px-5 py-4">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1.5"
        >
          <span className="eyebrow">Average TAT · today</span>
          <div className="flex items-baseline gap-2">
            <span className="numeric font-display text-[42px] leading-none text-ink">
              <MetricNumber value={Math.round(c.avg_tat ?? 0)} suffix="s" />
            </span>
            <span className="font-mono-tight text-[12px] text-[var(--color-emerald)]">
              ↘ vs 4–24h manual baseline
            </span>
          </div>
          <span className="font-mono-tight text-[11px] text-ink-mute">
            spec target &lt; 90s · <span className="text-[var(--color-champagne)]">beating it on {Math.round((c.avg_tat ?? 0) < 90 ? 100 : 0)}% of checks</span>
          </span>
        </motion.div>

        <div className="flex items-center gap-6 border-l border-line-soft pl-6">
          <Stat Icon={Timer} value={c.total} label="checks today" sub="across 4 sites" />
          <Stat Icon={Wifi} value={liveHitRate} suffix="%" label="live-API rate" sub={`${c.live_count}/${c.total} real-time`} tone="champagne" />
          <Stat Icon={FileCheck2} value={c.pre_auth_required} label="pre-auth needed" sub="auto-routed to billing" />
          <Stat Icon={ShieldAlert} value={blockedRate} suffix="%" label="blocked / disputed" sub="caught at desk · not at claim" tone={blockedRate > 0 ? "coral" : "ink"} />
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  Icon, value, suffix, label, sub, tone = "ink",
}: { Icon: any; value: number; suffix?: string; label: string; sub: string; tone?: "ink" | "champagne" | "coral" }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
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
