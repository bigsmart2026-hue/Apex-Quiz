import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchSubscriptionStatus, upgradeToPremium, cancelSubscription, isUnavailable, TIERS,
} from '../services/backend/subscriptionService';
import { toast } from './useToastStore';

const initialTier = {
  tier: 'free',
  isPaid: false,
  questionLimit: TIERS.free.maxQuestions,
  questionMin: TIERS.free.minQuestions,
  usedThisMonth: 0,
  remaining: TIERS.free.maxQuestions,
  expiresAt: null,
};

export const useSubscriptionStore = create(
  persist(
    (set, get) => ({
      ...initialTier,
      loading: false,
      syncing: false,
      error: null,
      backendAvailable: false,
      upgradeModalOpen: false,
      upgradeReason: null,

      openUpgrade: (reason = null) => set({ upgradeModalOpen: true, upgradeReason: reason }),
      closeUpgrade: () => set({ upgradeModalOpen: false, upgradeReason: null }),

      /** Pulls live status; keeps local tier when the backend is down. */
      refresh: async () => {
        if (get().syncing) return;
        set({ syncing: true, error: null });
        try {
          const status = await fetchSubscriptionStatus();
          set({ ...status, backendAvailable: true, syncing: false });
        } catch (err) {
          set({
            syncing: false,
            backendAvailable: !isUnavailable(err),
            error: isUnavailable(err) ? null : err.message,
          });
        }
      },

      /** Demo checkout. Works offline by enabling local premium. */
      upgrade: async () => {
        set({ loading: true, error: null });
        try {
          const status = await upgradeToPremium();
          set({ ...status, backendAvailable: true, loading: false, upgradeModalOpen: false });
          toast.success('Welcome to Premium!', `Generate up to ${status.questionLimit} questions per quiz.`);
          return true;
        } catch (err) {
          if (isUnavailable(err)) {
            const premium = {
              tier: 'premium',
              isPaid: true,
              questionLimit: TIERS.premium.maxQuestions,
              questionMin: TIERS.premium.minQuestions,
              backendAvailable: false,
            };
            set({ ...premium, loading: false, upgradeModalOpen: false });
            toast.success('Premium enabled (offline)', 'Will sync with the server when it is back.');
            return true;
          }
          set({ loading: false, error: err.message });
          return false;
        }
      },

      cancel: async () => {
        set({ loading: true, error: null });
        try {
          const status = await cancelSubscription();
          set({ ...status, backendAvailable: true, loading: false });
          toast.success('Back to Free', 'Premium cancelled — free limits apply.');
        } catch (err) {
          if (isUnavailable(err)) {
            set({ ...initialTier, backendAvailable: false, loading: false });
            toast.success('Back to Free', 'Premium cancelled locally.');
          } else {
            set({ loading: false, error: err.message });
          }
        }
      },
    }),
    {
      name: 'apex-quiz-subscription',
      partialize: (s) => ({
        tier: s.tier,
        isPaid: s.isPaid,
        questionLimit: s.questionLimit,
        questionMin: s.questionMin,
        usedThisMonth: s.usedThisMonth,
        remaining: s.remaining,
        expiresAt: s.expiresAt,
      }),
    }
  )
);
