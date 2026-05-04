import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";

type Claim = {
  id: string;
  patient_name: string;
  payor_name: string;
  payor_color: string;
  drg: string;
  dx: string;
  gross_idr: number;
  status: string;
  acceptance_score: number;
  predicted_dtp_days: number | null;
};

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "info" | "champagne" | "neutral"> = {
  PAID: "good",
  SUBMITTED: "info",
  BUILDING: "champagne",
  DENIED: "bad",
};

export function RecentActivity() {
  const [rows, setRows] = useState<Claim[]>([]);

  useEffect(() => {
    query<Claim>(
      `SELECT c.id, p.name AS patient_name, py.name AS payor_name, py.color AS payor_color,
              c.drg, c.dx, c.gross_idr, c.status, c.acceptance_score, c.predicted_dtp_days
         FROM claims c
         JOIN patients p ON p.id = c.patient_id
         JOIN payors py ON py.id = c.payor_id
        ORDER BY c.id DESC`,
    ).then(setRows);
  }, []);

  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        eyebrow="Working · last 14 days"
        title="Recent claim activity"
        right={<span className="font-mono-tight text-[10.5px] text-ink-faint">{rows.length} claims</span>}
      />
      <div className="hairline-x mx-5" />
      <div className="flex flex-col">
        <div className="grid grid-cols-12 gap-2 px-5 py-2.5 font-mono-tight text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          <div className="col-span-4">Patient · DRG</div>
          <div className="col-span-3">Payor</div>
          <div className="col-span-2 text-right">Gross</div>
          <div className="col-span-2 text-right">Acceptance</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        {rows.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="grid grid-cols-12 items-center gap-2 border-t border-line-soft px-5 py-3 hover:bg-[var(--color-panel-2)]/40"
          >
            <div className="col-span-4 flex flex-col">
              <span className="text-[12.5px] text-ink">{r.patient_name}</span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">{r.dx}</span>
            </div>
            <div className="col-span-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.payor_color }} />
              <span className="text-[12px] text-ink-soft">{r.payor_name}</span>
            </div>
            <div className="col-span-2 text-right numeric text-[13px] text-ink-soft">
              {fmtCompactIDR(r.gross_idr)}
            </div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <div className="h-1 w-14 overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(r.acceptance_score * 100)}%`,
                    background:
                      r.acceptance_score >= 0.8
                        ? "var(--color-emerald)"
                        : r.acceptance_score >= 0.55
                          ? "var(--color-champagne)"
                          : "var(--color-coral)",
                  }}
                />
              </div>
              <span className="numeric text-[12px] text-ink-soft">{Math.round(r.acceptance_score * 100)}%</span>
            </div>
            <div className="col-span-1 flex justify-end">
              <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.toLowerCase()}</Pill>
            </div>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}
