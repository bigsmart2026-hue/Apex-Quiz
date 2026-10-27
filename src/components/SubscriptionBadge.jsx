import { Crown } from 'lucide-react';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

/**
 * Tier pill for the navbar. Opens the upgrade modal on click.
 */
export default function SubscriptionBadge() {
  const tier = useSubscriptionStore((s) => s.tier);
  const openUpgrade = useSubscriptionStore((s) => s.openUpgrade);
  const isPremium = tier === 'premium';

  return (
    <button
      onClick={() => openUpgrade()}
      title={isPremium ? 'Premium active' : 'Upgrade to Premium'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
        isPremium
          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      <Crown className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{isPremium ? 'Premium' : 'Free'}</span>
    </button>
  );
}
