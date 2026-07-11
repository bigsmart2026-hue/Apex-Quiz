import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';

export default function ThemeToggle() {
  const theme = useQuizStore((s) => s.theme);
  const toggleTheme = useQuizStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className={`relative w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer flex items-center flex-shrink-0 ${
        isDark ? 'bg-slate-600' : 'bg-slate-300'
      }`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`absolute w-5 h-5 rounded-full flex items-center justify-center ${
          isDark ? 'bg-slate-800 left-[2px]' : 'bg-white left-[calc(100%-22px)]'
        }`}
      >
        {isDark ? (
          <Moon className="w-3 h-3 text-amber-400" />
        ) : (
          <Sun className="w-3 h-3 text-amber-500" />
        )}
      </motion.div>
    </motion.button>
  );
}
