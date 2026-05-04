import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/cn";

export function MetricNumber({
  value,
  prefix,
  suffix,
  decimals = 0,
  className,
  durationKey,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  durationKey?: string | number;
}) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 80, damping: 18, mass: 0.8 });
  const display = useTransform(spring, (v) => {
    const n = decimals === 0 ? Math.round(v) : v;
    const formatted = n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
  });

  useEffect(() => {
    mv.set(value);
  }, [value, mv, durationKey]);

  // tabular-nums + numeric utility prevents layout shift during the spring tick.
  return <motion.span className={cn("numeric tabular-nums", className)}>{display}</motion.span>;
}
