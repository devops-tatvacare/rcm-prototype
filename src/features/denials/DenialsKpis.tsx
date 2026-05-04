import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy, AlertOctagon, Clock, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { fmtCompactIDR } from "@/lib/format";
import { query } from "@/lib/db";

type Counts = {
  total: number;
  drafting: number;
  ready: number;
  submitted: number;
  won: number;
  lost: number;
  open_amount: number;
  recovered_amount: number;
  deadlines_7d: number;
  recurring_patterns: number;
};

export function DenialsKpis() {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    query<Counts>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN appeal_status='DRAFTING' THEN 1 ELSE 0 END) AS drafting,
         SUM(CASE WHEN appeal_status='READY' THEN 1 ELSE 0 END) AS ready,
         SUM(CASE WHEN appeal_status='SUBMITTED' THEN 1 ELSE 0 END) AS submitted,
         SUM(CASE WHEN appeal_status='WON' THEN 1 ELSE 0 END) AS won,
         SUM(CASE WHEN appeal_status='LOST' THEN 1 ELSE 0 END) AS lost,
         SUM(CASE WHEN appeal_status NOT IN ('WON','LOST') THEN denied_amount_idr ELSE 0 END) AS open_amount,
         SUM(CASE WHEN appeal_status='WON' THEN denied_amount_idr ELSE 0 END) AS recovered_amount,
         SUM(CASE WHEN julianday(appeal_deadline_at) - julianday('now') < 7 AND appeal_status NOT IN ('WON','LOST') THEN 1 ELSE 0 END) AS deadlines_7d,
         (SELECT COUNT(DISTINCT recurring_pattern_id) FROM denials WHERE recurring_pattern_id IS NOT NULL) AS recurring_patterns
       FROM denials`,
    ).then((rows) => setC(rows[0] ?? null));
  }, []);

  if (!c) return <div className="h-[88px]" />;
  const closed = (c.won ?? 0) + (c.lost ?? 0);
  const successRate = closed > 0 ? Math.round(((c.won ?? 0) / closed) * 100) : 0;

  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="flex items-center justify-between gap-6 px-5 py-4">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1.5"
        >
          <span className="eyebrow">Appeal success · trailing 90 days</span>
          <div className="flex items-baseline gap-2">
            <span className="numeric font-display text-[42px] leading-none text-ink">
              <MetricNumber value={successRate} suffix="%" />
            </span>
            <span className="font-mono-tight text-[12px] text-[var(--color-emerald)]">
              ↗ vs SEA baseline 30–45%
            </span>
          </div>
          <span className="font-mono-tight text-[11px] text-ink-mute">
            spec target &gt; 70% · {fmtCompactIDR(c.recovered_amount ?? 0)} recovered this quarter
          </span>
        </motion.div>

        <div className="flex items-center gap-6 border-l border-line-soft pl-6">
          <Stat Icon={AlertOctagon} value={c.total} label="open denials" sub={fmtCompactIDR(c.open_amount ?? 0) + " at risk"} tone="coral" />
          <Stat Icon={Clock} value={c.deadlines_7d} label="deadlines &lt; 7d" sub="auto-prioritised" tone="amber" />
          <Stat Icon={Trophy} value={c.won} label="won this quarter" sub="agent-drafted appeals" tone="emerald" />
          <Stat Icon={RefreshCw} value={c.recurring_patterns} label="recurring patterns" sub="pushed back to Builder" tone="champagne" />
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  Icon, value, label, sub, tone = "ink",
}: { Icon: any; value: number; label: string; sub: string; tone?: "ink" | "champagne" | "emerald" | "coral" | "amber" }) {
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
          <MetricNumber value={value} />
        </span>
      </div>
      <span className="text-[11px] text-ink-soft" dangerouslySetInnerHTML={{ __html: label }} />
      <span className="font-mono-tight text-[10px] text-ink-faint">{sub}</span>
    </div>
  );
}
