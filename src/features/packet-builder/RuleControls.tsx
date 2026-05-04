import { motion } from "motion/react";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { usePacketBuilder } from "@/store/usePacketBuilder";

export function RuleControls() {
  const { attachMri, attachConservativeNarrative, attachSyntaxScore, toggleAttach, emittedSteps } = usePacketBuilder();
  const triggered = new Set(emittedSteps.map((s) => s.ruleId).filter(Boolean));

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="Payor-learned rules · 6"
        title="Override library"
        right={
          <span className="font-mono-tight text-[10.5px] text-ink-faint">{triggered.size} fired this run</span>
        }
      />
      <div className="hairline-x mx-5" />
      <div className="flex flex-col gap-3 p-5">
        <RuleRow
          active={attachMri}
          onToggle={() => toggleAttach("attachMri")}
          fired={triggered.has("r1")}
          title="Attach pelvic MRI report"
          evidence={184}
          lift={11.4}
          payor="BPJS"
        />
        <RuleRow
          active={attachConservativeNarrative}
          onToggle={() => toggleAttach("attachConservativeNarrative")}
          fired={triggered.has("r2")}
          title="Lead with conservative-management failure narrative"
          evidence={213}
          lift={8.3}
          payor="BPJS"
        />
        <RuleRow
          active={attachSyntaxScore}
          onToggle={() => toggleAttach("attachSyntaxScore")}
          fired={false}
          title="SYNTAX score worksheet"
          evidence={89}
          lift={18.0}
          payor="AIA"
          notApplicable
        />
      </div>
    </Panel>
  );
}

function RuleRow({
  active, onToggle, fired, title, evidence, lift, payor, notApplicable,
}: {
  active: boolean; onToggle: () => void; fired: boolean; title: string;
  evidence: number; lift: number; payor: string; notApplicable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3.5 py-2.5">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-ink">{title}</span>
          {fired && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono-tight text-[9.5px] uppercase tracking-[0.16em] text-[var(--color-emerald)]"
            >
              Fired
            </motion.span>
          )}
          {notApplicable && (
            <span className="font-mono-tight text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              n/a · DRG mismatch
            </span>
          )}
        </div>
        <div className="font-mono-tight text-[10.5px] text-ink-faint">
          {payor} · {evidence} threads · +{lift.toFixed(1)} pts historic lift
        </div>
      </div>
      <ToggleChip
        active={active && !notApplicable}
        onToggle={() => !notApplicable && onToggle()}
        label={active && !notApplicable ? "Attached" : "Skip"}
        hint={notApplicable ? "" : `+${lift.toFixed(1)}`}
      />
    </div>
  );
}
