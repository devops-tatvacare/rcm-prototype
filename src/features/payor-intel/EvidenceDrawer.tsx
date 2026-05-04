import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { Mail, ChevronRight, Sparkles, FileText, Tag } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Pill } from "@/components/ui/Pill";
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
  excerpt: string;
  body: string;
  highlight: string;
  outcome: string;
  learned_rule: string;
  rule_text: string;
  rule_kind: string;
  drg_pattern: string;
  ts: string;
};

type RuleSummary = {
  id: string;
  payor_name: string;
  payor_color: string;
  drg_pattern: string;
  kind: string;
  description: string;
  evidence_threads: number;
  lift_pct: number;
};

const OUTCOME_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  approved: "good",
  approved_after_mri: "good",
  partial_paid: "warn",
  denied_resubmitted_won: "warn",
  denied: "bad",
};

// Mounted once at app root — listens to the shared evidence store.
export function EvidenceDrawer() {
  const ruleId = useEvidence((s) => s.ruleId);
  const threadId = useEvidence((s) => s.threadId);
  const closeAll = useEvidence((s) => s.closeAll);
  const closeThread = useEvidence((s) => s.closeThread);
  const openThread = useEvidence((s) => s.openThread);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [rule, setRule] = useState<RuleSummary | null>(null);

  useEffect(() => {
    if (!ruleId) return;
    query<Thread>(
      `SELECT t.id, t.payor_id, py.name AS payor_name, py.color AS payor_color,
              t.subject, t.sender, t.excerpt, t.body, t.highlight, t.outcome,
              t.learned_rule, r.description AS rule_text, r.kind AS rule_kind,
              r.drg_pattern, t.ts
         FROM email_threads t
         JOIN payors py ON py.id = t.payor_id
         LEFT JOIN payor_rules r ON r.id = t.learned_rule
        WHERE t.learned_rule = ?
        ORDER BY t.ts DESC`,
      [ruleId],
    ).then(setThreads);

    query<RuleSummary>(
      `SELECT r.id, p.name AS payor_name, p.color AS payor_color,
              r.drg_pattern, r.kind, r.description, r.evidence_threads, r.lift_pct
         FROM payor_rules r JOIN payors p ON p.id = r.payor_id
        WHERE r.id = ?`,
      [ruleId],
    ).then((rows) => setRule(rows[0] ?? null));
  }, [ruleId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === threadId) ?? null,
    [threads, threadId],
  );

  return (
    <>
      <Drawer open={!!ruleId} onClose={closeAll} width={620} level={1}>
        {rule && <RuleEvidenceView rule={rule} threads={threads} onPickThread={openThread} />}
      </Drawer>

      <Drawer open={!!activeThread} onClose={closeThread} width={620} level={2}>
        {activeThread && <ThreadView thread={activeThread} />}
      </Drawer>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Rule-list mode — header summarises the rule, body lists supporting threads
// with the rule-justifying phrase highlighted in each excerpt.
// ───────────────────────────────────────────────────────────────────────────
function RuleEvidenceView({
  rule,
  threads,
  onPickThread,
}: {
  rule: RuleSummary;
  threads: Thread[];
  onPickThread: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line-soft px-6 pt-5 pb-4 pr-12">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-[var(--color-champagne)]" />
          <span className="eyebrow">Auto-learned rule · evidence</span>
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: rule.payor_color }}
          />
          <h2 className="font-display text-[16.5px] leading-snug text-ink">
            {rule.description}
          </h2>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono-tight text-[10.5px] text-ink-faint">
          <span>{rule.payor_name}</span>
          <span>·</span>
          <span>{rule.drg_pattern}</span>
          <Pill tone="champagne" size="xs" className="ml-1">
            {rule.kind}
          </Pill>
          <span className="ml-1 text-[var(--color-emerald)]">
            +{(rule.lift_pct * 100).toFixed(1)} pts lift
          </span>
        </div>
        <div className="mt-3 rounded-md border border-[var(--color-champagne)]/25 bg-[var(--color-champagne)]/[0.06] px-3 py-2 font-mono-tight text-[10.5px] text-ink-soft">
          <span className="text-ink-faint">Evidence basis · </span>
          {threads.length} of {rule.evidence_threads.toLocaleString()} threads loaded · highlighted
          phrases below are what the agent matched on
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.map((t, i) => (
          <button
            type="button"
            key={t.id}
            onClick={() => onPickThread(t.id)}
            className="group flex w-full items-start gap-3 border-b border-line-soft px-6 py-3.5 text-left hover:bg-[var(--color-panel-2)]/40"
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: t.payor_color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono-tight text-[10.5px] text-ink-faint">
                <Mail size={10} />
                <span className="truncate">{t.sender}</span>
                <span>·</span>
                <span className="shrink-0">
                  {relativeTime(Date.now() - new Date(t.ts).getTime())}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[12.5px] text-ink">{t.subject}</div>
              <div className="mt-1 font-mono-tight text-[11.5px] leading-relaxed text-ink-mute">
                <span className="text-ink-faint">{"> "}</span>
                {renderHighlighted(t.excerpt, t.highlight)}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Pill tone={OUTCOME_TONE[t.outcome] ?? "neutral"} size="xs" dot>
                {t.outcome.replace(/_/g, " ")}
              </Pill>
              <ChevronRight
                size={14}
                className="text-ink-faint opacity-60 group-hover:opacity-100"
              />
            </div>
            {/* keep `i` referenced for staggered animation in future; suppress unused var */}
            <span hidden>{i}</span>
          </button>
        ))}
        {threads.length === 0 && (
          <div className="px-6 py-12 text-center font-mono-tight text-[11px] text-ink-faint">
            No threads indexed for this rule yet.
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Single-thread mode — full email body with the highlight marked.
// ───────────────────────────────────────────────────────────────────────────
function ThreadView({ thread }: { thread: Thread }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line-soft px-6 pt-5 pb-4 pr-12">
        <div className="flex items-center gap-1.5">
          <Mail size={11} className="text-ink-faint" />
          <span className="eyebrow">Email thread · evidence</span>
        </div>
        <h2 className="mt-1.5 font-display text-[16px] leading-snug text-ink">
          {thread.subject}
        </h2>
        <div className="mt-2 rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40">
          <Row label="From" value={thread.sender} mono />
          <Row label="Date" value={new Date(thread.ts).toString().slice(0, 33)} mono />
          <Row
            label="Payor"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: thread.payor_color }}
                />
                {thread.payor_name}
              </span>
            }
          />
          <Row
            label="Outcome"
            value={
              <Pill tone={OUTCOME_TONE[thread.outcome] ?? "neutral"} size="xs" dot>
                {thread.outcome.replace(/_/g, " ")}
              </Pill>
            }
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
        {/* Rule chip — what this thread taught */}
        {thread.rule_text && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-[var(--color-champagne)]/25 bg-[var(--color-champagne)]/[0.05] px-4 py-3"
          >
            <div className="flex items-center gap-1.5">
              <Tag size={11} className="text-[var(--color-champagne)]" />
              <span className="eyebrow text-[var(--color-champagne)]">
                Learned rule · {thread.rule_kind} · {thread.drg_pattern}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">{thread.rule_text}</p>
          </motion.div>
        )}

        {/* Body */}
        <div className="mt-4 rounded-lg border border-line-soft bg-[var(--color-panel)]/60 px-4 py-3.5">
          <pre className="whitespace-pre-wrap font-mono-tight text-[11.5px] leading-relaxed text-ink-soft">
            {renderHighlighted(thread.body, thread.highlight)}
          </pre>
        </div>

        {/* Footer hint */}
        <div className="mt-3 flex items-center gap-2 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2 font-mono-tight text-[10.5px] text-ink-faint">
          <FileText size={11} />
          Highlighted phrase is the substring the rule extractor matched on across similar threads.
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line-soft px-4 py-2 last:border-b-0">
      <span className="w-[60px] shrink-0 font-mono-tight text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </span>
      <span className={`flex-1 truncate ${mono ? "font-mono-tight text-[11.5px]" : "text-[12.5px]"} text-ink-soft`}>
        {value}
      </span>
    </div>
  );
}

// Wrap the highlight substring (case-insensitive, first match) in a <mark>.
// If the highlight isn't found we render the source verbatim.
function renderHighlighted(source: string, needle: string): React.ReactNode {
  if (!needle) return source;
  const idx = source.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return source;
  const before = source.slice(0, idx);
  const match = source.slice(idx, idx + needle.length);
  const after = source.slice(idx + needle.length);
  return (
    <>
      {before}
      <mark className="rounded-sm bg-[var(--color-champagne)]/25 px-0.5 text-[var(--color-champagne)]">
        {match}
      </mark>
      {after}
    </>
  );
}
