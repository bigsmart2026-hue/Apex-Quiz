/**
 * Compact stat block for dashboards.
 * @param {{ label: string, value: React.ReactNode, icon?: React.ReactNode, sub?: string }} props
 */
export default function StatCard({ label, value, icon, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
          {value}
        </p>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}