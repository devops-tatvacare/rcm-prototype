import { create } from "zustand";

// Shared overlay state for the thread-evidence drawer + single-thread drawer.
// Used by Payor Intelligence (rule library, ingestion list) and the
// Packet Builder reasoning trace (rule-firing steps).
type State = {
  // Rule-list mode: opens the evidence drawer for a given rule id.
  ruleId: string | null;
  // Single-thread mode: stacks above the rule drawer (level 2).
  threadId: string | null;

  openRule: (ruleId: string) => void;
  openThread: (threadId: string) => void;
  closeThread: () => void;
  closeAll: () => void;
};

export const useEvidence = create<State>((set) => ({
  ruleId: null,
  threadId: null,
  openRule: (ruleId) => set({ ruleId, threadId: null }),
  openThread: (threadId) => set({ threadId }),
  closeThread: () => set({ threadId: null }),
  closeAll: () => set({ ruleId: null, threadId: null }),
}));
