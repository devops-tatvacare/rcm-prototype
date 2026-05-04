import { type ComponentType } from "react";
import { cn } from "@/lib/cn";

export function IconBadge({
  Icon,
  tone = "champagne",
  size = "md",
  className,
}: {
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: "champagne" | "emerald" | "coral" | "violet" | "azure" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const ic = size === "sm" ? 13 : size === "lg" ? 19 : 15;
  const tones: Record<string, string> = {
    champagne: "bg-[var(--color-champagne)]/12 text-[var(--color-champagne)] border-[var(--color-champagne)]/25",
    emerald: "bg-[var(--color-emerald)]/12 text-[var(--color-emerald)] border-[var(--color-emerald)]/25",
    coral: "bg-[var(--color-coral)]/12 text-[var(--color-coral)] border-[var(--color-coral)]/25",
    violet: "bg-[var(--color-violet)]/12 text-[var(--color-violet)] border-[var(--color-violet)]/25",
    azure: "bg-[var(--color-azure)]/12 text-[var(--color-azure)] border-[var(--color-azure)]/25",
    neutral: "bg-[var(--color-panel-2)] text-ink-soft border-line-soft",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg border",
        dims,
        tones[tone],
        className,
      )}
    >
      <Icon size={ic} strokeWidth={1.75} />
    </span>
  );
}
