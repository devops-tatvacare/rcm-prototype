import { motion } from "motion/react";
import { useMemo } from "react";

type Row = { d: string; billed_idr: number; collected_idr: number; denied_idr: number };

const H = 230;
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export function CashFlow({ data }: { data: Row[] }) {
  const series = useMemo(() => data, [data]);
  if (!series.length) return <div className="h-[230px]" />;
  const max = Math.max(...series.map((r) => r.billed_idr));
  const stepX = (W: number) => (W - PAD_X * 2) / Math.max(1, series.length - 1);
  const yFor = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM);

  return (
    <div className="relative w-full px-2">
      <svg viewBox="0 0 1000 240" preserveAspectRatio="none" className="h-[230px] w-full">
        <defs>
          <linearGradient id="cf-billed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(231,192,138,0.45)" />
            <stop offset="100%" stopColor="rgba(231,192,138,0.04)" />
          </linearGradient>
          <linearGradient id="cf-collected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(52,211,153,0.55)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.04)" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={PAD_X} x2={1000 - PAD_X} y1={yFor(max * g)} y2={yFor(max * g)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        ))}

        {/* billed area */}
        <Series data={series} accessor="billed_idr" yFor={yFor} stepX={stepX(1000)} max={max} fill="url(#cf-billed)" stroke="#e7c08a" />
        {/* collected area */}
        <Series data={series} accessor="collected_idr" yFor={yFor} stepX={stepX(1000)} max={max} fill="url(#cf-collected)" stroke="#34d399" />

        {/* denied bars */}
        {series.map((r, i) => {
          const x = PAD_X + i * stepX(1000) - 1.5;
          const y = yFor(r.denied_idr);
          return (
            <motion.rect
              key={i}
              initial={{ height: 0, y: H - PAD_BOTTOM }}
              animate={{ height: H - PAD_BOTTOM - y + PAD_TOP, y }}
              transition={{ delay: i * 0.012, type: "spring", stiffness: 90, damping: 18 }}
              x={x}
              width={3}
              fill="rgba(251,113,133,0.5)"
            />
          );
        })}

        {/* axis ticks */}
        {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
          <text key={i} x={PAD_X + i * stepX(1000)} y={H + 6} textAnchor="middle" className="fill-[var(--color-ink-faint)] font-mono-tight text-[9.5px]">
            {series[i]?.d.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Series({
  data, accessor, yFor, stepX, fill, stroke,
}: {
  data: Row[];
  accessor: keyof Row;
  yFor: (v: number) => number;
  stepX: number;
  max: number;
  fill: string;
  stroke: string;
}) {
  const pts = data.map((r, i) => [PAD_X + i * stepX, yFor(r[accessor] as number)] as const);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)} ${H - PAD_BOTTOM} L${PAD_X} ${H - PAD_BOTTOM} Z`;

  return (
    <g>
      <motion.path d={area} fill={fill} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </g>
  );
}
