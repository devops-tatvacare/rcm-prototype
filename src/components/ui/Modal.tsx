import { type ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// Centered modal — stacks above any open drawer. ESC + backdrop close.
export function Modal({
  open,
  onClose,
  children,
  width = 720,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[3px]"
          />
          <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              style={{ width }}
              className={cn(
                "pointer-events-auto relative max-h-[88vh] overflow-hidden rounded-xl border border-line-strong bg-[var(--color-canvas)] shadow-lift",
                className,
              )}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ink-mute hover:bg-[var(--color-panel-2)] hover:text-ink"
                aria-label="Close"
              >
                <X size={15} />
              </button>
              <div className="flex max-h-[88vh] flex-col overflow-hidden">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
