import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Trophy, User, BarChart3 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useQuizStore from '../store/useQuizStore';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import ResultCard from '../components/ResultCard';

export default function ResultsPage({ onRestart, onShowLeaderboard }) {
  const { questions, selectedAnswers, score, user } = useQuizStore(
    useShallow((s) => ({
      questions: s.questions,
      selectedAnswers: s.selectedAnswers,
      score: s.score,
      user: s.user,
    }))
  );

  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const { gradeColor, gradeText } = useMemo(() => {
    if (percentage >= 80) return { gradeColor: 'text-emerald-600 dark:text-emerald-400', gradeText: 'Excellent!' };
    if (percentage >= 50) return { gradeColor: 'text-amber-600 dark:text-amber-400', gradeText: 'Good Effort' };
    return { gradeColor: 'text-rose-600 dark:text-rose-400', gradeText: 'Keep Trying' };
  }, [percentage]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-6 py-3">
        <div className="w-full flex items-center justify-between">
          <Logo animate />
          <div className="flex items-center gap-4 sm:gap-6">
            <ThemeToggle />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onShowLeaderboard}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </motion.button>
            {user && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">{user.displayName}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-2xl space-y-8 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 sm:p-10 shadow-sm text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/40 mb-4"
            >
              <Trophy className="w-10 h-10 text-amber-500 dark:text-amber-400" />
            </motion.div>

            <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white mb-2 font-heading">
              {gradeText}
            </h1>

            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 12 }}
              className={`text-5xl sm:text-6xl ${gradeColor} mb-2 font-heading`}
            >
              {percentage}%
            </motion.p>

            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              You got <span className="font-semibold text-slate-900 dark:text-white">{score}</span> out of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{total}</span> correct
            </p>
          </motion.div>

          <div className="space-y-4">
            <h2 className="text-xl text-slate-900 dark:text-white px-1 font-heading">
              Detailed Breakdown
            </h2>
            {questions.map((question, index) => (
              <ResultCard
                key={question.id}
                question={question}
                selectedAnswer={selectedAnswers[question.id]}
                index={index}
              />
            ))}
          </div>

          <div className="flex justify-center gap-3 pt-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onRestart}
              className="flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-xl transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <RotateCcw className="w-5 h-5" />
              Retry Quiz
            </motion.button>
          </div>
        </div>
      </main>
    </div>
  );
}
