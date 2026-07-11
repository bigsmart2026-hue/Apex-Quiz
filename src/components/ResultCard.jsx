import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * @param {Object} props
 * @param {{ id: string, text: string, options: string[], correctAnswer: number }} props.question
 * @param {number} props.selectedAnswer
 * @param {number} props.index
 */
export default function ResultCard({ question, selectedAnswer, index }) {
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`p-4 rounded-xl border-2 ${
        isCorrect
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20'
          : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-slate-100 text-sm sm:text-base mb-2 font-heading">
            {question.text}
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-slate-600 dark:text-slate-400">
              Your answer:{' '}
              <span className={isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                {selectedAnswer !== undefined ? question.options[selectedAnswer] : 'Not answered'}
              </span>
            </p>
            {!isCorrect && (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                Correct answer: {question.options[question.correctAnswer]}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
