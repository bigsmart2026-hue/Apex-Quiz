import {
  doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp, collection,
} from 'firebase/firestore';
import { db } from './firebase.config';
import { CHALLENGES_COLLECTION } from '../utils/constants';
import { generateChallengeCode, isValidChallengeCode } from '../utils/challengeCode';
import { addDaysKey, toDateKey } from '../utils/dates';

const EXPIRES_DAYS = 7;
const LOCAL_CHALLENGES_KEY = 'apex-quiz-local-challenges';

function readLocalChallenges() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_CHALLENGES_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLocalChallenges(map) {
  try {
    localStorage.setItem(LOCAL_CHALLENGES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Friend challenge lifecycle.
 * Firestore when configured, otherwise localStorage (single-device).
 * Scores are written once per participant; the winner is derived
 * from the stored scores, never accepted from the client.
 */

export async function createChallenge({ creator, category, questions, total, opponentId = null, opponentName = null }) {
  const code = generateChallengeCode();
  const challenge = {
    code,
    categoryId: category.id,
    categoryName: category.name,
    questions,
    total,
    status: opponentId ? 'waiting' : 'open',
    creatorId: creator.uid,
    creatorName: creator.displayName,
    opponentId,
    opponentName,
    creatorScore: null,
    creatorAccuracy: null,
    opponentScore: null,
    opponentAccuracy: null,
    createdAt: Date.now(),
    expiresAt: addDaysKey(toDateKey(), EXPIRES_DAYS),
  };
  if (!db) {
    const map = readLocalChallenges();
    map[code] = challenge;
    writeLocalChallenges(map);
    return { code, challenge };
  }
  const ref = doc(collection(db, CHALLENGES_COLLECTION), code);
  await setDoc(ref, { ...challenge, createdAt: serverTimestamp() });
  return { code, challenge };
}

export async function getChallenge(code) {
  if (!isValidChallengeCode(code)) return null;
  if (!db) {
    return readLocalChallenges()[code] ?? null;
  }
  const snap = await getDoc(doc(db, CHALLENGES_COLLECTION, code));
  return snap.exists() ? snap.data() : null;
}

export async function joinChallenge(code, user) {
  if (!db) {
    const map = readLocalChallenges();
    const challenge = map[code];
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status !== 'open' && challenge.status !== 'waiting') {
      throw new Error('Challenge is no longer joinable');
    }
    if (challenge.opponentId && challenge.opponentId !== user.uid) {
      throw new Error('Challenge already has two players');
    }
    const updated = { ...challenge, opponentId: user.uid, opponentName: user.displayName, status: 'active' };
    map[code] = updated;
    writeLocalChallenges(map);
    return updated;
  }
  const ref = doc(db, CHALLENGES_COLLECTION, code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Challenge not found');
    const challenge = snap.data();

    if (challenge.status !== 'open' && challenge.status !== 'waiting') {
      throw new Error('Challenge is no longer joinable');
    }
    if (challenge.creatorId === user.uid) throw new Error('You cannot join your own challenge');
    if (challenge.opponentId && challenge.opponentId !== user.uid) {
      throw new Error('Challenge already has two players');
    }

    tx.update(ref, {
      opponentId: user.uid,
      opponentName: user.displayName,
      status: 'active',
    });
    return { ...challenge, opponentId: user.uid, opponentName: user.displayName, status: 'active' };
  });
}

/**
 * Submits a participant's score. Only the participant's own slot may be
 * written, and only while it is unset (rules enforce this as well).
 * Status stays 'active' so both players can play before comparison.
 */
export async function submitChallengeScore(code, user, { score, total, accuracyPct }) {
  if (!db) {
    const map = readLocalChallenges();
    const challenge = map[code];
    if (!challenge) return;
    const field = user.uid === challenge.creatorId ? 'creator' : 'opponent';
    map[code] = { ...challenge, [`${field}Score`]: score, [`${field}Accuracy`]: accuracyPct, [`${field}Total`]: total };
    writeLocalChallenges(map);
    return;
  }
  const challenge = await getChallenge(code);
  const field = user.uid === challenge.creatorId ? 'creator' : 'opponent';
  const ref = doc(db, CHALLENGES_COLLECTION, code);
  return updateDoc(ref, {
    [`${field}Score`]: score,
    [`${field}Accuracy`]: accuracyPct,
    [`${field}Total`]: total,
  });
}

/** Winner is derived from immutable stored scores. */
export function resolveWinner(challenge) {
  if (challenge.creatorScore === null || challenge.opponentScore === null) return null;
  if (challenge.creatorScore > challenge.opponentScore) return 'creator';
  if (challenge.opponentScore > challenge.creatorScore) return 'opponent';
  return 'draw';
}
