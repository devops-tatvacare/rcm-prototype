import { create } from "zustand";
import { exec, queryOne } from "@/lib/db";
import { composeAppealLetter, type DenialDetail } from "@/lib/appealComposer";

type State = {
  drawerOpen: boolean;
  selectedDenialId: string | null;
  draftedSubmitted: Record<string, boolean>;
  // Per-denial drafting state — true while the agent is composing.
  drafting: Record<string, boolean>;
  // Bumps when a new draft is persisted, so the panel re-fetches from DB.
  draftTick: number;
  openDenial: (id: string) => void;
  closeDrawer: () => void;
  markSubmitted: (id: string) => void;
  draftAppeal: (denialId: string) => Promise<void>;
  redraftAppeal: (denialId: string) => Promise<void>;
};

async function loadDenialDetail(id: string): Promise<DenialDetail | null> {
  return queryOne<DenialDetail>(
    `SELECT d.id, d.claim_id,
            p.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex,
            d.payor_id, py.name AS payor_name,
            h.name AS hospital_name,
            d.category, d.reason_code, d.reason_text,
            d.denied_amount_idr, d.denied_at, d.appeal_deadline_at,
            d.success_probability, d.root_cause_step, d.recurring_pattern_id
       FROM denials d
       JOIN claims c ON c.id = d.claim_id
       JOIN patients p ON p.id = c.patient_id
       JOIN payors py ON py.id = d.payor_id
       JOIN hospitals h ON h.id = d.hospital_id
      WHERE d.id = ?`,
    [id],
  );
}

export const useDenials = create<State>((set, get) => ({
  drawerOpen: false,
  selectedDenialId: null,
  draftedSubmitted: {},
  drafting: {},
  draftTick: 0,
  openDenial: (id) => set({ drawerOpen: true, selectedDenialId: id }),
  closeDrawer: () => set({ drawerOpen: false }),
  markSubmitted: (id) =>
    set((s) => ({ draftedSubmitted: { ...s.draftedSubmitted, [id]: true } })),

  draftAppeal: async (denialId) => {
    set((s) => ({ drafting: { ...s.drafting, [denialId]: true } }));
    try {
      const detail = await loadDenialDetail(denialId);
      if (!detail) return;

      const composed = composeAppealLetter(detail);

      // Compose feels real if we wait a tick (~1.4s).
      await new Promise((r) => setTimeout(r, 1400));

      const newId = `ad_${Date.now()}_${denialId}`;
      await exec(
        `INSERT INTO appeal_drafts
           (id, denial_id, letter_md, attachments_json, drafted_at, submitted_at, outcome)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
        [
          newId,
          denialId,
          composed.letter_md,
          JSON.stringify(composed.attachments),
          new Date().toISOString(),
        ],
      );
      // Move denial to DRAFTING status so the queue + KPIs reflect it.
      await exec(
        `UPDATE denials SET appeal_status = 'DRAFTING' WHERE id = ?`,
        [denialId],
      );

      set((s) => ({
        drafting: { ...s.drafting, [denialId]: false },
        draftTick: s.draftTick + 1,
      }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("draftAppeal failed", e);
      set((s) => ({ drafting: { ...s.drafting, [denialId]: false } }));
    }
  },

  redraftAppeal: async (denialId) => {
    set((s) => ({ drafting: { ...s.drafting, [denialId]: true } }));
    try {
      const detail = await loadDenialDetail(denialId);
      if (!detail) return;

      const composed = composeAppealLetter(detail);
      await new Promise((r) => setTimeout(r, 1200));

      // Replace any existing draft for this denial.
      await exec(`DELETE FROM appeal_drafts WHERE denial_id = ?`, [denialId]);
      const newId = `ad_${Date.now()}_${denialId}`;
      await exec(
        `INSERT INTO appeal_drafts
           (id, denial_id, letter_md, attachments_json, drafted_at, submitted_at, outcome)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
        [
          newId,
          denialId,
          composed.letter_md,
          JSON.stringify(composed.attachments),
          new Date().toISOString(),
        ],
      );

      set((s) => ({
        drafting: { ...s.drafting, [denialId]: false },
        draftTick: s.draftTick + 1,
        // Re-drafting clears any prior submitted-here flag.
        draftedSubmitted: { ...s.draftedSubmitted, [denialId]: false },
      }));
      // hush
      void get;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("redraftAppeal failed", e);
      set((s) => ({ drafting: { ...s.drafting, [denialId]: false } }));
    }
  },
}));
