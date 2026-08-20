/**
 * Base glass card. Extend with className for padding/width.
 */
export default function Card({ className = '', children }) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}