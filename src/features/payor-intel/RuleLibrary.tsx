import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { useEvidence } from "@/store/useEvidence";

type Rule = {
  id: string;
  payor_id: string;
  payor_name: string;
  payor_color: string;
  drg_pattern: string;
  kind: string;
  description: string;
  evidence_threads: number;
  lift_pct: number;
};

const KIND_TONE: Record<string, "champagne" | "violet" | "info" | "good" | "warn" | "neutral"> = {
  documentation: "champagne",
  narrative: "violet",
  format: "info",
  evidence: "good",
  "pre-auth": "warn",
};

export function RuleLibrary() {
  const [rules, setRules] = useState<Rule[]>([]);
  const openRule = useEvidence((s) => s.openRule);

  useEffect(() => {
    query<Rule>(
      `SELECT r.*, p.name AS payor_name, p.color AS payor_color
         FROM payor_rules r JOIN payors p ON p.id = r.payor_id
        ORDER BY r.lift_pct DESC`,
    ).then(setRules);
  }, []);

  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        eyebrow="Auto-learned · ranked by lift"
        title="Rule library"
        right={<Pill tone="champagne" dot>{rules.length} rules</Pill>}
      />
      <div className="hairline-x mx-5" />
      <div className="flex flex-col">
        {rules.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i }}
            className="border-t border-line-soft px-5 py-3 first:border-t-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.payor_color }} />
                  <span className="font-mono-tight text-[10.5px] text-ink-mute">{r.payor_name}</span>
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">· {r.drg_pattern}</span>
                  <Pill tone={KIND_TONE[r.kind] ?? "neutral"} className="ml-1">{r.kind}</Pill>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">{r.description}</p>
                <button
                  type="button"
                  onClick={() => openRule(r.id)}
                  className="mt-1.5 inline-flex items-center gap-1 font-mono-tight text-[10.5px] text-ink-faint underline-offset-2 hover:text-[var(--color-champagne)] hover:underline"
                  aria-label={`View ${r.evidence_threads} evidence threads`}
                >
                  evidence · {r.evidence_threads.toLocaleString()} threads
                  <ArrowUpRight size={11} className="opacity-70" />
                </button>
              </div>
              <div className="text-right">
                <div className="numeric text-[18px] text-[var(--color-emerald)]">+{(r.lift_pct * 100).toFixed(1)}</div>
                <div className="font-mono-tight text-[10px] text-ink-faint">pts lift</div>
              </div>
            </div>
            {/* Lift bar */}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, r.lift_pct * 100 * 4)}%` }}
                transition={{ delay: 0.1 + i * 0.04, type: "spring", stiffness: 70, damping: 18 }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-champagne-deep)] to-[var(--color-emerald)]"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}
