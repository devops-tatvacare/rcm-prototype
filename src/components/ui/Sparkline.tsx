import { useId } from "react";

export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = "var(--color-emerald)",
  fill = "rgba(52,211,153,0.18)",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  const id = useId();
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1e-6, max - min);
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => [i * step, height - ((v - min) / span) * (height - 4) - 2] as const);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${path} L${(points[points.length - 1][0]).toFixed(1)} ${height} L0 ${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sp-${id})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={stroke} />
    </svg>
  );
}
