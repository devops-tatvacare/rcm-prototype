import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft, Radio, Layers, GitBranch, Clock, AlertTriangle,
  FileText, CreditCard, Workflow, ExternalLink, Inbox,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel, PanelHeader, PanelDivider } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { MetricNumber } from "@/components/ui/MetricNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { IconBadge } from "@/components/ui/IconBadge";
import { query } from "@/lib/db";
import { fmtCompactIDR, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type Payor = {
  id: string; name: string; kind: string;
  clean_claim_rate: number; avg_dtp_days: number; denial_rate: number;
  threads_ingested: number; monthly_volume_idr: number; color: string;
};

type DenialCode = {
  id: string; payor_id: string | null; bucket: string;
  code: string; phrasing: string; frequency_pct: number;
};

type PayorRule = {
  id: string; payor_id: string; category: string; kind: string;
  drg_pattern: string | null; description: string; threshold_value: string | null;
  source_confidence: string; evidence_url: string | null;
  evidence_threads: number; lift_pct: number; added_by: string | null;
};

type Thread = {
  id: string; payor_id: string; subject: string; sender: string;
  excerpt: string; body: string; highlight: string | null;
  outcome: string; learned_rule: string | null; ts: string;
  payor_color: string;
};

type Profile = {
  channel: string;
  drgHandling: string;
  cob: string;
  cobNote: string;
  slas: string;
};

const PROFILES: Record<string, Profile> = {
  bpjs: {
    channel: "BPJS V-Claim REST API",
    drgHandling: "INA-CBG (1,077 groups, Permenkes 26/2021)",
    cob: "Pays first up to INA-CBG tariff. Private insurers settle excess.",
    cobNote: "Per KMK 1117/2025",
    slas: "Verifier review 15 wd · payment 15 wd",
  },
  pru: {
    channel: "Cashless review desk · Portal + email",
    drgHandling: "Plan-tier benefit caps; INA-CBG informs case-mix where CoB applies",
    cob: "Pays selisih biaya only when patient is BPJS-active.",
    cobNote: "Per KMK 1117/2025",
    slas: "Cashless GL 2-4h elective / 1h emergency · Reimbursement 14 wd from complete file · 60d submission window",
  },
  aia: {
    channel: "Cashless review desk · Portal + email",
    drgHandling: "Plan-tier benefit caps; INA-CBG informs case-mix where CoB applies",
    cob: "Pays selisih biaya only when patient is BPJS-active.",
    cobNote: "Per KMK 1117/2025",
    slas: "Cashless GL 2-4h elective / 1h emergency · Reimbursement 14 wd from complete file · 60d submission window",
  },
};

const DEFAULT_PROFILE: Profile = {
  channel: "Portal + email",
  drgHandling: "Plan-tier benefit caps",
  cob: "—",
  cobNote: "",
  slas: "—",
};

const BUCKET_TONE: Record<string, "bad" | "warn" | "info" | "violet"> = {
  technical: "bad",
  clinical: "warn",
  contractual: "info",
  administrative: "violet",
};

const BUCKET_COLOR: Record<string, string> = {
  technical: "var(--color-coral)",
  clinical: "var(--color-amber)",
  contractual: "var(--color-azure)",
  administrative: "var(--color-violet)",
};

const SOURCE_CONF_TONE: Record<string, "champagne" | "neutral" | "info" | "good"> = {
  extracted: "champagne",
  industry_typical: "neutral",
  admin_added: "info",
  promoted_from_denial: "good",
};

const SOURCE_CONF_LABEL: Record<string, string> = {
  extracted: "Extracted",
  industry_typical: "Industry typical",
  admin_added: "Admin added",
  promoted_from_denial: "Promoted from denial",
};

const CATEGORY_META: Record<string, { label: string; Icon: any; tone: "champagne" | "emerald" | "violet" }> = {
  documentation: { label: "Documentation", Icon: FileText, tone: "champagne" },
  financial: { label: "Financial", Icon: CreditCard, tone: "emerald" },
  process: { label: "Process", Icon: Workflow, tone: "violet" },
};

const CATEGORY_ORDER = ["documentation", "financial", "process"] as const;

const OUTCOME_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  approved: "good",
  paid: "good",
  denied: "bad",
  pending: "warn",
  appealed: "info",
  resubmitted: "info",
  clarification: "warn",
};

