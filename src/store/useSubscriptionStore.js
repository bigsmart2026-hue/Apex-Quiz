import { create } from 'zustand';
import useQuizStore from './useQuizStore';
import {
  fetchSubscriptionStatus,
  fetchPaystackPlan,
  initializePaystackCheckout,
  verifyPaystackPayment,
  cancelSubscription,
  loadPaystack,
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
  subscriptionStatus: 'none',
  planCode: null,
  renewalDate: null,
};

/**
 * Subscription state. Paystack remains the source of truth: the store only
 * reflects backend responses and never upgrades the user locally.
 */
export const useSubscriptionStore = create((set, get) => ({
  ...initialTier,
  loading: false,
  syncing: false,
  planLoading: false,
  error: null,
  backendAvailable: false,
  plan: null,
  planConfigured: false,
  priceLabel: TIERS.premium.price,
  upgradeModalOpen: false,
  upgradeReason: null,

  openUpgrade: (reason = null) => set({ upgradeModalOpen: true, upgradeReason: reason }),
  closeUpgrade: () => set({ upgradeModalOpen: false, upgradeReason: null }),

  /** Pulls live status from the backend. */
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

  /** Loads the server-configured plan price for display. */
  loadPlan: async () => {
    if (get().planLoading) return;
    set({ planLoading: true });
    try {
      const plan = await fetchPaystackPlan();
      set({
        plan,
        planConfigured: Boolean(plan?.configured),
        priceLabel: plan?.price_label || get().priceLabel,
        backendAvailable: true,
        planLoading: false,
      });
    } catch (err) {
      set({
        planLoading: false,
        planConfigured: false,
        backendAvailable: !isUnavailable(err),
      });
    }
  },

  /** Verify a Paystack reference server-side, then update entitlement. */
  verifyPayment: async (reference) => {
    if (!reference) {
      set({ error: 'No payment reference was returned.' });
      return false;
    }
    set({ loading: true, error: null });
    try {
      const status = await verifyPaystackPayment(reference);
      set({
        ...status,
        backendAvailable: true,
        loading: false,
        upgradeModalOpen: false,
        upgradeReason: null,
      });
      toast.success(
        'Premium activated',
        `You can now generate up to ${status.questionLimit} questions per quiz.`
      );
      return true;
    } catch (err) {
      set({ loading: false, error: err.message });
      toast.error('Payment not verified', err.message);
      return false;
    }
  },

  /** Open Paystack checkout for the premium plan. */
  upgrade: async () => {
    if (get().isPaid) {
      set({ upgradeModalOpen: false, upgradeReason: null });
      return true;
    }

    set({ loading: true, error: null });
    try {
      const email = useQuizStore.getState().user?.email;
      const checkout = await initializePaystackCheckout({ email });
      const redirectFallback = () => {
        if (checkout?.authorization_url) {
          window.location.assign(checkout.authorization_url);
          return true;
        }
        return false;
      };

      if (!checkout?.access_code || !checkout?.public_key) {
        if (redirectFallback()) return false;
        throw new Error('Paystack did not return a checkout session.');
      }

      let PaystackPop;
      try {
        PaystackPop = await loadPaystack();
      } catch {
        if (redirectFallback()) return false;
        throw new Error('Paystack checkout could not be loaded.');
      }

      return await new Promise((resolve) => {
        const popup = PaystackPop.setup({
          key: checkout.public_key,
          email: checkout.email,
          access_code: checkout.access_code,
          onClose: () => {
            set({ loading: false });
            resolve(false);
          },
          callback: async (response) => {
            const ok = await get().verifyPayment(response?.reference);
            resolve(ok);
          },
        });
        popup.openIframe();
      });
    } catch (err) {
      set({
        loading: false,
        error: isUnavailable(err)
          ? 'The payment server is offline. Please try again shortly.'
          : err.message,
      });
      if (isUnavailable(err)) {
        toast.error('Payments unavailable', 'The payment server is offline.');
      }
      return false;
    }
  },

  cancel: async () => {
    set({ loading: true, error: null });
    try {
      const status = await cancelSubscription();
      set({ ...status, backendAvailable: true, loading: false });
      toast.success('Back to Free', 'Premium cancelled — free limits apply.');
      return true;
    } catch (err) {
      set({
        loading: false,
        error: isUnavailable(err)
          ? 'The payment server is offline. Please try again shortly.'
          : err.message,
      });
      toast.error('Could not cancel', err.message);
      return false;
    }
  },
}));
