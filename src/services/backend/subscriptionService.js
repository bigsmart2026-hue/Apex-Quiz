/**
 * Subscription status: backend when reachable, local fallback otherwise.
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

/** Demo checkout — flips the backend flag, no real payment. */
export async function upgradeToPremium() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/upgrade', {
    method: 'POST',
    json: { plan: 'premium' },
  });
  return normalize(data);
}

/** Cancel premium and return to free. */
export async function cancelSubscription() {
  await ensureBackendSession();
  const { data } = await apiFetch('/api/auth/cancel', { method: 'POST', json: {} });
  return normalize(data);
}

export function isUnavailable(err) {
  return err instanceof BackendUnavailableError || err?.code === 'BACKEND_UNAVAILABLE';
}
