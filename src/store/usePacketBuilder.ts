import { create } from "zustand";
import { type AgentStep, type Artifact } from "@/lib/agent";
import { buildChannel, buildDispatchPlan, expectedAdjudicationDate, type SubmissionChannel } from "@/lib/submission";
import { exec, queryOne } from "@/lib/db";
import {
  buildLivePlan,
  buildReadyTrace,
  buildPreAuthTrace,
  buildAdjudicatingTrace,
  buildAtRiskTrace,
  buildRemediationPlan,
  type ClaimLike,
} from "@/lib/stagedTraces";

export type Status =
  | "idle"            // Building · awaiting Run agent
  | "running"         // Building · live trace streaming
  | "paused"
  | "ready"           // Building reached ready · OR Ready/At-risk ready to submit
  | "dispatching"     // submit clicked · dispatch trace animating
  | "submitted"       // dispatch done · receipt shown
  | "preauth_wait"    // Pre-auth claim · trace frozen · waiting for ack
  | "blocked"         // At-risk · trace frozen at block step
  | "remediating"     // At-risk · remediation mini-flow streaming
  | "remediated";     // At-risk · remediation done · can resubmit

// Which left-panel view to render; derived from claim.stage on openClaim.
export type ViewMode = "build" | "ready" | "preauth" | "adjudicating" | "atrisk";

type State = {
  selectedClaimId: string | null;
  drawerOpen: boolean;
  viewMode: ViewMode;
  status: Status;
  // Live build plan (Building stage)
  steps: AgentStep[];
  cursor: number;
  emittedSteps: AgentStep[];
  artifacts: Artifact[];
  acceptance: number;
  baseline: number;
  predictedDtpDays: number;
  attachMri: boolean;
  attachConservativeNarrative: boolean;
  attachSyntaxScore: boolean;
  // Submission state
  channel: SubmissionChannel | null;
  expectedAdjDate: string | null;
  payloadOverlayOpen: boolean;
  // Loaded claim row (drives stage-aware rendering)
  loadedClaim: ClaimLike | null;
  // Floor refresh signal — bumps when a claim's stage changes (so the board re-queries)
  boardRefreshTick: number;
  openClaim: (id: string) => void;
  closeDrawer: () => void;
  reset: () => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  toggleAttach: (key: "attachMri" | "attachConservativeNarrative" | "attachSyntaxScore") => void;
  submit: () => void;
  runRemediation: () => void;
  runHumanUpload: () => void;
  openPayloadOverlay: () => void;
  closePayloadOverlay: () => void;
};

const baseline = 47;

