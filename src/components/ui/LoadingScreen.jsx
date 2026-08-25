export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3" role="status">
      <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
    </div>
  );
}