/**
 * Subscription status and Paystack checkout.
 */
import { apiFetch, ensureBackendSession, BackendUnavailableError } from './apiClient';
import { FREE_TIER, PREMIUM_TIER } from '../../utils/constants';

export const TIERS = {
  free: { ...FREE_TIER, label: 'Free', price: '$0' },
  premium: { ...PREMIUM_TIER, label: 'Premium', price: '$4.99/mo' },
};

const normalize = (data) => {
  const tier = data?.tier === 'premium' ? 'premium' : 'free';
  const limits = TIERS[tier];
  return {
    tier,
    isPaid: data?.is_paid ?? tier === 'premium',
    questionLimit: data?.question_limit ?? limits.maxQuestions,
    questionMin: limits.minQuestions,
    usedThisMonth: data?.questions_used_this_month ?? 0,
    remaining: data?.questions_remaining ?? limits.maxQuestions,
    expiresAt: data?.expires_at ?? null,
  };
};

/** Fetch live subscription status. Throws BackendUnavailableError when down. */
export async function fetchSubscriptionStatus() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/subscription');
  return normalize(data);
}

/** Fetch the configured Paystack plan (real price/currency/interval). */
export async function fetchPremiumPlan() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/upgrade/plan');
  return {
    name: data.name,
    amount: data.amount,
    currency: data.currency,
    interval: data.interval,
  };
}

/**
 * Create a Paystack transaction and return the hosted checkout URL.
 * The caller redirects the browser to `authorizationUrl`.
 */
export async function initializePremiumCheckout(callbackUrl, email) {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/upgrade', {
    method: 'POST',
    json: { callback_url: callbackUrl, ...(email ? { email } : {}) },
  });
  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

/** Verify a completed Paystack payment and activate premium. */
export async function verifyPremiumPayment(reference) {
  await ensureBackendSession();
  const { data } = await apiFetch(
    `/api/auth/upgrade/verify?reference=${encodeURIComponent(reference)}`,
  );
  return normalize(data);
}

/** Stop the Paystack subscription and return to free. */
export async function cancelSubscription() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/cancel', { method: 'POST', json: {} });
  return normalize(data);
}

export function isUnavailable(err) {
  return err instanceof BackendUnavailableError || err?.code === 'BACKEND_UNAVAILABLE';
}
