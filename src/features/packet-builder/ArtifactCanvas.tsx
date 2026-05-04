import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, FlaskConical, Stethoscope, Scale, Sparkles, ShieldCheck, FileSignature } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { usePacketBuilder } from "@/store/usePacketBuilder";
import { cn } from "@/lib/cn";

// Hand-tuned positions on a unit canvas (0..1)
const POSITIONS: Record<string, { x: number; y: number; Icon: any; tone: string }> = {
  a1: { x: 0.18, y: 0.22, Icon: FileText, tone: "champagne" },
  a2: { x: 0.38, y: 0.16, Icon: Sparkles, tone: "azure" },
  a3: { x: 0.62, y: 0.22, Icon: FlaskConical, tone: "violet" },
  a4: { x: 0.82, y: 0.36, Icon: Sparkles, tone: "violet" },
  a5: { x: 0.78, y: 0.62, Icon: FileSignature, tone: "champagne" },
  a6: { x: 0.55, y: 0.74, Icon: Stethoscope, tone: "azure" },
  a7: { x: 0.32, y: 0.74, Icon: ShieldCheck, tone: "emerald" },
  a8: { x: 0.14, y: 0.55, Icon: Scale, tone: "champagne" },
};

const TONE_COLOR: Record<string, string> = {
  champagne: "var(--color-champagne)",
  azure: "var(--color-azure)",
  violet: "var(--color-violet)",
  emerald: "var(--color-emerald)",
};

export function ArtifactCanvas() {
  const { artifacts, status } = usePacketBuilder();

  const center = { x: 0.48, y: 0.48 };

  const lines = useMemo(
    () =>
      artifacts.map((a) => {
        const p = POSITIONS[a.id];
        if (!p) return null;
        return { id: a.id, from: p, to: center };
      }).filter(Boolean) as Array<{ id: string; from: { x: number; y: number; Icon: any; tone: string }; to: { x: number; y: number } }>,
    [artifacts],
  );

  return (
    <Panel className="relative flex h-[460px] flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Auto-Document Engine · canvas"
        title="Packet assembly"
        right={
          <div className="font-mono-tight text-[11px] text-ink-faint">
            {artifacts.length}/8 artifacts attached
          </div>
        }
      />
      <div className="hairline-x mx-5" />

      <div className="relative flex-1 overflow-hidden">
        {/* grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(120% 100% at 50% 50%, black 35%, transparent 80%)",
          }}
        />
        {/* concentric rings */}
        <Rings />

        {/* SVG connections */}
        <svg className="absolute inset-0 h-full w-full">
          <AnimatePresence>
            {lines.map((l) => (
              <motion.line
                key={l.id}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                x1={`${l.from.x * 100}%`}
                y1={`${l.from.y * 100}%`}
                x2={`${l.to.x * 100}%`}
                y2={`${l.to.y * 100}%`}
                stroke={TONE_COLOR[l.from.tone]}
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Center "packet" node */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${center.x * 100}%`, top: `${center.y * 100}%` }}
        >
          <div className="relative flex flex-col items-center">
            <motion.div
              animate={status === "running" ? { boxShadow: ["0 0 0 0 rgba(231,192,138,0.0)", "0 0 0 14px rgba(231,192,138,0.0)"] } : {}}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-champagne)]/30 bg-[var(--color-canvas-deep)] shadow-glow-champagne"
            >
              <span className="font-display text-[26px] text-[var(--color-champagne)]">Π</span>
            </motion.div>
            <div className="mt-2 font-mono-tight text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">Packet</div>
            <div className="font-mono-tight text-[10.5px] text-ink-faint">BPJS · v4.2</div>
          </div>
        </motion.div>

        {/* Artifact nodes */}
        <AnimatePresence>
          {artifacts.map((a, i) => {
            const p = POSITIONS[a.id];
            if (!p) return null;
            const Icon = p.Icon;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ type: "spring", stiffness: 320, damping: 22, delay: i * 0.04 }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg border bg-[var(--color-canvas-deep)]",
                    )}
                    style={{ borderColor: `${TONE_COLOR[p.tone]}55`, color: TONE_COLOR[p.tone] }}
                  >
                    <Icon size={16} strokeWidth={1.6} />
                  </div>
                  <div className="mt-1.5 max-w-[110px] text-center font-mono-tight text-[10.5px] leading-tight text-ink-mute">
                    {a.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function Rings() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[1, 2, 3].map((r) => (
        <motion.div
          key={r}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.18 }}
          transition={{ delay: r * 0.1 }}
          className="absolute rounded-full border border-[var(--color-champagne)]/30"
          style={{ width: `${110 + r * 80}px`, height: `${110 + r * 80}px` }}
        />
      ))}
    </div>
  );
}
