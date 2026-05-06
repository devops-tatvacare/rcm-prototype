import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, Building2, RefreshCw, ListChecks, ChevronLeft, ChevronRight, Monitor, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { resetDb } from "@/lib/db";
import { useTheme } from "@/store/useTheme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type NavItem = { to: string; label: string; Icon: any };
type NavGroup = { items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/", label: "Command Center", Icon: LayoutDashboard },
      { to: "/worklist", label: "Worklist", Icon: ListChecks },
      { to: "/payors", label: "Payor Intelligence", Icon: Building2 },
    ],
  },
];

const STORAGE_KEY = "tatvacare_sidebar_collapsed";
const RESET_TOAST_KEY = "tatvacare_reset_toast";
const WORKLIST_STATE_KEY = "tatvacare_worklist_state_v1";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetToastVisible, setResetToastVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(RESET_TOAST_KEY) !== "1") return;
    window.sessionStorage.removeItem(RESET_TOAST_KEY);
    setResetToastVisible(true);
    const timer = window.setTimeout(() => setResetToastVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  const themeMode = useTheme((s) => s.mode);
  const cycleTheme = useTheme((s) => s.cycle);
  const ThemeIcon = themeMode === "system" ? Monitor : themeMode === "light" ? Sun : Moon;
  const themeLabel = themeMode === "system" ? "System" : themeMode === "light" ? "Light" : "Dark";

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 244 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="relative flex h-full shrink-0 flex-col border-r border-line-soft bg-canvas-deep/80 backdrop-blur-md"
    >
      {/* Collapse toggle — sits on the right edge of the sidebar */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-7 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-[var(--color-canvas-deep)] text-ink-mute shadow-lift transition-colors hover:border-[var(--color-champagne)]/60 hover:text-[var(--color-champagne)]"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* Brand */}
      <div className={cn("flex items-center gap-3 pt-5 pb-4", collapsed ? "justify-center px-3" : "px-5")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-champagne)] text-[var(--color-canvas-deep)] shadow-glow-champagne">
          <span className="font-display text-[18px] font-bold leading-none">T</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="truncate font-display text-[16px] tracking-tight text-ink">TatvaCare</span>
            <span className="truncate font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">Claims Engine</span>
          </div>
        )}
      </div>

      <div className={cn("hairline-x", collapsed ? "mx-3" : "mx-5")} />

      {/* Nav — grouped by RCM cycle stage */}
      <nav className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
        {GROUPS.map((group, groupIdx) => (
          <div key={groupIdx} className="flex flex-col gap-0.5">
            {group.items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                title={collapsed ? label : undefined}
                className="relative"
              >
                {({ isActive }) => (
                  <motion.div
                    layout
                    whileHover={{ x: collapsed ? 0 : 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg transition-colors",
                      collapsed ? "h-10 justify-center" : "px-3 py-2",
                      isActive
                        ? "bg-[var(--color-panel-2)]/80 text-ink"
                        : "text-ink-mute hover:bg-[var(--color-panel)]/60 hover:text-ink-soft",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-rail"
                        className="absolute -left-0.5 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[var(--color-champagne)]"
                      />
                    )}
                    <Icon
                      size={15}
                      strokeWidth={1.6}
                      className={cn(
                        "shrink-0 transition-colors",
                        isActive ? "text-[var(--color-champagne)]" : "text-ink-faint group-hover:text-ink-mute",
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate text-[12.5px] font-medium tracking-tight">{label}</span>
                    )}
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("flex flex-col gap-0.5 border-t border-line-soft", collapsed ? "p-2" : "p-3")}>
        <button
          onClick={cycleTheme}
          title={collapsed ? `Theme: ${themeLabel}` : undefined}
          aria-label={`Theme: ${themeLabel}. Click to cycle.`}
          className={cn(
            "group flex w-full items-center rounded-md text-[11.5px] text-ink-faint hover:text-ink-mute",
            collapsed ? "h-9 justify-center" : "gap-2 px-2 py-1.5",
          )}
        >
          <ThemeIcon size={collapsed ? 13 : 12} className="shrink-0" />
          {!collapsed && <span>{themeLabel}</span>}
        </button>
        <button
          onClick={() => setConfirmResetOpen(true)}
          title={collapsed ? "Reset data" : undefined}
          className={cn(
            "group flex w-full items-center rounded-md text-[11.5px] text-ink-faint hover:text-ink-mute",
            collapsed ? "h-9 justify-center" : "gap-2 px-2 py-1.5",
          )}
        >
          <RefreshCw size={collapsed ? 13 : 12} className="shrink-0 transition-transform group-hover:-rotate-180 duration-500" />
          {!collapsed && <span>Reset data</span>}
        </button>
      </div>

      <AnimatePresence>
        {resetToastVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={cn(
              "absolute z-40 rounded-lg border border-[var(--color-emerald)]/30 bg-[var(--color-panel)] px-3 py-2 shadow-lift",
              collapsed ? "bottom-16 left-2 right-2" : "bottom-16 left-3 right-3",
            )}
          >
            <div className="font-mono-tight text-[10.5px] text-[var(--color-emerald)]">
              Demo reset to clean state.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={confirmResetOpen} onClose={() => setConfirmResetOpen(false)} width={460}>
        <div className="border-b border-line-soft px-5 py-3">
          <div className="eyebrow">Reset</div>
          <div className="font-display text-[18px] tracking-tight text-ink">Reset local data</div>
        </div>
        <div className="px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
          Clear local state and reload the seeded showcase patients, payor rules, and correspondence threads.
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line-soft bg-[var(--color-canvas-deep)]/40 px-5 py-3">
          <Button size="sm" variant="ghost" onClick={() => setConfirmResetOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              window.localStorage.removeItem(WORKLIST_STATE_KEY);
              window.sessionStorage.setItem(RESET_TOAST_KEY, "1");
              await resetDb();
              window.location.reload();
            }}
          >
            Reset data
          </Button>
        </div>
      </Modal>
    </motion.aside>
  );
}
