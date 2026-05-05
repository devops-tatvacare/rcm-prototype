import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, RotateCcw, Send, Stethoscope, Building2,
  Radar, Lock, AlertTriangle, Clock, Mail,
  Zap, BellRing, ChevronRight, Upload,
} from "lucide-react";
import { query } from "@/lib/db";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { fmtCompactIDR } from "@/lib/format";
import { usePacketBuilder } from "@/store/usePacketBuilder";
import { AgentStream } from "./AgentStream";
import { FleetStatus } from "./FleetStatus";
import { PayloadOverlay } from "./PayloadOverlay";
import { lastPolledSummary, generatePollEvents, buildRemediationPlan, type ClaimLike } from "@/lib/stagedTraces";
import { AssistActions } from "@/features/worklist/AssistActions";
import { UploadedDocsPanel } from "@/features/worklist/UploadedDocsPanel";

export function ClaimDetail() {
  const loadedClaim = usePacketBuilder((s) => s.loadedClaim);
  const viewMode = usePacketBuilder((s) => s.viewMode);
  const payloadOverlayOpen = usePacketBuilder((s) => s.payloadOverlayOpen);
  const closePayloadOverlay = usePacketBuilder((s) => s.closePayloadOverlay);
  const channel = usePacketBuilder((s) => s.channel);
  const artifacts = usePacketBuilder((s) => s.artifacts);
  const startAgent = usePacketBuilder((s) => s.start);
  const [agentInvoked, setAgentInvoked] = useState(false);

  // For DOC_UPLOAD claims, hide the build/gauge panels until the associate
  // either clicks "Run agent" or hands off uploaded docs to the packet agent.
  // Polling because handoff happens inside the docs panel and we want to react to it.
  useEffect(() => {
    if (!loadedClaim || loadedClaim.source !== "DOC_UPLOAD") { setAgentInvoked(true); return; }
    setAgentInvoked(false);
    let cancelled = false;
    const tick = () => {
      query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM uploaded_docs
          WHERE owner_kind = 'claim' AND owner_id = ? AND status = 'handed_to_packet'`,
        [loadedClaim.id],
      ).then((rows) => { if (!cancelled && (rows[0]?.n ?? 0) > 0) setAgentInvoked(true); });
    };
    tick();
    const i = setInterval(tick, 700);
    return () => { cancelled = true; clearInterval(i); };
  }, [loadedClaim?.id, loadedClaim?.source]);

  if (!loadedClaim) return <FleetStatus />;

  const showBuildPanels = loadedClaim.source !== "DOC_UPLOAD" || agentInvoked;

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-12 gap-3 p-4 pt-12">
        <div className="col-span-6 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0">
          <ClaimHeader d={loadedClaim} />
          <AssistActions patientName={loadedClaim.patient_name} compact />
          {loadedClaim.source === "DOC_UPLOAD" && (
            <UploadedDocsPanel
              ownerKind="claim"
              ownerId={loadedClaim.id}
              patientName={loadedClaim.patient_name}
              onRunAgent={() => { setAgentInvoked(true); startAgent(); }}
            />
          )}
          {showBuildPanels && viewMode === "build" && <BuildPanel />}
          {showBuildPanels && viewMode === "ready" && <ReadyPanel />}
          {showBuildPanels && viewMode === "preauth" && <PreAuthPanel />}
          {showBuildPanels && viewMode === "adjudicating" && <AdjudicatingPanel />}
          {showBuildPanels && viewMode === "atrisk" && <AtRiskPanel />}
        </div>
        <div className="col-span-6 flex min-h-0 flex-col">
          <AgentStream />
        </div>
      </div>
      <PayloadOverlay
        open={payloadOverlayOpen}
        onClose={closePayloadOverlay}
        channel={channel}
        artifacts={artifacts}
        patientName={loadedClaim.patient_name}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared header — top of every left column. Patient + diagnosis + money chain.
// ─────────────────────────────────────────────────────────────────────────
function ClaimHeader({ d }: { d: ClaimLike }) {
  return (
    <Panel tone="raised" className="overflow-hidden">
      <div className="h-[3px] w-full" style={{ background: payorColor(d.payor_id) }} />
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[20px] leading-tight tracking-tight text-ink">{d.patient_name}</div>
          <div className="mt-1 flex items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-faint">
            <Building2 size={9} className="shrink-0 opacity-60" />
            <span className="truncate">{d.hospital_name} · {d.ward_class}</span>
          </div>
        </div>
        <Pill tone="champagne" dot className="shrink-0">{d.payor_name}</Pill>
      </div>

      <div className="border-t border-line-soft px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Stethoscope size={10} className="shrink-0 text-ink-faint" />
          <span className="eyebrow">Diagnosis</span>
          <span className="font-mono-tight text-[10px] text-[var(--color-champagne)]">{d.drg}</span>
          <span className="ml-auto inline-flex items-center rounded-sm border border-line-soft bg-[var(--color-canvas-deep)]/40 px-1.5 py-0.5 font-mono-tight text-[10px] text-ink-mute">
            LOS {d.los_days}d
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{d.dx}</p>
      </div>

      <div className="border-t border-line-soft px-4 py-3">
        <div className="eyebrow mb-1.5">Reimbursement story</div>
        <div className="flex items-stretch gap-2">
          <Money label="Gross" v={fmtCompactIDR(d.gross_idr)} tone="ink-mute" />
          <Arrow />
          <Money label="Expected" v={fmtCompactIDR(d.expected_reimb_idr)} tone="champagne" emphasized />
          <Arrow />
          <Money label="DTP" v={`${d.predicted_dtp_days ?? 14}d`} tone="emerald" />
        </div>
      </div>
    </Panel>
  );
}

function payorColor(payorId: string) {
  if (payorId === "bpjs") return "#e7c08a";
  if (payorId === "aia") return "#a78bfa";
  return "#fb7185";
}

function Money({ label, v, tone, emphasized }: { label: string; v: string; tone: "ink-mute" | "champagne" | "emerald"; emphasized?: boolean }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "emerald" ? "text-[var(--color-emerald)]"
    : "text-ink-mute";
  return (
    <div className={`flex flex-1 flex-col rounded-md ${emphasized ? "border border-[var(--color-champagne)]/25 bg-[var(--color-champagne)]/5" : ""} px-2 py-1`}>
      <span className="eyebrow truncate">{label}</span>
      <span className={`mt-0.5 numeric text-[14px] tracking-tight truncate ${c}`}>{v}</span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center text-ink-faint/60">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </div>
  );
}

function ScoreCell({
  label, value, mono, accent = "ink",
}: {
  label: string; value: string; mono?: boolean; accent?: "ink" | "emerald" | "coral" | "champagne";
}) {
  const c =
    accent === "emerald" ? "text-[var(--color-emerald)]"
    : accent === "coral" ? "text-[var(--color-coral)]"
    : accent === "champagne" ? "text-[var(--color-champagne)]"
    : "text-ink";
  return (
    <div className="bg-[var(--color-panel)] px-4 py-2.5">
      <div className="eyebrow truncate">{label}</div>
      <div className={`mt-0.5 numeric truncate text-[14px] ${mono ? "font-mono-tight" : ""} ${c}`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD PANEL — live agent runner (existing behavior) + post-submit receipt
// ─────────────────────────────────────────────────────────────────────────
function BuildPanel() {
  const status = usePacketBuilder((s) => s.status);
  if (status === "submitted") return <SubmissionReceipt />;
  return <LiveAcceptanceCard />;
}

function LiveAcceptanceCard() {
  const {
    status, acceptance, baseline, predictedDtpDays,
    start, reset, pause, resume, submit,
    attachMri, attachConservativeNarrative, attachSyntaxScore, toggleAttach, emittedSteps,
  } = usePacketBuilder();
  const ready = status === "ready";
  const running = status === "running";
  const dispatching = status === "dispatching";
  const fired = new Set(emittedSteps.map((s) => s.ruleId).filter(Boolean));
  const earned = +(acceptance - baseline).toFixed(1);

  const statusTone = running || dispatching ? "info" : ready ? "good" : status === "paused" ? "warn" : "neutral";
  const statusLabel =
    status === "idle" ? "Awaiting agent"
    : running ? "Working"
    : ready ? "Ready to submit"
    : status === "paused" ? "Paused"
    : dispatching ? "Dispatching"
    : "Idle";

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="eyebrow">Acceptance probability</span>
        <Pill tone={statusTone} dot size="xs">{statusLabel}</Pill>
      </div>
      <div className="hairline-x mx-4" />
      <InlineAcceptanceBar value={acceptance} target={85} />
      <InlineStatsRow
        baseline={`${baseline}%`}
        earned={`${earned >= 0 ? "+" : ""}${earned.toFixed(1)} pts`}
        earnedAccent={earned >= 0 ? "emerald" : "coral"}
        dtp={`${predictedDtpDays}d`}
      />

      <div className="border-t border-line-soft px-4 py-2.5">
        <AnimatePresence mode="wait">
          {!ready && !dispatching && (
            <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
              {running ? (
                <Button size="md" variant="soft" className="flex-1" onClick={pause}><Pause size={13} /> Pause</Button>
              ) : status === "paused" ? (
                <Button size="md" variant="primary" className="flex-1" onClick={resume}><Play size={13} /> Resume agent</Button>
              ) : (
                <Button size="md" variant="primary" className="flex-1" onClick={start}><Play size={13} /> Run agent</Button>
              )}
              <Button size="md" variant="ghost" onClick={reset}><RotateCcw size={12} /></Button>
            </motion.div>
          )}
          {ready && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button size="md" variant="primary" className="w-full" onClick={submit}>
                <Send size={13} /> Submit packet to payor
              </Button>
            </motion.div>
          )}
          {dispatching && <DispatchingBadge />}
        </AnimatePresence>
      </div>

      <div className="border-t border-line-soft px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Rules that move this score</span>
          <span className="font-mono-tight text-[10px] text-ink-faint">{fired.size} of 3 fired</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ToggleChip active={attachMri} onToggle={() => toggleAttach("attachMri")} label="Attach pelvic MRI" hint="+11.4" />
          <ToggleChip active={attachConservativeNarrative} onToggle={() => toggleAttach("attachConservativeNarrative")} label="Conservative narrative" hint="+8.3" />
          <ToggleChip active={attachSyntaxScore} onToggle={() => toggleAttach("attachSyntaxScore")} label="SYNTAX score" hint="n/a" />
        </div>
      </div>
    </Panel>
  );
}

function DispatchingBadge() {
  return (
    <motion.div key="disp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-md border border-[var(--color-azure)]/30 bg-[var(--color-azure)]/10 px-3 py-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-azure)] opacity-75" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--color-azure)]" />
      </span>
      <span className="text-[12px] font-medium text-[var(--color-azure)]">Dispatching to payor channel…</span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// READY PANEL — frozen build, awaiting human submit
// ─────────────────────────────────────────────────────────────────────────
function ReadyPanel() {
  const status = usePacketBuilder((s) => s.status);
  if (status === "submitted") return <SubmissionReceipt />;

  const { acceptance, baseline, predictedDtpDays, submit } = usePacketBuilder();
  const dispatching = status === "dispatching";
  const earned = +(acceptance - baseline).toFixed(1);

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex flex-col leading-tight">
          <span className="eyebrow">Acceptance probability</span>
          <span className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">scrubbed clean · awaiting human approval</span>
        </div>
        <Pill tone="good" dot size="sm">Ready to submit</Pill>
      </div>
      <div className="hairline-x mx-4" />
      <InlineAcceptanceBar value={acceptance} target={85} />
      <div className="grid grid-cols-3 gap-px bg-[var(--color-line-soft)] px-px">
        <ScoreCell label="Baseline" value={`${baseline}%`} mono />
        <ScoreCell label="Earned" value={`${earned >= 0 ? "+" : ""}${earned.toFixed(1)} pts`} mono accent="emerald" />
        <ScoreCell label="Predicted DTP" value={`${predictedDtpDays}d`} mono accent="champagne" />
      </div>
      <div className="border-t border-line-soft px-4 py-3">
        {dispatching ? <DispatchingBadge /> : (
          <Button size="md" variant="primary" className="w-full" onClick={submit}>
            <Send size={13} /> Submit packet to payor
          </Button>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Inline acceptance bar — replaces circular gauge with a horizontal track.
// Big % on the left, target marker, fills left→right. Compact, not chunky.
// ─────────────────────────────────────────────────────────────────────────
function InlineStatsRow({
  baseline, earned, earnedAccent, dtp,
}: { baseline: string; earned: string; earnedAccent: "emerald" | "coral"; dtp: string }) {
  const earnedColor = earnedAccent === "emerald" ? "var(--color-emerald)" : "var(--color-coral)";
  return (
    <div className="grid grid-cols-3 gap-px bg-[var(--color-line-soft)] px-px">
      <Cell label="Baseline" value={baseline} />
      <Cell label="Earned" value={earned} color={earnedColor} />
      <Cell label="Pred DTP" value={dtp} color="var(--color-champagne)" />
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--color-panel)] px-3 py-1.5">
      <div className="font-mono-tight text-[9.5px] uppercase tracking-[0.12em] text-ink-faint truncate">{label}</div>
      <div className="numeric mt-0.5 truncate text-[12px] font-mono-tight" style={{ color: color ?? "var(--color-ink)" }}>{value}</div>
    </div>
  );
}

function InlineAcceptanceBar({ value, target }: { value: number; target: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = pct >= target ? "var(--color-emerald)" : pct >= 70 ? "var(--color-champagne)" : "var(--color-coral)";
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="numeric font-display text-[22px] leading-none" style={{ color }}>{pct}</span>
        <span className="text-[12px] text-ink-mute">%</span>
        <span className="ml-auto font-mono-tight text-[10px] text-ink-faint">target {target}%</span>
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 70, damping: 18 }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, var(--color-coral), var(--color-champagne) 60%, ${color})` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-[var(--color-ink)]/40"
          style={{ left: `${target}%` }}
          title={`Target ${target}%`}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PRE-AUTH PANEL — pre-auth dispatched · awaiting ack
// ─────────────────────────────────────────────────────────────────────────
function PreAuthPanel() {
  const claim = usePacketBuilder((s) => s.loadedClaim)!;
  const poll = lastPolledSummary(claim, "pre-auth");
  // Realistic pre-auth SLA · 48h target for clean cashless requests.
  const slaHours = 48;
  const elapsedH = claim.days_in_stage * 24;
  const pct = Math.min(100, Math.round((elapsedH / slaHours) * 100));
  const aging = claim.risk_flag === "AGING_PA" || pct >= 75;

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex flex-col leading-tight">
          <span className="eyebrow">Pre-authorization · awaiting payor</span>
          <span className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">letter dispatched · adjudication queue</span>
        </div>
        <Pill tone={aging ? "bad" : "warn"} dot size="sm">{aging ? "Aging" : "Waiting"}</Pill>
      </div>
      <div className="hairline-x mx-5" />

      {/* SLA clock */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-end justify-between">
          <div className="leading-tight">
            <div className="eyebrow">Time waiting · vs payor SLA</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="numeric font-display text-[28px] leading-none text-ink">{claim.days_in_stage}</span>
              <span className="font-display text-[14px] text-ink-mute">d</span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">/ {slaHours / 24}d typical</span>
            </div>
          </div>
          <span className={`numeric text-[14px] ${aging ? "text-[var(--color-coral)]" : "text-[var(--color-amber)]"}`}>{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 16 }}
            className="h-full rounded-full"
            style={{ background: aging ? "var(--color-coral)" : "linear-gradient(90deg, var(--color-amber), var(--color-coral))" }}
          />
        </div>
      </div>

      {/* Polling summary */}
      <div className="grid grid-cols-3 gap-px bg-[var(--color-line-soft)] px-px">
        <ScoreCell label="Last polled" value={poll.lastPolled} mono />
        <ScoreCell label="Next poll" value={poll.nextPolled} mono />
        <ScoreCell label="Checks today" value={`${poll.checksToday}`} mono />
      </div>

      {/* Aging callout — promoted from gray caption to a real colored alert */}
      {aging && (
        <div className="border-t border-line-soft px-5 py-3">
          <div className="flex items-start gap-2 rounded-md border border-[var(--color-coral)]/30 bg-[var(--color-coral)]/[0.06] px-3 py-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--color-coral)]" />
            <div className="flex-1 text-[12px] leading-snug text-ink-soft">
              SLA breached · auto-followup sent twice. Escalation routes to TPA supervisor + opens a phone-call ticket.
            </div>
          </div>
        </div>
      )}

      {/* Followup actions */}
      <div className="border-t border-line-soft px-5 py-3.5">
        {aging ? (
          <Button size="md" variant="primary" className="w-full">
            <BellRing size={13} /> Escalate to {claim.payor_name} desk
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between font-mono-tight text-[10px] uppercase tracking-[0.14em]">
              <span className="text-ink-faint">Auto · followup</span>
              <span className="text-ink-soft">at 24h mark</span>
            </div>
            <Button size="md" variant="outline" className="w-full">
              <Mail size={13} /> Send manual followup now
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ADJUDICATING PANEL — submission receipt + SLA tracking + last polled
// ─────────────────────────────────────────────────────────────────────────
function AdjudicatingPanel() {
  return <SubmissionReceipt />;
}

// ─────────────────────────────────────────────────────────────────────────
// AT-RISK PANEL — blocked + remediation mini-flow
// ─────────────────────────────────────────────────────────────────────────
function AtRiskPanel() {
  const { loadedClaim, status, acceptance, baseline, predictedDtpDays, runRemediation, runHumanUpload, submit } = usePacketBuilder();
  if (!loadedClaim) return null;

  const plan = buildRemediationPlan(loadedClaim);
  const remediating = status === "remediating";
  const remediated = status === "remediated";
  const dispatching = status === "dispatching";
  const earned = +(acceptance - baseline).toFixed(1);

  return (
    <>
      {/* Block summary */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex flex-col leading-tight">
            <span className="eyebrow">Status · blocked</span>
            <span className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">scrub failed · agent halted before submission</span>
          </div>
          <Pill tone="bad" dot size="sm">{remediated ? "Resolved" : remediating ? "Remediating" : "Blocked"}</Pill>
        </div>
        <div className="hairline-x mx-5" />
        <div className="flex items-start gap-2 px-5 py-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-coral)]" />
          <div className="flex-1 text-[12.5px] leading-snug text-ink-soft">
            {blockSummary(loadedClaim)}
          </div>
        </div>
      </Panel>

      {/* Remediation card */}
      {plan && (
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex flex-col leading-tight">
              <span className="eyebrow">Suggested remediation</span>
              <span className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">expected lift · +{plan.liftPts} pts</span>
            </div>
            {remediating && (
              <Pill tone="info" dot size="sm">Running</Pill>
            )}
            {remediated && (
              <Pill tone="good" dot size="sm">Done</Pill>
            )}
          </div>
          <div className="hairline-x mx-5" />

          {(remediating || remediated) && (
            <div className="border-t border-line-soft px-px">
              <div className="grid grid-cols-3 gap-px bg-[var(--color-line-soft)] px-px">
                <ScoreCell label="Score now" value={`${Math.round(acceptance)}%`} mono accent={remediated ? "emerald" : "champagne"} />
                <ScoreCell label="Earned" value={`${earned >= 0 ? "+" : ""}${earned.toFixed(1)} pts`} mono accent="emerald" />
                <ScoreCell label="Predicted DTP" value={`${predictedDtpDays}d`} mono />
              </div>
            </div>
          )}

          <div className="border-t border-line-soft px-5 py-3.5">
            <AnimatePresence mode="wait">
              {!remediating && !remediated && !dispatching && (
                <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                  {/* Agent path */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between font-mono-tight text-[10px] uppercase tracking-[0.14em]">
                      <span className="text-ink-faint">Path A · agent</span>
                      <span className="text-ink-soft">composes from source data</span>
                    </div>
                    <Button size="md" variant="primary" className="w-full" onClick={runRemediation}>
                      <Zap size={13} /> Run agent remediation
                    </Button>
                  </div>

                  {/* Or-divider */}
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-line-soft" />
                    <span className="font-mono-tight text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">or</span>
                    <div className="h-px flex-1 bg-line-soft" />
                  </div>

                  {/* Human-upload path */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between font-mono-tight text-[10px] uppercase tracking-[0.14em]">
                      <span className="text-ink-faint">Path B · human assist</span>
                      <span className="text-ink-soft">if you have it in hand</span>
                    </div>
                    <button
                      type="button"
                      onClick={runHumanUpload}
                      className="group flex items-center gap-3 rounded-md border border-dashed border-line-strong bg-[var(--color-canvas-deep)]/40 px-3.5 py-3 text-left transition-colors hover:border-[var(--color-champagne)]/50 hover:bg-[var(--color-champagne)]/[0.04]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line-soft bg-[var(--color-panel)]/60 text-ink-mute group-hover:border-[var(--color-champagne)]/40 group-hover:text-[var(--color-champagne)]">
                        <Upload size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-ink">{plan.humanUploadLabel}</div>
                        <div className="font-mono-tight text-[10.5px] text-ink-faint truncate">{plan.humanUploadHint}</div>
                      </div>
                      <ChevronRight size={12} className="text-ink-faint group-hover:text-[var(--color-champagne)]" />
                    </button>
                  </div>
                </motion.div>
              )}
              {remediating && (
                <motion.div key="run-ing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-md border border-[var(--color-azure)]/30 bg-[var(--color-azure)]/10 px-3 py-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-azure)] opacity-75" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--color-azure)]" />
                  </span>
                  <span className="text-[12px] font-medium text-[var(--color-azure)]">Working on remediation…</span>
                </motion.div>
              )}
              {remediated && plan.liftPts > 0 && !dispatching && (
                <motion.div key="resubmit" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button size="md" variant="primary" className="w-full" onClick={submit}>
                    <Send size={13} /> {plan.nextActionLabel}
                  </Button>
                </motion.div>
              )}
              {remediated && plan.liftPts === 0 && (
                <motion.div key="escalated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/25 bg-[var(--color-emerald)]/[0.06] px-3 py-2">
                  <BellRing size={12} className="text-[var(--color-emerald)]" />
                  <span className="text-[12px] text-[var(--color-emerald)]">{plan.nextActionLabel} · TPA desk notified</span>
                </motion.div>
              )}
              {dispatching && <DispatchingBadge />}
            </AnimatePresence>
          </div>
        </Panel>
      )}
    </>
  );
}

function blockSummary(c: ClaimLike): string {
  switch (c.risk_flag) {
    case "PA_MISMATCH":
      return `Pre-auth scope mismatch — operative report shows implant model differs from approved pre-auth letter. ${c.payor_name} rule r6 is the #1 denial driver on this DRG without an addendum.`;
    case "MISSING_DOC":
      if (c.drg.includes("CARDIO") || c.drg.includes("PCI")) {
        return `SYNTAX score worksheet not on file. ${c.payor_name} rule r5 requires SYNTAX for any PCI claim — historical pass-rate jumps from 71% to 89% when attached.`;
      }
      return `Pre-op pelvic MRI report not on file. ${c.payor_name} rule r1 requires MRI alongside ultrasound — historically lifts pass rate by 11.4 pts (184 evidence threads).`;
    case "LOS_VARIANCE":
      return `LOS ${c.los_days}d exceeds DRG cap. Submitting without an extension request will trigger automatic line reduction at adjudication.`;
    case "AGING_PA":
      return `Pre-auth aging beyond payor SLA. Auto-followup sent twice without response.`;
    default:
      return `Manual review required.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMISSION RECEIPT — shared by Build (post-submit) + Adjudicating views
// ─────────────────────────────────────────────────────────────────────────
function SubmissionReceipt() {
  const {
    loadedClaim, channel, expectedAdjDate, acceptance, predictedDtpDays,
    openPayloadOverlay,
  } = usePacketBuilder();
  if (!channel || !loadedClaim) return null;

  const poll = lastPolledSummary(loadedClaim, "adjudication");
  const events = generatePollEvents(loadedClaim, loadedClaim.days_in_stage, "adjudication");
  const lastEvent = events[events.length - 1];

  // SLA progress: how far through the adjudication window we are.
  const pct = Math.min(100, Math.round((loadedClaim.days_in_stage / channel.sla_days) * 100));

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex flex-col leading-tight">
          <span className="eyebrow">Submission · receipt</span>
          <span className="mt-1 text-[15px] font-medium text-ink">{channel.label}</span>
          <span className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">{channel.endpoint_path}</span>
        </div>
        <Pill tone="good" dot size="sm">Acknowledged</Pill>
      </div>
      <div className="hairline-x mx-5" />

      <div className="grid grid-cols-3 gap-px bg-[var(--color-line-soft)] px-px">
        <ScoreCell label="Acceptance" value={`${Math.round(acceptance)}%`} mono accent="emerald" />
        <ScoreCell label="Predicted DTP" value={`${predictedDtpDays}d`} mono accent="champagne" />
        <ScoreCell label="Adjudicate by" value={expectedAdjDate ?? "—"} mono />
      </div>

      {/* SLA progress */}
      <div className="px-5 pt-3.5 pb-3">
        <div className="flex items-end justify-between">
          <div className="leading-tight">
            <div className="eyebrow">Adjudication clock · vs SLA</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="numeric font-display text-[20px] leading-none text-ink">{loadedClaim.days_in_stage}</span>
              <span className="font-display text-[12px] text-ink-mute">/ {channel.sla_days}d</span>
            </div>
          </div>
          <span className="numeric text-[12px] text-ink-soft">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 16 }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, var(--color-azure), var(--color-emerald))" }}
          />
        </div>
      </div>

      {/* Polling summary */}
      <div className="border-t border-line-soft px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Status polling</span>
          <span className="font-mono-tight text-[10px] text-ink-faint">every 2h · auto</span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <SmallStat icon={Clock} label="Last poll" value={poll.lastPolled} />
          <SmallStat icon={Radar} label="Next poll" value={poll.nextPolled} />
        </div>
        {lastEvent && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2">
            <BellRing size={11} className="mt-0.5 shrink-0 text-ink-faint" />
            <div className="flex-1 text-[11.5px] leading-snug text-ink-soft">
              <span className="text-ink">{lastEvent.status}</span>
              <span className="text-ink-faint"> · {lastEvent.detail}</span>
            </div>
          </div>
        )}
      </div>

      {/* Channel mechanics — promoted from gray footer to a labeled stat row */}
      <div className="border-t border-line-soft px-5 py-3">
        <div className="flex items-start gap-2">
          <Radar size={11} className="mt-0.5 text-ink-faint" />
          <div className="flex-1 text-[12px] leading-snug text-ink-soft">
            {channel.submission_method_blurb}
          </div>
        </div>
      </div>

      {/* View payload — opens the secondary right drawer */}
      <div className="border-t border-line-soft px-5 py-3.5">
        <Button size="md" variant="outline" className="w-full" onClick={openPayloadOverlay}>
          <Lock size={12} />
          {channel.kind === "rest_api"
            ? "View outgoing API request"
            : channel.kind === "email"
              ? "View outgoing email + bundle"
              : "View bundle uploaded to portal"}
          <ChevronRight size={11} className="ml-auto" />
        </Button>
      </div>
    </Panel>
  );
}

function SmallStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-2.5 py-1.5">
      <Icon size={11} className="mt-0.5 text-ink-faint" />
      <div className="flex-1 leading-tight">
        <div className="eyebrow">{label}</div>
        <div className="mt-0.5 font-mono-tight text-[11.5px] text-ink-soft">{value}</div>
      </div>
    </div>
  );
}
