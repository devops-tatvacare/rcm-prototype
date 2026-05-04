import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function ToggleChip({
  active,
  onToggle,
  label,
  hint,
  disabled,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className={cn(
        // Fixed height keeps the row from shifting when toggled.
        "group inline-flex h-[26px] items-center gap-2 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors",
        active && !disabled
          ? "border-[var(--color-emerald)]/40 bg-[var(--color-emerald)]/10 text-[var(--color-emerald-soft)]"
          : disabled
            ? "border-line-soft bg-[var(--color-canvas-deep)]/40 text-ink-faint cursor-not-allowed"
            : "border-line-soft bg-[var(--color-canvas-deep)]/60 text-ink-mute hover:text-ink-soft",
        className,
      )}
    >
      {/* Icon slot is always 14px — width never changes between states */}
      <span
        className={cn(
          "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full transition-colors",
          active && !disabled
            ? "bg-[var(--color-emerald)] text-[var(--color-canvas-deep)]"
            : "border border-line-strong",
        )}
      >
        {active && !disabled && <Check size={10} strokeWidth={3} />}
      </span>
      <span className="leading-none">{label}</span>
      {hint && <span className="font-mono-tight text-[10px] leading-none text-ink-faint">{hint}</span>}
    </motion.button>
  );
}
