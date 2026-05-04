import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Clock, Stethoscope, Wrench, FileText, Scale } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDenials } from "@/store/useDenials";

type Row = {
  id: string;
  claim_id: string;
  patient_name: string;
  patient_initials: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  category: string;
  reason_code: string;
  reason_text: string;
  denied_amount_idr: number;
  denied_at: string;
  appeal_deadline_at: string;
  appeal_status: string;
  success_probability: number;
};

const CATEGORY_TONE: Record<string, "warn" | "info" | "violet" | "champagne"> = {
  CLINICAL: "warn",
  TECHNICAL: "info",
  ADMINISTRATIVE: "violet",
  CONTRACTUAL: "champagne",
};

const CATEGORY_ICON: Record<string, any> = {
  CLINICAL: Stethoscope,
  TECHNICAL: Wrench,
  ADMINISTRATIVE: FileText,
  CONTRACTUAL: Scale,
};

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral" | "champagne"> = {
  NEW: "neutral",
  DRAFTING: "champagne",
  READY: "info",
  SUBMITTED: "info",
  WON: "good",
  LOST: "bad",
};

function daysToDeadline(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function DenialsQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const { openDenial, selectedDenialId } = useDenials();

  useEffect(() => {
    query<Row>(
      `SELECT d.id, d.claim_id,
              p.name AS patient_name,
              substr(p.name, 1, 1) || substr(p.name, instr(p.name, ' ') + 1, 1) AS patient_initials,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              d.category, d.reason_code, d.reason_text,
              d.denied_amount_idr, d.denied_at, d.appeal_deadline_at,
              d.appeal_status, d.success_probability
         FROM denials d
         JOIN claims c ON c.id = d.claim_id
         JOIN patients p ON p.id = c.patient_id
         JOIN payors py ON py.id = d.payor_id
         JOIN hospitals h ON h.id = d.hospital_id
        ORDER BY (d.denied_amount_idr * d.success_probability) /
                 CASE WHEN julianday(d.appeal_deadline_at) - julianday('now') < 1 THEN 1
                      ELSE julianday(d.appeal_deadline_at) - julianday('now') END
                 DESC`,
    ).then(setRows);
  }, []);

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Open denials · ranked by ROI = $ × P(win) ÷ days-to-deadline"
        title="Appeal queue"
        right={<Pill tone="champagne" dot>{rows.length} open</Pill>}
      />
      <div className="hairline-x mx-5" />

      <div className="grid shrink-0 grid-cols-[28px_minmax(0,2.6fr)_minmax(0,1.2fr)_88px_minmax(0,1.4fr)_94px_94px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        <span></span>
        <span>Patient · Reason</span>
        <span>Payor</span>
        <span>Category</span>
        <span>Status</span>
        <span className="text-right">$ at risk</span>
        <span className="text-right">Deadline · P(win)</span>
        <span></span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.map((r, i) => {
          const dtd = daysToDeadline(r.appeal_deadline_at);
          const Icon = CATEGORY_ICON[r.category];
          return (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => openDenial(r.id)}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className={cn(
                "grid grid-cols-[28px_minmax(0,2.6fr)_minmax(0,1.2fr)_88px_minmax(0,1.4fr)_94px_94px_60px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40",
                selectedDenialId === r.id && "bg-[var(--color-panel-2)]/60",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-[var(--color-canvas-deep)] font-mono-tight text-[9.5px] text-ink-mute">
                {r.patient_initials}
              </span>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] text-ink">{r.patient_name}</span>
                  <span className="font-mono-tight text-[10px] text-ink-faint">· claim {r.claim_id}</span>
                </div>
                <span className="line-clamp-1 font-mono-tight text-[10.5px] text-ink-faint" title={r.reason_text}>
                  {r.reason_code} · {r.reason_text}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.payor_color }} />
                <span className="truncate text-[11.5px] text-ink-soft">{r.payor_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Pill tone={CATEGORY_TONE[r.category]} size="xs">
                  <Icon size={9} />
                  {r.category.toLowerCase()}
                </Pill>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Pill tone={STATUS_TONE[r.appeal_status]} dot size="xs">{r.appeal_status.toLowerCase()}</Pill>
              </div>
              <div className="text-right numeric text-[12.5px] text-ink-soft">
                {fmtCompactIDR(r.denied_amount_idr)}
              </div>
              <div className="flex items-center justify-end gap-1.5 font-mono-tight text-[11px]">
                <span className={cn(
                  "flex items-center gap-0.5",
                  dtd <= 3 ? "text-[var(--color-coral)]" : dtd <= 7 ? "text-[var(--color-amber)]" : "text-ink-mute",
                )}>
                  <Clock size={10} />
                  {dtd}d
                </span>
                <span className="text-ink-faint">·</span>
                <span className="text-ink-soft">{Math.round(r.success_probability * 100)}%</span>
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
