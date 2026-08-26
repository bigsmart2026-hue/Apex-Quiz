import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react';

const DIFFICULTY_COLORS = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  master: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function ResultCard({ question, selectedAnswer, index, expanded, onToggle }) {
  const answered = selectedAnswer !== undefined;
  const isCorrect = answered && selectedAnswer === question.correctAnswer;
  const points = question.points || 10;
  const earned = isCorrect ? points : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className={`rounded-xl border-2 overflow-hidden ${
        isCorrect
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20'
          : answered
            ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer"
        aria-expanded={expanded}
      >
        <span className="flex-shrink-0 mt-0.5" aria-hidden="true">
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : answered ? (
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          ) : (
            <span className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 inline-block" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-slate-900 dark:text-slate-100 text-sm sm:text-base font-heading block">
            {question.text}
          </span>
          <span className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[question.difficulty] || DIFFICULTY_COLORS.easy}`}>
              {question.difficulty || 'easy'}
            </span>
            <span className={`text-xs font-semibold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : answered ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {isCorrect ? `+${earned}pts` : '0pts'}
            </span>
          </span>
          <span
            className={`text-xs font-semibold mt-0.5 inline-block ${
              isCorrect
                ? 'text-emerald-600 dark:text-emerald-400'
                : answered
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isCorrect ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Correct</span> : answered ? <span className="inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Incorrect</span> : '— Not answered'}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-1.5 text-sm border-t border-slate-200/60 dark:border-slate-700/60">
              <p className="text-slate-600 dark:text-slate-400">
                Your answer:{' '}
                <span className={`font-medium ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {answered ? question.options[selectedAnswer] : 'Not answered'}
                </span>
              </p>
              {!isCorrect && (
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Correct answer: {question.options[question.correctAnswer]}
                </p>
              )}
              {question.explanation && (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 italic">
                  {question.explanation}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}