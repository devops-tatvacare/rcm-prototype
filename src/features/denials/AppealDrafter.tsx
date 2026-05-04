import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Send, RefreshCw, FileText, ShieldCheck, Stethoscope, Wrench, Scale, Clock, Building2, Sparkles } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { useDenials } from "@/store/useDenials";

type Detail = {
  id: string;
  claim_id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: string;
  ward_class: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  category: string;
  reason_code: string;
  reason_text: string;
  denied_amount_idr: number;
  denied_at: string;
  appeal_deadline_at: string;
  appeal_status: string;
  success_probability: number;
  root_cause_step: string;
  recurring_pattern_id: string | null;
  // letter
  letter_md: string | null;
  attachments_json: string | null;
  drafted_at: string | null;
};

const CATEGORY_ICON: Record<string, any> = {
  CLINICAL: Stethoscope,
  TECHNICAL: Wrench,
  ADMINISTRATIVE: FileText,
  CONTRACTUAL: Scale,
};

export function AppealDrafter() {
  const { selectedDenialId, markSubmitted, draftedSubmitted, drafting, draftTick, draftAppeal, redraftAppeal } = useDenials();
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (!selectedDenialId) return;
    query<Detail>(
      `SELECT d.id, d.claim_id,
              p.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex, p.ward_class,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              d.category, d.reason_code, d.reason_text,
              d.denied_amount_idr, d.denied_at, d.appeal_deadline_at,
              d.appeal_status, d.success_probability, d.root_cause_step, d.recurring_pattern_id,
              ad.letter_md, ad.attachments_json, ad.drafted_at
         FROM denials d
         JOIN claims c ON c.id = d.claim_id
         JOIN patients p ON p.id = c.patient_id
         JOIN payors py ON py.id = d.payor_id
         JOIN hospitals h ON h.id = d.hospital_id
         LEFT JOIN appeal_drafts ad ON ad.denial_id = d.id
        WHERE d.id = ?`,
      [selectedDenialId],
    ).then((rows) => setDetail(rows[0] ?? null));
  }, [selectedDenialId, draftTick]);

  if (!detail) {
    return <div className="flex h-full items-center justify-center text-ink-faint">Loading…</div>;
  }

  const Icon = CATEGORY_ICON[detail.category];
  const dtd = Math.ceil((new Date(detail.appeal_deadline_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const submittedHere = draftedSubmitted[detail.id];
  const isDrafting = !!drafting[detail.id];
  let attachments: string[] = [];
  try { attachments = JSON.parse(detail.attachments_json || "[]"); } catch { /* noop */ }

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-3 p-4 pt-12">
      {/* Left — denial details + classification + root cause */}
      <div className="col-span-5 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {/* Header */}
        <Panel tone="raised" className="overflow-hidden">
          <div className="h-[3px] w-full" style={{ background: detail.payor_color }} />
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <div className="min-w-0">
              <div className="truncate font-display text-[19px] leading-tight tracking-tight text-ink">{detail.patient_name}</div>
              <div className="mt-0.5 flex items-center gap-1 font-mono-tight text-[10px] text-ink-faint">
                <Building2 size={9} className="opacity-60 shrink-0" />
                <span className="truncate">{detail.hospital_name} · {detail.ward_class} · claim {detail.claim_id}</span>
              </div>
            </div>
            <Pill tone="champagne" dot className="shrink-0">{detail.payor_name}</Pill>
          </div>

          {/* Classification + amount + deadline */}
          <div className="grid grid-cols-2 border-t border-line-soft">
            <div className="border-r border-line-soft px-4 py-2.5">
              <div className="eyebrow">Category</div>
              <div className="mt-1 flex items-center gap-1.5">
                <Icon size={11} className="text-ink-mute" />
                <span className="text-[12.5px] capitalize text-ink">{detail.category.toLowerCase()}</span>
              </div>
              <div className="mt-0.5 font-mono-tight text-[10px] text-ink-faint">{detail.reason_code}</div>
            </div>
            <div className="px-4 py-2.5">
              <div className="eyebrow">$ at risk</div>
              <div className="numeric mt-1 text-[15px] text-[var(--color-coral)]">{fmtCompactIDR(detail.denied_amount_idr)}</div>
            </div>
            <div className="col-span-2 border-t border-line-soft px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Deadline</span>
                <span className={`flex items-center gap-1 font-mono-tight text-[11px] ${dtd <= 3 ? "text-[var(--color-coral)]" : dtd <= 7 ? "text-[var(--color-amber)]" : "text-ink-mute"}`}>
                  <Clock size={10} />
                  {dtd}d remaining
                </span>
              </div>
              <div className="mt-1 font-mono-tight text-[11px] text-ink-soft">
                {new Date(detail.appeal_deadline_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        </Panel>

        {/* Reason text */}
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Payor's reason" title="What they said" />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <p className="text-[12.5px] leading-snug text-ink-soft">"{detail.reason_text}"</p>
          </div>
        </Panel>

        {/* Root cause */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Root cause · traced back"
            title="What broke upstream"
            right={detail.recurring_pattern_id ? <Pill tone="warn" size="xs">recurring</Pill> : null}
          />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <p className="text-[12px] leading-snug text-ink-soft">{detail.root_cause_step}</p>
            {detail.recurring_pattern_id && (
              <div className="mt-2 rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-2.5 py-1.5">
                <div className="font-mono-tight text-[10.5px] text-[var(--color-amber)]">
                  Pattern {detail.recurring_pattern_id} has fired on multiple claims this quarter.
                  A new rule will be promoted to the Builder rule library on submit.
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Success probability */}
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Predicted appeal outcome" title="P(win)" />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="numeric font-display text-[36px] leading-none" style={{
                color: detail.success_probability >= 0.7 ? "var(--color-emerald)" : detail.success_probability >= 0.5 ? "var(--color-champagne)" : "var(--color-coral)",
              }}>
                {Math.round(detail.success_probability * 100)}<span className="text-[14px] text-ink-mute">%</span>
              </span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                based on 142 similar appeals · this payor · same category
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${detail.success_probability * 100}%` }}
                transition={{ type: "spring", stiffness: 70, damping: 18 }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-champagne-deep)] via-[var(--color-champagne)] to-[var(--color-emerald)]"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Right — drafted appeal letter */}
      <div className="col-span-7 flex min-h-0 flex-col">
        <Panel className="flex h-full min-h-0 flex-col">
          <PanelHeader
            eyebrow="Auto-drafted by TatvaCare · editable"
            title="Appeal letter"
            right={
              <div className="flex items-center gap-2">
                {isDrafting ? (
                  <Pill tone="info" dot>Drafting…</Pill>
                ) : detail.letter_md ? (
                  <Pill tone="champagne" dot>Drafted</Pill>
                ) : (
                  <Pill tone="neutral">Not yet drafted</Pill>
                )}
              </div>
            }
          />
          <div className="hairline-x mx-5" />

          {isDrafting ? (
            <DraftingState payorName={detail.payor_name} />
          ) : detail.letter_md ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <article className="prose-rcm">
                  <Markdown text={detail.letter_md} />
                </article>
              </div>
              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="border-t border-line-soft px-5 py-3">
                  <div className="eyebrow mb-1.5">Attachment bundle · {attachments.length}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {attachments.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/50 px-2 py-1 font-mono-tight text-[10.5px] text-ink-soft">
                        <FileText size={10} className="text-[var(--color-champagne)]" />
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Submit */}
              <div className="border-t border-line-soft px-5 py-3">
                {submittedHere ? (
                  <div className="flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/10 px-3 py-2">
                    <ShieldCheck size={13} className="text-[var(--color-emerald)]" />
                    <span className="text-[12px] text-[var(--color-emerald)]">Appeal submitted to {detail.payor_name}. Tracking ID assigned.</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="primary" size="md" className="flex-1" onClick={() => markSubmitted(detail.id)}>
                      <Send size={12} /> Send appeal to {detail.payor_name}
                    </Button>
                    <Button variant="outline" size="md" onClick={() => redraftAppeal(detail.id)}>
                      <RefreshCw size={11} /> Re-draft
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-champagne)]/10 ring-1 ring-[var(--color-champagne)]/30">
                <Sparkles size={20} className="text-[var(--color-champagne)]" />
              </div>
              <div className="mt-3 font-display text-[16px] text-ink">No draft yet</div>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-mute">
                Agent will compose an appeal letter using the clinical record, this payor's historically successful arguments, and the relevant guideline citations.
              </p>
              <Button variant="primary" size="md" className="mt-4" onClick={() => draftAppeal(detail.id)}>
                <Sparkles size={12} /> Draft appeal letter
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// Streaming-style "agent composing" state — shown while draftAppeal runs.
function DraftingState({ payorName }: { payorName: string }) {
  const lines = [
    "Pulling clinical record from EMR…",
    "Loading prior successful arguments for this payor + denial category…",
    "Selecting attachments that historically moved the needle…",
    "Composing letter in payor's preferred language…",
  ];
  return (
    <div className="flex flex-1 min-h-0 flex-col items-start justify-center px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-champagne)] opacity-75" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--color-champagne)]" />
        </span>
        <span className="text-[13px] font-medium text-ink">Drafting appeal to {payorName}…</span>
      </div>
      <ol className="relative ml-2 mt-4 border-l border-line-soft self-stretch">
        {lines.map((line, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.3, type: "spring", stiffness: 220, damping: 24 }}
            className="relative pl-5 py-1.5"
          >
            <span className="absolute -left-[5px] top-2.5 h-2.5 w-2.5 rounded-full border border-[var(--color-champagne)]/50 bg-[var(--color-canvas-deep)]" />
            <span className="font-mono-tight text-[11.5px] text-ink-mute">{line}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

// Tiny markdown renderer — bold + paragraphs only. Avoids pulling in react-markdown for one drawer.
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-3 text-[12.5px] leading-relaxed text-ink-soft">
      {blocks.map((block, i) => {
        if (block.startsWith("- ") || block.startsWith("· ")) {
          return (
            <ul key={i} className="ml-1 list-none space-y-1">
              {block.split("\n").map((line, j) => (
                <li key={j} className="font-mono-tight text-[11.5px] text-ink-soft">{renderInline(line.replace(/^[-·]\s*/, "· "))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(block)}</p>;
      })}
    </div>
  );
}

function renderInline(s: string) {
  // **bold** → <strong>
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
