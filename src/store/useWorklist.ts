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
  lastViewedPatientId: string | null;
  refreshTick: number;
  load: () => Promise<void>;
  setSilo: (s: Silo) => void;
  setViewMode: (v: ViewMode) => void;
  toggleFilter: (k: FilterKey) => void;
  setFilters: (f: Partial<Record<FilterKey, boolean>>) => void;
  setSubStage: (s: SubStage | null) => void;
  setSearch: (q: string) => void;
  setLastViewedPatientId: (patientId: string | null) => void;
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

const STORAGE_KEY = "tatvacare_worklist_state_v1";

type PersistedState = Pick<
  State,
  "silo" | "viewMode" | "filters" | "subStage" | "search" | "lastViewedPatientId"
>;

function readPersistedState(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      silo:
        parsed.silo === "preauth" || parsed.silo === "concurrent" || parsed.silo === "postdischarge"
          ? parsed.silo
          : undefined,
      viewMode: parsed.viewMode === "kanban" || parsed.viewMode === "table" ? parsed.viewMode : undefined,
      filters: parsed.filters ? { ...EMPTY_FILTERS, ...parsed.filters } : undefined,
      subStage: parsed.subStage ?? null,
      search: typeof parsed.search === "string" ? parsed.search : undefined,
      lastViewedPatientId: typeof parsed.lastViewedPatientId === "string" ? parsed.lastViewedPatientId : null,
    };
  } catch {
    return {};
  }
}

function persistState(state: Pick<State, keyof PersistedState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      silo: state.silo,
      viewMode: state.viewMode,
      filters: state.filters,
      subStage: state.subStage,
      search: state.search,
      lastViewedPatientId: state.lastViewedPatientId,
    } satisfies PersistedState),
  );
}

const persisted = readPersistedState();

export const useWorklist = create<State>((set, get) => ({
  items: [],
  loaded: false,
  silo: persisted.silo ?? "preauth",
  viewMode: persisted.viewMode ?? "kanban",
  filters: persisted.filters ?? { ...EMPTY_FILTERS },
  subStage: persisted.subStage ?? null,
  search: persisted.search ?? "",
  lastViewedPatientId: persisted.lastViewedPatientId ?? null,
  refreshTick: 0,

  load: async () => {
    const items = await loadWorklist();
    set({ items, loaded: true });
  },
  // Switching silo wipes silo-scoped filters (subStage) but keeps generic ones.
  setSilo: (s) => set((state) => {
    const next = { ...state, silo: s, subStage: null };
    persistState(next);
    return { silo: s, subStage: null };
  }),
  setViewMode: (v) => set((state) => {
    const next = { ...state, viewMode: v };
    persistState(next);
    return { viewMode: v };
  }),
  toggleFilter: (k) => set((state) => {
    const next = { ...state, filters: { ...state.filters, [k]: !state.filters[k] } };
    persistState(next);
    return { filters: next.filters };
  }),
  setFilters: (f) => set((state) => {
    const next = { ...state, filters: { ...state.filters, ...f } };
    persistState(next);
    return { filters: next.filters };
  }),
  setSubStage: (s) => set((state) => {
    const next = { ...state, subStage: s };
    persistState(next);
    return { subStage: s };
  }),
  setSearch: (q) => set((state) => {
    const next = { ...state, search: q };
    persistState(next);
    return { search: q };
  }),
  setLastViewedPatientId: (patientId) => set((state) => {
    const next = { ...state, lastViewedPatientId: patientId };
    persistState(next);
    return { lastViewedPatientId: patientId };
  }),
  clearFilters: () => set((state) => {
    const next = { ...state, filters: { ...EMPTY_FILTERS }, subStage: null, search: "" };
    persistState(next);
    return { filters: next.filters, subStage: null, search: "" };
  }),
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
