import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { usePacketBuilder } from "@/store/usePacketBuilder";

type Counts = {
  in_flight: number;
  building: number;
  preauth: number;
  ready: number;
  submitted: number;
  at_risk: number;
  in_flight_value: number;
};

const SPARK = [2.6, 2.9, 3.1, 3.0, 3.4, 3.7, 3.9, 4.0, 4.1, 4.2];

export function HeadlineStrip() {
  const [c, setC] = useState<Counts | null>(null);
  const boardRefreshTick = usePacketBuilder((s) => s.boardRefreshTick);

  useEffect(() => {
    query<Counts>(
      `SELECT
         SUM(CASE WHEN stage IN ('BUILDING','AWAITING_PREAUTH','READY','SUBMITTED','AT_RISK') THEN 1 ELSE 0 END) AS in_flight,
         SUM(CASE WHEN stage='BUILDING' THEN 1 ELSE 0 END) AS building,
         SUM(CASE WHEN stage='AWAITING_PREAUTH' THEN 1 ELSE 0 END) AS preauth,
         SUM(CASE WHEN stage='READY' THEN 1 ELSE 0 END) AS ready,
         SUM(CASE WHEN stage='SUBMITTED' THEN 1 ELSE 0 END) AS submitted,
         SUM(CASE WHEN stage='AT_RISK' THEN 1 ELSE 0 END) AS at_risk,
         SUM(CASE WHEN stage IN ('BUILDING','AWAITING_PREAUTH','READY','SUBMITTED','AT_RISK') THEN expected_reimb_idr ELSE 0 END) AS in_flight_value
       FROM claims`,
    ).then((rows) => setC(rows[0] ?? null));
  }, [boardRefreshTick]);

  if (!c) return <div className="h-[88px]" />;
  const touchless = Math.round((((c.building ?? 0) + (c.ready ?? 0) + (c.submitted ?? 0)) / (c.in_flight || 1)) * 100);

  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="flex items-center justify-between gap-6 px-5 py-4">
        {/* Left: hero metric */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-1.5"
        >
          <span className="eyebrow">Cash unlocked · last 7 days</span>
          <div className="flex items-baseline gap-2">
            <span className="numeric font-display text-[42px] leading-none text-ink">
              <MetricNumber value={4.2} decimals={1} prefix="IDR " suffix=" B" />
            </span>
            <span className="flex items-center gap-0.5 font-mono-tight text-[12px] text-[var(--color-emerald)]">
              <ArrowUpRight size={12} /> +50%
            </span>
          </div>
          <span className="font-mono-tight text-[11px] text-ink-mute">
            vs IDR 2.8 B same week last month · time-to-cash compressed 38d → 26d
          </span>
        </motion.div>

        {/* Center: sparkline */}
        <div className="hidden flex-1 items-center justify-center md:flex">
          <Sparkline data={SPARK} width={220} height={48} stroke="var(--color-emerald)" fill="rgba(52,211,153,0.18)" />
        </div>

        {/* Right: live ops summary */}
        <div className="flex items-center gap-6 border-l border-line-soft pl-6">
          <Stat n={c.in_flight} label="in flight" sub={fmtCompactIDR(c.in_flight_value ?? 0)} />
          <Stat n={touchless} suffix="%" label="touchless" sub="no human review" tone="champagne" />
          <Stat n={c.at_risk} label="need attention" sub="across 4 sites" tone={c.at_risk > 0 ? "coral" : "ink"} />
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  n, suffix, label, sub, tone = "ink",
}: { n: number; suffix?: string; label: string; sub: string; tone?: "ink" | "champagne" | "coral" }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "coral" ? "text-[var(--color-coral)]"
    : "text-ink";
  return (
    <div className="flex flex-col leading-tight">
      <span className={`numeric font-display text-[22px] ${c}`}>
        <MetricNumber value={n} suffix={suffix} />
      </span>
      <span className="text-[11px] text-ink-soft">{label}</span>
      <span className="font-mono-tight text-[10px] text-ink-faint">{sub}</span>
    </div>
  );
}
