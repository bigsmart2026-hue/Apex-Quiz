import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useQuizStore from '../store/useQuizStore';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import Leaderboard from '../components/Leaderboard';

export default function LeaderboardPage({ onBack }) {
  const { leaderboard, user, fetchLeaderboard } = useQuizStore(
    useShallow((s) => ({
      leaderboard: s.leaderboard,
      user: s.user,
      fetchLeaderboard: s.fetchLeaderboard,
    }))
  );

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-6 py-3">
        <div className="w-full flex items-center justify-between">
          <Logo animate />
          <div className="flex items-center gap-4 sm:gap-6">
            <ThemeToggle />
            <div className="flex items-center gap-2 text-sm">
              {user && (
                <>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  )}
                  <span className="text-slate-600 dark:text-slate-400">{user.displayName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-2xl py-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center space-y-2"
          >
            <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white font-heading">
              Leaderboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Top scores across all quizzes
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Leaderboard entries={leaderboard} currentUserId={user?.uid} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
