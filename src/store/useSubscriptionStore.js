import { create } from 'zustand';
import {
  fetchSubscriptionStatus,
  fetchPremiumPlan,
  initializePremiumCheckout,
  cancelSubscription,
  isUnavailable,
  TIERS,
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

export const useSubscriptionStore = create((set, get) => ({
  ...initialTier,
  loading: false,
  syncing: false,
  error: null,
  backendAvailable: false,
  upgradeModalOpen: false,
  upgradeReason: null,
  plan: null,
  planLoading: false,

  openUpgrade: (reason = null) => {
    set({ upgradeModalOpen: true, upgradeReason: reason });
    get().loadPlan();
  },
  closeUpgrade: () => set({ upgradeModalOpen: false, upgradeReason: null }),

  /** Loads the real Paystack plan price; falls back to the static label. */
  loadPlan: async () => {
    if (get().plan || get().planLoading) return;
    set({ planLoading: true });
    try {
      set({ plan: await fetchPremiumPlan(), planLoading: false });
    } catch {
      set({ planLoading: false });
    }
  },

  /** Pulls live status from the backend; the server is the only source of truth. */
  refresh: async () => {
    if (get().syncing) return;
    set({ syncing: true, error: null });
    try {
      const status = await fetchSubscriptionStatus();
      set({ ...status, backendAvailable: true, syncing: false });
    } catch (err) {
      set({
        syncing: false,
        backendAvailable: false,
        error: isUnavailable(err) ? null : err.message,
      });
    }
  },

  /** Starts a Paystack checkout and redirects the browser to the hosted page. */
  upgrade: async (email) => {
    set({ loading: true, error: null });
    try {
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { authorizationUrl } = await initializePremiumCheckout(callbackUrl, email);
      if (!authorizationUrl) {
        throw new Error('Paystack did not return a checkout URL');
      }
      window.location.assign(authorizationUrl);
      return true;
    } catch (err) {
      set({ loading: false, error: err?.message || 'Could not start Paystack checkout.' });
      return false;
    }
  },

  cancel: async () => {
    set({ loading: true, error: null });
    try {
      const status = await cancelSubscription();
      set({ ...status, backendAvailable: true, loading: false });
      toast.success('Subscription cancelled', 'Your plan is now Free.');
    } catch (err) {
      const message = err?.message || 'Could not cancel the subscription.';
      set({ loading: false, error: message });
      toast.error('Cancellation failed', message);
    }
  },
}));