export function PayorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payor, setPayor] = useState<Payor | null>(null);
  const [denials, setDenials] = useState<DenialCode[]>([]);
  const [rules, setRules] = useState<PayorRule[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    if (!id) return;
    query<Payor>("SELECT * FROM payors WHERE id = ?", [id]).then((rows) => setPayor(rows[0] ?? null));
    query<DenialCode>(
      "SELECT * FROM denial_codes WHERE payor_id = ? OR payor_id IS NULL ORDER BY frequency_pct DESC LIMIT 5",
      [id],
    ).then(setDenials);
    query<PayorRule>(
      "SELECT * FROM payor_rules WHERE payor_id = ? ORDER BY category, lift_pct DESC",
      [id],
    ).then(setRules);
    query<Thread>(
      `SELECT t.*, py.color as payor_color
       FROM email_threads t
       JOIN payors py ON py.id = t.payor_id
       WHERE t.payor_id = ?
       ORDER BY ts DESC
       LIMIT 5`,
      [id],
    ).then(setThreads);
  }, [id]);

  const profile = useMemo<Profile>(() => (id && PROFILES[id]) ? PROFILES[id] : DEFAULT_PROFILE, [id]);

  const groupedRules = useMemo(() => {
    const out: Record<string, PayorRule[]> = { documentation: [], financial: [], process: [] };
    rules.forEach((r) => {
      const cat = r.category in out ? r.category : "process";
      out[cat].push(r);
    });
    return out;
  }, [rules]);

  const denialMaxFreq = useMemo(
    () => denials.reduce((m, d) => Math.max(m, d.frequency_pct), 0) || 1,
    [denials],
  );

  if (!payor) {
    return (
      <>
        <TopBar title="Payor" breadcrumb="Payor Intelligence" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="font-mono-tight text-[11px] text-ink-faint">Loading payor…</div>
        </div>
      </>
    );
  }

  const trendDtp = [44, 42, 40, 39, 38, 36, 33, 30, 27, payor.avg_dtp_days];
  const trendDenial = [18, 17, 16, 15, 14, 13, 12, 11, 10, payor.denial_rate * 100];
  const trendCcr = [70, 72, 74, 75, 77, 78, 80, 82, 84, payor.clean_claim_rate * 100];

  const isGov = payor.kind === "government";

  return (
    <>
      <TopBar title={payor.name} breadcrumb="Payor Intelligence" />

      <div className="flex flex-1 flex-col overflow-auto">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          className="px-4 pt-4"
        >
          <Panel tone="raised" className="overflow-hidden">
            {/* Stripe at top in payor color */}
            <div
              className="h-1 w-full"
              style={{ background: `linear-gradient(90deg, transparent, ${payor.color}, transparent)` }}
            />
            <div className="flex items-start gap-4 px-5 pt-4 pb-3">
              <button
                type="button"
                onClick={() => navigate("/payors?tab=payors")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-soft text-ink-mute transition-colors hover:border-[var(--color-champagne)]/40 hover:text-ink"
                aria-label="Back to Payors"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="eyebrow">{isGov ? "Government scheme" : "Private payor"}</div>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="truncate font-display text-[26px] tracking-tight text-ink">{payor.name}</h2>
                  <Pill tone={isGov ? "info" : "champagne"} dot className="shrink-0">
                    {isGov ? "Gov scheme" : "Private payor"}
                  </Pill>
                </div>
                <div className="mt-0.5 truncate font-mono-tight text-[11px] text-ink-faint">
                  {fmtCompactIDR(payor.monthly_volume_idr)} / mo · {payor.threads_ingested.toLocaleString()} threads ingested
                </div>
              </div>
            </div>

            <PanelDivider />

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
              <StatTile
                eyebrow="Clean-claim rate"
                value={payor.clean_claim_rate * 100}
                suffix="%"
                decimals={0}
                trend={trendCcr}
                stroke={payor.color}
              />
              <StatTile
                eyebrow="Days to payment"
                value={payor.avg_dtp_days}
                suffix="d"
                decimals={0}
                trend={trendDtp}
                stroke={payor.color}
              />
              <StatTile
                eyebrow="Denial rate"
                value={payor.denial_rate * 100}
                suffix="%"
                decimals={1}
                trend={trendDenial}
                stroke="var(--color-coral)"
              />
              <StatTile
                eyebrow="Threads ingested"
                value={payor.threads_ingested}
                suffix=""
                decimals={0}
                stroke={payor.color}
              />
              <StatTile
                eyebrow="Monthly volume"
                value={Math.round(payor.monthly_volume_idr / 1e9)}
                prefix="IDR "
                suffix=" B"
                decimals={0}
                stroke={payor.color}
              />
            </div>
          </Panel>
        </motion.div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-12 gap-3 p-4 pt-3">
          {/* LEFT — Payor profile */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.35 }}
            className="col-span-12 lg:col-span-5"
          >
            <Panel tone="raised" className="flex h-full flex-col">
              <PanelHeader eyebrow="Profile" title="Payor profile" density="compact" />
              <PanelDivider />
              <div className="flex flex-col gap-3 p-4">
                <ProfileRow Icon={Radio} tone="azure" label="Channel" value={profile.channel} />
                <ProfileRow Icon={Layers} tone="champagne" label="DRG handling" value={profile.drgHandling} />
                <ProfileRow
                  Icon={GitBranch}
                  tone="violet"
                  label="Coordination of Benefits"
                  value={profile.cob}
                  footnote={profile.cobNote}
                />
                <ProfileRow Icon={Clock} tone="emerald" label="Typical SLAs" value={profile.slas} />
              </div>

              <PanelDivider />

              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="eyebrow">Top denial reasons</div>
                  <span className="font-mono-tight text-[10px] text-ink-faint">{denials.length} of top-5</span>
                </div>
                {denials.length === 0 && (
                  <div className="font-mono-tight text-[11px] text-ink-faint">No denial codes seeded.</div>
                )}
                <div className="flex flex-col gap-2">
                  {denials.map((d) => {
                    const tone = BUCKET_TONE[d.bucket] ?? "neutral";
                    const color = BUCKET_COLOR[d.bucket] ?? "var(--color-ink-mute)";
                    const widthPct = Math.max(6, Math.round((d.frequency_pct / denialMaxFreq) * 100));
                    return (
                      <div key={d.id} className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/30 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Pill tone={tone} size="xs" className="shrink-0 font-mono-tight uppercase">
                              {d.code}
                            </Pill>
                            <span className="truncate text-[12px] text-ink-soft" title={d.phrasing}>
                              {d.phrasing}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono-tight text-[10.5px] text-ink-mute tabular-nums">
                            {(d.frequency_pct * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-line-soft)]/40">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${widthPct}%`, background: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </motion.div>

          {/* RIGHT — Rules grouped */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
            className="col-span-12 lg:col-span-7"
          >
            <Panel tone="raised" className="flex h-full flex-col">
              <PanelHeader
                eyebrow="Rules"
                title="Structured rules"
                density="compact"
                right={
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">
                    {rules.length} total
                  </span>
                }
              />
              <PanelDivider />
              <div className="flex flex-col divide-y divide-[var(--color-line-soft)]">
                {CATEGORY_ORDER.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const items = groupedRules[cat] ?? [];
                  return (
                    <RuleSection key={cat} label={meta.label} Icon={meta.Icon} tone={meta.tone} rules={items} />
                  );
                })}
              </div>
            </Panel>
          </motion.div>

          {/* BOTTOM — Recent threads */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.35 }}
            className="col-span-12"
          >
            <Panel tone="raised" className="flex flex-col">
              <PanelHeader
                eyebrow="Inbox · last 5"
                title="Recent threads"
                density="compact"
                right={
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">
                    Click to open inbox · P2.3
                  </span>
                }
              />
              <PanelDivider />
              {threads.length === 0 ? (
                <div className="px-4 py-6 font-mono-tight text-[11px] text-ink-faint">No threads ingested for this payor yet.</div>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--color-line-soft)]">
                  {threads.map((t) => {
                    const ageMs = Date.now() - new Date(t.ts).getTime();
                    const tone = OUTCOME_TONE[t.outcome] ?? "neutral";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        title="Inbox · P2.3"
                        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-panel-2)]/40"
                      >
                        <span
                          className="h-7 w-1 shrink-0 rounded-full"
                          style={{ background: t.payor_color }}
                        />
                        <Inbox size={13} className="shrink-0 text-ink-faint" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[12.5px] text-ink" title={t.subject}>
                              {t.subject}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono-tight text-[10.5px] text-ink-faint">
                            <span className="truncate">{t.sender}</span>
                            <span>·</span>
                            <span className="shrink-0">{relativeTime(ageMs)}</span>
                          </div>
                        </div>
                        <Pill tone={tone} size="xs" className="shrink-0 capitalize">
                          {t.outcome}
                        </Pill>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          </motion.div>
        </div>
      </div>
    </>
  );
}

function StatTile({
  eyebrow, value, suffix, prefix, decimals = 0, trend, stroke = "var(--color-emerald)",
}: {
  eyebrow: string; value: number; suffix?: string; prefix?: string; decimals?: number; trend?: number[]; stroke?: string;
}) {
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow truncate">{eyebrow}</div>
          <div className="mt-0.5 numeric text-[20px] text-ink">
            <MetricNumber value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
          </div>
        </div>
        {trend && (
          <Sparkline data={trend} stroke={stroke} fill={stroke} width={64} height={28} />
        )}
      </div>
    </div>
  );
}

function ProfileRow({
  Icon, tone, label, value, footnote,
}: {
  Icon: any;
  tone: "champagne" | "emerald" | "coral" | "violet" | "azure" | "neutral";
  label: string;
  value: string;
  footnote?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <IconBadge Icon={Icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="eyebrow">{label}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{value}</div>
        {footnote && (
          <div className="mt-0.5 font-mono-tight text-[10px] text-ink-faint">{footnote}</div>
        )}
      </div>
    </div>
  );
}

function RuleSection({
  label, Icon, tone, rules,
}: {
  label: string;
  Icon: any;
  tone: "champagne" | "emerald" | "violet";
  rules: PayorRule[];
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <IconBadge Icon={Icon} tone={tone} size="sm" />
          <span className="font-display text-[13px] tracking-tight text-ink">{label}</span>
          <span className="font-mono-tight text-[10.5px] text-ink-faint">
            · {rules.length} {rules.length === 1 ? "rule" : "rules"}
          </span>
        </div>
      </div>
      {rules.length === 0 ? (
        <div className="px-4 pb-3 font-mono-tight text-[11px] text-ink-faint">No rules in this category.</div>
      ) : (
        <div className="flex flex-col">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleRow({ rule }: { rule: PayorRule }) {
  const [open, setOpen] = useState(false);
  const tone = SOURCE_CONF_TONE[rule.source_confidence] ?? "neutral";
  const label = SOURCE_CONF_LABEL[rule.source_confidence] ?? rule.source_confidence;
  const hasDetail = !!rule.evidence_url || !!rule.added_by;

  return (
    <div className="border-t border-[var(--color-line-soft)]/60">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          "grid w-full grid-cols-12 items-center gap-2 px-4 py-2 text-left transition-colors",
          hasDetail && "hover:bg-[var(--color-panel-2)]/30",
          !hasDetail && "cursor-default",
        )}
      >
        <span className="col-span-2 truncate font-mono-tight text-[10.5px] text-ink-faint" title={rule.id}>
          {rule.id}
        </span>
        <span className="col-span-5 truncate text-[12.5px] text-ink-soft" title={rule.description}>
          {rule.description}
        </span>
        <span
          className="col-span-2 truncate font-mono-tight text-[11px] text-ink-mute tabular-nums"
          title={rule.threshold_value ?? ""}
        >
          {rule.threshold_value ?? "—"}
        </span>
        <span className="col-span-2 flex justify-start">
          <Pill tone={tone} size="xs">{label}</Pill>
        </span>
        <span className="col-span-1 flex items-center justify-end gap-1 font-mono-tight text-[10.5px] text-ink-faint tabular-nums">
          <AlertTriangle size={10} className="opacity-60" />
          {rule.evidence_threads}
          <span className="ml-1 text-ink-mute">+{rule.lift_pct.toFixed(0)}%</span>
        </span>
      </button>
      {open && hasDetail && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden bg-[var(--color-canvas-deep)]/40"
        >
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 font-mono-tight text-[11px]">
            {rule.evidence_url && (
              <a
                href={rule.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[var(--color-azure)] hover:underline"
              >
                <ExternalLink size={11} />
                Evidence
              </a>
            )}
            {rule.added_by && (
              <span className="text-ink-faint">Added by · {rule.added_by}</span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
