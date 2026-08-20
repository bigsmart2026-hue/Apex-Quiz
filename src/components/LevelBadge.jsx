import { motion } from 'framer-motion';

/**
 * Level badge for the navbar / hero.
 * @param {{ level: number, name: string, xp: number, progress: number, compact?: boolean }} props
 */
export default function LevelBadge({ level, name, xp, progress, compact = false }) {
  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold"
        title={`Level ${level} — ${name} · ${xp} XP`}
      >
        <span>LVL {level}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex flex-col items-center justify-center shadow-sm flex-shrink-0">
        <span className="text-[10px] font-bold leading-none">LVL</span>
        <span className="text-xl font-black leading-none">{level}</span>
      </div>
      <div className="min-w-0">
        <p className="font-heading text-slate-900 dark:text-white leading-tight truncate">{name}</p>
        <div className="w-36 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-amber-500"
            initial={false}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
          {xp.toLocaleString()} XP
        </p>
      </div>
    </div>
  );
}