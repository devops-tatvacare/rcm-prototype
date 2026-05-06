import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { cn } from "@/lib/cn";

type Payor = {
  id: string; name: string; kind: string;
  clean_claim_rate: number; avg_dtp_days: number; denial_rate: number;
  threads_ingested: number; monthly_volume_idr: number; color: string;
};

type Tab = "payors" | "inbox" | "rules";

const TABS: { value: Tab; label: string }[] = [
  { value: "payors", label: "Payors" },
  { value: "inbox", label: "Email Inbox" },
  { value: "rules", label: "Payor Rules" },
];

function isTab(v: string | null): v is Tab {
  return v === "payors" || v === "inbox" || v === "rules";
}

export function PayorIntel() {
  const [payors, setPayors] = useState<Payor[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [rulesCount, setRulesCount] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    query<Payor>("SELECT * FROM payors ORDER BY monthly_volume_idr DESC").then(setPayors);
    query<{ c: number }>("SELECT COUNT(*) AS c FROM email_threads").then((rows) => setInboxCount(rows[0]?.c ?? 0));
    query<{ c: number }>("SELECT COUNT(*) AS c FROM payor_rules").then((rows) => setRulesCount(rows[0]?.c ?? 0));
  }, []);

  const tabParam = searchParams.get("tab");
  const activeTab: Tab = isTab(tabParam) ? tabParam : "payors";

  function selectTab(t: Tab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  }

  const counts = useMemo<Record<Tab, number>>(
    () => ({ payors: payors.length, inbox: inboxCount, rules: rulesCount }),
    [payors.length, inboxCount, rulesCount],
  );

  return (
    <>
      <TopBar title="Payor Intelligence" />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center px-4 pt-4">
          <div className="flex items-center gap-1 rounded-full border border-line-soft bg-[var(--color-canvas-deep)]/60 p-0.5">
            {TABS.map((t) => {
              const active = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => selectTab(t.value)}
                  className={cn(
                    "relative flex h-8 items-center gap-2 rounded-full px-3.5 transition-colors",
                    active ? "text-ink" : "text-ink-mute hover:text-ink-soft",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="payor-intel-tab-active"
                      className="absolute inset-0 -z-[1] rounded-full bg-[var(--color-panel-2)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="text-[12.5px] font-medium tracking-tight">{t.label}</span>
                  <span className="font-mono-tight text-[10px] text-ink-faint">{counts[t.value]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          {activeTab === "payors" && (
            <div className="grid grid-cols-12 gap-3">
              {payors.map((p, i) => (
                <PayorCard key={p.id} payor={p} index={i} />
              ))}
            </div>
          )}

          {activeTab === "inbox" && (
            <TabPlaceholder title="Email Inbox" subtitle="Coming in P2.3" />
          )}

          {activeTab === "rules" && (
            <TabPlaceholder title="Payor Rules" subtitle="Coming in P2.3" />
          )}
        </div>
      </div>
    </>
  );
}

function TabPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Panel tone="raised" className="flex min-h-[320px] flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="font-display text-[22px] tracking-tight text-ink">{title}</div>
        <div className="font-mono-tight text-[11px] text-ink-faint">{subtitle}</div>
      </div>
    </Panel>
  );
}

function PayorCard({ payor, index }: { payor: Payor; index: number }) {
  const trendDtp = [44, 42, 40, 39, 38, 36, 33, 30, 27, payor.avg_dtp_days];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: "spring", stiffness: 220, damping: 26 }}
      className="col-span-12 lg:col-span-4 flex"
    >
      <Panel tone="raised" className="flex w-full flex-col overflow-hidden">
        {/* Stripe at top in payor color */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${payor.color}, transparent)` }} />
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow">{payor.kind === "government" ? "Gov scheme" : "Private payor"}</div>
              <div className="mt-1 truncate font-display text-[22px] tracking-tight text-ink">{payor.name}</div>
              <div className="mt-0.5 truncate whitespace-nowrap font-mono-tight text-[11px] text-ink-faint">
                {fmtCompactIDR(payor.monthly_volume_idr)} / mo · {payor.threads_ingested.toLocaleString()} threads
              </div>
            </div>
            <Pill tone={payor.clean_claim_rate >= 0.8 ? "good" : "warn"} dot className="shrink-0">
              {Math.round(payor.clean_claim_rate * 100)}% CCR
            </Pill>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Mini eyebrow="Days to payment" value={payor.avg_dtp_days} suffix="d" trend={trendDtp} positiveDown stroke={payor.color} />
            <Mini eyebrow="Denial rate" value={payor.denial_rate * 100} suffix="%" decimals={1} trend={[18, 17, 16, 15, 14, 13, 12, 11, 10, payor.denial_rate * 100]} positiveDown />
          </div>

          {/* sub-pills */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Pill tone="neutral">{payor.kind === "government" ? "BPJS V-Claim REST" : "Portal + email"}</Pill>
            <Pill tone="neutral">INA-CBG · DRG</Pill>
            <Pill tone="neutral">Cashless</Pill>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

function Mini({
  eyebrow, value, suffix, decimals = 0, trend, stroke = "var(--color-emerald)", positiveDown,
}: { eyebrow: string; value: number; suffix: string; decimals?: number; trend: number[]; stroke?: string; positiveDown?: boolean }) {
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="mt-0.5 numeric text-[20px] text-ink">
            <MetricNumber value={value} decimals={decimals} suffix={suffix} />
          </div>
        </div>
        <Sparkline data={positiveDown ? [...trend].reverse().map((_, i) => trend[i]) : trend} stroke={stroke} fill={`${stroke.replace(")", "33)").replace("var(--color-", "var(--color-")}`} width={70} height={28} />
      </div>
    </div>
  );
}
