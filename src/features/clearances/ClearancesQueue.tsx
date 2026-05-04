import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { fmtCompactIDR, fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useClearances } from "@/store/useClearances";

type Row = {
  id: string;
  patient_name: string;
  patient_initials: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  status: string;
  drg: string;
  dx: string;
  scheduled_admission_at: string;
  episode_cost_idr: number;
  expected_reimb_idr: number;
  patient_liability_idr: number;
  deposit_required_idr: number;
  deposit_collected_idr: number;
  bad_debt_risk_tier: string;
  payment_mode: string;
  gop_status: string;
};

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "champagne" | "neutral"> = {
  CLEARED: "good",
  CONDITIONAL: "champagne",
  PENDING: "warn",
  NOT_CLEARED: "bad",
};

const RISK_TONE: Record<string, "good" | "warn" | "bad"> = {
  LOW: "good",
  MEDIUM: "warn",
  HIGH: "bad",
};

export function ClearancesQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const { open, selectedId } = useClearances();

  useEffect(() => {
    query<Row>(
      `SELECT fc.id,
              p.name AS patient_name,
              substr(p.name, 1, 1) || substr(p.name, instr(p.name, ' ') + 1, 1) AS patient_initials,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              fc.status, fc.drg, fc.dx, fc.scheduled_admission_at,
              fc.episode_cost_idr, fc.expected_reimb_idr, fc.patient_liability_idr,
              fc.deposit_required_idr, fc.deposit_collected_idr, fc.bad_debt_risk_tier,
              fc.payment_mode, fc.gop_status
         FROM clearances fc
         JOIN patients p ON p.id = fc.patient_id
         JOIN payors py ON py.id = fc.payor_id
         JOIN hospitals h ON h.id = fc.hospital_id
        ORDER BY fc.scheduled_admission_at`,
    ).then(setRows);
  }, []);

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Today's admissions · all 4 sites"
        title="Clearance queue"
        right={<Pill tone="champagne" dot>{rows.length} cases</Pill>}
      />
      <div className="hairline-x mx-5" />

      <div className="grid shrink-0 grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.2fr)_94px_94px_94px_88px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        <span></span>
        <span>Patient · DRG</span>
        <span>Payor</span>
        <span className="text-right">Episode cost</span>
        <span className="text-right">Patient liab.</span>
        <span className="text-right">Deposit</span>
        <span className="text-right">Status · risk</span>
        <span></span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.map((r, i) => {
          const collected = (r.deposit_collected_idr ?? 0) >= (r.deposit_required_idr ?? 0) && r.deposit_required_idr > 0;
          return (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => open(r.id)}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className={cn(
                "grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.2fr)_94px_94px_94px_88px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40",
                selectedId === r.id && "bg-[var(--color-panel-2)]/60",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-[var(--color-canvas-deep)] font-mono-tight text-[9.5px] text-ink-mute">
                {r.patient_initials}
              </span>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] text-ink">{r.patient_name}</span>
                  <span className="font-mono-tight text-[10px] text-ink-faint">· adm. {fmtTime(r.scheduled_admission_at)}</span>
                </div>
                <span className="truncate font-mono-tight text-[10.5px] text-ink-faint">
                  {r.drg} · {r.dx.split(" · ")[0]} · {r.hospital_name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.payor_color }} />
                <span className="truncate text-[11.5px] text-ink-soft">{r.payor_name}</span>
              </div>
              <div className="text-right numeric text-[12px] text-ink-soft">
                {fmtCompactIDR(r.episode_cost_idr)}
              </div>
              <div className="text-right numeric text-[12px] text-ink-mute">
                {fmtCompactIDR(r.patient_liability_idr)}
              </div>
              <div className="text-right">
                <div className="numeric text-[12px]" style={{ color: collected ? "var(--color-emerald)" : "var(--color-coral)" }}>
                  {fmtCompactIDR(r.deposit_collected_idr ?? 0)}
                </div>
                <div className="font-mono-tight text-[9.5px] text-ink-faint">
                  of {fmtCompactIDR(r.deposit_required_idr ?? 0)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <Pill tone={STATUS_TONE[r.status]} dot size="xs">
                  {r.status.toLowerCase().replace("_", " ")}
                </Pill>
                <span className={`font-mono-tight text-[9.5px] ${
                  RISK_TONE[r.bad_debt_risk_tier] === "good" ? "text-[var(--color-emerald)]" :
                  RISK_TONE[r.bad_debt_risk_tier] === "warn" ? "text-[var(--color-amber)]" :
                  "text-[var(--color-coral)]"
                }`}>
                  {r.bad_debt_risk_tier.toLowerCase()} risk
                </span>
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
