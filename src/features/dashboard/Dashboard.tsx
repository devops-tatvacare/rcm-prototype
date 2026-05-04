import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/ui/Sparkline";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { fmtCompactIDR } from "@/lib/format";
import { query } from "@/lib/db";
import { CashFlow } from "./CashFlow";
import { Pipeline } from "./Pipeline";
import { RecentActivity } from "./RecentActivity";

export function Dashboard() {
  const [period, setPeriod] = useState<"d" | "w" | "m">("m");
  const [cashflow, setCashflow] = useState<{ d: string; billed_idr: number; collected_idr: number; denied_idr: number }[]>([]);

  useEffect(() => {
    query<{ d: string; billed_idr: number; collected_idr: number; denied_idr: number }>(
      "SELECT d, billed_idr, collected_idr, denied_idr FROM cashflow_days ORDER BY d ASC",
    ).then(setCashflow);
  }, []);

  const totalBilled = cashflow.reduce((a, r) => a + r.billed_idr, 0);
  const totalCollected = cashflow.reduce((a, r) => a + r.collected_idr, 0);
  const totalDenied = cashflow.reduce((a, r) => a + r.denied_idr, 0);

  return (
    <>
      <TopBar breadcrumb="Workspace · CFO" title="Cash-flow Cockpit" />

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
        {/* Headline strip */}
        <div className="grid grid-cols-12 gap-3">
          <KPI
            span={3}
            eyebrow="Time to cash"
            value={26}
            suffix="d"
            delta={-12}
            deltaTone="good"
            spark={[42, 39, 38, 37, 33, 32, 31, 28, 28, 27, 26]}
            note="vs 38d before agent"
          />
          <KPI
            span={3}
            eyebrow="Eligibility TAT"
            value={68}
            suffix="s"
            delta={-99}
            deltaTone="good"
            deltaUnit="%"
            spark={[14400, 9000, 5400, 3600, 1800, 600, 200, 120, 90, 75, 68]}
            note="vs 4–24h manual"
            tone="champagne"
          />
          <KPI
            span={3}
            eyebrow="Clean claim rate"
            value={89}
            suffix="%"
            delta={+18}
            deltaTone="good"
            spark={[71, 73, 74, 75, 78, 81, 84, 86, 87, 88, 89]}
            note="first-pass acceptance"
            tone="champagne"
          />
          <KPI
            span={3}
            eyebrow="Appeal success"
            value={73}
            suffix="%"
            delta={+38}
            deltaTone="good"
            spark={[35, 38, 42, 48, 53, 58, 62, 67, 70, 72, 73]}
            note="vs 30–45% baseline"
            tone="violet"
          />
        </div>

        {/* Row: cashflow + pipeline */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-8">
            <Panel className="overflow-hidden">
              <PanelHeader
                eyebrow="Last 30 days · IDR"
                title="Cash flow waterfall"
                right={
                  <div className="flex items-center gap-3">
                    <div className="hidden items-center gap-3 md:flex">
                      <Legend dot="#e7c08a" label="Billed" />
                      <Legend dot="#34d399" label="Collected" />
                      <Legend dot="#fb7185" label="Denied" />
                    </div>
                    <SegmentedControl
                      value={period}
                      onChange={setPeriod}
                      options={[
                        { value: "d", label: "D" },
                        { value: "w", label: "W" },
                        { value: "m", label: "M" },
                      ]}
                    />
                  </div>
                }
              />
              <div className="hairline-x mx-5" />
              <CashFlow data={cashflow} />
              <div className="grid grid-cols-3 gap-3 px-5 pt-1 pb-5">
                <Tot label="Billed" value={totalBilled} tone="champagne" />
                <Tot label="Collected" value={totalCollected} tone="emerald" />
                <Tot label="Denied · in appeal" value={totalDenied} tone="coral" />
              </div>
            </Panel>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <Pipeline />
          </div>
        </div>

        {/* Row: recent activity + agent wins */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-7">
            <RecentActivity />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <AgentWins />
          </div>
        </div>
      </div>
    </>
  );
}

function KPI({
  span, eyebrow, value, suffix, decimals, delta, deltaTone, deltaUnit, spark, note, tone = "ink",
}: {
  span: number;
  eyebrow: string;
  value: number;
  suffix?: string;
  decimals?: number;
  delta: number;
  deltaTone: "good" | "bad";
  deltaUnit?: string;
  spark: number[];
  note: string;
  tone?: "ink" | "champagne" | "violet";
}) {
  const TrendIcon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  const sparkColor = tone === "champagne" ? "var(--color-champagne)" : tone === "violet" ? "var(--color-violet)" : "var(--color-emerald)";
  const sparkFill = tone === "champagne" ? "rgba(231,192,138,0.18)" : tone === "violet" ? "rgba(167,139,250,0.18)" : "rgba(52,211,153,0.18)";
  const unit = deltaUnit ?? (suffix === "%" ? "pts" : suffix === "d" ? "d" : "");

  return (
    <Panel className={`col-span-${span} overflow-hidden`}>
      <div className="flex items-start justify-between p-4 pb-1">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">{eyebrow}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="numeric font-display text-[40px] leading-none text-ink">
              <MetricNumber value={value} decimals={decimals ?? 0} />
            </span>
            <span className="font-display text-[18px] text-ink-mute">{suffix}</span>
          </div>
        </div>
        <Sparkline data={spark} stroke={sparkColor} fill={sparkFill} />
      </div>
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-2">
        <span className="font-mono-tight text-[10.5px] text-ink-faint">{note}</span>
        <span className={`flex items-center gap-1 font-mono-tight text-[11px] ${deltaTone === "good" ? "text-[var(--color-emerald)]" : "text-[var(--color-coral)]"}`}>
          <TrendIcon size={11} />
          {delta > 0 ? "+" : ""}{delta}
          {unit && ` ${unit}`}
        </span>
      </div>
    </Panel>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-mute">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

function Tot({ label, value, tone }: { label: string; value: number; tone: "champagne" | "emerald" | "coral" }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]" : tone === "emerald" ? "text-[var(--color-emerald)]" : "text-[var(--color-coral)]";
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2">
      <div className="eyebrow">{label}</div>
      <div className={`mt-0.5 numeric text-[18px] ${c}`}>{fmtCompactIDR(value)}</div>
    </div>
  );
}

function AgentWins() {
  const wins = [
    { title: "MRI rule fired", note: "BPJS · hysterectomy claim · +11.4 pts", value: "IDR 32.9 M held → released" },
    { title: "Pre-auth scope mismatch caught", note: "Allianz · TKR · would have denied", value: "IDR 168 M saved" },
    { title: "SYNTAX score auto-attached", note: "AIA · NSTEMI PCI · cleaner first-pass", value: "−7d on DTP" },
  ];
  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        eyebrow="Agent wins · today"
        title="What the agent saved"
        right={<Pill tone="champagne" dot>Auto</Pill>}
      />
      <div className="hairline-x mx-5" />
      <div className="flex flex-col gap-2 p-4">
        {wins.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, type: "spring", stiffness: 220, damping: 24 }}
            className="flex items-start gap-3 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3.5 py-3"
          >
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-champagne)]/30 bg-[var(--color-champagne)]/10 text-[var(--color-champagne)]">
              <Sparkles size={13} strokeWidth={1.6} />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-[12.5px] font-medium text-ink">{w.title}</span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">{w.note}</span>
            </div>
            <span className="numeric text-[12.5px] text-[var(--color-emerald)]">{w.value}</span>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}
