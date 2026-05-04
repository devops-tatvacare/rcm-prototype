import { motion } from "motion/react";
import { CalendarDays, IdCard, Stethoscope, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { fmtCompactIDR } from "@/lib/format";

export function PatientCase() {
  return (
    <Panel tone="raised" className="overflow-hidden">
      {/* photo strip */}
      <div className="relative h-20 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(231,192,138,0.25),transparent_60%)]">
        <div className="absolute inset-0 [background-image:linear-gradient(115deg,transparent_30%,rgba(231,192,138,0.08)_50%,transparent_70%)]" />
        <div className="absolute -bottom-7 left-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-champagne)]/30 bg-[var(--color-canvas-deep)] font-display text-[20px] text-[var(--color-champagne)]">
          SW
        </div>
      </div>

      <div className="px-5 pt-10 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow">Active case</div>
            <div className="mt-1 font-display text-[22px] leading-tight tracking-tight text-ink">Sari Wulandari</div>
            <div className="mt-1 flex items-center gap-2 font-mono-tight text-[11px] text-ink-faint">
              <span>MRN-734291</span>
              <span className="opacity-30">·</span>
              <span>F · 47</span>
              <span className="opacity-30">·</span>
              <span>Class I</span>
            </div>
          </div>
          <Pill tone="champagne" dot>BPJS Kesehatan</Pill>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Cell Icon={Stethoscope} label="Diagnosis" value="Endometriosis · N80.9" />
          <Cell Icon={CalendarDays} label="LOS · Disch." value="4 days · 2026-04-29" />
          <Cell Icon={IdCard} label="Policy" value="0001-2099-447-188" />
          <Cell Icon={ShieldCheck} label="Pre-auth" value="PA-77821 · valid 14d" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Money label="Gross billed" value={38_400_000} tone="ink" />
          <Money label="Expected reimb." value={32_900_000} tone="champagne" />
          <Money label="Patient liability" value={5_500_000} tone="ink-mute" />
        </div>

        <div className="mt-5 rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 p-3">
          <div className="eyebrow">Procedure</div>
          <div className="mt-1 font-mono-tight text-[12px] leading-relaxed text-ink-soft">
            Total laparoscopic hysterectomy + bilateral salpingectomy. Indication: refractory endometriosis after 8 months of hormonal therapy. INA-CBG group <span className="text-[var(--color-champagne)]">O-6-13-I</span>.
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Cell({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5"
    >
      <div className="flex items-center gap-1.5 text-ink-faint">
        <Icon size={11} strokeWidth={1.6} />
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mt-1 font-mono-tight text-[12px] text-ink-soft">{value}</div>
    </motion.div>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone: "ink" | "champagne" | "ink-mute" }) {
  const toneClass = tone === "champagne" ? "text-[var(--color-champagne)]" : tone === "ink-mute" ? "text-ink-mute" : "text-ink";
  return (
    <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/40 px-3 py-2.5">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 numeric text-[16px] tracking-tight ${toneClass}`}>{fmtCompactIDR(value)}</div>
    </div>
  );
}
