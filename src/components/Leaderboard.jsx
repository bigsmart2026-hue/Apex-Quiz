import { motion } from 'framer-motion';
import { Trophy, Medal, User } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Array<{ userId: string, displayName: string, score: number, total: number }>} props.entries
 * @param {string|null} props.currentUserId
 */
export default function Leaderboard({ entries, currentUserId }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400">No results yet. Be the first!</p>
      </div>
    );
  }

  const rankIcon = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-slate-400 dark:text-slate-500" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700 dark:text-amber-300" />;
    return null;
  };

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const isCurrentUser = entry.userId === currentUserId;
        const percentage = entry.total > 0 ? Math.round((entry.score / entry.total) * 100) : 0;

        return (
          <motion.div
            key={entry.id || index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-colors duration-200 ${
              isCurrentUser
                ? 'border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
              {rankIcon(index) || (
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{index + 1}</span>
              )}
            </div>

            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isCurrentUser ? 'text-amber-900 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                {entry.displayName || 'Anonymous'}
                {isCurrentUser && <span className="text-amber-600 dark:text-amber-400 text-xs ml-1.5">(you)</span>}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {entry.score}/{entry.total}
              </span>
              <span className={`text-sm font-bold ${percentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' : percentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {percentage}%
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
