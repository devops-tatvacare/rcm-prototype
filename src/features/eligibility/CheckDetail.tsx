import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ScanLine, ArrowRight, Wifi, Database, ShieldCheck, ShieldAlert, Building2, AlertTriangle, Bell, Users, Sparkles, Plus } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { fmtCompactIDR, fmtTime } from "@/lib/format";
import { useEligibility } from "@/store/useEligibility";
import { useClearances } from "@/store/useClearances";
import { type SampleCard } from "@/lib/eligibilityIntake";
import { IntakeView } from "./IntakeView";
import { cn } from "@/lib/cn";

type Detail = {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: string;
  ward_class: string;
  policy_number: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  status: string;
  source: string;
  tat_seconds: number;
  annual_limit_remaining_idr: number;
  annual_limit_total_idr: number;
  room_class_entitlement: string;
  pre_auth_required: number;
  pre_auth_status: string;
  cob_primary_payor: string | null;
  dispute_risk_score: number;
  exclusions_json: string;
  scheduled_admission_at: string;
  planned_procedure: string;
};

export function CheckDetail() {
  const flow = useEligibility((s) => s.flow);
  if (flow === "intake") return <IntakeView />;
  if (flow === "sim") return <SimulationView />;
  if (flow === "completed") return <CompletedRouter />;
  return null;
}

// Loads the persisted row for the queue-row drawer, then hands off to CompletedView.
function CompletedRouter() {
  const selectedCheckId = useEligibility((s) => s.selectedCheckId);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (!selectedCheckId) {
      setDetail(null);
      return;
    }
    query<Detail>(
      `SELECT e.id,
              p.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex,
              p.ward_class, p.policy_number,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              e.status, e.source, e.tat_seconds,
              e.annual_limit_remaining_idr, e.annual_limit_total_idr,
              e.room_class_entitlement, e.pre_auth_required, e.pre_auth_status,
              e.cob_primary_payor, e.dispute_risk_score, e.exclusions_json,
              e.scheduled_admission_at, e.planned_procedure
         FROM eligibility_checks e
         JOIN patients p ON p.id = e.patient_id
         JOIN payors py ON py.id = e.payor_id
         JOIN hospitals h ON h.id = e.hospital_id
        WHERE e.id = ?`,
      [selectedCheckId],
    ).then((rows) => setDetail(rows[0] ?? null));
  }, [selectedCheckId]);

  if (!detail) return <div className="flex h-full items-center justify-center text-ink-faint">Loading…</div>;
  return <CompletedView d={detail} />;
}

// ── Live simulation view (entered from intake → "Run live" / "Run outage") ─

