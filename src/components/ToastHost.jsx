import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, Award, X } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

const STYLE = {
  success: { icon: CheckCircle2, ring: 'border-emerald-500/40', iconColor: 'text-emerald-500' },
  error: { icon: XCircle, ring: 'border-rose-500/40', iconColor: 'text-rose-500' },
  info: { icon: Info, ring: 'border-sky-500/40', iconColor: 'text-sky-500' },
  achievement: { icon: Award, ring: 'border-amber-500/40', iconColor: 'text-amber-500' },
};

/** Renders the toast queue. Mount once near the root. */
export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const style = STYLE[toast.type] || STYLE.info;
          const Icon = style.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto bg-white dark:bg-slate-800 rounded-xl border ${style.ring} shadow-lg p-3.5 flex items-start gap-3`}
              role="status"
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer text-xs font-bold"
                aria-label="Dismiss notification"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}