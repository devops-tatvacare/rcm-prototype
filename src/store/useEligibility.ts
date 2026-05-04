import { create } from "zustand";
import { exec } from "@/lib/db";
import {
  SAMPLE_CARDS,
  buildLivePlan,
  buildCachedPlan,
  type SampleCard,
  type LiveStep,
  type SimMode,
} from "@/lib/eligibilityIntake";

export type { LiveStep, SimMode };

// drawer flow state machine
//   idle      — drawer closed
//   completed — opened by clicking a queue row
//   intake    — opened by clicking "+ New verification" (card pick → review → run)
//   sim       — running a live trace (entered from intake)
export type Flow = "idle" | "completed" | "intake" | "sim";
export type IntakeStep = "pick" | "review";

// Re-export legacy plans so existing imports don't break (they default to the
// happy-path live trace + the canonical cached path for sample card 1).
const _samp1 = SAMPLE_CARDS[0];
export const LIVE_PLAN: LiveStep[] = buildLivePlan(_samp1);
export const CACHED_PLAN: LiveStep[] = buildCachedPlan(_samp1);

type State = {
  flow: Flow;
  drawerOpen: boolean;
  // queue-row drawer
  selectedCheckId: string | null;
  // intake drawer
  intakeStep: IntakeStep;
  intakeCard: SampleCard | null;
  ocrProgress: number;
  // simulation
  simRunning: boolean;
  simCursor: number;
  simEmitted: LiveStep[];
  simElapsedMs: number;
  simMode: SimMode;
  simPlan: LiveStep[];
  simCard: SampleCard | null;
  simInsertedId: string | null;
  // queue refresh signal — bumps when a new check has been persisted
  queueRefreshTick: number;
  // pulse target for the queue (clears after a few seconds)
  pulseId: string | null;
  // ── actions ────────────────────────────────────────────────────────────
  openCheck: (id: string) => void;
  closeDrawer: () => void;
  openIntake: () => void;
  selectIntakeCard: (cardId: string) => void;
  resetIntakeCard: () => void;
  runVerification: (mode: SimMode) => void;
  // legacy/back-compat: starts a sim with the first sample card
  startSimulation: (mode?: SimMode) => void;
  resetSimulation: () => void;
};

