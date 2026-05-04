import { create } from "zustand";

type State = {
  drawerOpen: boolean;
  selectedId: string | null;
  gopSubmitted: Record<string, boolean>;
  consentSigned: Record<string, boolean>;
  depositCollected: Record<string, boolean>;
  open: (id: string) => void;
  close: () => void;
  submitGop: (id: string) => void;
  signConsent: (id: string) => void;
  collectDeposit: (id: string) => void;
};

export const useClearances = create<State>((set) => ({
  drawerOpen: false,
  selectedId: null,
  gopSubmitted: {},
  consentSigned: {},
  depositCollected: {},
  open: (id) => set({ drawerOpen: true, selectedId: id }),
  close: () => set({ drawerOpen: false }),
  submitGop: (id) => set((s) => ({ gopSubmitted: { ...s.gopSubmitted, [id]: true } })),
  signConsent: (id) => set((s) => ({ consentSigned: { ...s.consentSigned, [id]: true } })),
  collectDeposit: (id) => set((s) => ({ depositCollected: { ...s.depositCollected, [id]: true } })),
}));
