import { useEffect, useId } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

const SIZE = 168;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const ARC = 0.74; // 0..1 of full circle (top opening)

export function Gauge({
  value,
  label,
}: {
  value: number; // 0..100
  label?: string;
}) {
  const id = useId();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 70, damping: 14, mass: 0.9 });
  const dashOffset = useTransform(spring, (v) => CIRC * ARC * (1 - v / 100));
  const display = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    mv.set(Math.max(0, Math.min(100, value)));
  }, [value, mv]);

  const rotation = -90 - (ARC * 360) / 2;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={SIZE} height={SIZE} className="-rotate-[0deg]">
        <defs>
          <linearGradient id={`g-track-${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id={`g-fill-${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="55%" stopColor="#e7c08a" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${rotation} ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#g-track-${id})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC * ARC} ${CIRC}`}
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#g-fill-${id})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC * ARC} ${CIRC}`}
            style={{ strokeDashoffset: dashOffset }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <div className="eyebrow">{label}</div>}
        <div className="mt-1 flex items-baseline">
          <motion.span className="numeric font-display text-[44px] leading-none text-ink">
            {display}
          </motion.span>
          <span className="ml-0.5 font-display text-[15px] text-ink-mute">%</span>
        </div>
      </div>
    </div>
  );
}
