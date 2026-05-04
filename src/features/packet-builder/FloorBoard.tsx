import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, AlertTriangle, Bot, Hourglass, ShieldCheck, Send } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { query } from "@/lib/db";
import { fmtCompactIDR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { usePacketBuilder } from "@/store/usePacketBuilder";

export type FloorClaim = {
  id: string;
  patient_name: string;
  patient_initials: string;
  ward_class: string;
  payor_name: string;
  payor_color: string;
  hospital_name: string;
  drg: string;
  dx: string;
  gross_idr: number;
  expected_reimb_idr: number;
  acceptance_score: number;
  predicted_dtp_days: number | null;
  stage: string;
  days_in_stage: number;
  agent_step: string | null;
  risk_flag: string | null;
};

// `trigger` ties each kanban column to its spec workflow trigger event
// (Module A pre-admission, C.6 step 1 discharge, C.5.4 HITL, C.6 step 8 submit).
const STAGES = [
  { key: "BUILDING", label: "Building", Icon: Bot, tone: "champagne", trigger: "On discharge order" },
  { key: "AWAITING_PREAUTH", label: "Pre-auth", Icon: Hourglass, tone: "violet", trigger: "Pre-admission" },
  { key: "READY", label: "Ready", Icon: ShieldCheck, tone: "emerald", trigger: "Scrubbed · awaiting human" },
  { key: "SUBMITTED", label: "Adjudicating", Icon: Send, tone: "azure", trigger: "Post-submit · payor reviewing" },
  { key: "AT_RISK", label: "At risk", Icon: AlertTriangle, tone: "coral", trigger: "Scrub blocked · needs human" },
] as const;

// Full-text labels for risk flags shown on cards — keep concise but readable.
export const RISK_FLAG_LABEL: Record<string, string> = {
  PA_MISMATCH: "Pre-auth scope mismatch",
  MISSING_DOC: "Missing supporting document",
  LOS_VARIANCE: "LOS exceeds DRG cap",
  AGING_PA: "Pre-auth aging beyond SLA",
};

const TONE_BG: Record<string, string> = {
  champagne: "bg-[var(--color-champagne)]/10 text-[var(--color-champagne)] border-[var(--color-champagne)]/25",
  violet: "bg-[var(--color-violet)]/10 text-[var(--color-violet)] border-[var(--color-violet)]/25",
  emerald: "bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border-[var(--color-emerald)]/25",
  azure: "bg-[var(--color-azure)]/10 text-[var(--color-azure)] border-[var(--color-azure)]/25",
  coral: "bg-[var(--color-coral)]/10 text-[var(--color-coral)] border-[var(--color-coral)]/25",
};

export function FloorBoard() {
  const [claims, setClaims] = useState<FloorClaim[]>([]);
  const { selectedClaimId, openClaim } = usePacketBuilder();
  const boardRefreshTick = usePacketBuilder((s) => s.boardRefreshTick);

  useEffect(() => {
    query<FloorClaim>(
      `SELECT c.id,
              p.name AS patient_name,
              substr(p.name, 1, 1) || substr(p.name, instr(p.name, ' ') + 1, 1) AS patient_initials,
              p.ward_class,
              py.name AS payor_name, py.color AS payor_color,
              h.name AS hospital_name,
              c.drg, c.dx, c.gross_idr, c.expected_reimb_idr,
              c.acceptance_score, c.predicted_dtp_days, c.stage, c.days_in_stage,
              c.agent_step, c.risk_flag
         FROM claims c
         JOIN patients p ON p.id = c.patient_id
         JOIN payors py ON py.id = c.payor_id
         JOIN hospitals h ON h.id = c.hospital_id
        WHERE c.stage IN ('BUILDING','AWAITING_PREAUTH','READY','SUBMITTED','AT_RISK')`,
    ).then(setClaims);
  }, [boardRefreshTick]);

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Live · all 4 sites"
        title="Claims floor"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="good" dot>{claims.length} in flight</Pill>
          </div>
        }
      />
      <div className="hairline-x mx-5" />

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-2 p-3">
        {STAGES.map((s) => {
          const items = claims.filter((c) => c.stage === s.key);
          const total = items.reduce((a, c) => a + c.expected_reimb_idr, 0);
          return (
            <div key={s.key} className="flex min-h-0 flex-col rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/35">
              {/* Column header */}
              <div className="flex items-center justify-between gap-1 border-b border-line-soft px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", TONE_BG[s.tone])}>
                    <s.Icon size={11} strokeWidth={1.7} />
                  </span>
                  <span className="truncate text-[12px] font-medium text-ink">{s.label}</span>
                </div>
                <span className="shrink-0 font-mono-tight text-[11px] text-ink-faint">{items.length}</span>
              </div>
              <div className="border-b border-line-soft px-2.5 py-1.5">
                <div className="font-mono-tight text-[9px] uppercase tracking-[0.14em] text-ink-faint truncate">{s.trigger}</div>
                <div className="mt-0.5 font-mono-tight text-[10px] text-ink-mute">{fmtCompactIDR(total)}</div>
              </div>
              {/* Claim cards */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {items.map((c, i) => (
                  <ClaimCard
                    key={c.id}
                    claim={c}
                    index={i}
                    selected={selectedClaimId === c.id}
                    onSelect={() => openClaim(c.id)}
                  />
                ))}
                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center font-mono-tight text-[10.5px] text-ink-faint">
                    No claims
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ClaimCard({
  claim, selected, onSelect, index,
}: {
  claim: FloorClaim; selected: boolean; onSelect: () => void; index: number;
}) {
  const acc = Math.round(claim.acceptance_score * 100);
  const accColor = acc >= 80 ? "var(--color-emerald)" : acc >= 60 ? "var(--color-champagne)" : "var(--color-coral)";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 280, damping: 24 }}
      whileHover={{ y: -1 }}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-md border bg-[var(--color-canvas-deep)]/60 px-2.5 py-2 text-left transition-colors",
        selected ? "border-[var(--color-champagne)]/60 bg-[var(--color-panel-raised)]" : "border-line-soft hover:border-line-strong",
      )}
    >
      {/* Payor color stripe */}
      <span
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
        style={{ background: claim.payor_color }}
      />
      <div className="flex items-start justify-between gap-1.5 pl-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-[var(--color-panel)] font-mono-tight text-[9px] text-ink-mute">
            {claim.patient_initials}
          </span>
          <span className="truncate text-[11.5px] font-medium text-ink">{claim.patient_name.split(" ")[0]}</span>
        </div>
        <span className="numeric text-[11.5px]" style={{ color: accColor }}>{acc}%</span>
      </div>
      <div className="pl-1.5 font-mono-tight text-[10px] leading-snug text-ink-faint line-clamp-2">
        {claim.drg} · {claim.dx.split(" · ")[0]}
      </div>
      <div className="flex items-center justify-between pl-1.5 font-mono-tight text-[10px]">
        <span className="text-ink-mute">{fmtCompactIDR(claim.expected_reimb_idr)}</span>
        <span className="text-ink-faint">
          {claim.days_in_stage === 0 ? "today" : `${claim.days_in_stage}d`}
        </span>
      </div>
      {claim.risk_flag && (
        <div className="ml-1.5 flex items-center gap-1 rounded-sm border border-[var(--color-coral)]/30 bg-[var(--color-coral)]/10 px-1.5 py-0.5 font-mono-tight text-[9.5px] text-[var(--color-coral)]">
          <AlertTriangle size={9} />
          {RISK_FLAG_LABEL[claim.risk_flag] ?? claim.risk_flag}
        </div>
      )}
      <AnimatePresence>
        {selected && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -right-1 top-1/2 -translate-y-1/2 text-[var(--color-champagne)]"
          >
            <ChevronRight size={12} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
