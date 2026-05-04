import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, AlertTriangle, ClockAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { cn } from "@/lib/cn";
import { useCaseReview } from "@/store/useCaseReview";

type Row = {
  id: string;
  patient_name: string;
  patient_initials: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  drg: string;
  dx: string;
  ward_class: string;
  attending_physician: string;
  day_of_stay: number;
  authorized_days: number;
  los_drg_benchmark: number;
  los_variance_pct: number;
  acuity: string;
  medical_necessity_score: number;
  auth_extension_status: string;
  avoidable_day_flag: number;
  discharge_readiness_score: number;
};

const ACUITY_TONE: Record<string, "good" | "info" | "warn" | "bad" | "neutral"> = {
  STABLE: "info",
  IMPROVING: "good",
  WATCH: "warn",
  CRITICAL: "bad",
};

export function InpatientQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const { open, selectedId } = useCaseReview();

  useEffect(() => {
    query<Row>(
      `SELECT ip.id,
              p.name AS patient_name,
              substr(p.name, 1, 1) || substr(p.name, instr(p.name, ' ') + 1, 1) AS patient_initials,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              ip.drg, ip.dx, ip.ward_class, ip.attending_physician,
              ip.day_of_stay, ip.authorized_days, ip.los_drg_benchmark, ip.los_variance_pct,
              ip.acuity, ip.medical_necessity_score, ip.auth_extension_status,
              ip.avoidable_day_flag, ip.discharge_readiness_score
         FROM inpatients ip
         JOIN patients p ON p.id = ip.patient_id
         JOIN payors py ON py.id = ip.payor_id
         JOIN hospitals h ON h.id = ip.hospital_id
        ORDER BY ip.day_of_stay - ip.authorized_days DESC, ip.day_of_stay DESC`,
    ).then(setRows);
  }, []);

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Concurrent review · all 4 sites"
        title="Inpatient board"
        right={<Pill tone="good" dot>{rows.length} active</Pill>}
      />
      <div className="hairline-x mx-5" />

      <div className="grid shrink-0 grid-cols-[28px_minmax(0,2.2fr)_minmax(0,1.0fr)_minmax(0,1.2fr)_140px_94px_88px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        <span></span>
        <span>Patient · Diagnosis</span>
        <span>Payor</span>
        <span>Attending</span>
        <span>Day · benchmark · auth</span>
        <span className="text-right">Med-nec.</span>
        <span className="text-right">Acuity</span>
        <span></span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.map((r, i) => {
          const overAuth = r.day_of_stay > r.authorized_days;
          const atAuth = r.day_of_stay === r.authorized_days;
          const mnPct = Math.round(r.medical_necessity_score * 100);
          return (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => open(r.id)}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className={cn(
                "grid grid-cols-[28px_minmax(0,2.2fr)_minmax(0,1.0fr)_minmax(0,1.2fr)_140px_94px_88px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40",
                selectedId === r.id && "bg-[var(--color-panel-2)]/60",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-[var(--color-canvas-deep)] font-mono-tight text-[9.5px] text-ink-mute">
                {r.patient_initials}
              </span>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] text-ink">{r.patient_name}</span>
                  {r.avoidable_day_flag === 1 && (
                    <span className="flex items-center gap-0.5 font-mono-tight text-[9.5px] text-[var(--color-amber)]">
                      <ClockAlert size={9} />
                      avoidable
                    </span>
                  )}
                </div>
                <span className="truncate font-mono-tight text-[10.5px] text-ink-faint">
                  {r.drg} · {r.dx.split(" · ")[0]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.payor_color }} />
                <span className="truncate text-[11.5px] text-ink-soft">{r.payor_name}</span>
              </div>
              <div className="flex min-w-0 flex-col font-mono-tight text-[10.5px]">
                <span className="truncate text-ink-soft">{r.attending_physician}</span>
                <span className="truncate text-ink-faint">{r.hospital_name} · {r.ward_class}</span>
              </div>
              <LosBar
                day={r.day_of_stay}
                benchmark={r.los_drg_benchmark}
                authorized={r.authorized_days}
                overAuth={overAuth}
                atAuth={atAuth}
              />
              <div className="text-right">
                <div className="numeric text-[12.5px]" style={{ color: mnPct >= 90 ? "var(--color-emerald)" : mnPct >= 75 ? "var(--color-champagne)" : "var(--color-coral)" }}>
                  {mnPct}%
                </div>
              </div>
              <div className="flex justify-end">
                <Pill tone={ACUITY_TONE[r.acuity]} dot size="xs">
                  {r.acuity.toLowerCase()}
                </Pill>
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

// Inline LOS visualization — day count vs DRG benchmark vs authorized
function LosBar({
  day, benchmark, authorized, overAuth, atAuth,
}: { day: number; benchmark: number; authorized: number; overAuth: boolean; atAuth: boolean }) {
  const max = Math.max(day, authorized, benchmark) + 1;
  const pct = (v: number) => (v / max) * 100;
  return (
    <div className="flex items-center gap-1.5">
      {/* Bar */}
      <div className="relative flex-1 h-3 rounded-full bg-[var(--color-canvas-deep)]">
        {/* benchmark marker */}
        <div className="absolute top-0 bottom-0 w-px bg-[var(--color-ink-faint)]" style={{ left: `${pct(benchmark)}%` }} />
        {/* authorized marker */}
        <div className="absolute -top-0.5 -bottom-0.5 w-px bg-[var(--color-champagne)]" style={{ left: `${pct(authorized)}%` }} />
        {/* day fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct(day)}%` }}
          transition={{ type: "spring", stiffness: 70, damping: 18 }}
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={{
            background: overAuth ? "var(--color-coral)"
              : atAuth ? "var(--color-amber)"
              : "var(--color-emerald)",
          }}
        />
      </div>
      <span className={cn(
        "shrink-0 font-mono-tight text-[10.5px] tabular-nums whitespace-nowrap",
        overAuth ? "text-[var(--color-coral)]" :
        atAuth ? "text-[var(--color-amber)]" :
        "text-ink-mute",
      )}>
        d{day}/{authorized}
        {overAuth && <AlertTriangle size={9} className="inline ml-0.5 -mt-0.5" />}
      </span>
    </div>
  );
}
