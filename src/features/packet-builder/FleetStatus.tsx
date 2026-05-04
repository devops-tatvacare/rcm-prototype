import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bot, Activity, Sparkles } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/ui/Sparkline";

const TICKER_LINES = [
  { ts: "13:42:08", text: "Rule r1 fired · Cendana Jakarta · TLH endometriosis · MRI auto-attached", tone: "emerald" },
  { ts: "13:41:54", text: "Pre-auth submitted · Cendana Surabaya · PRIV-CARDIO-PCI-S · IDR 138.9 M", tone: "ink" },
  { ts: "13:41:31", text: "Risk flag · Cendana Medan · TLH without MRI · queued for nurse review", tone: "coral" },
  { ts: "13:41:17", text: "Packet ready · Cendana Bandung · INA-CBG K-1-15-II · 91% acceptance", tone: "emerald" },
  { ts: "13:40:58", text: "Rule r3 fired · 6 BPJS claims · SEP header re-ordered to page 1", tone: "champagne" },
  { ts: "13:40:42", text: "Submitted · Cendana Jakarta · INA-CBG O-6-13-I · 14d predicted DTP", tone: "ink" },
] as const;

export function FleetStatus() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Panel tone="raised" className="overflow-hidden">
        <PanelHeader
          eyebrow="TatvaCare agent fleet · all 4 sites"
          title="Operating in real time"
          right={<Pill tone="good" dot>All systems green</Pill>}
        />
        <div className="hairline-x mx-5" />
        <div className="grid grid-cols-3 gap-3 p-4">
          <FleetMetric Icon={Bot} label="Agents online" value="14" sub="across 4 sites" tone="champagne" />
          <FleetMetric Icon={Activity} label="Throughput · 1h" value="62" sub="claims processed" tone="emerald" />
          <FleetMetric Icon={Sparkles} label="Rules fired · 24h" value="187" sub="across 6 rule types" tone="violet" />
        </div>
        <div className="px-4 pb-4">
          <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Throughput · last 12h</span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">claims/hour</span>
            </div>
            <div className="mt-1">
              <Sparkline
                data={[34, 38, 41, 47, 52, 58, 60, 62, 64, 61, 66, 62]}
                width={320}
                height={56}
                stroke="var(--color-emerald)"
                fill="rgba(52,211,153,0.18)"
              />
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PanelHeader
          eyebrow="Live decision ticker · last 60s"
          title="What the fleet just did"
        />
        <div className="hairline-x mx-5" />
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {TICKER_LINES.map((line, i) => (
            <motion.div
              key={`${tick}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-2.5 border-l-2 px-2.5 py-1.5"
              style={{
                borderColor:
                  line.tone === "emerald" ? "var(--color-emerald)" :
                  line.tone === "coral" ? "var(--color-coral)" :
                  line.tone === "champagne" ? "var(--color-champagne)" :
                  "var(--color-line-soft)",
              }}
            >
              <span className="font-mono-tight text-[10px] text-ink-faint pt-0.5">{line.ts}</span>
              <span className="text-[11.5px] leading-snug text-ink-soft">{line.text}</span>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="eyebrow text-ink-mute">Pick a claim to drop in</div>
          <div className="mt-1 text-[12px] text-ink-faint">
            Click any card on the floor to see the agent's reasoning, gauge, and submission CTA for that claim.
          </div>
        </div>
      </Panel>
    </div>
  );
}

function FleetMetric({ Icon, label, value, sub, tone }: { Icon: any; label: string; value: string; sub: string; tone: "champagne" | "emerald" | "violet" }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "emerald" ? "text-[var(--color-emerald)]"
    : "text-[var(--color-violet)]";
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <Icon size={12} className={c} />
      </div>
      <div className={`mt-1 numeric text-[26px] leading-none ${c}`}>{value}</div>
      <div className="mt-1 font-mono-tight text-[10.5px] text-ink-faint">{sub}</div>
    </div>
  );
}
