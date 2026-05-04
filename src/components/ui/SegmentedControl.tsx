import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/70 p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-[1] flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
              active ? "text-[var(--color-canvas-deep)]" : "text-ink-mute hover:text-ink-soft",
            )}
          >
            {active && (
              <motion.span
                layoutId="seg-active"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute inset-0 -z-[1] rounded-full bg-[var(--color-champagne)]"
              />
            )}
            <span>{o.label}</span>
            {o.hint && (
              <span className={cn("font-mono-tight text-[10px]", active ? "opacity-70" : "opacity-50")}>{o.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