export const useEligibility = create<State>((set, get) => {
  let stepTimer: ReturnType<typeof setTimeout> | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let ocrTimer: ReturnType<typeof setInterval> | null = null;
  let pulseTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
    if (ocrTimer) { clearInterval(ocrTimer); ocrTimer = null; }
  }

  // Drives one step of the trace, then schedules the next.
  function tick() {
    const s = get();
    if (!s.simRunning) return;
    const plan = s.simPlan;
    if (s.simCursor >= plan.length) {
      finishSimulation();
      return;
    }
    const step = plan[s.simCursor];
    stepTimer = setTimeout(() => {
      const cur = get();
      if (!cur.simRunning) return;
      set({
        simCursor: cur.simCursor + 1,
        simEmitted: [...cur.simEmitted, step],
      });
      tick();
    }, step.ms);
  }

  // On completion: persist the patient (INSERT OR IGNORE) + the new
  // eligibility_checks row, then bump the queue refresh tick.
  async function finishSimulation() {
    const s = get();
    set({ simRunning: false });
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }

    const card = s.simCard;
    if (!card) return;

    const checkId = `chk_${Date.now()}_${card.id}`;
    const tatSec = Math.max(1, Math.round(s.simElapsedMs / 1000));
    const startedAt = new Date(Date.now() - s.simElapsedMs).toISOString();
    const completedAt = new Date().toISOString();

    // Cached path always lands on a provisional/cached source; the underlying
    // status comes from the card's resolved state.
    const status = s.simMode === "cached"
      ? (card.result.status === "LAPSED" ? "LAPSED" : "ACTIVE")
      : card.result.status;
    const source = s.simMode === "cached" ? "CACHED" : "LIVE_API";

    // Cached path inflates dispute risk per the spec ("claim risk +0.18").
    const disputeRisk = s.simMode === "cached"
      ? Math.min(1, card.result.dispute_risk_score + 0.18)
      : card.result.dispute_risk_score;

    try {
      await exec(
        `INSERT OR IGNORE INTO patients (id, mrn, name, age, sex, national_id, policy_number, payor_id, ward_class)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          card.patient_id, card.mrn, card.patient_name, card.patient_age, card.patient_sex,
          card.national_id_masked, card.policy_number, card.payor_id, card.ward_class,
        ],
      );
      await exec(
        `INSERT INTO eligibility_checks
           (id, patient_id, payor_id, hospital_id, status, source,
            started_at, completed_at, tat_seconds,
            annual_limit_remaining_idr, annual_limit_total_idr,
            room_class_entitlement, pre_auth_required, pre_auth_status,
            cob_primary_payor, dispute_risk_score, exclusions_json,
            scheduled_admission_at, planned_procedure)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          checkId, card.patient_id, card.payor_id, card.hospital_id, status, source,
          startedAt, completedAt, tatSec,
          card.result.annual_limit_remaining_idr, card.result.annual_limit_total_idr,
          card.result.room_class_entitlement, card.result.pre_auth_required, card.result.pre_auth_status,
          card.result.cob_primary_payor, disputeRisk, JSON.stringify(card.result.exclusions),
          card.scheduled_admission_at, card.planned_procedure,
        ],
      );
      set({
        simInsertedId: checkId,
        queueRefreshTick: get().queueRefreshTick + 1,
        pulseId: checkId,
      });
      // Pulse decays after 4s.
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => set({ pulseId: null }), 4000);
    } catch (e) {
      // Don't block the UI on persistence errors — the trace remains visible.
      // eslint-disable-next-line no-console
      console.error("eligibility persistence failed", e);
    }
  }

  return {
    flow: "idle",
    drawerOpen: false,
    selectedCheckId: null,
    intakeStep: "pick",
    intakeCard: null,
    ocrProgress: 0,
    simRunning: false,
    simCursor: 0,
    simEmitted: [],
    simElapsedMs: 0,
    simMode: "live" as SimMode,
    simPlan: [],
    simCard: null,
    simInsertedId: null,
    queueRefreshTick: 0,
    pulseId: null,

    openCheck: (id) => {
      clearTimers();
      set({
        flow: "completed",
        drawerOpen: true,
        selectedCheckId: id,
        intakeStep: "pick",
        intakeCard: null,
        ocrProgress: 0,
        simRunning: false,
        simCursor: 0,
        simEmitted: [],
        simElapsedMs: 0,
        simPlan: [],
        simCard: null,
        simInsertedId: null,
      });
    },

    closeDrawer: () => {
      clearTimers();
      set({
        flow: "idle",
        drawerOpen: false,
        selectedCheckId: null,
        intakeStep: "pick",
        intakeCard: null,
        ocrProgress: 0,
        simRunning: false,
        simCursor: 0,
        simEmitted: [],
        simElapsedMs: 0,
        simPlan: [],
        simCard: null,
        simInsertedId: null,
      });
    },

    openIntake: () => {
      clearTimers();
      set({
        flow: "intake",
        drawerOpen: true,
        selectedCheckId: null,
        intakeStep: "pick",
        intakeCard: null,
        ocrProgress: 0,
        simRunning: false,
        simCursor: 0,
        simEmitted: [],
        simElapsedMs: 0,
        simPlan: [],
        simCard: null,
        simInsertedId: null,
      });
    },

    selectIntakeCard: (cardId) => {
      const card = SAMPLE_CARDS.find((c) => c.id === cardId) ?? null;
      if (!card) return;
      // Animate OCR progress from 0 → 100 over ~1.4s. Fields fade in as
      // thresholds cross (consumed by IntakeView).
      if (ocrTimer) clearInterval(ocrTimer);
      set({ intakeCard: card, intakeStep: "review", ocrProgress: 0 });
      const start = Date.now();
      const total = 1400;
      ocrTimer = setInterval(() => {
        const pct = Math.min(100, Math.round(((Date.now() - start) / total) * 100));
        set({ ocrProgress: pct });
        if (pct >= 100 && ocrTimer) {
          clearInterval(ocrTimer);
          ocrTimer = null;
        }
      }, 60);
    },

    resetIntakeCard: () => {
      if (ocrTimer) { clearInterval(ocrTimer); ocrTimer = null; }
      set({ intakeStep: "pick", intakeCard: null, ocrProgress: 0 });
    },

    runVerification: (mode) => {
      const card = get().intakeCard;
      if (!card) return;
      clearTimers();
      const plan = mode === "cached" ? buildCachedPlan(card) : buildLivePlan(card);
      set({
        flow: "sim",
        drawerOpen: true,
        simRunning: true,
        simCursor: 0,
        simEmitted: [],
        simElapsedMs: 0,
        simMode: mode,
        simPlan: plan,
        simCard: card,
        simInsertedId: null,
      });
      const start = Date.now();
      elapsedTimer = setInterval(() => {
        set({ simElapsedMs: Date.now() - start });
      }, 80);
      tick();
    },

    // Legacy entry: starts a sim with the first sample card so any old caller
    // still works during the refactor. New callers should use openIntake →
    // selectIntakeCard → runVerification.
    startSimulation: (mode = "live") => {
      const card = SAMPLE_CARDS[0];
      clearTimers();
      const plan = mode === "cached" ? buildCachedPlan(card) : buildLivePlan(card);
      set({
        flow: "sim",
        drawerOpen: true,
        intakeCard: card,
        intakeStep: "review",
        ocrProgress: 100,
        simRunning: true,
        simCursor: 0,
        simEmitted: [],
        simElapsedMs: 0,
        simMode: mode,
        simPlan: plan,
        simCard: card,
        simInsertedId: null,
      });
      const start = Date.now();
      elapsedTimer = setInterval(() => {
        set({ simElapsedMs: Date.now() - start });
      }, 80);
      tick();
    },

    resetSimulation: () => {
      clearTimers();
      set({
        simRunning: false,
        simCursor: 0,
        simEmitted: [],
        simElapsedMs: 0,
        simPlan: [],
      });
    },
  };
});
