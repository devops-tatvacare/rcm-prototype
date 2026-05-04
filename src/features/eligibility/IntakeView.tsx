import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ScanLine, Wifi, AlertTriangle, ArrowLeft, Building2, ShieldCheck, Hourglass, ShieldAlert, Check, Users } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useEligibility } from "@/store/useEligibility";
import { SAMPLE_CARDS, type SampleCard } from "@/lib/eligibilityIntake";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";

// Insurance-card thumbnails the desk picks from. Each card is a pre-canned
// scenario that drives the trace + the persisted check row.
export function IntakeView() {
  const { intakeStep } = useEligibility();
  return intakeStep === "pick" ? <CardPicker /> : <CardReview />;
}

function CardPicker() {
  const { selectIntakeCard } = useEligibility();
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 pt-12">
      <Panel tone="raised" className="overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <div className="eyebrow">A.6 step 1–2 · registration</div>
          <h2 className="mt-1 font-display text-[20px] tracking-tight text-ink">
            Scan an insurance card
          </h2>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-ink-mute">
            Pick a card to scan. OCR extracts policy + insurer + group + validity, then the
            agent dispatches the eligibility query, evaluates pre-auth gap, and routes the
            outcome — all of step 3 through 11 of the spec workflow.
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        {SAMPLE_CARDS.map((c, i) => (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => selectIntakeCard(c.id)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, type: "spring", stiffness: 240, damping: 24 }}
            whileHover={{ y: -1 }}
            className="group relative overflow-hidden rounded-lg border border-line-soft bg-[var(--color-panel)] p-4 text-left transition-colors hover:border-line-strong hover:bg-[var(--color-panel-2)]/60"
          >
            <CardChip card={c} />
            <div className="mt-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{c.patient_name}</div>
                <div className="truncate font-mono-tight text-[10.5px] text-ink-faint">
                  {c.patient_sex} · {c.patient_age}y · {c.hospital_name} · {c.ward_class}
                </div>
              </div>
              <Pill tone={c.tag_tone} dot size="xs">{c.tag.split(" · ")[0]}</Pill>
            </div>
            <div className="mt-2 line-clamp-2 font-mono-tight text-[10.5px] leading-snug text-ink-mute">
              {c.planned_procedure}{c.ina_cbg !== "—" && <> · {c.ina_cbg}</>}
            </div>
            <div className="mt-3 flex items-center gap-1 font-mono-tight text-[10px] text-ink-faint group-hover:text-[var(--color-champagne)]">
              <ScanLine size={10} /> Scan & verify <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </motion.button>
        ))}
      </div>

      <div className="font-mono-tight text-[10px] text-ink-faint">
        Each card is a discrete spec scenario · happy path (BPJS) · dispute-risk (AIA) · lapsed (Allianz · A.6 step 10) · family-plan dependent (A.10 edge case 2)
      </div>
    </div>
  );
}

// Small card chip used in the picker grid.
function CardChip({ card }: { card: SampleCard }) {
  return (
    <div className="relative h-[88px] overflow-hidden rounded-md border border-line-soft bg-[var(--color-canvas-deep)]">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: card.payor_color }} />
      <div className="flex h-full items-center gap-3 px-3.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-display text-[14px] font-bold"
          style={{ background: `${card.payor_color}22`, color: card.payor_color, border: `1px solid ${card.payor_color}55` }}
        >
          {card.payor_kind === "gov" ? "B" : card.payor_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[12px] tracking-tight text-ink">{card.payor_name}</div>
          <div className="mt-0.5 font-mono-tight text-[10.5px] text-ink-soft">{card.policy_number}</div>
          <div className="font-mono-tight text-[9.5px] text-ink-faint">{card.group_code} · valid {card.validity}</div>
        </div>
      </div>
    </div>
  );
}

