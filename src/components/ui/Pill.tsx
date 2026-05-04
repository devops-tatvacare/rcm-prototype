import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "champagne" | "violet";
type Size = "xs" | "sm" | "md";

const TONE: Record<Tone, string> = {
  neutral: "bg-[var(--color-panel-2)] text-ink-soft border border-line-soft",
  good: "bg-[var(--color-emerald)]/12 text-[var(--color-emerald)] border border-[var(--color-emerald)]/25",
  warn: "bg-[var(--color-amber)]/12 text-[var(--color-amber)] border border-[var(--color-amber)]/25",
  bad: "bg-[var(--color-coral)]/12 text-[var(--color-coral)] border border-[var(--color-coral)]/30",
  info: "bg-[var(--color-azure)]/12 text-[var(--color-azure)] border border-[var(--color-azure)]/25",
  champagne: "bg-[var(--color-champagne)]/12 text-[var(--color-champagne)] border border-[var(--color-champagne)]/25",
  violet: "bg-[var(--color-violet)]/12 text-[var(--color-violet)] border border-[var(--color-violet)]/25",
};

// Fixed heights so pills line up cleanly across rows + header chips.
const SIZE: Record<Size, string> = {
  xs: "h-[18px] px-2 gap-1 text-[10px]",
  sm: "h-[22px] px-2.5 gap-1.5 text-[11px]",
  md: "h-[26px] px-3 gap-1.5 text-[12px]",
};

const DOT_SIZE: Record<Size, string> = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-1.5 w-1.5",
};

export function Pill({
  tone = "neutral",
  size = "sm",
  className,
  children,
  dot,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; size?: Size; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tracking-tight whitespace-nowrap",
        SIZE[size],
        TONE[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("rounded-full bg-current", DOT_SIZE[size])} />}
      {children}
    </span>
  );
}
