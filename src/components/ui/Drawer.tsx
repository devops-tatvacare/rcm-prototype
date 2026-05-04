import { type ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

// Drawer with level-based z-stacking. Level 2 sits over level 1 so a secondary
// drawer (e.g. the payload inspector) can overlay an open primary drawer.
export function Drawer({
  open,
  onClose,
  children,
  width = 540,
  level = 1,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  level?: 1 | 2;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  const dimClass = level === 2 ? "z-[55]" : "z-40";
  const drawerClass = level === 2 ? "z-[60]" : "z-50";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className={`fixed inset-0 ${dimClass} bg-black/45 backdrop-blur-[2px]`}
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            style={{ width }}
            className={`fixed inset-y-0 right-0 ${drawerClass} flex flex-col border-l border-line-strong bg-[var(--color-canvas)] shadow-lift`}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ink-mute hover:bg-[var(--color-panel-2)] hover:text-ink"
              aria-label="Close"
            >
              <X size={15} />
            </button>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