// Full-size insurance card surface used in the review/scan view.
// Looks like a real card — payor band, monogram, large policy number, holder + validity.
function CardSurface({ card, scanning }: { card: SampleCard; scanning: boolean }) {
  return (
    <div
      className="relative aspect-[2.2/1] w-full overflow-hidden rounded-xl border border-line-strong shadow-lift"
      style={{
        background: `linear-gradient(135deg, ${card.payor_color}18 0%, var(--color-canvas-deep) 55%, var(--color-canvas) 100%)`,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: card.payor_color }} />
      {/* Subtle stripe pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "repeating-linear-gradient(125deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 14px)",
        }}
      />
      {/* Header — payor identity */}
      <div className="absolute inset-x-0 top-[6px] flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-md font-display text-[20px] font-bold"
            style={{ background: `${card.payor_color}26`, color: card.payor_color, border: `1px solid ${card.payor_color}66` }}
          >
            {card.payor_kind === "gov" ? "B" : card.payor_name.charAt(0)}
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] tracking-tight text-ink">{card.payor_name}</div>
            <div className="mt-0.5 font-mono-tight text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              {card.payor_kind === "gov" ? "Government scheme" : "Private insurer"}
            </div>
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">Group</div>
          <div className="font-mono-tight text-[11px] text-ink-soft">{card.group_code}</div>
        </div>
      </div>

      {/* Policy number — the hero numeric */}
      <div className="absolute inset-x-0 bottom-[44px] px-5">
        <div className="font-mono-tight text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">Policy number</div>
        <div className="mt-0.5 numeric font-display text-[22px] tracking-[0.06em] text-ink">
          {card.policy_number}
        </div>
      </div>

      {/* Footer — holder + validity */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-3.5">
        <div className="leading-tight">
          <div className="font-mono-tight text-[9px] uppercase tracking-[0.16em] text-ink-faint">Holder</div>
          <div className="text-[11.5px] text-ink-soft">{card.scenario === "family_plan" ? "Ibu Santoso" : card.patient_name}</div>
        </div>
        <div className="text-right leading-tight">
          <div className="font-mono-tight text-[9px] uppercase tracking-[0.16em] text-ink-faint">Valid</div>
          <div className="font-mono-tight text-[10.5px] text-ink-soft">{card.validity}</div>
        </div>
      </div>

      {/* Scan band — slides top→bottom while scanning */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            key="scan"
            initial={{ y: -2, opacity: 0 }}
            animate={{ y: "100%", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[var(--color-champagne)] shadow-[0_0_18px_var(--color-champagne)]"
          />
        )}
      </AnimatePresence>
      {scanning && (
        <div className="pointer-events-none absolute inset-0 bg-[var(--color-champagne)]/[0.04]" />
      )}
    </div>
  );
}

function CardReview() {
  const { intakeCard, ocrProgress, runVerification, resetIntakeCard, simRunning } = useEligibility();
  const card = intakeCard;
  if (!card) return null;
  const ocrDone = ocrProgress >= 100;
  const scanning = !ocrDone;

  // OCR ladder thresholds — each field appears as it's "extracted".
  const ladder = [
    { threshold: 22, label: "Policy number", value: card.policy_number, mono: true },
    { threshold: 44, label: "Insurer", value: card.payor_name, mono: false },
    { threshold: 66, label: "Group / scheme", value: card.group_code, mono: true },
    { threshold: 88, label: "Validity", value: card.validity, mono: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 pt-12">
      {/* Identity strip */}
      <Panel tone="raised" className="overflow-hidden">
        <div className="h-[3px] w-full" style={{ background: card.payor_color }} />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3.5">
          <div className="min-w-0">
            <div className="font-display text-[22px] leading-tight tracking-tight text-ink">{card.patient_name}</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono-tight text-[11px] text-ink-faint">
              <Building2 size={10} className="opacity-60" />
              <span>{card.hospital_name}</span>
              <span className="opacity-40">·</span>
              <span>{card.ward_class}</span>
              <span className="opacity-40">·</span>
              <span>{card.patient_sex} · {card.patient_age}y</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Pill tone="champagne" dot>{card.payor_name}</Pill>
            <span className="font-mono-tight text-[10px] text-ink-faint">MRN {card.mrn}</span>
          </div>
        </div>
      </Panel>

      {/* Scan & verify — 2-column: card surface (left, big) + extraction ladder (right) */}
      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Step 1–2 · scan & cross-check"
          title={ocrDone ? "Card scanned · identity verified" : "Scanning insurance card…"}
          right={<Pill tone={ocrDone ? "good" : "info"} dot size="xs">{ocrDone ? "4/4 fields" : `${Math.min(4, Math.floor(ocrProgress / 25))}/4 fields`}</Pill>}
        />
        <div className="hairline-x mx-5" />
        <div className="grid grid-cols-12 gap-5 p-5">
          {/* Card surface */}
          <div className="col-span-7">
            <CardSurface card={card} scanning={scanning} />
            {/* Progress bar tucked under the card */}
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
                <motion.div
                  animate={{ width: `${ocrProgress}%` }}
                  transition={{ ease: "linear" }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--color-champagne), var(--color-emerald))" }}
                />
              </div>
              <span className="font-mono-tight text-[10.5px] tabular-nums text-ink-faint">{ocrProgress}%</span>
            </div>
          </div>

          {/* Extraction ladder */}
          <div className="col-span-5 flex flex-col gap-2">
            <div className="eyebrow">OCR · extraction</div>
            <ul className="flex flex-col">
              {ladder.map((row) => {
                const visible = ocrProgress >= row.threshold;
                return (
                  <li
                    key={row.label}
                    className="flex items-start gap-2.5 border-b border-line-soft py-2 last:border-b-0"
                  >
                    <motion.span
                      animate={{
                        background: visible ? "var(--color-emerald)" : "transparent",
                        borderColor: visible ? "var(--color-emerald)" : "var(--color-line-strong)",
                      }}
                      className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border"
                    >
                      {visible && <Check size={9} className="text-[var(--color-canvas-deep)]" strokeWidth={3} />}
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <div className="eyebrow">{row.label}</div>
                      <motion.div
                        animate={{ opacity: visible ? 1 : 0.25 }}
                        className={cn(
                          "mt-0.5 truncate text-[12.5px]",
                          row.mono ? "font-mono-tight text-ink-soft" : "text-ink-soft",
                        )}
                      >
                        {visible ? row.value : "extracting…"}
                      </motion.div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Cross-checks slide in once OCR is done */}
            <AnimatePresence>
              {ocrDone && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 flex flex-col gap-1.5 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Check size={11} className="shrink-0 text-[var(--color-emerald)]" strokeWidth={3} />
                    <span className="font-mono-tight text-[11px] text-ink-soft">
                      NIK <span className="text-ink">{card.national_id_masked}</span> · Dukcapil match
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.scenario === "family_plan" ? (
                      <Users size={11} className="shrink-0 text-[var(--color-violet)]" />
                    ) : (
                      <Check size={11} className="shrink-0 text-[var(--color-emerald)]" strokeWidth={3} />
                    )}
                    <span className="font-mono-tight text-[11px] text-ink-soft">
                      {card.scenario === "family_plan"
                        ? <>Dependent · holder <span className="text-ink">Ibu Santoso</span> · KK aligned</>
                        : <>Holder · self · no dependents on this admission</>}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Panel>

      {/* Encounter context — horizontal cells, less nested */}
      <AnimatePresence>
        {ocrDone && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.06 }}
          >
            <Panel className="overflow-hidden">
              <PanelHeader
                eyebrow="Step 3 · encounter context"
                title="Planned admission"
              />
              <div className="hairline-x mx-5" />
              <div className="grid grid-cols-4 gap-px bg-[var(--color-line-soft)] px-px">
                <ContextCell label="Procedure" value={card.planned_procedure} />
                <ContextCell label="DRG / INA-CBG" value={card.ina_cbg} mono />
                <ContextCell label="Site · class" value={`${card.hospital_name} · ${card.ward_class}`} />
                <ContextCell label="Scheduled" value={fmtTime(card.scheduled_admission_at)} mono />
              </div>
              <div className="hairline-x mx-5" />
              <div className="flex flex-col gap-1.5 px-5 py-3">
                <div className="eyebrow">Pre-flight rule check</div>
                <div className="flex items-center gap-2">
                  {card.result.pre_auth_required === 1 ? (
                    <>
                      <Hourglass size={12} className="text-[var(--color-amber)]" />
                      <span className="text-[12px] text-ink-soft">{card.ina_cbg} requires pre-auth · gap matrix will run</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
                      <span className="text-[12px] text-ink-soft">No pre-auth required for this DRG</span>
                    </>
                  )}
                </div>
                {card.scenario === "dispute_risk" && (
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={12} className="text-[var(--color-coral)]" />
                    <span className="text-[12px] text-ink-soft">Pre-existing condition pattern flagged · dispute risk model will score this</span>
                  </div>
                )}
                {card.scenario === "lapsed" && (
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={12} className="text-[var(--color-coral)]" />
                    <span className="text-[12px] text-ink-soft">Membership status field will determine self-pay route (A.6 step 10)</span>
                  </div>
                )}
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action panel */}
      <AnimatePresence>
        {ocrDone && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Panel tone="raised" className="overflow-hidden">
              <div className="flex items-end justify-between gap-4 px-5 pt-4 pb-3">
                <div className="min-w-0">
                  <div className="eyebrow">A.6 step 3–4 · dispatch verification</div>
                  <h3 className="mt-1 font-display text-[16px] tracking-tight text-ink">Run scenario</h3>
                </div>
                <button
                  type="button"
                  onClick={resetIntakeCard}
                  className="flex shrink-0 items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-faint hover:text-ink-mute"
                >
                  <ArrowLeft size={11} /> Pick a different card
                </button>
              </div>
              <p className="px-5 pb-3 font-mono-tight text-[11px] leading-relaxed text-ink-faint">
                Live path runs the real-time eligibility query against the payor channel.
                Outage path exercises the circuit-breaker fallback to cached payor rules
                with a manual-confirmation flag (spec A.10 edge case 1).
              </p>
              <div className="flex gap-2 px-5 pb-5">
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => runVerification("live")}
                  disabled={simRunning}
                >
                  <Wifi size={13} /> Live {card.payor_kind === "gov" ? "BPJS" : card.payor_name} API
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={() => runVerification("cached")}
                  disabled={simRunning}
                >
                  <AlertTriangle size={13} /> Run with API outage
                </Button>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContextCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-[var(--color-panel)] px-4 py-2.5">
      <div className="eyebrow truncate">{label}</div>
      <div className={cn("mt-0.5 truncate text-[12.5px] text-ink-soft", mono && "font-mono-tight")}>{value}</div>
    </div>
  );
}
