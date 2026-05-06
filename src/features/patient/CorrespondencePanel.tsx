import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mail, Pin, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

// Inline insurer-correspondence panel rendered inside relevant stage cards.
// For P3.2, threads are filtered per-payor (no patient_id link yet on threads).
// P5 will extend the schema for richer per-patient correspondence.
type Thread = {
  id: string;
  payor_id: string;
  payor_name: string;
  payor_color: string;
  subject: string;
  sender: string;
  excerpt: string;
  body: string;
  outcome: string;
  learned_rule: string | null;
  ts: string;
};

type RuleLite = { id: string; description: string };

export function CorrespondencePanel({ payorId }: { payorId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sentConfirm, setSentConfirm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    query<Thread>(
      `SELECT t.*, py.name AS payor_name, py.color AS payor_color
         FROM email_threads t
         JOIN payors py ON py.id = t.payor_id
        WHERE t.payor_id = ?
        ORDER BY t.ts DESC
        LIMIT 3`,
      [payorId],
    ).then(async (rows) => {
      if (cancelled) return;
      setThreads(rows);
      const ruleIds = rows
        .map((r) => r.learned_rule)
        .filter((x): x is string => Boolean(x));
      if (ruleIds.length === 0) {
        setRules({});
        return;
      }
      const placeholders = ruleIds.map(() => "?").join(",");
      const ruleRows = await query<RuleLite>(
        `SELECT id, description FROM payor_rules WHERE id IN (${placeholders})`,
        ruleIds,
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const r of ruleRows) map[r.id] = r.description;
      setRules(map);
    });
    return () => {
      cancelled = true;
    };
  }, [payorId]);

  function handleSend() {
    setSentConfirm("Reply queued (mocked).");
    setDraft("");
    setComposerOpen(false);
    setTimeout(() => setSentConfirm(null), 2400);
  }

  return (
    <div className="rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={12} className="text-ink-faint" />
          <span className="eyebrow">Insurer correspondence</span>
        </div>
        <span className="font-mono-tight text-[10px] text-ink-faint">
          {threads.length} thread{threads.length === 1 ? "" : "s"}
        </span>
      </div>

      {threads.length === 0 ? (
        <div className="flex items-center justify-center px-3 py-5 font-mono-tight text-[11px] text-ink-faint">
          No insurer correspondence yet for this patient.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {threads.map((t) => {
            const ageMs = Date.now() - new Date(t.ts).getTime();
            const ruleDesc = t.learned_rule ? rules[t.learned_rule] : null;
            return (
              <li
                key={t.id}
                className="relative overflow-hidden rounded-md border border-line-soft bg-panel px-3 py-2.5"
              >
                <div
                  className="absolute left-0 right-0 top-0 h-[1px]"
                  style={{ background: t.payor_color, opacity: 0.6 }}
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
                  <span className="ml-auto shrink-0 font-mono-tight text-[10px] text-ink-faint">
                    {relativeTime(ageMs)}
                  </span>
                </div>
                <div className="mt-1 truncate text-[12.5px] text-ink">{t.subject}</div>
                <div className="mt-0.5 line-clamp-2 font-mono-tight text-[11px] leading-snug text-ink-mute">
                  {t.excerpt}
                </div>
                {(ruleDesc || t.learned_rule) && (
                  <div className="mt-2 flex items-start gap-1.5 border-t border-line-soft pt-2">
                    <Pin
                      size={10}
                      className="mt-0.5 shrink-0 text-[var(--color-champagne)]"
                    />
                    <div className="min-w-0 flex-1 font-mono-tight text-[10.5px] leading-snug text-ink-soft">
                      <span className="text-ink-faint">Linked rule · </span>
                      <span className="text-[var(--color-champagne)]">
                        {t.learned_rule}
                      </span>
                      {ruleDesc && (
                        <>
                          <span className="text-ink-faint"> — </span>
                          <span className="text-ink-soft">
                            {truncate(ruleDesc, 80)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Reply composer */}
      <div className="mt-2 flex items-center justify-between gap-2">
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
              Mocked composer · per-payor thread filter
            </motion.span>
          )}
        </AnimatePresence>
        <Button
          size="sm"
          variant={composerOpen ? "soft" : "outline"}
          onClick={() => setComposerOpen((o) => !o)}
        >
          <Sparkles size={10} className="opacity-70" />
          {composerOpen ? "Hide reply" : "Add reply"}
        </Button>
      </div>

      {composerOpen && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Draft reply to insurer…"
            className={cn(
              "block h-20 w-full resize-none rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-[var(--color-champagne)]/40",
            )}
          />
          <div className="flex justify-end">
            <Button size="sm" variant="primary" onClick={handleSend}>
              <Send size={11} />
              Send (mocked)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
