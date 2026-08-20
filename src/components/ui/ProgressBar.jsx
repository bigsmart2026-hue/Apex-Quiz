import { motion } from 'framer-motion';

/**
 * Animated progress bar.
 * @param {{ value: number (0-1), label?: string, barClassName?: string }} props
 */
export default function ProgressBar({ value, label, barClassName = 'bg-amber-500' }) {
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>{label}</span>
          <span className="font-semibold tabular-nums">{Math.round(clamped * 100)}%</span>
        </div>
      )}
      <div
        className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className={`h-full rounded-full ${barClassName}`}
          initial={false}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}