import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Building2, Send, Pen, Wallet, AlertTriangle, ShieldCheck, TrendingUp, FileText } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { useClearances } from "@/store/useClearances";

type Detail = {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: string;
  ward_class: string;
  policy_number: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  status: string;
  drg: string;
  dx: string;
  scheduled_admission_at: string;
  los_predicted: number;
  los_ci_low: number;
  los_ci_high: number;
  episode_cost_idr: number;
  expected_reimb_idr: number;
  patient_liability_idr: number;
  deposit_required_idr: number;
  deposit_collected_idr: number;
  bad_debt_risk_tier: string;
  payment_mode: string;
  gop_status: string;
  gop_letter_md: string | null;
  consent_status: string;
  consent_signed_at: string | null;
  cost_breakdown_json: string;
};

type Breakdown = { room: number; procedures: number; drugs: number; implants: number; labs: number; other: number };

export function ClearanceDetail() {
  const { selectedId, gopSubmitted, consentSigned, depositCollected, submitGop, signConsent, collectDeposit } = useClearances();
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    query<Detail>(
      `SELECT fc.id,
              p.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex,
              p.ward_class, p.policy_number,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              fc.status, fc.drg, fc.dx, fc.scheduled_admission_at,
              fc.los_predicted, fc.los_ci_low, fc.los_ci_high,
              fc.episode_cost_idr, fc.expected_reimb_idr, fc.patient_liability_idr,
              fc.deposit_required_idr, fc.deposit_collected_idr, fc.bad_debt_risk_tier,
              fc.payment_mode, fc.gop_status, fc.gop_letter_md,
              fc.consent_status, fc.consent_signed_at, fc.cost_breakdown_json
         FROM clearances fc
         JOIN patients p ON p.id = fc.patient_id
         JOIN payors py ON py.id = fc.payor_id
         JOIN hospitals h ON h.id = fc.hospital_id
        WHERE fc.id = ?`,
      [selectedId],
    ).then((rows) => setD(rows[0] ?? null));
  }, [selectedId]);

  if (!d) return <div className="flex h-full items-center justify-center text-ink-faint">Loading…</div>;

  let bd: Breakdown = { room: 0, procedures: 0, drugs: 0, implants: 0, labs: 0, other: 0 };
  try { bd = JSON.parse(d.cost_breakdown_json); } catch { /* noop */ }

  const gopReady = !!d.gop_letter_md;
  const gopWasSubmitted = gopSubmitted[d.id] || d.gop_status === "SUBMITTED" || d.gop_status === "APPROVED";
  const consentWasSigned = consentSigned[d.id] || d.consent_status === "SIGNED";
  const depositMet = depositCollected[d.id] || (d.deposit_collected_idr ?? 0) >= (d.deposit_required_idr ?? 0);

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-3 p-4 pt-12">
      {/* Left — claim story: identity, LOS prediction, cost breakdown, money chain */}
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
            <Pill tone="champagne" dot className="shrink-0">{d.payor_name}</Pill>
          </div>
          <div className="border-t border-line-soft px-4 py-2.5">
            <div className="eyebrow">Diagnosis · DRG</div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{d.dx}</p>
            <div className="mt-1 font-mono-tight text-[10px] text-[var(--color-champagne)]">{d.drg}</div>
          </div>
        </Panel>

        {/* LOS prediction */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Length-of-stay prediction · XGBoost"
            title="Expected LOS"
            right={<span className="numeric text-[14px] text-ink">{d.los_predicted.toFixed(1)}d</span>}
          />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <LOSChart predicted={d.los_predicted} low={d.los_ci_low} high={d.los_ci_high} />
            <div className="mt-2 font-mono-tight text-[10.5px] text-ink-faint">
              80% CI · {d.los_ci_low.toFixed(1)} — {d.los_ci_high.toFixed(1)} days
            </div>
          </div>
        </Panel>

        {/* Cost breakdown waterfall */}
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Episode cost · waterfall" title={fmtCompactIDR(d.episode_cost_idr)} />
          <div className="hairline-x mx-5" />
          <div className="flex flex-col gap-1.5 px-4 py-3">
            <Bar label="Room + ward" value={bd.room} total={d.episode_cost_idr} color="var(--color-azure)" />
            <Bar label="Procedures" value={bd.procedures} total={d.episode_cost_idr} color="var(--color-champagne)" />
            <Bar label="Drugs" value={bd.drugs} total={d.episode_cost_idr} color="var(--color-violet)" />
            {bd.implants > 0 && <Bar label="Implants" value={bd.implants} total={d.episode_cost_idr} color="var(--color-emerald)" />}
            <Bar label="Labs" value={bd.labs} total={d.episode_cost_idr} color="var(--color-amber)" />
            <Bar label="Other" value={bd.other} total={d.episode_cost_idr} color="var(--color-ink-faint)" />
          </div>
        </Panel>

        {/* Money chain — episode → reimb → liability → deposit */}
        <Panel className="overflow-hidden">
          <PanelHeader eyebrow="Reimbursement story" title="Who pays what" />
          <div className="hairline-x mx-5" />
          <div className="px-4 py-3">
            <div className="flex flex-col gap-2">
              <ChainRow icon={TrendingUp} label="Episode cost" v={fmtCompactIDR(d.episode_cost_idr)} tone="ink" />
              <ChainRow icon={Wallet} label={`Expected ${d.payor_name} reimb.`} v={fmtCompactIDR(d.expected_reimb_idr)} tone="champagne" />
              <ChainRow icon={Wallet} label="Patient liability" v={fmtCompactIDR(d.patient_liability_idr)} tone="ink-mute" />
              <ChainRow icon={ShieldCheck} label="Deposit required" v={fmtCompactIDR(d.deposit_required_idr)} tone="emerald" emphasized />
            </div>
            {/* Risk pill */}
            <div className="mt-3 flex items-center justify-between rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={11} className={
                  d.bad_debt_risk_tier === "HIGH" ? "text-[var(--color-coral)]"
                  : d.bad_debt_risk_tier === "MEDIUM" ? "text-[var(--color-amber)]"
                  : "text-[var(--color-emerald)]"
                } />
                <span className="text-[11px] text-ink-soft">Bad-debt risk</span>
              </div>
              <Pill tone={d.bad_debt_risk_tier === "HIGH" ? "bad" : d.bad_debt_risk_tier === "MEDIUM" ? "warn" : "good"} size="xs">
                {d.bad_debt_risk_tier.toLowerCase()}
              </Pill>
            </div>
          </div>
        </Panel>
      </div>

      {/* Right — actions: GOP letter, consent form, deposit */}
      <div className="col-span-7 flex min-h-0 flex-col gap-3 overflow-y-auto pl-1">
        {/* Status banner */}
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Clearance status</span>
              <Pill tone={
                d.status === "CLEARED" ? "good"
                : d.status === "CONDITIONAL" ? "champagne"
                : d.status === "PENDING" ? "warn"
                : "bad"
              } dot>
                {d.status.toLowerCase().replace("_", " ")}
              </Pill>
            </div>
            <div className="flex items-center gap-3 font-mono-tight text-[10.5px] text-ink-faint">
              <span>Payment mode: <span className="text-ink-mute">{d.payment_mode.toLowerCase().replace("_", " ")}</span></span>
            </div>
          </div>
        </Panel>

        {/* GOP / Pre-auth letter */}
        {d.payment_mode === "CASHLESS_INSURED" && (
          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="GOP / Pre-auth letter · auto-drafted"
              title={`To ${d.payor_name}`}
              right={
                <Pill tone={
                  gopWasSubmitted ? "good" :
                  d.gop_status === "DRAFTED" ? "champagne" :
                  d.gop_status === "REJECTED" ? "bad" :
                  "neutral"
                } dot>
                  {gopWasSubmitted ? "Submitted" : d.gop_status.toLowerCase()}
                </Pill>
              }
            />
            <div className="hairline-x mx-5" />
            {gopReady ? (
              <>
                <div className="max-h-[200px] overflow-y-auto px-5 py-3">
                  <article className="text-[12px] leading-relaxed text-ink-soft">
                    <Markdown text={d.gop_letter_md!} />
                  </article>
                </div>
                <div className="border-t border-line-soft px-5 py-2.5">
                  {gopWasSubmitted ? (
                    <div className="flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/10 px-3 py-2">
                      <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
                      <span className="text-[11.5px] text-[var(--color-emerald)]">GOP submitted to {d.payor_name} · awaiting LOG approval (typically 4h)</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" className="flex-1" onClick={() => submitGop(d.id)}>
                        <Send size={11} /> Submit GOP to {d.payor_name}
                      </Button>
                      <Button variant="outline" size="sm">Re-draft</Button>
                    </div>
                  )}
                </div>
              </>
            ) : d.gop_status === "APPROVED" ? (
              <div className="flex items-center gap-2 px-5 py-4">
                <ShieldCheck size={13} className="text-[var(--color-emerald)]" />
                <span className="text-[12px] text-[var(--color-emerald)]">GOP approved · LOG on file · admit anytime today</span>
              </div>
            ) : d.gop_status === "REJECTED" ? (
              <div className="flex items-center gap-2 px-5 py-4">
                <AlertTriangle size={13} className="text-[var(--color-coral)]" />
                <span className="text-[12px] text-[var(--color-coral)]">GOP rejected — fall back to self-pay or appeal eligibility decision</span>
              </div>
            ) : (
              <div className="px-5 py-4 text-[12px] text-ink-faint">No GOP needed for this case.</div>
            )}
          </Panel>
        )}

        {/* Financial consent */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Informed financial consent"
            title="Patient acknowledgement"
            right={<Pill tone={consentWasSigned ? "good" : "warn"} dot>{consentWasSigned ? "Signed" : "Pending"}</Pill>}
          />
          <div className="hairline-x mx-5" />
          <div className="px-5 py-3">
            <p className="text-[12px] leading-snug text-ink-soft">
              I, <span className="text-ink">{d.patient_name}</span>, acknowledge that the estimated total cost of this admission is{" "}
              <span className="numeric text-ink">{fmtCompactIDR(d.episode_cost_idr)}</span>. My insurer ({d.payor_name}) is expected to cover{" "}
              <span className="numeric text-[var(--color-champagne)]">{fmtCompactIDR(d.expected_reimb_idr)}</span>. I am responsible for the balance of{" "}
              <span className="numeric text-ink">{fmtCompactIDR(d.patient_liability_idr)}</span>, of which a deposit of{" "}
              <span className="numeric text-[var(--color-emerald)]">{fmtCompactIDR(d.deposit_required_idr)}</span> is collected at admission.
            </p>
            <p className="mt-2 font-mono-tight text-[10.5px] text-ink-faint">
              Cost estimates are based on the planned procedure ({d.drg}) and the LOS predicted by TatvaCare. Actual costs may vary by ±15%.
            </p>
            {!consentWasSigned && (
              <Button variant="primary" size="sm" className="mt-3" onClick={() => signConsent(d.id)}>
                <Pen size={11} /> Capture patient signature
              </Button>
            )}
            {consentWasSigned && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/10 px-3 py-2">
                <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
                <span className="text-[11.5px] text-[var(--color-emerald)]">
                  Consent captured · signature stored · NHPA / Private Healthcare Facilities Act compliant
                </span>
              </div>
            )}
          </div>
        </Panel>

        {/* Deposit */}
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow={d.deposit_required_idr === 0 ? "No deposit required" : "Deposit collection"}
            title={
              <span className="flex items-baseline gap-2">
                <span className="numeric">{fmtCompactIDR(depositMet ? d.deposit_required_idr : (d.deposit_collected_idr ?? 0))}</span>
                {d.deposit_required_idr > 0 && <span className="text-ink-mute text-[14px]">of {fmtCompactIDR(d.deposit_required_idr)}</span>}
              </span>
            }
            right={<Pill tone={depositMet ? "good" : d.deposit_required_idr > 0 ? "warn" : "neutral"} dot>{depositMet ? "Collected" : d.deposit_required_idr > 0 ? "Pending" : "Waived"}</Pill>}
          />
          {d.deposit_required_idr > 0 && !depositMet && (
            <>
              <div className="hairline-x mx-5" />
              <div className="px-5 py-3">
                <Button variant="primary" size="sm" onClick={() => collectDeposit(d.id)}>
                  <Wallet size={11} /> Mark deposit collected
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function LOSChart({ predicted, low, high }: { predicted: number; low: number; high: number }) {
  const max = Math.ceil(high + 1);
  const pct = (v: number) => (v / max) * 100;
  return (
    <div className="relative h-12">
      {/* axis */}
      <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--color-line-soft)]" />
      {/* CI band */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct(high - low)}%` }}
        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
        style={{ left: `${pct(low)}%` }}
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--color-champagne)]/20 via-[var(--color-champagne)]/40 to-[var(--color-champagne)]/20"
      />
      {/* predicted line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, left: `${pct(predicted)}%` }}
        transition={{ duration: 0.8 }}
        className="absolute top-1/2 h-7 w-[2px] -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--color-champagne)]"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, left: `${pct(predicted)}%` }}
        transition={{ duration: 0.8 }}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 -mt-5 rounded-full bg-[var(--color-champagne)] px-1.5 py-0.5 font-mono-tight text-[10px] text-[var(--color-canvas-deep)]"
      >
        {predicted.toFixed(1)}d
      </motion.div>
      {/* tick labels */}
      <div className="absolute -bottom-4 left-0 right-0 flex justify-between font-mono-tight text-[9.5px] text-ink-faint">
        <span>0</span>
        <span>{Math.round(max / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[88px] shrink-0 text-[11px] text-ink-mute">{label}</span>
      <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 70, damping: 18 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="w-[80px] shrink-0 text-right numeric text-[11px] text-ink-soft">{fmtCompactIDR(value)}</span>
    </div>
  );
}

function ChainRow({ icon: Icon, label, v, tone, emphasized }: { icon: any; label: string; v: string; tone: "ink" | "ink-mute" | "champagne" | "emerald"; emphasized?: boolean }) {
  const c =
    tone === "champagne" ? "text-[var(--color-champagne)]"
    : tone === "emerald" ? "text-[var(--color-emerald)]"
    : tone === "ink-mute" ? "text-ink-mute"
    : "text-ink";
  return (
    <div className={`flex items-center justify-between rounded-md ${emphasized ? "border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/5" : ""} px-2 py-1.5`}>
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-ink-faint" />
        <span className="text-[11.5px] text-ink-soft">{label}</span>
      </div>
      <span className={`numeric text-[13px] tracking-tight ${c}`}>{v}</span>
    </div>
  );
}

// Reused from AppealDrafter pattern
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-2 text-[11.5px] leading-relaxed text-ink-soft">
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
        return <p key={i}>{renderInline(block)}</p>;
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

// Token to silence unused-import warnings on icons we may use later
void FileText;
