/**
 * Intentional empty state for lists/boards.
 * @param {{ icon?: React.ReactNode, title: string, description?: string,
 *           action?: React.ReactNode }} props
 */
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="text-center py-12 space-y-3">
      {icon && (
        <div className="flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          </div>
        </div>
      )}
      <p className="text-slate-600 dark:text-slate-300 font-semibold">{title}</p>
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  );
}