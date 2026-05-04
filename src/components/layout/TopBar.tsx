import { motion } from "motion/react";
import { Activity, Bell, Search } from "lucide-react";
import { Pill } from "@/components/ui/Pill";

export function TopBar({ title, breadcrumb }: { title: string; breadcrumb?: string }) {
  return (
    <header className="relative flex h-14 items-center justify-between border-b border-line-soft bg-canvas/40 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-tight">
          {breadcrumb && <span className="eyebrow">{breadcrumb}</span>}
          <h1 className="font-display text-[19px] tracking-tight text-ink">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden items-center gap-2 rounded-full border border-line-soft bg-[var(--color-panel-2)]/40 px-3 py-1.5 md:flex"
        >
          <Search size={13} className="text-ink-faint" />
          <span className="font-mono-tight text-[11px] text-ink-faint">Search patient · claim · payor…</span>
          <kbd className="rounded border border-line-soft px-1.5 py-0.5 font-mono-tight text-[9.5px] text-ink-faint">⌘K</kbd>
        </motion.div>
        <Pill tone="good" dot className="font-mono-tight">
          <Activity size={10} className="-ml-0.5" />
          Agent online
        </Pill>
        <Pill tone="champagne">Cendana Health Group · 4 sites</Pill>
        <button className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-[var(--color-panel-2)]/60 hover:text-ink-soft">
          <Bell size={14} />
        </button>
      </div>
      {/* hairline */}
      <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(231,192,138,0.18)] to-transparent" />
    </header>
  );
}
