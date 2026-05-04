import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Wifi, Database, AlertTriangle, ShieldCheck, Hourglass, Plus, Sparkles } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { query } from "@/lib/db";
import { fmtCompactIDR, fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useEligibility } from "@/store/useEligibility";

type Row = {
  id: string;
  patient_name: string;
  patient_initials: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  status: string;
  source: string;
  tat_seconds: number;
  scheduled_admission_at: string;
  planned_procedure: string;
  pre_auth_required: number;
  pre_auth_status: string;
  annual_limit_remaining_idr: number;
  dispute_risk_score: number;
};

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  ACTIVE: "good",
  DISPUTED: "warn",
  LAPSED: "bad",
  WAITING_PERIOD: "warn",
  SUSPENDED: "bad",
};

export function EligibilityQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const openCheck = useEligibility((s) => s.openCheck);
  const openIntake = useEligibility((s) => s.openIntake);
  const selectedCheckId = useEligibility((s) => s.selectedCheckId);
  const queueRefreshTick = useEligibility((s) => s.queueRefreshTick);
  const pulseId = useEligibility((s) => s.pulseId);

  useEffect(() => {
    query<Row>(
      `SELECT e.id,
              p.name AS patient_name,
              substr(p.name, 1, 1) || substr(p.name, instr(p.name, ' ') + 1, 1) AS patient_initials,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              e.status, e.source, e.tat_seconds,
              e.scheduled_admission_at, e.planned_procedure,
              e.pre_auth_required, e.pre_auth_status,
              e.annual_limit_remaining_idr, e.dispute_risk_score
         FROM eligibility_checks e
         JOIN patients p ON p.id = e.patient_id
         JOIN payors py ON py.id = e.payor_id
         JOIN hospitals h ON h.id = e.hospital_id
        ORDER BY e.completed_at DESC`,
    ).then(setRows);
  }, [queueRefreshTick]);

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Today's eligibility · all 4 sites"
        title="Verification queue"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="good" dot>{rows.length} processed</Pill>
            <Button size="sm" variant="primary" onClick={openIntake}>
              <Plus size={11} /> New verification
            </Button>
          </div>
        }
      />
      <div className="hairline-x mx-5" />

      {/* Header */}
      <div className="grid shrink-0 grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_88px_88px_92px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        <span></span>
        <span>Patient · DRG</span>
        <span>Payor</span>
        <span>Coverage</span>
        <span className="text-right">Pre-auth</span>
        <span className="text-right">Source</span>
        <span className="text-right">TAT</span>
        <span></span>
      </div>

      {/* Rows */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.map((r, i) => {
          const isPulse = pulseId === r.id;
          return (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => openCheck(r.id)}
              initial={{ opacity: 0, y: 3 }}
              animate={isPulse
                ? { opacity: 1, y: 0, backgroundColor: ["rgba(231,192,138,0.18)", "rgba(231,192,138,0.06)", "rgba(231,192,138,0.18)"] }
                : { opacity: 1, y: 0 }}
              transition={isPulse
                ? { backgroundColor: { duration: 1.6, repeat: 2 }, default: { delay: i * 0.025 } }
                : { delay: i * 0.025 }}
              className={cn(
                "relative grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_88px_88px_92px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40",
                selectedCheckId === r.id && "bg-[var(--color-panel-2)]/60",
                isPulse && "shadow-[inset_2px_0_0_var(--color-champagne)]",
              )}
            >
              {isPulse && (
                <span className="absolute right-[78px] top-1/2 -translate-y-1/2 flex items-center gap-0.5 font-mono-tight text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-champagne)]">
                  <Sparkles size={9} />
                  just verified
                </span>
              )}
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-[var(--color-canvas-deep)] font-mono-tight text-[9.5px] text-ink-mute">
                {r.patient_initials}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[12.5px] text-ink">{r.patient_name}</span>
                <span className="truncate font-mono-tight text-[10.5px] text-ink-faint">
                  {r.planned_procedure} · {r.hospital_name} · adm. {fmtTime(r.scheduled_admission_at)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.payor_color }} />
                <span className="truncate text-[11.5px] text-ink-soft">{r.payor_name}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Pill tone={STATUS_TONE[r.status] ?? "neutral"} dot>{r.status.toLowerCase().replace("_", " ")}</Pill>
                {r.status === "ACTIVE" && (
                  <span className="font-mono-tight text-[10px] text-ink-faint truncate">
                    {fmtCompactIDR(r.annual_limit_remaining_idr)} left
                  </span>
                )}
              </div>
              <div className="text-right">
                <PreAuthCell required={!!r.pre_auth_required} status={r.pre_auth_status} />
              </div>
              <div className="flex items-center justify-end gap-1 font-mono-tight text-[10.5px]">
                {r.source === "LIVE_API" ? (
                  <><Wifi size={10} className="text-[var(--color-emerald)]" /> live</>
                ) : (
                  <><Database size={10} className="text-ink-faint" /> cached</>
                )}
              </div>
              <div className="flex items-center justify-end gap-1 font-mono-tight text-[12px]">
                <span className={r.tat_seconds <= 90 ? "text-[var(--color-emerald)]" : "text-[var(--color-coral)]"}>{r.tat_seconds}s</span>
              </div>
              <div className="flex justify-end text-ink-faint">
                <ChevronRight size={13} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </Panel>
  );
}

function PreAuthCell({ required, status }: { required: boolean; status: string }) {
  if (!required) return <span className="font-mono-tight text-[10.5px] text-ink-faint">—</span>;
  const tone =
    status.startsWith("ATTACHED") ? "good" :
    status.startsWith("PENDING") ? "warn" :
    status.includes("MISMATCH") || status.includes("DECLINED") || status.includes("BLOCKED") || status.includes("N/A") ? "bad" :
    "neutral";
  const Icon = tone === "good" ? ShieldCheck : tone === "warn" ? Hourglass : AlertTriangle;
  return (
    <span className="inline-flex items-center gap-1 font-mono-tight text-[10.5px]" style={{
      color: tone === "good" ? "var(--color-emerald)" : tone === "warn" ? "var(--color-amber)" : tone === "bad" ? "var(--color-coral)" : "var(--color-ink-mute)",
    }}>
      <Icon size={10} />
      <span className="truncate max-w-[64px]">{status.split(" · ")[0].toLowerCase()}</span>
    </span>
  );
}
