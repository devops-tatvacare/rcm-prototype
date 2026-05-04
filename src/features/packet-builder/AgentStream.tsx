import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, FileText, Code2, ShieldCheck, Layers, CheckCircle2, BookOpen, Send, BellRing, Radar, Upload, ArrowUpRight } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { usePacketBuilder } from "@/store/usePacketBuilder";
import { useEvidence } from "@/store/useEvidence";
import { query } from "@/lib/db";
import { cn } from "@/lib/cn";

function statePillTone(s: string): "info" | "good" | "warn" | "bad" | "champagne" | "neutral" {
  if (s === "running" || s === "dispatching" || s === "remediating") return "info";
  if (s === "ready" || s === "remediated") return "good";
  if (s === "submitted") return "champagne";
  if (s === "blocked") return "bad";
  if (s === "preauth_wait" || s === "paused") return "warn";
  return "neutral";
}

function statePillLabel(s: string): string {
  if (s === "idle") return "Idle";
  if (s === "running") return "Working";
  if (s === "paused") return "Paused";
  if (s === "ready") return "Ready for review";
  if (s === "dispatching") return "Dispatching";
  if (s === "submitted") return "Submitted";
  if (s === "preauth_wait") return "Awaiting ack";
  if (s === "blocked") return "Blocked";
  if (s === "remediating") return "Remediating";
  if (s === "remediated") return "Resolved";
  return "Idle";
}

const ICONS: Record<string, any> = {
  init: Sparkles,
  fetch: FileText,
  code: Code2,
  rule: BookOpen,
  validate: ShieldCheck,
  compose: Layers,
  ready: CheckCircle2,
  dispatch: Send,
  ack: BellRing,
  tracking: Radar,
  intake: Upload,
};

export function AgentStream() {
  const { emittedSteps, status } = usePacketBuilder();
  const ref = useRef<HTMLDivElement>(null);
  const openRule = useEvidence((s) => s.openRule);
  // Map ruleId → number of evidence threads, so each rule firing in the trace
  // can show "view evidence · N threads" without inflating the AgentStep schema.
  const [ruleEvidence, setRuleEvidence] = useState<Record<string, { count: number; description: string }>>({});

  useEffect(() => {
    query<{ id: string; evidence_threads: number; description: string }>(
      "SELECT id, evidence_threads, description FROM payor_rules",
    ).then((rows) => {
      const map: Record<string, { count: number; description: string }> = {};
      rows.forEach((r) => {
        map[r.id] = { count: r.evidence_threads, description: r.description };
      });
      setRuleEvidence(map);
    });
  }, []);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [emittedSteps.length]);

  return (
    <Panel className="flex h-full min-h-0 flex-col">
      <PanelHeader
        eyebrow="Agent · live"
        title="Reasoning trace"
        right={
          <Pill tone={statePillTone(status)} dot>
            {statePillLabel(status)}
          </Pill>
        }
      />
      <div className="hairline-x mx-5" />

      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {emittedSteps.length === 0 && status === "idle" && <EmptyState />}

        <ol className="relative ml-2 border-l border-line-soft">
          <AnimatePresence initial={false}>
            {emittedSteps.map((s, i) => {
              const Icon = ICONS[s.kind] ?? Sparkles;
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  className="relative pl-6 py-2.5"
                >
                  <span
                    className={cn(
                      "absolute -left-[9px] top-3.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-canvas-deep",
                      s.kind === "rule"
                        ? "border-[var(--color-champagne)]/60 text-[var(--color-champagne)]"
                        : s.kind === "ready" || s.kind === "ack"
                          ? "border-[var(--color-emerald)]/60 text-[var(--color-emerald)]"
                          : s.kind === "dispatch"
                            ? "border-[var(--color-azure)]/60 text-[var(--color-azure)]"
                            : s.kind === "tracking"
                              ? "border-[var(--color-violet)]/60 text-[var(--color-violet)]"
                              : s.kind === "intake"
                                ? "border-[var(--color-champagne)]/60 bg-[var(--color-champagne)]/15 text-[var(--color-champagne)]"
                                : "border-line-strong text-ink-mute",
                    )}
                  >
                    <Icon size={9.5} strokeWidth={2} />
                  </span>

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-mono-tight text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
                        {s.kind} · step {String(i + 1).padStart(2, "0")}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{s.narration}</p>
                      {s.artifact && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/50 px-2 py-1">
                          <FileText size={11} className="text-[var(--color-champagne)]" />
                          <span className="font-mono-tight text-[11px] text-ink-soft">{s.artifact.label}</span>
                          <span className="font-mono-tight text-[10px] text-ink-faint">· {s.artifact.source}</span>
                          {s.artifact.bytes && <span className="font-mono-tight text-[10px] text-ink-faint">· {s.artifact.bytes}</span>}
                        </div>
                      )}
                      {/* Rule firings link back to the threads that taught the rule. */}
                      {s.kind === "rule" && s.ruleId && ruleEvidence[s.ruleId] && (
                        <button
                          type="button"
                          onClick={() => openRule(s.ruleId!)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/[0.06] px-2 py-1 font-mono-tight text-[10.5px] text-[var(--color-champagne)] hover:bg-[var(--color-champagne)]/[0.12]"
                        >
                          <BookOpen size={10} />
                          view evidence · {ruleEvidence[s.ruleId].count.toLocaleString()} threads
                          <ArrowUpRight size={10} className="opacity-70" />
                        </button>
                      )}
                    </div>
                    {s.probDelta > 0 && (
                      <div className="font-mono-tight text-[11px] text-[var(--color-emerald)] whitespace-nowrap pt-1">
                        +{s.probDelta.toFixed(1)} pts
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>

          {status === "running" && <ThinkingDots />}
        </ol>
      </div>
    </Panel>
  );
}

function ThinkingDots() {
  return (
    <li className="relative pl-6 py-2.5">
      <span className="absolute -left-[9px] top-3.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--color-champagne)]/40 bg-canvas-deep">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-champagne)]" />
        <span className="pulse-ring absolute inset-0 rounded-full ring-1 ring-[var(--color-champagne)]/50" />
      </span>
      <div className="flex items-center gap-1.5 font-mono-tight text-[11px] text-ink-faint">
        thinking
        <span className="inline-flex gap-0.5">
          <Dot d={0} /><Dot d={0.18} /><Dot d={0.36} />
        </span>
      </div>
    </li>
  );
}
function Dot({ d }: { d: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.2, 1, 0.2] }}
      transition={{ duration: 1.05, repeat: Infinity, delay: d }}
      className="block h-[3px] w-[3px] rounded-full bg-[var(--color-champagne)]"
    />
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="relative mb-4">
        <div className="h-12 w-12 rounded-xl bg-[var(--color-champagne)]/10 ring-1 ring-[var(--color-champagne)]/30" />
        <div className="pulse-ring absolute inset-0 rounded-xl ring-1 ring-[var(--color-champagne)]/30" />
      </div>
      <div className="font-display text-[16px] text-ink">Agent ready</div>
      <p className="mt-1 max-w-sm text-[12px] text-ink-faint">
        Press <kbd className="font-mono-tight rounded border border-line-soft px-1 text-[10px] text-ink-mute">Run</kbd> to assemble the BPJS claim packet for this case. The agent will narrate every decision it makes.
      </p>
    </div>
  );
}
