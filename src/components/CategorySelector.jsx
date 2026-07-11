import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, User } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { categories } from '../utils/categories';

/**
 * @param {Object} props
 * @param {(category: { id: string, name: string, apiId: number, icon: any }) => void} props.onSelect
 * @param {() => void} props.onLogout
 */
export default function CategorySelector({ onSelect, onLogout }) {
  const user = useQuizStore((s) => s.user);
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-6 py-3">
        <div className="w-full flex items-center justify-between">
          <Logo animate />

          <div className="flex items-center gap-4 sm:gap-6">
            <ThemeToggle />
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                )}
                <span className="text-slate-600 dark:text-slate-400">{user.displayName}</span>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-4xl py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2 mb-8 sm:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white font-heading">
              Choose a Category
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Select a topic to start the quiz
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {categories.map((category, index) => {
              const Icon = category.icon;
              const isHovered = hoveredId === category.id;
              return (
                <motion.button
                  key={category.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07, duration: 0.35 }}
                  whileTap={{ scale: 0.94 }}
                  onMouseEnter={() => setHoveredId(category.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelect(category)}
                  className={`flex flex-col items-center gap-3 p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all duration-250 cursor-pointer group relative ${
                    isHovered
                      ? 'border-amber-400 shadow-lg shadow-amber-500/10'
                      : 'border-slate-200 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  {isHovered && (
                    <div className="absolute inset-0 rounded-2xl bg-amber-400/5 pointer-events-none" />
                  )}
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-250 ${
                      isHovered
                        ? 'bg-amber-100 dark:bg-amber-900/40 scale-110'
                        : 'bg-amber-50 dark:bg-amber-900/20'
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 sm:w-7 sm:h-7 transition-all duration-250 ${
                        isHovered ? 'text-amber-600 dark:text-amber-400 scale-110' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 text-center leading-tight">
                    {category.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
