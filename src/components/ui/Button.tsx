import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = Omit<HTMLMotionProps<"button">, "ref"> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--color-champagne)] text-[var(--color-canvas-deep)] hover:brightness-105 active:brightness-95 shadow-glow-champagne",
  ghost:
    "text-ink-soft hover:bg-[var(--color-panel-2)]/70",
  outline:
    "border border-line-strong text-ink-soft hover:bg-[var(--color-panel-2)]/60",
  soft:
    "bg-[var(--color-panel-2)] text-ink-soft hover:bg-[var(--color-panel-raised)]",
  danger:
    "bg-[var(--color-coral)]/15 text-[var(--color-coral)] hover:bg-[var(--color-coral)]/25 border border-[var(--color-coral)]/30",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-lg",
  lg: "h-11 px-5 text-[14px] gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "soft", size = "md", children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -0.5 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "inline-flex items-center justify-center font-medium tracking-tight transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-champagne)]/60",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  ),
);
Button.displayName = "Button";
