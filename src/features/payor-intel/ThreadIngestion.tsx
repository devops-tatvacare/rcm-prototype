import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { useEvidence } from "@/store/useEvidence";

type Thread = {
  id: string;
  payor_id: string;
  payor_name: string;
  payor_color: string;
  subject: string;
  sender: string;
  outcome: string;
  learned_rule: string;
  rule_kind: string;
  ts: string;
};

const OUTCOME_TONE: Record<string, "good" | "warn" | "bad"> = {
  approved: "good",
  approved_after_mri: "good",
  partial_paid: "warn",
  denied_resubmitted_won: "warn",
  denied: "bad",
};

export function ThreadIngestion() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [pulse, setPulse] = useState(0);
  const openRule = useEvidence((s) => s.openRule);
  const openThread = useEvidence((s) => s.openThread);

  useEffect(() => {
    query<Thread>(
      `SELECT t.id, t.payor_id, py.name AS payor_name, py.color AS payor_color,
              t.subject, t.sender, t.outcome, t.learned_rule, r.kind AS rule_kind, t.ts
         FROM email_threads t
         JOIN payors py ON py.id = t.payor_id
         LEFT JOIN payor_rules r ON r.id = t.learned_rule
        ORDER BY t.ts DESC`,
    ).then(setThreads);
  }, []);

  async function startIngest() {
    setIngesting(true);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setPulse((p) => p + 1);
      if (n >= 6) {
        clearInterval(id);
        setIngesting(false);
      }
    }, 700);
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="Cold-start engine · how the agent learns"
        title="Email-thread ingestion"
        right={
          <Button
            size="sm"
            variant={ingesting ? "soft" : "primary"}
            onClick={startIngest}
            disabled={ingesting}
          >
            <Sparkles size={12} />
            {ingesting ? "Parsing…" : "Ingest 6 new threads"}
          </Button>
        }
      />
      <div className="hairline-x mx-5" />

      {/* Live sweep ribbon */}
      <div className="relative h-9 border-b border-line-soft bg-[var(--color-canvas-deep)]/50 overflow-hidden">
        <AnimatePresence>
          {ingesting && (
            <motion.div
              key={pulse}
              initial={{ x: -200 }}
              animate={{ x: "120vw" }}
              transition={{ duration: 1.4, ease: "linear" }}
              className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-full border border-[var(--color-champagne)]/40 bg-[var(--color-champagne)]/10 px-3 py-1 font-mono-tight text-[11px] text-[var(--color-champagne)]"
            >
              <Mail size={11} />
              klaim.bpjs@bpjs-kesehatan.go.id
              <ArrowRight size={11} className="opacity-60" />
              extracting rule…
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 flex items-center justify-between px-5 font-mono-tight text-[10.5px] text-ink-faint">
          <span>Inbox connector · Cendana TPA desk</span>
          <span>
            {threads.length} threads loaded · 6 rules learned · last sync 4 min ago
          </span>
        </div>
      </div>

      {/* Slim list — one row per thread, click to open right-side drawer.
          Detail (excerpt, body, learned-rule card) lives in the drawer. */}
      <ul className="flex flex-col">
        {threads.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * i }}
            className="border-t border-line-soft first:border-t-0"
          >
            {/* Outer is a div (not button) so the rule chip can be a real button — nested
                <button> is invalid HTML. Row activation handled via onClick + role. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => openThread(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openThread(t.id);
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left hover:bg-[var(--color-panel-2)]/40 focus-visible:bg-[var(--color-panel-2)]/40 focus-visible:outline-none"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: t.payor_color }}
              />

              {/* Sender — fixed width so subjects line up across rows */}
              <div className="hidden w-[210px] shrink-0 truncate font-mono-tight text-[10.5px] text-ink-faint sm:block">
                {t.sender}
              </div>

              {/* Subject */}
              <div className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                {t.subject}
              </div>

              {/* Rule kind chip — clicking jumps to the rule's evidence list,
                  separately from clicking the row (which opens the single thread). */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (t.learned_rule) openRule(t.learned_rule);
                }}
                className="hidden shrink-0 md:block"
                aria-label={`View all evidence for rule kind ${t.rule_kind}`}
              >
                <Pill tone="champagne" size="xs" className="hover:brightness-125">
                  {t.rule_kind ?? "rule"}
                </Pill>
              </button>

              {/* Time */}
              <span className="hidden shrink-0 font-mono-tight text-[10.5px] text-ink-faint md:block">
                {relativeTime(Date.now() - new Date(t.ts).getTime())}
              </span>

              {/* Outcome */}
              <Pill tone={OUTCOME_TONE[t.outcome] ?? "neutral"} size="xs" dot>
                {t.outcome.replace(/_/g, " ")}
              </Pill>

              <ChevronRight
                size={14}
                className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
          </motion.li>
        ))}
      </ul>
    </Panel>
  );
}
