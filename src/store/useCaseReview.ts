import { create } from "zustand";

type State = {
  drawerOpen: boolean;
  selectedId: string | null;
  extensionSubmitted: Record<string, boolean>;
  open: (id: string) => void;
  close: () => void;
  submitExtension: (id: string) => void;
};

export const useCaseReview = create<State>((set) => ({
  drawerOpen: false,
  selectedId: null,
  extensionSubmitted: {},
  open: (id) => set({ drawerOpen: true, selectedId: id }),
  close: () => set({ drawerOpen: false }),
  submitExtension: (id) => set((s) => ({ extensionSubmitted: { ...s.extensionSubmitted, [id]: true } })),
}));
