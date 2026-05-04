import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { query } from "@/lib/db";
import { fmtCompactIDR, fmtInt } from "@/lib/format";

type Bucket = { id: string; label: string; count: number; value_idr: number; sort: number };

const TONES: Record<string, string> = {
  Building: "var(--color-violet)",
  "Awaiting pre-auth": "var(--color-azure)",
  Submitted: "var(--color-champagne)",
  Acknowledged: "var(--color-champagne-soft)",
  Adjudicated: "var(--color-emerald-soft)",
  Paid: "var(--color-emerald)",
  "Denied · in appeal": "var(--color-coral)",
};

export function Pipeline() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  useEffect(() => {
    query<Bucket>("SELECT id, label, count, value_idr, sort FROM pipeline_buckets ORDER BY sort").then(setBuckets);
  }, []);

  const maxValue = Math.max(1, ...buckets.map((b) => b.value_idr));

  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader eyebrow="Live · in-flight claims" title="Claim pipeline" />
      <div className="hairline-x mx-5" />
      <div className="flex flex-col gap-2.5 p-5">
        {buckets.map((b, i) => {
          const pct = (b.value_idr / maxValue) * 100;
          const color = TONES[b.label] ?? "var(--color-ink-faint)";
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i, type: "spring", stiffness: 220, damping: 24 }}
            >
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-ink-soft">{b.label}</span>
                </div>
                <div className="flex items-center gap-3 font-mono-tight text-[11px] text-ink-faint">
                  <span>{fmtInt(b.count)} claims</span>
                  <span className="text-ink-mute">{fmtCompactIDR(b.value_idr)}</span>
                </div>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.15 + i * 0.04, type: "spring", stiffness: 70, damping: 16 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, transparent, ${color})` }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
