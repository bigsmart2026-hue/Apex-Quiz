import { motion } from 'framer-motion';

/**
 * @param {Object} props
 * @param {string} props.text
 * @param {number} props.index
 * @param {boolean} props.isSelected
 * @param {boolean} props.isCorrect
 * @param {boolean} props.showFeedback
 * @param {boolean} props.disabled
 * @param {() => void} props.onClick
 */
export default function OptionButton({ text, index, isSelected, isCorrect, showFeedback, disabled, onClick }) {
  const letter = String.fromCharCode(65 + index);

  let borderStyle = 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/30 dark:hover:bg-amber-900/20 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]';
  let letterStyle = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';

  if (showFeedback) {
    if (isCorrect) {
      borderStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-500/30';
      letterStyle = 'bg-emerald-500 text-white';
    } else if (isSelected) {
      borderStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 ring-2 ring-rose-500/30';
      letterStyle = 'bg-rose-500 text-white';
    } else {
      borderStyle = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60';
      letterStyle = 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
    }
  } else if (isSelected) {
    borderStyle = 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-500/40';
    letterStyle = 'bg-amber-500 text-white';
  }

  return (
    <motion.button
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 sm:gap-4 ${disabled ? 'cursor-default' : 'cursor-pointer'} ${borderStyle}`}
    >
      <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200 ${letterStyle}`}>
        {letter}
      </span>
      <span className="text-slate-900 dark:text-slate-100 font-medium text-sm sm:text-base">{text}</span>
    </motion.button>
  );
}
