import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Building2, Send, RefreshCw, ShieldCheck, AlertTriangle, ClockAlert, Activity, Stethoscope } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { useCaseReview } from "@/store/useCaseReview";

type Detail = {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: string;
  policy_number: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  drg: string;
  dx: string;
  ward_class: string;
  attending_physician: string;
  admission_date: string;
  day_of_stay: number;
  authorized_days: number;
  los_drg_benchmark: number;
  los_variance_pct: number;
  acuity: string;
  medical_necessity_score: number;
  medical_necessity_gaps_json: string;
  auth_extension_status: string;
  auth_extension_letter_md: string | null;
  discharge_readiness_score: number;
  avoidable_day_flag: number;
  avoidable_day_reason: string | null;
};

const ACUITY_TONE: Record<string, "good" | "info" | "warn" | "bad"> = {
  STABLE: "info",
  IMPROVING: "good",
  WATCH: "warn",
  CRITICAL: "bad",
};

export function CaseDetail() {
  const { selectedId, extensionSubmitted, submitExtension } = useCaseReview();
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    query<Detail>(
      `SELECT ip.id,
              p.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex, p.policy_number,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              ip.drg, ip.dx, ip.ward_class, ip.attending_physician, ip.admission_date,
              ip.day_of_stay, ip.authorized_days, ip.los_drg_benchmark, ip.los_variance_pct,
              ip.acuity, ip.medical_necessity_score, ip.medical_necessity_gaps_json,
              ip.auth_extension_status, ip.auth_extension_letter_md,
              ip.discharge_readiness_score, ip.avoidable_day_flag, ip.avoidable_day_reason
         FROM inpatients ip
         JOIN patients p ON p.id = ip.patient_id
         JOIN payors py ON py.id = ip.payor_id
         JOIN hospitals h ON h.id = ip.hospital_id
        WHERE ip.id = ?`,
      [selectedId],
    ).then((rows) => setD(rows[0] ?? null));
  }, [selectedId]);

  if (!d) return <div className="flex h-full items-center justify-center text-ink-faint">Loading…</div>;

  let gaps: string[] = [];
  try { gaps = JSON.parse(d.medical_necessity_gaps_json || "[]"); } catch { /* noop */ }

  const overAuth = d.day_of_stay > d.authorized_days;
  const atAuth = d.day_of_stay === d.authorized_days;
  const ext = extensionSubmitted[d.id] || d.auth_extension_status === "SUBMITTED" || d.auth_extension_status === "APPROVED";
  const mnPct = Math.round(d.medical_necessity_score * 100);
  const drPct = Math.round(d.discharge_readiness_score * 100);

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-3 p-4 pt-12">
      {/* Left — patient + LOS visualization + medical-necessity gaps */}
      <div className="col-span-5 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {/* Identity */}
        <Panel tone="raised" className="overflow-hidden">
          <div className="h-[3px] w-full" style={{ background: d.payor_color }} />
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <div className="min-w-0">
              <div className="truncate font-display text-[19px] leading-tight tracking-tight text-ink">{d.patient_name}</div>
              <div className="mt-0.5 flex items-center gap-1 font-mono-tight text-[10px] text-ink-faint">
                <Building2 size={9} className="opacity-60 shrink-0" />
                <span className="truncate">{d.hospital_name} · {d.ward_class} · {d.patient_sex}/{d.patient_age}y</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Pill tone={ACUITY_TONE[d.acuity]} dot className="shrink-0">{d.acuity.toLowerCase()}</Pill>
              <Pill tone="champagne" dot className="shrink-0">{d.payor_name}</Pill>
            </div>
          </div>
          <div className="border-t border-line-soft px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <Stethoscope size={10} className="text-ink-faint" />
              <span className="eyebrow">Diagnosis</span>
              <span className="font-mono-tight text-[10px] text-[var(--color-champagne)]">{d.drg}</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{d.dx}</p>
            <div className="mt-1.5 font-mono-tight text-[10.5px] text-ink-faint">
              attending: {d.attending_physician} · admitted {new Date(d.admission_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          </div>
        </Panel>

        {/* LOS visual */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="LOS · day vs benchmark vs authorized"
            title={
              <span className="flex items-baseline gap-2">
                <span className="numeric">Day {d.day_of_stay}</span>
                <span className="text-ink-mute text-[14px]">of {d.authorized_days} authorized</span>
              </span>
            }
            right={
              <span className={`numeric text-[14px] ${overAuth ? "text-[var(--color-coral)]" : atAuth ? "text-[var(--color-amber)]" : "text-[var(--color-emerald)]"}`}>
                {d.los_variance_pct >= 0 ? "+" : ""}{d.los_variance_pct.toFixed(1)}%
              </span>
            }
          />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <LosTrack day={d.day_of_stay} benchmark={d.los_drg_benchmark} authorized={d.authorized_days} />
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono-tight text-[10px] text-ink-faint">
              <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-emerald)] mr-1" />current</span>
              <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-ink-faint)] mr-1" />DRG benchmark {d.los_drg_benchmark}d</span>
              <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-champagne)] mr-1" />payor auth {d.authorized_days}d</span>
            </div>
          </div>
        </Panel>

        {/* Medical necessity */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Medical necessity · payor criteria"
            title={
              <span className="flex items-baseline gap-2">
                <span className="numeric" style={{ color: mnPct >= 90 ? "var(--color-emerald)" : mnPct >= 75 ? "var(--color-champagne)" : "var(--color-coral)" }}>{mnPct}%</span>
                <span className="text-ink-mute text-[13px]">documented</span>
              </span>
            }
          />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            {gaps.length === 0 ? (
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-[var(--color-emerald)]" />
                <span className="text-[12px] text-[var(--color-emerald)]">All payor criteria met · no gaps detected</span>
              </div>
            ) : (
              <>
                <div className="eyebrow text-[var(--color-coral)] mb-1.5">Gaps the agent flagged</div>
                <ul className="flex flex-col gap-1.5">
                  {gaps.map((g, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 rounded-md border border-[var(--color-coral)]/25 bg-[var(--color-coral)]/5 px-2.5 py-2"
                    >
                      <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[var(--color-coral)]" />
                      <span className="text-[12px] leading-snug text-ink-soft">{g}</span>
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-2 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-2.5 py-1.5">
                  <span className="font-mono-tight text-[10.5px] text-ink-faint">
                    Surface these to the attending now — gaps caught here become denial reasons after discharge.
                  </span>
                </div>
              </>
            )}
          </div>
        </Panel>

        {/* Avoidable day */}
        {d.avoidable_day_flag === 1 && d.avoidable_day_reason && (
          <Panel className="overflow-hidden">
            <PanelHeader eyebrow="Avoidable day flagged" title="Today is non-clinical" />
            <div className="hairline-x mx-5" />
            <div className="px-4 py-3">
              <div className="flex items-start gap-2 rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-2.5 py-2">
                <ClockAlert size={11} className="mt-0.5 shrink-0 text-[var(--color-amber)]" />
                <span className="text-[12px] leading-snug text-ink-soft">{d.avoidable_day_reason}</span>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* Right — auth extension drafter (when relevant) + discharge readiness */}
      <div className="col-span-7 flex min-h-0 flex-col gap-3 overflow-y-auto pl-1">
        {/* Discharge readiness */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Discharge readiness · LSTM model"
            title={
              <span className="flex items-baseline gap-2">
                <span className="numeric" style={{ color: drPct >= 80 ? "var(--color-emerald)" : drPct >= 50 ? "var(--color-champagne)" : "var(--color-coral)" }}>{drPct}%</span>
                <span className="text-ink-mute text-[13px]">ready</span>
              </span>
            }
            right={
              drPct >= 80 ? <Pill tone="good" dot>Discharge today</Pill>
              : drPct >= 50 ? <Pill tone="champagne" dot>Trending</Pill>
              : <Pill tone="warn" dot>Continued stay</Pill>
            }
          />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${drPct}%` }}
                transition={{ type: "spring", stiffness: 70, damping: 18 }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-coral)] via-[var(--color-champagne)] to-[var(--color-emerald)]"
              />
            </div>
            <p className="mt-2.5 font-mono-tight text-[10.5px] leading-relaxed text-ink-faint">
              Predicted from vital sign trends, lab trajectory, mobility assessments, and physician note sentiment over the last {d.day_of_stay} days.
            </p>
          </div>
        </Panel>

        {/* Pre-auth extension drafter */}
        {(overAuth || atAuth) && (
          <Panel className="flex flex-col overflow-hidden">
            <PanelHeader
              eyebrow="Pre-auth extension · auto-drafted"
              title={`Request ${d.payor_name} for additional days`}
              right={
                <Pill tone={
                  ext ? "good"
                  : d.auth_extension_status === "DRAFTED" ? "champagne"
                  : d.auth_extension_status === "REJECTED" ? "bad"
                  : "neutral"
                } dot>
                  {ext ? "Submitted" :
                   d.auth_extension_status === "DRAFTED" ? "Drafted" :
                   d.auth_extension_status === "REJECTED" ? "Rejected" :
                   d.auth_extension_status === "APPROVED" ? "Approved" :
                   "Not started"}
                </Pill>
              }
            />
            <div className="hairline-x mx-5" />
            {d.auth_extension_letter_md ? (
              <>
                <div className="flex-1 max-h-[360px] overflow-y-auto px-5 py-3">
                  <article className="text-[12px] leading-relaxed text-ink-soft">
                    <Markdown text={d.auth_extension_letter_md} />
                  </article>
                </div>
                <div className="border-t border-line-soft px-5 py-2.5">
                  {ext ? (
                    <div className="flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/10 px-3 py-2">
                      <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
                      <span className="text-[11.5px] text-[var(--color-emerald)]">Extension request submitted to {d.payor_name} · UM team will review</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" className="flex-1" onClick={() => submitExtension(d.id)}>
                        <Send size={11} /> Submit extension to {d.payor_name}
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw size={11} /> Re-draft
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="px-5 py-4 text-[12px] text-ink-faint">
                {d.auth_extension_status === "REJECTED"
                  ? "Previous extension request was rejected — escalate to medical director peer-to-peer."
                  : "Auto-draft extension letter from current clinical justification?"}
                {d.auth_extension_status !== "REJECTED" && (
                  <Button variant="primary" size="sm" className="mt-3"><Send size={11} /> Draft extension letter</Button>
                )}
              </div>
            )}
          </Panel>
        )}

        {/* Indicators (mock vital trends as bars) */}
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Concurrent indicators · last 24h" title="Clinical pulse" />
          <div className="hairline-x mx-5" />
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            <Indicator label="Vitals stability" value={d.acuity === "CRITICAL" ? 35 : d.acuity === "WATCH" ? 64 : 88} />
            <Indicator label="Lab trajectory" value={d.acuity === "IMPROVING" ? 91 : d.acuity === "STABLE" ? 78 : 56} />
            <Indicator label="Mobility / ADL" value={drPct} />
            <Indicator label="Med necessity score" value={mnPct} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LosTrack({ day, benchmark, authorized }: { day: number; benchmark: number; authorized: number }) {
  const max = Math.max(day, benchmark, authorized) + 1;
  const pct = (v: number) => (v / max) * 100;
  const overAuth = day > authorized;
  const atAuth = day === authorized;
  return (
    <div className="relative h-7">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-[var(--color-canvas-deep)]" />
      {/* day fill */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct(day)}%` }}
        transition={{ type: "spring", stiffness: 70, damping: 18 }}
        className="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-full"
        style={{ background: overAuth ? "var(--color-coral)" : atAuth ? "var(--color-amber)" : "var(--color-emerald)" }}
      />
      {/* benchmark marker */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${pct(benchmark)}%` }}>
        <div className="h-5 w-px bg-[var(--color-ink-faint)]" />
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono-tight text-[9.5px] whitespace-nowrap text-ink-faint">{benchmark}d</div>
      </div>
      {/* authorized marker */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${pct(authorized)}%` }}>
        <div className="h-7 w-[2px] bg-[var(--color-champagne)] rounded-full" />
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono-tight text-[9.5px] whitespace-nowrap text-[var(--color-champagne)]">auth {authorized}d</div>
      </div>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: number }) {
  const c = value >= 80 ? "var(--color-emerald)" : value >= 60 ? "var(--color-champagne)" : "var(--color-coral)";
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow truncate">{label}</div>
          <div className="mt-1 numeric text-[18px]" style={{ color: c }}>{value}<span className="text-[12px] text-ink-mute">%</span></div>
        </div>
        <Activity size={11} style={{ color: c }} />
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-canvas)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: 0.1, type: "spring", stiffness: 70, damping: 18 }}
          className="h-full rounded-full"
          style={{ background: c }}
        />
      </div>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        if (block.startsWith("- ") || block.startsWith("· ")) {
          return (
            <ul key={i} className="ml-1 list-none space-y-0.5">
              {block.split("\n").map((line, j) => (
                <li key={j} className="font-mono-tight text-[10.5px] text-ink-soft">{renderInline(line.replace(/^[-·]\s*/, "· "))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="text-[12px] leading-relaxed text-ink-soft">{renderInline(block)}</p>;
      })}
    </div>
  );
}

function renderInline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
