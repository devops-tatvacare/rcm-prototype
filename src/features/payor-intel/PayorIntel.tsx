import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { ThreadIngestion } from "./ThreadIngestion";
import { RuleLibrary } from "./RuleLibrary";

type Payor = {
  id: string; name: string; kind: string;
  clean_claim_rate: number; avg_dtp_days: number; denial_rate: number;
  threads_ingested: number; monthly_volume_idr: number; color: string;
};

export function PayorIntel() {
  const [payors, setPayors] = useState<Payor[]>([]);

  useEffect(() => {
    query<Payor>("SELECT * FROM payors ORDER BY monthly_volume_idr DESC").then(setPayors);
  }, []);

  return (
    <>
      <TopBar breadcrumb="Workspace · Mid-cycle" title="Payor Intelligence" />

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
        {/* Per-payor scorecards */}
        <div className="grid grid-cols-12 gap-3">
          {payors.map((p, i) => (
            <PayorCard key={p.id} payor={p} index={i} />
          ))}
        </div>

        {/* Thread ingestion + rule library */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-7">
            <ThreadIngestion />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <RuleLibrary />
          </div>
        </div>
      </div>
    </>
  );
}

function PayorCard({ payor, index }: { payor: Payor; index: number }) {
  const trendDtp = [44, 42, 40, 39, 38, 36, 33, 30, 27, payor.avg_dtp_days];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: "spring", stiffness: 220, damping: 26 }}
      className="col-span-12 lg:col-span-4"
    >
      <Panel tone="raised" className="overflow-hidden">
        {/* Stripe at top in payor color */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${payor.color}, transparent)` }} />
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">{payor.kind === "government" ? "Gov scheme" : "Private payor"}</div>
              <div className="mt-1 font-display text-[22px] tracking-tight text-ink">{payor.name}</div>
              <div className="mt-0.5 font-mono-tight text-[11px] text-ink-faint">
                {fmtCompactIDR(payor.monthly_volume_idr)} / mo · {payor.threads_ingested.toLocaleString()} threads ingested
              </div>
            </div>
            <Pill tone={payor.clean_claim_rate >= 0.8 ? "good" : "warn"} dot>
              {Math.round(payor.clean_claim_rate * 100)}% CCR
            </Pill>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Mini eyebrow="Days to payment" value={payor.avg_dtp_days} suffix="d" trend={trendDtp} positiveDown stroke={payor.color} />
            <Mini eyebrow="Denial rate" value={payor.denial_rate * 100} suffix="%" decimals={1} trend={[18, 17, 16, 15, 14, 13, 12, 11, 10, payor.denial_rate * 100]} positiveDown />
          </div>

          {/* sub-pills */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Pill tone="neutral">{payor.kind === "government" ? "BPJS V-Claim REST" : "Portal + email"}</Pill>
            <Pill tone="neutral">INA-CBG · DRG</Pill>
            <Pill tone="neutral">Cashless</Pill>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

function Mini({
  eyebrow, value, suffix, decimals = 0, trend, stroke = "var(--color-emerald)", positiveDown,
}: { eyebrow: string; value: number; suffix: string; decimals?: number; trend: number[]; stroke?: string; positiveDown?: boolean }) {
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="mt-0.5 numeric text-[20px] text-ink">
            <MetricNumber value={value} decimals={decimals} suffix={suffix} />
          </div>
        </div>
        <Sparkline data={positiveDown ? [...trend].reverse().map((_, i) => trend[i]) : trend} stroke={stroke} fill={`${stroke.replace(")", "33)").replace("var(--color-", "var(--color-")}`} width={70} height={28} />
      </div>
    </div>
  );
}
