import { motion } from 'framer-motion';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

/**
 * Centered glass card layout shared by the login/register pages.
 * @param {{ title: string, subtitle: string, children: React.ReactNode }} props
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-0"
      >
        <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <div className="text-center space-y-4 mb-8">
            <div className="flex items-center justify-center">
              <Logo size={88} showWordmark={false} animate />
            </div>
            <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white font-heading">
              {title}
            </h1>
            {subtitle && (
              <p className="text-slate-600 dark:text-slate-400 text-sm">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </motion.div>
    </div>
  );
}