function SimulationView() {
  const { simRunning, simEmitted, simElapsedMs, simMode, simPlan, simCard, simInsertedId, openIntake } = useEligibility();
  const totalSteps = simPlan.length;
  const done = simEmitted.length === totalSteps && !simRunning;
  const elapsedSec = (simElapsedMs / 1000).toFixed(1);
  const progress = totalSteps === 0 ? 0 : Math.min(100, (simEmitted.length / totalSteps) * 100);
  const isCached = simMode === "cached";
  const card = simCard;
  if (!card) return null;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-3 p-4 pt-12">
      {/* Left — TAT counter + walk-up patient + result */}
      <div className="col-span-5 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <Panel tone="raised" className="overflow-hidden">
          <div className="h-[3px] w-full" style={{ background: isCached ? "var(--color-amber)" : card.payor_color }} />
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{isCached ? "Outage failover" : "Live verification"}</span>
              <Pill tone={done ? statusToTone(card, isCached) : simRunning ? "info" : "neutral"} dot>
                {done ? statusToLabel(card, isCached) : simRunning ? "Running" : "Idle"}
              </Pill>
            </div>
            <div className="flex items-baseline gap-2">
              <motion.span
                key={Math.floor(simElapsedMs / 100)}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                className="numeric font-display text-[58px] leading-none text-ink"
              >
                {elapsedSec}
              </motion.span>
              <span className="font-display text-[18px] text-ink-mute">s</span>
              <span className="ml-auto font-mono-tight text-[11px] text-ink-faint text-right">
                spec target &lt; 90s<br />
                manual baseline 4–24h
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 60, damping: 18 }}
                className="h-full rounded-full"
                style={{
                  background: isCached
                    ? "linear-gradient(90deg, var(--color-amber), var(--color-champagne))"
                    : "linear-gradient(90deg, var(--color-champagne), var(--color-emerald))",
                }}
              />
            </div>
            <div className="font-mono-tight text-[10.5px] text-ink-faint">
              {simEmitted.length} of {totalSteps} steps
            </div>
          </div>
        </Panel>

        <Panel tone="raised" className="overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="font-display text-[18px] tracking-tight text-ink">{card.patient_name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-faint">
              <Building2 size={9} />
              {card.hospital_name} · {card.ward_class} · {card.patient_sex} · {card.patient_age}y
            </div>
          </div>
          <div className="border-t border-line-soft px-4 py-2.5">
            <div className="eyebrow">Card scanned</div>
            <div className="mt-1 font-mono-tight text-[11px] text-ink-soft">{card.payor_name} · {card.policy_number}</div>
            <div className="font-mono-tight text-[10.5px] text-ink-faint">NIK {card.national_id_masked}</div>
          </div>
          <div className="border-t border-line-soft px-4 py-2.5">
            <div className="eyebrow">Planned procedure</div>
            <div className="mt-1 text-[12.5px] text-ink-soft">{card.planned_procedure}</div>
            {card.ina_cbg !== "—" && (
              <div className="font-mono-tight text-[10px] text-[var(--color-champagne)]">{card.ina_cbg}</div>
            )}
          </div>
          {card.scenario === "family_plan" && (
            <div className="border-t border-line-soft px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <Users size={11} className="text-[var(--color-violet)]" />
                <span className="eyebrow text-[var(--color-violet)]">Dependent</span>
              </div>
              <div className="mt-1 font-mono-tight text-[11px] text-ink-soft">Policy holder · Ibu Santoso</div>
              <div className="font-mono-tight text-[10.5px] text-ink-faint">A.10 edge case · disambiguated by NIK + DOB + KK</div>
            </div>
          )}
          {done && <ResultSummary card={card} cached={isCached} insertedId={simInsertedId} />}
        </Panel>

        {done && (
          <Panel tone="raised" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-col">
                <span className="eyebrow">Next steps</span>
                <span className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">
                  Verification persisted to queue · downstream actions ready.
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={openIntake}>
                <Plus size={11} /> Verify another
              </Button>
            </div>
          </Panel>
        )}
      </div>

      {/* Right — live trace */}
      <div className="col-span-7 flex min-h-0 flex-col">
        <Panel className="flex h-full min-h-0 flex-col">
          <PanelHeader
            eyebrow={isCached ? "Agent · failover · cached eligibility" : `Agent · live · ${card.payor_name}`}
            title="Verification trace"
            right={<Pill tone={simRunning ? "info" : done ? statusToTone(card, isCached) : "neutral"} dot>{simRunning ? "Working" : done ? "Done" : "Idle"}</Pill>}
          />
          <div className="hairline-x mx-5" />
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <ol className="relative ml-2 border-l border-line-soft">
              <AnimatePresence initial={false}>
                {simEmitted.map((step, i) => {
                  const isLast = i === simEmitted.length - 1 && simRunning;
                  const isFailover = step.source === "Failover";
                  const isFlag = step.source === "Workflow";
                  const isDone = step.source === "Done";
                  const isDependent = step.source === "Dependent";
                  const dotTone = isLast ? "border-[var(--color-champagne)]/60 text-[var(--color-champagne)]"
                    : isDone ? (isCached || card.result.status === "LAPSED" ? "border-[var(--color-amber)]/60 text-[var(--color-amber)]" : "border-[var(--color-emerald)]/60 text-[var(--color-emerald)]")
                    : isFailover ? "border-[var(--color-coral)]/60 text-[var(--color-coral)]"
                    : isFlag ? "border-[var(--color-amber)]/60 text-[var(--color-amber)]"
                    : isDependent ? "border-[var(--color-violet)]/60 text-[var(--color-violet)]"
                    : "border-line-strong text-ink-mute";
                  const Icon = isFailover ? AlertTriangle : isFlag ? Bell : isDone ? ShieldCheck : isDependent ? Users : ScanLine;
                  return (
                    <motion.li
                      key={step.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 240, damping: 24 }}
                      className="relative pl-6 py-2.5"
                    >
                      <span className={cn("absolute -left-[9px] top-3.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-canvas-deep", dotTone)}>
                        <Icon size={10} />
                      </span>
                      <div className="font-mono-tight text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                        step {String(i + 1).padStart(2, "0")} · {step.source}
                      </div>
                      <div className="mt-0.5 text-[12.5px] font-medium text-ink">{step.label}</div>
                      <div className="mt-0.5 font-mono-tight text-[11px] leading-snug text-ink-mute">{step.detail}</div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {simRunning && simEmitted.length < totalSteps && (
                <li className="relative pl-6 py-2.5">
                  <span className="absolute -left-[9px] top-3.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--color-champagne)]/40 bg-canvas-deep">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-champagne)]" />
                    <span className="pulse-ring absolute inset-0 rounded-full ring-1 ring-[var(--color-champagne)]/50" />
                  </span>
                  <div className="font-mono-tight text-[10.5px] text-ink-faint">querying {simPlan[simEmitted.length].source}…</div>
                </li>
              )}
              {simEmitted.length === 0 && !simRunning && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Sparkles size={20} className="text-ink-faint" />
                  <div className="mt-2 font-display text-[15px] text-ink">Trace will stream here</div>
                  <div className="mt-1 max-w-sm font-mono-tight text-[11px] text-ink-faint">
                    Each A.6 workflow step is a row · OCR → ID cross-check → payor dispatch → coverage normalize → pre-auth gap → dispute risk → summary attach → handoff.
                  </div>
                </div>
              )}
            </ol>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function statusToTone(card: SampleCard, cached: boolean): "good" | "warn" | "bad" {
  if (cached) return "warn";
  if (card.result.status === "LAPSED" || card.result.status === "SUSPENDED") return "bad";
  if (card.result.status === "DISPUTED" || card.result.status === "WAITING_PERIOD") return "warn";
  if (card.scenario === "dispute_risk") return "warn";
  return "good";
}

