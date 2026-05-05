import { cn } from "@/lib/cn";

export function AiHumanBar({ aiPct, compact = false, className }: { aiPct: number; compact?: boolean; className?: string }) {
  const youPct = Math.max(0, 100 - aiPct);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex overflow-hidden rounded-full bg-[var(--color-canvas-deep)] border border-line-soft",
          compact ? "h-1 w-16" : "h-1.5 w-24",
        )}
      >
        <span
          className="block bg-[var(--color-champagne)]"
          style={{ width: `${aiPct}%` }}
        />
        <span
          className="block bg-[var(--color-azure)]"
          style={{ width: `${youPct}%` }}
        />
      </div>
      {!compact && (
        <span className="font-mono-tight text-[10px] text-ink-faint whitespace-nowrap">
          AI {aiPct}<span className="opacity-50"> · </span>You {youPct}
        </span>
      )}
    </div>
  );
}
