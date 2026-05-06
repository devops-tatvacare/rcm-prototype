import { create } from "zustand";

/**
 * Theme controller.
 *
 * Modes:
 *   - "system": follow the OS preference; reacts live to OS theme changes.
 *   - "light":  force light theme.
 *   - "dark":   force dark theme.
 *
 * Implementation notes:
 *   - The actual theme is applied by setting `data-theme="light"` or
 *     `data-theme="dark"` on <html>. The CSS in `global.css` keys on this
 *     attribute (the @theme block is dark by default; `:root[data-theme="light"]`
 *     overrides it).
 *   - Persisted to localStorage under "tatvacare_theme".
 *   - `initTheme()` is called once at module-load from main.tsx so the
 *     attribute is set before first paint (no flash).
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "tatvacare_theme";
const ORDER: ThemeMode[] = ["system", "light", "dark"];

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

type ThemeState = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
};

export const useTheme = create<ThemeState>((set, get) => ({
  mode: readStoredMode(),
  resolved: resolve(readStoredMode()),
  setMode: (mode) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    const resolved = resolve(mode);
    applyToDocument(resolved);
    set({ mode, resolved });
  },
  cycle: () => {
    const idx = ORDER.indexOf(get().mode);
    const next = ORDER[(idx + 1) % ORDER.length];
    get().setMode(next);
  },
}));

/**
 * Apply the persisted theme synchronously, and subscribe to OS theme changes
 * so that "system" mode reacts live. Call this exactly once at module top of
 * main.tsx (before React renders) to avoid a flash of the wrong theme.
 */
export function initTheme() {
  if (typeof window === "undefined") return;
  const mode = readStoredMode();
  applyToDocument(resolve(mode));

  // React to live OS theme changes whenever mode === "system".
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    const current = useTheme.getState().mode;
    if (current === "system") {
      const resolved = resolve("system");
      applyToDocument(resolved);
      useTheme.setState({ resolved });
    }
  };
  // Modern + legacy listener APIs.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
  } else if (typeof (mql as any).addListener === "function") {
    (mql as any).addListener(onChange);
  }
}