export const usePacketBuilder = create<State>((set, get) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dispatchTimer: ReturnType<typeof setTimeout> | null = null;
  let remediationTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (dispatchTimer) { clearTimeout(dispatchTimer); dispatchTimer = null; }
    if (remediationTimer) { clearTimeout(remediationTimer); remediationTimer = null; }
  }

  function tick() {
    const s = get();
    if (s.status !== "running") return;
    if (s.cursor >= s.steps.length) {
      set({ status: "ready" });
      return;
    }
    const step = s.steps[s.cursor];
    timer = setTimeout(() => {
      const cur = get();
      if (cur.status !== "running") return;
      const nextEmitted = [...cur.emittedSteps, step];
      const nextArtifacts = step.artifact ? [...cur.artifacts, step.artifact] : cur.artifacts;
      let delta = step.probDelta;
      if (step.ruleId === "r1" && !cur.attachMri) delta = 0;
      if (step.ruleId === "r2" && !cur.attachConservativeNarrative) delta = 0;
      const nextAcc = Math.min(99, cur.acceptance + delta);
      const dtp = Math.max(7, Math.round(31 - (nextAcc - baseline) * 0.36));
      set({
        cursor: cur.cursor + 1,
        emittedSteps: nextEmitted,
        artifacts: nextArtifacts,
        acceptance: nextAcc,
        predictedDtpDays: dtp,
      });
      tick();
    }, step.ms);
  }

  function streamDispatch(plan: AgentStep[], idx: number) {
    if (idx >= plan.length) {
      set({ status: "submitted" });
      return;
    }
    const step = plan[idx];
    dispatchTimer = setTimeout(() => {
      const cur = get();
      set({ emittedSteps: [...cur.emittedSteps, step] });
      streamDispatch(plan, idx + 1);
    }, step.ms);
  }

  function streamRemediation(plan: AgentStep[], idx: number, lift: number) {
    if (idx >= plan.length) {
      set({ status: "remediated" });
      return;
    }
    const step = plan[idx];
    remediationTimer = setTimeout(() => {
      const cur = get();
      const stepLift = step.probDelta;
      const nextAcc = Math.min(99, cur.acceptance + stepLift);
      set({
        emittedSteps: [...cur.emittedSteps, step],
        artifacts: step.artifact ? [...cur.artifacts, step.artifact] : cur.artifacts,
        acceptance: nextAcc,
      });
      streamRemediation(plan, idx + 1, lift);
    }, step.ms);
  }

  function viewModeForStage(stage: string): ViewMode {
    if (stage === "BUILDING") return "build";
    if (stage === "READY") return "ready";
    if (stage === "AWAITING_PREAUTH") return "preauth";
    if (stage === "SUBMITTED") return "adjudicating";
    if (stage === "AT_RISK") return "atrisk";
    return "build";
  }

  return {
    selectedClaimId: null,
    drawerOpen: false,
    viewMode: "build",
    status: "idle",
    steps: [],
    cursor: 0,
    emittedSteps: [],
    artifacts: [],
    acceptance: baseline,
    baseline,
    predictedDtpDays: 31,
    attachMri: true,
    attachConservativeNarrative: true,
    attachSyntaxScore: false,
    channel: null,
    expectedAdjDate: null,
    payloadOverlayOpen: false,
    loadedClaim: null,
    boardRefreshTick: 0,

    openClaim: (id) => {
      clearTimer();
      // Open drawer immediately so the user gets feedback; load the claim async.
      set({
        selectedClaimId: id,
        drawerOpen: true,
        viewMode: "build",
        status: "idle",
        cursor: 0,
        emittedSteps: [],
        artifacts: [],
        acceptance: baseline,
        predictedDtpDays: 31,
        channel: null,
        expectedAdjDate: null,
        loadedClaim: null,
        payloadOverlayOpen: false,
      });

      (async () => {
        const claim = await queryOne<ClaimLike>(
          `SELECT c.id, p.name AS patient_name,
                  c.drg, c.dx, c.los_days, c.gross_idr, c.expected_reimb_idr,
                  c.payor_id, py.name AS payor_name,
                  h.name AS hospital_name, p.ward_class, p.policy_number,
                  c.acceptance_score, c.predicted_dtp_days, c.stage, c.days_in_stage,
                  c.agent_step, c.risk_flag, c.submitted_at
             FROM claims c
             JOIN patients p ON p.id = c.patient_id
             JOIN payors py ON py.id = c.payor_id
             JOIN hospitals h ON h.id = c.hospital_id
            WHERE c.id = ?`,
          [id],
        );
        if (!claim || get().selectedClaimId !== id) return;

        const view = viewModeForStage(claim.stage);
        const accPct = Math.round(claim.acceptance_score * 100);

        if (view === "build") {
          // Live build flow — keep idle, user runs the agent.
          const plan = buildLivePlan(claim);
          set({
            loadedClaim: claim,
            viewMode: view,
            steps: plan,
            status: "idle",
          });
          return;
        }

        if (view === "ready") {
          // Frozen build trace · ready to submit.
          const trace = buildReadyTrace(claim);
          const arts = trace.flatMap((s) => s.artifact ? [s.artifact] : []);
          set({
            loadedClaim: claim,
            viewMode: view,
            emittedSteps: trace,
            artifacts: arts,
            acceptance: accPct,
            predictedDtpDays: claim.predicted_dtp_days ?? 14,
            status: "ready",
          });
          return;
        }

        if (view === "preauth") {
          const trace = buildPreAuthTrace(claim);
          const arts = trace.flatMap((s) => s.artifact ? [s.artifact] : []);
          set({
            loadedClaim: claim,
            viewMode: view,
            emittedSteps: trace,
            artifacts: arts,
            acceptance: accPct,
            predictedDtpDays: claim.predicted_dtp_days ?? 14,
            status: "preauth_wait",
          });
          return;
        }

        if (view === "adjudicating") {
          const trace = buildAdjudicatingTrace(claim);
          const arts = trace.flatMap((s) => s.artifact ? [s.artifact] : []);
          // Reconstruct channel + expected adjudication date for the receipt.
          const channel = buildChannel(claim.payor_id, {
            patient_name: claim.patient_name,
            policy_number: claim.policy_number,
            drg: claim.drg,
            dx: claim.dx,
            los_days: claim.los_days,
            gross_idr: claim.gross_idr,
            expected_reimb_idr: claim.expected_reimb_idr,
            hospital_name: claim.hospital_name,
          });
          // Use the claim's submitted_at to compute the expected adjudication date.
          const submittedAt = claim.submitted_at ? new Date(claim.submitted_at) : new Date();
          const expDate = new Date(submittedAt.getTime() + channel.sla_days * 86400000)
            .toISOString().slice(0, 10);
          set({
            loadedClaim: claim,
            viewMode: view,
            emittedSteps: trace,
            artifacts: arts,
            acceptance: accPct,
            predictedDtpDays: claim.predicted_dtp_days ?? 14,
            status: "submitted",
            channel,
            expectedAdjDate: expDate,
          });
          return;
        }

        if (view === "atrisk") {
          const trace = buildAtRiskTrace(claim);
          const arts = trace.flatMap((s) => s.artifact ? [s.artifact] : []);
          set({
            loadedClaim: claim,
            viewMode: view,
            emittedSteps: trace,
            artifacts: arts,
            acceptance: accPct,
            predictedDtpDays: claim.predicted_dtp_days ?? 14,
            status: "blocked",
          });
          return;
        }
      })();
    },

    closeDrawer: () => {
      clearTimer();
      set({
        drawerOpen: false, status: "idle", cursor: 0, emittedSteps: [], artifacts: [],
        acceptance: baseline, predictedDtpDays: 31, channel: null, expectedAdjDate: null,
        loadedClaim: null, payloadOverlayOpen: false, viewMode: "build",
      });
    },
    reset: () => {
      clearTimer();
      set({
        status: "idle", cursor: 0, emittedSteps: [], artifacts: [],
        acceptance: baseline, predictedDtpDays: 31, channel: null, expectedAdjDate: null,
        payloadOverlayOpen: false,
      });
    },
    start: () => {
      clearTimer();
      const claim = get().loadedClaim;
      if (!claim) return;
      const plan = buildLivePlan(claim);
      set({
        steps: plan,
        status: "running", cursor: 0, emittedSteps: [], artifacts: [],
        acceptance: baseline, predictedDtpDays: 31, channel: null, expectedAdjDate: null,
      });
      tick();
    },
    pause: () => {
      clearTimer();
      set({ status: "paused" });
    },
    resume: () => {
      set({ status: "running" });
      tick();
    },
    toggleAttach: (key) => {
      set({ [key]: !get()[key] } as Partial<State>);
    },
    submit: async () => {
      clearTimer();
      const claim = get().loadedClaim;
      if (!claim) return;

      const channel = buildChannel(claim.payor_id, {
        patient_name: claim.patient_name,
        policy_number: claim.policy_number,
        drg: claim.drg,
        dx: claim.dx,
        los_days: claim.los_days,
        gross_idr: claim.gross_idr,
        expected_reimb_idr: claim.expected_reimb_idr,
        hospital_name: claim.hospital_name,
      });

      const expDate = expectedAdjudicationDate(channel.sla_days);
      set({ status: "dispatching", channel, expectedAdjDate: expDate });
      streamDispatch(buildDispatchPlan(channel), 0);

      try {
        await exec(
          `UPDATE claims SET stage = 'SUBMITTED', status = 'SUBMITTED', days_in_stage = 0,
                              submitted_at = ?, agent_step = ?
            WHERE id = ?`,
          [
            new Date().toISOString(),
            `Submitted via ${channel.label} · ack ${channel.ack_id}`,
            claim.id,
          ],
        );
        set({ boardRefreshTick: get().boardRefreshTick + 1 });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("submit persistence failed", e);
      }
    },
    runRemediation: () => {
      clearTimer();
      const claim = get().loadedClaim;
      if (!claim) return;
      const plan = buildRemediationPlan(claim);
      if (!plan) return;
      set({ status: "remediating" });
      streamRemediation(plan.steps, 0, plan.liftPts);
    },
    runHumanUpload: () => {
      clearTimer();
      const claim = get().loadedClaim;
      if (!claim) return;
      const plan = buildRemediationPlan(claim);
      if (!plan) return;
      set({ status: "remediating" });
      streamRemediation(plan.humanUploadSteps, 0, plan.liftPts);
    },
    openPayloadOverlay: () => set({ payloadOverlayOpen: true }),
    closePayloadOverlay: () => set({ payloadOverlayOpen: false }),
  };
});
