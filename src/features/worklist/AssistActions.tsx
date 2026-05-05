import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowUpRight, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Mode = "idle" | "request" | "escalate" | "sent" | "escalated";

export function AssistActions({ patientName, className, compact = false }: { patientName: string; className?: string; compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("");

  function send() {
    setMode("sent");
    setText("");
    setTimeout(() => setMode("idle"), 2400);
  }
  function escalate() {
    setMode("escalated");
    setTimeout(() => setMode("idle"), 2400);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1.5">
        <ChipButton
          icon={<Mail size={11} />}
          label="Request info"
          active={mode === "request"}
          onClick={() => setMode(mode === "request" ? "idle" : "request")}
          compact={compact}
        />
        <ChipButton
          icon={<ArrowUpRight size={11} />}
          label="Escalate to manager"
          active={mode === "escalate"}
          onClick={() => setMode(mode === "escalate" ? "idle" : "escalate")}
          compact={compact}
        />
      </div>

      <AnimatePresence>
        {mode === "request" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 p-3">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Request info · {patientName}</span>
                <button onClick={() => setMode("idle")} className="text-ink-faint hover:text-ink-mute"><X size={12} /></button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ward · I need OT log + anaesthesia chart for day-3 review…"
                className="min-h-[64px] w-full resize-none rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 p-2 text-[12px] text-ink placeholder:text-ink-faint outline-none focus:border-[var(--color-champagne)]/40"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setMode("idle")}
                  className="font-mono-tight text-[11px] text-ink-faint hover:text-ink-mute px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={!text.trim()}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11.5px] font-medium",
                    text.trim()
                      ? "bg-[var(--color-champagne)] text-[var(--color-canvas-deep)]"
                      : "bg-[var(--color-panel-2)] text-ink-faint cursor-not-allowed",
                  )}
                >
                  Send to ward
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {mode === "escalate" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-violet)]/30 bg-[var(--color-violet)]/[0.06] p-3">
              <div className="flex flex-col">
                <span className="text-[12px] text-ink">Escalate to claims manager?</span>
                <span className="font-mono-tight text-[10.5px] text-ink-faint">{patientName} · routed with full case context</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMode("idle")}
                  className="font-mono-tight text-[11px] text-ink-faint hover:text-ink-mute px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={escalate}
                  className="rounded-md bg-[var(--color-violet)] px-3 py-1 text-[11.5px] font-medium text-white"
                >
                  Escalate
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {(mode === "sent" || mode === "escalated") && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/[0.08] px-3 py-2"
          >
            <Check size={12} className="text-[var(--color-emerald)]" />
            <span className="font-mono-tight text-[11px] text-[var(--color-emerald)]">
              {mode === "sent" ? "Request queued · ward will be notified" : "Escalated · manager will pick this up"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipButton({ icon, label, active, onClick, compact }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; compact: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 font-mono-tight transition-colors",
        compact ? "h-6 text-[10.5px]" : "h-7 text-[11px]",
        active
          ? "border-[var(--color-champagne)]/40 bg-[var(--color-champagne)]/[0.08] text-[var(--color-champagne)]"
          : "border-line-soft text-ink-mute hover:text-ink-soft",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
