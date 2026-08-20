import { motion } from 'framer-motion';

const VARIANT_CLASSES = {
  primary:
    'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm',
  secondary:
    'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200',
  outline:
    'border-2 border-slate-200 dark:border-slate-600 hover:border-amber-400 dark:hover:border-amber-500 text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-800/50',
  danger:
    'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-sm',
  ghost:
    'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
};

/**
 * @param {{ variant?: 'primary'|'secondary'|'outline'|'danger'|'ghost',
 *           size?: 'sm'|'md'|'lg', loading?: boolean, icon?: React.ReactNode,
 *           fullWidth?: boolean }} props
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900',
    'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  return (
    <motion.button
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      {children}
    </motion.button>
  );
}