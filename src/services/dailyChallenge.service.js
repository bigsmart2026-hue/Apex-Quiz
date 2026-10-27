import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.config';
import { DAILY_ATTEMPTS_COLLECTION } from '../utils/constants';
import { toDateKey } from '../utils/dates';

/**
 * Daily challenge participation tracking.
 * Firestore when configured, otherwise the local attempts map
 * maintained by profile.service.js.
 */
export const getDailyChallengeAttempt = async (uid) => {
  if (!db) {
    try {
      const attempts = JSON.parse(localStorage.getItem('apex-quiz-local-attempts') || '{}');
      return attempts[`${uid}_daily_${toDateKey()}`] ?? null;
    } catch {
      return null;
    }
  }
  const ref = doc(db, DAILY_ATTEMPTS_COLLECTION, `${uid}_${toDateKey()}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const hasCompletedDailyChallenge = async (uid) => {
  const attempt = await getDailyChallengeAttempt(uid);
  return Boolean(attempt);
};
