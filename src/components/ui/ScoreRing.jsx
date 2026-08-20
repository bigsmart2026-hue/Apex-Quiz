import { motion, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Circular score ring with animated count.
 * @param {{ value: number (0-100), size?: number, strokeWidth?: number,
 *           label?: string, colorClass?: string }} props
 */
export default function ScoreRing({
  value,
  size = 140,
  strokeWidth = 10,
  colorClass = 'text-amber-500',
  label = '%',
}) {
  const [display, setDisplay] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);

  const clamped = Math.min(100, Math.max(0, value));
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${clamped}${label}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorClass}
          stroke="currentColor"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold tabular-nums ${colorClass}`}>{display}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{label}</span>
      </div>
    </div>
  );
}