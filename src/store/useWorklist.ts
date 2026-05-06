import { create } from "zustand";
import { loadWorklist, type PatientItem, type Silo, type SubStage } from "@/lib/worklistAggregator";

export type ViewMode = "kanban" | "table";

export type FilterKey = "atRisk" | "slaSoon" | "awaitingHuman" | "highValue" | "slaRisk" | "docGap";

type State = {
  items: PatientItem[];
  loaded: boolean;
  silo: Silo;
  viewMode: ViewMode;
  filters: Record<FilterKey, boolean>;
  // When set, only items in this sub-stage are shown.
  subStage: SubStage | null;
  search: string;
  refreshTick: number;
  load: () => Promise<void>;
  setSilo: (s: Silo) => void;
  setViewMode: (v: ViewMode) => void;
  toggleFilter: (k: FilterKey) => void;
  setFilters: (f: Partial<Record<FilterKey, boolean>>) => void;
  setSubStage: (s: SubStage | null) => void;
  setSearch: (q: string) => void;
  clearFilters: () => void;
  bumpRefresh: () => void;
};

const EMPTY_FILTERS: Record<FilterKey, boolean> = {
  atRisk: false,
  slaSoon: false,
  awaitingHuman: false,
  highValue: false,
  slaRisk: false,
  docGap: false,
};

export const useWorklist = create<State>((set, get) => ({
  items: [],
  loaded: false,
  silo: "preauth",
  viewMode: "kanban",
  filters: { ...EMPTY_FILTERS },
  subStage: null,
  search: "",
  refreshTick: 0,

  load: async () => {
    const items = await loadWorklist();
    set({ items, loaded: true });
  },
  // Switching silo wipes silo-scoped filters (subStage) but keeps generic ones.
  setSilo: (s) => set({ silo: s, subStage: null }),
  setViewMode: (v) => set({ viewMode: v }),
  toggleFilter: (k) => set((s) => ({ filters: { ...s.filters, [k]: !s.filters[k] } })),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setSubStage: (s) => set({ subStage: s }),
  setSearch: (q) => set({ search: q }),
  clearFilters: () => set({ filters: { ...EMPTY_FILTERS }, subStage: null, search: "" }),
  bumpRefresh: () => {
    set({ refreshTick: get().refreshTick + 1 });
    get().load();
  },
}));

export function applyFilters(items: PatientItem[], state: Pick<State, "filters" | "search" | "silo" | "subStage">): PatientItem[] {
  const q = state.search.trim().toLowerCase();
  return items.filter((i) => {
    if (i.silo !== state.silo) return false;
    if (state.subStage && i.subStage !== state.subStage) return false;
    if (state.filters.atRisk && !i.riskLabel) return false;
    if (state.filters.slaSoon && (i.sla_hours == null || i.sla_hours > 24)) return false;
    if (state.filters.awaitingHuman && !i.awaiting_human) return false;
    if (state.filters.highValue && i.amount_idr < 100_000_000) return false;
    // SLA risk: long-aging items — sla_hours present AND > 5 days (120h).
    if (state.filters.slaRisk && (i.sla_hours == null || i.sla_hours <= 5 * 24)) return false;
    // Doc gap: packet/insurer-query items where doc completion is below 80%.
    if (state.filters.docGap && i.doc_completion_pct >= 80) return false;
    if (q) {
      const hay = `${i.patient_name} ${i.drg} ${i.dx} ${i.payor_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