function statusToLabel(card: SampleCard, cached: boolean): string {
  if (cached) return "Provisional";
  if (card.result.status === "LAPSED") return "Lapsed";
  if (card.scenario === "dispute_risk") return "Active · risk flagged";
  return "Cleared";
}

// Result summary card shown at the bottom of the left panel after the sim completes.
function ResultSummary({ card, cached, insertedId }: { card: SampleCard; cached: boolean; insertedId: string | null }) {
  const navigate = useNavigate();
  const closeEligDrawer = useEligibility((s) => s.closeDrawer);
  const openCheck = useEligibility((s) => s.openCheck);
  const isLapsed = card.result.status === "LAPSED";

  function viewInQueue() {
    if (!insertedId) return;
    openCheck(insertedId);
  }

  function goToClearances() {
    closeEligDrawer();
    setTimeout(() => navigate("/clearances"), 120);
  }

  const tone = cached || card.scenario === "dispute_risk" || isLapsed ? "amber" : "emerald";
  const label = cached
    ? "Coverage object · cached (T−12h)"
    : isLapsed
      ? "Coverage object · inactive"
      : card.scenario === "dispute_risk"
        ? "Coverage object · live (risk flagged)"
        : "Coverage object · live";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-t border-line-soft px-4 py-3"
    >
      <div className="flex items-center justify-between">
        <span
          className="eyebrow"
          style={{ color: tone === "amber" ? "var(--color-amber)" : "var(--color-emerald)" }}
        >
          {label}
        </span>
        <Pill tone={cached ? "warn" : isLapsed ? "bad" : card.scenario === "dispute_risk" ? "warn" : "good"} dot>
          {cached ? "Provisional" : isLapsed ? "Lapsed" : "Active"}
        </Pill>
      </div>
      <ul className="mt-2 space-y-1 font-mono-tight text-[11px] text-ink-soft">
        {!isLapsed ? (
          <>
            <li>· {card.result.room_class_entitlement} · {fmtCompactIDR(card.result.annual_limit_remaining_idr)} of {fmtCompactIDR(card.result.annual_limit_total_idr)} remaining</li>
            <li>· Pre-auth · {card.result.pre_auth_status}</li>
            <li>· COB · {card.result.cob_primary_payor ? card.result.cob_primary_payor : "single payor"}</li>
            <li>· Dispute risk {(cached ? Math.min(1, card.result.dispute_risk_score + 0.18) : card.result.dispute_risk_score).toFixed(2)}{cached ? " (cached + 0.18 elevation)" : ""}</li>
            {card.result.exclusions.length > 0 && (
              <li>· Exclusions · <span className="text-[var(--color-coral)]">{card.result.exclusions.join("; ")}</span></li>
            )}
            <li>· Eligibility Summary attached to chart {card.mrn}</li>
          </>
        ) : (
          <>
            <li>· Membership LAPSED · annual limit forfeit</li>
            <li>· Self-pay path opened · case manager notified</li>
            <li>· Lapse summary + financial assistance form drafted</li>
            <li>· All eligibility data passed to Module B (A.6 step 10)</li>
          </>
        )}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        {insertedId && (
          <Button variant="outline" size="sm" onClick={viewInQueue}>
            View persisted record
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={goToClearances}>
          {isLapsed ? "Open self-pay clearance" : "Open Financial Clearance"} <ArrowRight size={11} />
        </Button>
      </div>
    </motion.div>
  );
}

// ── Completed-check view (clicking a row in the queue) ────────────────────
function CompletedView({ d }: { d: Detail }) {
  const navigate = useNavigate();
  const closeEligDrawer = useEligibility((s) => s.closeDrawer);
  const openClearance = useClearances((s) => s.open);
  const [matchingClearanceId, setMatchingClearanceId] = useState<string | null>(null);

  let exclusions: string[] = [];
  try { exclusions = JSON.parse(d.exclusions_json); } catch { /* noop */ }

  // Look up the matching clearance row for this patient — A.6 step 11 handoff.
  useEffect(() => {
    query<{ id: string }>(
      `SELECT fc.id FROM clearances fc
        JOIN eligibility_checks e ON e.patient_id = fc.patient_id
       WHERE e.id = ? LIMIT 1`,
      [d.id],
    ).then((rows) => setMatchingClearanceId(rows[0]?.id ?? null));
  }, [d.id]);

  const statusTone =
    d.status === "ACTIVE" ? "good" :
    d.status === "DISPUTED" ? "warn" :
    "bad";

  function handoffToClearance() {
    if (!matchingClearanceId) return;
    closeEligDrawer();
    setTimeout(() => {
      navigate("/clearances");
      setTimeout(() => openClearance(matchingClearanceId), 80);
    }, 120);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 pt-12">
      <Panel tone="raised" className="overflow-hidden">
        <div className="h-[3px] w-full" style={{ background: d.payor_color }} />
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <div className="min-w-0">
            <div className="font-display text-[20px] leading-tight tracking-tight text-ink">{d.patient_name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-faint">
              <Building2 size={9} className="opacity-60" />
              <span>{d.hospital_name}</span>
              <span className="opacity-40">·</span>
              <span>{d.ward_class}</span>
              <span className="opacity-40">·</span>
              <span>{d.patient_sex} · {d.patient_age}y</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Pill tone="champagne" dot>{d.payor_name}</Pill>
            <span className="font-mono-tight text-[10px] text-ink-faint">policy {d.policy_number}</span>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-2 items-center gap-2 px-4 py-3">
          <div>
            <div className="eyebrow">TAT</div>
            <div className={`numeric font-display text-[36px] leading-none ${d.tat_seconds <= 90 ? "text-[var(--color-emerald)]" : "text-[var(--color-coral)]"}`}>{d.tat_seconds}<span className="text-[15px] text-ink-mute">s</span></div>
            <div className="font-mono-tight text-[10.5px] text-ink-faint">{d.source === "LIVE_API" ? <><Wifi size={9} className="inline mr-1" />live API</> : <><Database size={9} className="inline mr-1" />cached overnight</>}</div>
          </div>
          <div>
            <div className="eyebrow">Status</div>
            <Pill tone={statusTone as any} dot size="md">{d.status.replace("_", " ")}</Pill>
            <div className="mt-1 font-mono-tight text-[10.5px] text-ink-faint">checked {fmtTime(d.scheduled_admission_at)}</div>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Coverage object" title="Aggregated response" />
        <div className="hairline-x mx-5" />
        <div className="grid grid-cols-2 gap-2 p-4">
          <Cell label="Annual limit" v={fmtCompactIDR(d.annual_limit_remaining_idr) + " of " + fmtCompactIDR(d.annual_limit_total_idr)} />
          <Cell label="Room class" v={d.room_class_entitlement} />
          <Cell label="Planned procedure" v={d.planned_procedure} />
          <Cell label="COB primary" v={d.cob_primary_payor || "—"} />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Pre-auth" title="Gap matrix" />
        <div className="hairline-x mx-5" />
        <div className="px-4 py-3">
          {d.pre_auth_required ? (
            <div className="flex items-center gap-2">
              {d.pre_auth_status.startsWith("ATTACHED") ? <ShieldCheck size={14} className="text-[var(--color-emerald)]" />
                : d.pre_auth_status.startsWith("PENDING") ? <ArrowRight size={14} className="text-[var(--color-amber)]" />
                : <ShieldAlert size={14} className="text-[var(--color-coral)]" />}
              <span className="text-[12.5px] text-ink-soft">{d.pre_auth_status}</span>
            </div>
          ) : (
            <div className="font-mono-tight text-[11px] text-ink-faint">Not required for this DRG</div>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Risk" title="Coverage Dispute Score" right={<span className="numeric text-[14px]" style={{ color: d.dispute_risk_score > 0.5 ? "var(--color-coral)" : d.dispute_risk_score > 0.2 ? "var(--color-amber)" : "var(--color-emerald)" }}>{d.dispute_risk_score.toFixed(2)}</span>} />
        <div className="hairline-x mx-5" />
        <div className="px-4 py-3">
          {exclusions.length === 0 ? (
            <div className="font-mono-tight text-[11px] text-ink-faint">No relevant exclusions for this admission.</div>
          ) : (
            <ul className="flex flex-col gap-1 font-mono-tight text-[11px] text-ink-soft">
              {exclusions.map((ex, i) => (
                <li key={i}>· <span className="text-[var(--color-coral)]">{ex}</span></li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* A.6 step 11 — handoff to Financial Clearance */}
      {matchingClearanceId && (
        <Panel tone="raised" className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-col">
              <span className="eyebrow">Next stage · Front cycle</span>
              <span className="mt-0.5 text-[12.5px] text-ink-soft">All eligibility data passed to Financial Clearance.</span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                {d.status === "ACTIVE"
                  ? "Cashless insured workflow · GOP request awaits."
                  : d.status === "LAPSED" || d.status === "WAITING_PERIOD"
                    ? "Self-pay workflow · payment plan + financial assistance check needed."
                    : "Conditional path · provisional admission with manual confirmation."}
              </span>
            </div>
            <Button variant="primary" size="sm" onClick={handoffToClearance}>
              Open in Financial Clearance <ArrowRight size={11} />
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Cell({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-2.5 py-1.5">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-0.5 font-mono-tight text-[12px] text-ink-soft">{v}</div>
    </div>
  );
}
