import { create } from "zustand";

type State = {
  hospitalName: string;
  country: "ID" | "MY" | "TH" | "PH";
  envBadge: "Demo · Indonesia";
};

export const useAppStore = create<State>(() => ({
  hospitalName: "RS Cendana Jakarta",
  country: "ID",
  envBadge: "Demo · Indonesia",
}));
