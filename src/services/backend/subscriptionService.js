/**
 * Subscription + Paystack checkout integration.
 *
 * Access is never granted from the frontend callback: the server verifies
 * every transaction and Paystack webhooks are the source of truth.
 */
import { apiFetch, ensureBackendSession, BackendUnavailableError } from './apiClient';
import { FREE_TIER, PREMIUM_TIER } from '../../utils/constants';

export const TIERS = {
  free: { ...FREE_TIER, label: 'Free', price: '₦0' },
  premium: { ...PREMIUM_TIER, label: 'Premium', price: '₦5,000/mo' },
};

const PAYSTACK_SCRIPT = 'https://js.paystack.co/v1/inline.js';
let paystackLoader = null;

const normalize = (data) => {
  const tier = data?.tier === 'premium' ? 'premium' : 'free';
  const limits = TIERS[tier];
  return {
    tier,
    isPaid: Boolean(data?.is_paid),
    questionLimit: data?.question_limit ?? limits.maxQuestions,
    questionMin: limits.minQuestions,
    usedThisMonth: data?.questions_used_this_month ?? 0,
    remaining: data?.questions_remaining ?? limits.maxQuestions,
    expiresAt: data?.expires_at ?? null,
    subscriptionStatus: data?.status ?? (tier === 'premium' ? 'active' : 'none'),
    planCode: data?.plan_code ?? null,
    renewalDate: data?.renewal_date ?? null,
  };
};

/** Fetch live subscription status. Throws BackendUnavailableError when down. */
export async function fetchSubscriptionStatus() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/subscription');
  return normalize(data);
}

/** Public checkout details for the server-configured plan. */
export async function fetchPaystackPlan() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/payments/paystack/plan');
  return data;
}

/** Initialize a card-only recurring checkout tied to the plan code. */
export async function initializePaystackCheckout({ email } = {}) {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/payments/paystack/initialize', {
    method: 'POST',
    json: { plan: 'premium', ...(email ? { email } : {}) },
  });
  return data;
}

/** Verify a checkout on the server, then return the provisioned status. */
export async function verifyPaystackPayment(reference) {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/payments/paystack/verify', {
    method: 'POST',
    json: { reference },
  });
  return normalize(data.subscription);
}

/** Cancel the Paystack subscription and return to the free tier. */
export async function cancelSubscription() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/cancel', { method: 'POST', json: {} });
  return normalize(data);
}

export function isUnavailable(err) {
  return err instanceof BackendUnavailableError || err?.code === 'BACKEND_UNAVAILABLE';
}

/** Load Paystack Inline (once) for the checkout popup. */
export function loadPaystack() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paystack is only available in the browser.'));
  }
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if (paystackLoader) return paystackLoader;

  paystackLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) {
        resolve(window.PaystackPop);
      } else {
        paystackLoader = null;
        reject(new Error('Paystack checkout could not be loaded.'));
      }
    };
    script.onerror = () => {
      paystackLoader = null;
      reject(new Error('Paystack checkout could not be loaded.'));
    };
    document.body.appendChild(script);
  });

  return paystackLoader;
}
