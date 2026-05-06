import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Inbox, Send, Sparkles, Pin, Bot } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type Thread = {
  id: string;
  payor_id: string;
  payor_name: string;
  payor_color: string;
  subject: string;
  sender: string;
  excerpt: string;
  body: string;
  highlight: string | null;
  outcome: string;
  learned_rule: string | null;
  ts: string;
};

type RuleLite = {
  id: string;
  description: string;
};

const OUTCOME_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  approved: "good",
  approved_after_mri: "good",
  partial_paid: "warn",
  denied_resubmitted_won: "warn",
  denied: "bad",
};

type PayorFilter = "all" | "bpjs" | "pru" | "aia";

const PAYOR_FILTERS: { value: PayorFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bpjs", label: "BPJS" },
  { value: "pru", label: "Prudential" },
  { value: "aia", label: "AIA" },
];

export function EmailInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkedRule, setLinkedRule] = useState<RuleLite | null>(null);
  const [payorFilter, setPayorFilter] = useState<PayorFilter>("all");
  const [search, setSearch] = useState("");
  const [sentConfirm, setSentConfirm] = useState<string | null>(null);

  useEffect(() => {
    query<Thread>(
      `SELECT t.*, py.name AS payor_name, py.color AS payor_color
         FROM email_threads t
         JOIN payors py ON py.id = t.payor_id
        ORDER BY t.ts DESC`,
    ).then((rows) => {
      setThreads(rows);
      if (rows.length > 0) setSelectedId(rows[0].id);
    });
  }, []);

  // Fetch linked rule for selected thread
  useEffect(() => {
    const sel = threads.find((t) => t.id === selectedId);
    if (!sel || !sel.learned_rule) {
      setLinkedRule(null);
      return;
    }
    query<RuleLite>(
      `SELECT id, description FROM payor_rules WHERE id = ?`,
      [sel.learned_rule],
    ).then((rows) => setLinkedRule(rows[0] ?? null));
  }, [selectedId, threads]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (payorFilter !== "all" && t.payor_id !== payorFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.sender.toLowerCase().includes(q)
      );
    });
  }, [threads, payorFilter, search]);

  // Re-anchor selection when filter changes and current selection drops out
  useEffect(() => {
    if (filteredThreads.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredThreads.some((t) => t.id === selectedId)) {
      setSelectedId(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedId]);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  function handleSend() {
    if (!selected) return;
    setSentConfirm(`Reply queued (mocked) to ${selected.sender}`);
    setTimeout(() => setSentConfirm(null), 2400);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <Panel tone="raised" className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Filter</span>
          {PAYOR_FILTERS.map((f) => {
            const active = payorFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setPayorFilter(f.value)}
                className={cn(
                  "h-7 rounded-full border px-3 text-[12px] font-medium tracking-tight transition-colors",
                  active
                    ? "border-[var(--color-champagne)]/50 bg-[var(--color-champagne)]/15 text-[var(--color-champagne)]"
                    : "border-line-soft bg-[var(--color-canvas-deep)]/60 text-ink-mute hover:text-ink-soft",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject / sender"
              className="h-8 w-[260px] rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/60 pl-7 pr-3 text-[12px] text-ink placeholder:text-ink-faint focus:border-[var(--color-champagne)]/50 focus:outline-none"
            />
          </div>
          <span className="font-mono-tight text-[10.5px] text-ink-faint">
            {filteredThreads.length} of {threads.length}
          </span>
        </div>
      </Panel>

      {/* Body grid */}
      <div className="grid min-h-[560px] grid-cols-12 gap-3">
        {/* LEFT — Thread list */}
        <Panel tone="raised" className="col-span-12 flex flex-col overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line-soft bg-[var(--color-canvas-deep)]/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Inbox size={13} className="text-ink-faint" />
              <span className="font-display text-[13px] tracking-tight text-ink">Threads</span>
            </div>
            <span className="font-mono-tight text-[10.5px] text-ink-faint">{filteredThreads.length}</span>
          </div>

          {filteredThreads.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-8">
              <div className="font-mono-tight text-[11px] text-ink-faint">
                {threads.length === 0 ? "No threads yet" : "No threads match the current filters."}
              </div>
            </div>
          ) : (
            <ul className="flex max-h-[640px] flex-1 flex-col overflow-auto">
              {filteredThreads.map((t, i) => {
                const active = t.id === selectedId;
                const ageMs = Date.now() - new Date(t.ts).getTime();
                return (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * i }}
                    className="border-t border-line-soft first:border-t-0"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(t.id);
                        }
                      }}
                      className={cn(
                        "group relative flex cursor-pointer flex-col gap-1 px-4 py-3 text-left transition-colors",
                        active
                          ? "bg-[var(--color-champagne)]/10 ring-1 ring-inset ring-[var(--color-champagne)]/40"
                          : "hover:bg-[var(--color-panel-2)]/40",
                      )}
                    >
                      {/* payor color stripe */}
                      <div
                        className="absolute left-0 right-0 top-0 h-[1px]"
                        style={{ background: t.payor_color, opacity: active ? 1 : 0.55 }}
                      />
                      <div className="flex items-center gap-2">
                        <Pill tone="neutral" size="xs" className="shrink-0 uppercase">
                          <span
                            className="mr-1 h-1 w-1 rounded-full"
                            style={{ background: t.payor_color }}
                          />
                          {t.payor_name.split(" ")[0]}
                        </Pill>
                        <span className="truncate font-mono-tight text-[10.5px] text-ink-faint">
                          {t.sender}
                        </span>
                      </div>
                      <div className="truncate text-[12.5px] text-ink">{t.subject}</div>
                      <div className="truncate text-[11.5px] text-ink-mute">{t.excerpt}</div>
                      <div className="flex items-center justify-between gap-2">
                        <Pill tone={OUTCOME_TONE[t.outcome] ?? "neutral"} size="xs" dot>
                          {t.outcome.replace(/_/g, " ")}
                        </Pill>
                        <span className="font-mono-tight text-[10px] text-ink-faint">
                          {relativeTime(ageMs)}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* RIGHT — Selected thread view */}
        <Panel tone="raised" className="col-span-12 flex flex-col overflow-hidden lg:col-span-7">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-4 py-8">
              <div className="font-mono-tight text-[11px] text-ink-faint">Select a thread to view</div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Subject header */}
              <div className="border-b border-line-soft bg-[var(--color-canvas-deep)]/40 px-5 py-3">
                <div className="font-display text-[18px] leading-tight tracking-tight text-ink">
                  {selected.subject}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Pill tone="neutral" size="xs">
                    <span
                      className="mr-1 h-1 w-1 rounded-full"
                      style={{ background: selected.payor_color }}
                    />
                    {selected.payor_name}
                  </Pill>
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">{selected.sender}</span>
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">·</span>
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">
                    {new Date(selected.ts).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Body + AI block + composer */}
              <div className="flex flex-1 flex-col overflow-auto">
                {/* Body */}
                <div className="px-5 py-4">
                  <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">
                    <HighlightedBody body={selected.body} highlight={selected.highlight} />
                  </div>
                </div>

                {/* AI annotation */}
                <div className="border-t border-line-soft bg-[var(--color-canvas-deep)]/40 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={11} className="text-[var(--color-champagne)]" />
                    <span className="eyebrow">Agent annotation</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {selected.learned_rule && (
                      <div className="flex items-start gap-2">
                        <Pin size={12} className="mt-0.5 shrink-0 text-[var(--color-champagne)]" />
                        <div className="min-w-0 flex-1 text-[12px] leading-snug text-ink-soft">
                          <span className="font-mono-tight text-[10.5px] text-ink-faint">Linked rule · </span>
                          <span className="font-mono-tight text-[11px] text-[var(--color-champagne)]">
                            {selected.learned_rule}
                          </span>
                          {linkedRule?.description && (
                            <>
                              <span className="text-ink-faint"> — </span>
                              <span>{linkedRule.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <Bot size={12} className="mt-0.5 shrink-0 text-[var(--color-azure)]" />
                      <div className="flex items-center gap-2 text-[12px] text-ink-soft">
                        <span className="font-mono-tight text-[10.5px] text-ink-faint">Outcome ·</span>
                        <Pill tone={OUTCOME_TONE[selected.outcome] ?? "neutral"} size="xs" dot>
                          {selected.outcome.replace(/_/g, " ")}
                        </Pill>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reply composer */}
                <div className="border-t border-line-soft px-5 py-3">
                  <div className="eyebrow mb-2">Reply</div>
                  <textarea
                    disabled
                    placeholder="Drafted reply by AI agent…"
                    className="block h-20 w-full resize-none rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2 text-[12px] text-ink-soft placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <AnimatePresence mode="wait">
                      {sentConfirm ? (
                        <motion.span
                          key="sent"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          className="font-mono-tight text-[10.5px] text-[var(--color-emerald)]"
                        >
                          {sentConfirm}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="hint"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="font-mono-tight text-[10.5px] text-ink-faint"
                        >
                          Mocked composer · agent draft
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <Button size="sm" variant="primary" onClick={handleSend}>
                      <Send size={11} />
                      Send (mocked)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// Wrap matching highlight substring in a champagne <mark>. We do a literal,
// case-sensitive split because seed `highlight` strings are exact substrings.
function HighlightedBody({ body, highlight }: { body: string; highlight: string | null }) {
  if (!highlight || !body.includes(highlight)) {
    return <>{body}</>;
  }
  const idx = body.indexOf(highlight);
  const before = body.slice(0, idx);
  const after = body.slice(idx + highlight.length);
  return (
    <>
      {before}
      <mark className="rounded bg-[var(--color-champagne)]/30 px-0.5 text-[var(--color-champagne)]">
        {highlight}
      </mark>
      {after}
    </>
  );
}
