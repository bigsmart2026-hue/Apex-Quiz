import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.config';
import { DAILY_ATTEMPTS_COLLECTION } from '../utils/constants';
import { toDateKey } from '../utils/dates';

/**
 * Daily challenge participation tracking.
 * The challenge itself is deterministic (seeded by date) and lives in the
 * client; participation is recorded server-side with a deterministic doc id
 * inside the same transaction that awards XP (see profile.service.js), so a
 * user can complete at most one daily challenge per day.
 */
export const getDailyChallengeAttempt = async (uid) => {
  const ref = doc(db, DAILY_ATTEMPTS_COLLECTION, `${uid}_${toDateKey()}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const hasCompletedDailyChallenge = async (uid) => {
  const attempt = await getDailyChallengeAttempt(uid);
  return Boolean(attempt);
};