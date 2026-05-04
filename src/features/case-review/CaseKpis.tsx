import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Activity, AlertTriangle, FileText, ClockAlert } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { query } from "@/lib/db";

type Counts = {
  total: number;
  over_auth: number;
  near_auth: number;
  avoidable: number;
  avg_mn_score: number;
  avg_los_variance: number;
  ext_pending: number;
};

export function CaseKpis() {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    query<Counts>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN day_of_stay > authorized_days THEN 1 ELSE 0 END) AS over_auth,
         SUM(CASE WHEN day_of_stay = authorized_days THEN 1 ELSE 0 END) AS near_auth,
         SUM(CASE WHEN avoidable_day_flag = 1 THEN 1 ELSE 0 END) AS avoidable,
         AVG(medical_necessity_score) AS avg_mn_score,
         AVG(los_variance_pct) AS avg_los_variance,
         SUM(CASE WHEN auth_extension_status IN ('DRAFTED','SUBMITTED') THEN 1 ELSE 0 END) AS ext_pending
       FROM inpatients`,
    ).then((rows) => setC(rows[0] ?? null));
  }, []);

  if (!c) return <div className="h-[88px]" />;
  const mnScore = Math.round((c.avg_mn_score ?? 0) * 100);
  const avoidableRate = Math.round(((c.avoidable ?? 0) / Math.max(1, c.total)) * 100);

  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="flex items-center justify-between gap-6 px-5 py-4">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1.5"
        >
          <span className="eyebrow">Medical-necessity completeness · live</span>
          <div className="flex items-baseline gap-2">
            <span className="numeric font-display text-[42px] leading-none text-ink">
              <MetricNumber value={mnScore} suffix="%" />
            </span>
            <span className="font-mono-tight text-[12px] text-[var(--color-emerald)]">
              ↗ vs SEA baseline 60-75%
            </span>
          </div>
          <span className="font-mono-tight text-[11px] text-ink-mute">
            spec target &gt; 95% · gaps surfaced before discharge, not after denial
          </span>
        </motion.div>

        <div className="flex items-center gap-6 border-l border-line-soft pl-6">
          <Stat Icon={Activity} value={c.total} label="active inpatients" sub="across 4 sites" />
          <Stat Icon={AlertTriangle} value={c.over_auth} label="over auth" sub={c.ext_pending > 0 ? `${c.ext_pending} extensions pending` : "0 extensions filed"} tone={c.over_auth > 0 ? "coral" : "ink"} />
          <Stat Icon={ClockAlert} value={avoidableRate} suffix="%" label="avoidable days" sub={`${c.avoidable} flagged today`} tone={avoidableRate > 5 ? "amber" : "emerald"} />
          <Stat Icon={FileText} value={Math.abs(Math.round(c.avg_los_variance ?? 0))} suffix="%" label="LOS variance" sub={(c.avg_los_variance ?? 0) >= 0 ? "above DRG benchmark" : "below DRG benchmark"} tone="champagne" />
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  Icon, value, suffix, label, sub, tone = "ink",
}: { Icon: any; value: number; suffix?: string; label: string; sub: string; tone?: "ink" | "champagne" | "emerald" | "coral" | "amber" }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "emerald" ? "text-[var(--color-emerald)]"
    : tone === "coral" ? "text-[var(--color-coral)]"
    : tone === "amber" ? "text-[var(--color-amber)]"
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
