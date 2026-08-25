import { Shield, Star, Crown, Gem, Trophy } from 'lucide-react';
import { LEVELS, MAX_LEVEL } from '../utils/progression';

const LEVEL_ICONS = {
  1: Shield,
  2: Star,
  3: Crown,
  4: Gem,
  5: Trophy,
};

/**
 * Level badge for the navbar / hero.
 * @param {{ level: number, name: string, description?: string, minScorePct?: number, xp?: number, compact?: boolean }} props
 */
export default function LevelBadge({ level, name, description, compact = false }) {
  const Icon = LEVEL_ICONS[level] || Shield;
  const nextLevel = level < MAX_LEVEL ? LEVELS.find((l) => l.level === level + 1) : null;

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold"
        title={`Level ${level} — ${name}`}
      >
        <Icon className="w-3 h-3" />
        <span>LVL {level}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="font-heading text-slate-900 dark:text-white leading-tight truncate">
          Level {level} — {name}
        </p>
        {description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{description}</p>
        )}
        {nextLevel && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
            Score {nextLevel.minScorePct}%+ to unlock Level {nextLevel.level}
          </p>
        )}
        {level >= MAX_LEVEL && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
            Maximum level reached!
          </p>
        )}
      </div>
    </div>
  );
}
