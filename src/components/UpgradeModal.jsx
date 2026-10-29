import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Sparkles, ShieldCheck, CreditCard } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { TIERS } from '../services/backend/subscriptionService';

const FREE_FEATURES = [
  'Generate quizzes from PDF or text',
  `${TIERS.free.maxQuestions} questions per quiz`,
  'XP, levels & achievements',
  'Leaderboard & challenges',
];

const PREMIUM_FEATURES = [
  'Everything in Free',
  `Up to ${TIERS.premium.maxQuestions} questions per quiz`,
  'Larger generation allowance',
  'Premium badge on your profile',
];

/**
 * Pricing + Paystack checkout modal. Opened from anywhere via
 * useSubscriptionStore.openUpgrade(reason).
 */
export default function UpgradeModal() {
  const open = useSubscriptionStore((s) => s.upgradeModalOpen);
  const reason = useSubscriptionStore((s) => s.upgradeReason);
  const closeUpgrade = useSubscriptionStore((s) => s.closeUpgrade);
  const tier = useSubscriptionStore((s) => s.tier);
  const loading = useSubscriptionStore((s) => s.loading);
  const error = useSubscriptionStore((s) => s.error);
  const upgrade = useSubscriptionStore((s) => s.upgrade);
  const cancel = useSubscriptionStore((s) => s.cancel);
  const priceLabel = useSubscriptionStore((s) => s.priceLabel);
  const plan = useSubscriptionStore((s) => s.plan);
  const [step, setStep] = useState('plans');
  const [cancelling, setCancelling] = useState(false);

  const isPremium = tier === 'premium';

  const handleClose = () => {
    setStep('plans');
    setCancelling(false);
    closeUpgrade();
  };

  const handleUpgrade = async () => {
    const ok = await upgrade();
    if (ok) {
      setStep('plans');
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    const ok = await cancel();
    setCancelling(false);
    if (ok) handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={isPremium ? 'Your plan' : 'Go Premium'}>
      {reason && !isPremium && (
        <p className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm text-center">
          {reason}
        </p>
      )}

      {error && (
        <p className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm text-center">
          {error}
        </p>
      )}

      {step === 'plans' && (
        <div className="space-y-3">
          {/* Free plan */}
          <div
            className={`p-4 rounded-xl border-2 transition-colors ${
              !isPremium
                ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading text-slate-900 dark:text-white">Free</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">$0</span>
                {!isPremium && <Badge variant="slate">Current</Badge>}
              </div>
            </div>
            <ul className="space-y-1.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Premium plan */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border-2 relative overflow-hidden ${
              isPremium
                ? 'border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-900/20'
                : 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading text-slate-900 dark:text-white flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                Premium
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {priceLabel}
                </span>
                {isPremium && <Badge variant="amber">Current</Badge>}
              </div>
            </div>
            <ul className="space-y-1.5">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>

          {isPremium ? (
            <Button fullWidth variant="outline" loading={cancelling} onClick={handleCancel}>
              Cancel premium
            </Button>
          ) : (
            <Button fullWidth onClick={() => setStep('checkout')} icon={<Sparkles className="w-4 h-4" />}>
              Upgrade to Premium
            </Button>
          )}
        </div>
      )}

      {step === 'checkout' && !isPremium && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 text-sm space-y-1.5">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{plan?.name || 'Premium plan'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{priceLabel}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Billing</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                Recurring {plan?.interval || 'monthly'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Total due today</span>
              <span className="font-semibold text-slate-900 dark:text-white">{priceLabel}</span>
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            Secure checkout by Paystack. Recurring subscriptions are charged automatically to your card.
            Cancel anytime.
          </p>

          <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CreditCard className="w-4 h-4 flex-shrink-0 text-slate-400" />
            Card payments only. You will complete the payment in the Paystack popup.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setStep('plans')} disabled={loading}>
              Back
            </Button>
            <Button fullWidth loading={loading} onClick={handleUpgrade} icon={<Crown className="w-4 h-4" />}>
              Continue to Paystack
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
