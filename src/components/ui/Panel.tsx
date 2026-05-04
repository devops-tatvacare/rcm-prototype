import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { tone?: "default" | "raised" | "deep" }>(
  ({ className, tone = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-xl border border-line-soft",
        tone === "default" && "bg-panel",
        tone === "raised" && "bg-panel-raised",
        tone === "deep" && "bg-canvas-deep",
        "shadow-quiet",
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

type Density = "default" | "compact";

export function PanelHeader({
  eyebrow,
  title,
  right,
  density = "default",
  className,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  density?: Density;
  className?: string;
}) {
  // items-center keeps the right slot aligned with the title baseline,
  // not the bottom of the eyebrow + title block (which is what items-end did).
  const padding = density === "compact" ? "px-4 pt-3 pb-2.5" : "px-5 pt-4 pb-3";
  const titleSize = density === "compact" ? "text-[16px]" : "text-[18px]";

  return (
    <div className={cn("flex items-center justify-between gap-3", padding, className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="eyebrow truncate">{eyebrow}</span>}
        {title && <h3 className={cn("font-display leading-none tracking-tight text-ink truncate", titleSize)}>{title}</h3>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function PanelDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--color-line-soft)]", className)} />;
}
