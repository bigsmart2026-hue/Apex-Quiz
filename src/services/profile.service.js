import {
  doc, getDoc, runTransaction, setDoc, updateDoc, serverTimestamp, collection,
} from 'firebase/firestore';
import { db } from './firebase.config';
import { USERS_COLLECTION, ATTEMPTS_COLLECTION, DAILY_ATTEMPTS_COLLECTION } from '../utils/constants';
import { toDateKey, isYesterday, getWeekStartKey, weekChanged } from '../utils/dates';
import {
  DEFAULT_PROFILE, computeQuizXp, getLevel, getLevelName, getAccuracy,
} from '../utils/progression';
import { evaluateNewAchievements } from '../utils/achievements';

export const getOrCreateProfile = async (user) => {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    const merged = {
      ...DEFAULT_PROFILE,
      ...data,
      displayName: data.displayName ?? user.displayName ?? 'User',
      photoURL: data.photoURL ?? user.photoURL ?? null,
      email: data.email ?? user.email ?? null,
    };

    // Migrate profiles created by the legacy app (missing gamification
    // fields). A no-op normalization write is allowed by the rules.
    const missing = Object.keys(DEFAULT_PROFILE).some((key) => merged[key] === undefined);
    if (missing) {
      const patch = {};
      Object.keys(DEFAULT_PROFILE).forEach((key) => {
        if (merged[key] === undefined) patch[key] = DEFAULT_PROFILE[key];
      });
      await updateDoc(ref, patch);
    }

    return merged;
  }

  const fresh = {
    ...DEFAULT_PROFILE,
    displayName: user.displayName ?? 'User',
    photoURL: user.photoURL ?? null,
    email: user.email ?? null,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, fresh);
  return fresh;
};

/**
 * Records a finished quiz in a single transaction:
 *  - writes an immutable attempt doc (deterministic id => no duplicate farming)
 *  - updates the user profile: XP, streak, stats, achievements, weekly XP
 *
 * @param {{ uid: string, displayName: string }} user
 * @param {{ id: string, name: string }} category
 * @param {{ score: number, total: number, timeTakenMs: number, avgAnswerSec: number,
 *           isDaily?: boolean, isChallenge?: boolean, wonChallenge?: boolean }} params
 * @returns {Promise<{ xpGained: number, level: number, levelName: string, leveledUp: boolean,
 *                      streak: number, newAchievements: string[], accuracyPct: number }>}
 */
export async function recordQuizCompletion(user, category, params) {
  const { score, total, timeTakenMs, avgAnswerSec, isDaily = false, isChallenge = false, wonChallenge = false } = params;
  const todayKey = toDateKey();
  const attemptId = `${user.uid}_${isDaily ? 'daily' : category.id}_${todayKey}`;
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const attemptRef = doc(collection(db, ATTEMPTS_COLLECTION), attemptId);
  const dailyRef = isDaily
    ? doc(collection(db, DAILY_ATTEMPTS_COLLECTION), `${user.uid}_${todayKey}`)
    : null;

  return runTransaction(db, async (tx) => {
    const existingAttempt = await tx.get(attemptRef);
    if (existingAttempt.exists()) {
      throw new Error('QUIZ_ALREADY_PLAYED');
    }

    if (dailyRef) {
      const existingDaily = await tx.get(dailyRef);
      if (existingDaily.exists()) {
        throw new Error('QUIZ_ALREADY_PLAYED');
      }
    }

    const userSnap = await tx.get(userRef);
    const profile = userSnap.exists()
      ? { ...DEFAULT_PROFILE, ...userSnap.data() }
      : { ...DEFAULT_PROFILE, displayName: user.displayName };

    const streak = profile.lastPlayedDate === todayKey
      ? profile.currentStreak
      : isYesterday(profile.lastPlayedDate)
        ? profile.currentStreak + 1
        : 1;

    const xpGained = computeQuizXp({ score, total, isDaily, streak });
    const accuracyPct = getAccuracy(score, total);
    const prevLevel = getLevel(profile.xp);
    const newXp = profile.xp + xpGained;
    const newLevel = getLevel(newXp);

    const weekStart = weekChanged(profile.weekStart) ? getWeekStartKey() : profile.weekStart;
    const weeklyXp = weekStart === profile.weekStart ? profile.weeklyXp + xpGained : xpGained;

    const stat = profile.categoryStats?.[category.id] || { answered: 0, correct: 0, bestPct: 0 };
    const categoryStats = {
      ...(profile.categoryStats || {}),
      [category.id]: {
        answered: stat.answered + total,
        correct: stat.correct + score,
        bestPct: Math.max(stat.bestPct, accuracyPct),
      },
    };

    const questionsAnswered = (profile.questionsAnswered || 0) + total;
    const masteryPct = Math.min(100, Math.round((stat.correct / Math.max(stat.answered, 1)) * 100));

    const newAchievements = evaluateNewAchievements(
      {
        score, total, accuracyPct, avgAnswerSec,
        isDaily, isChallenge, wonChallenge,
        newStreak: streak, totalQuestionsAnswered: questionsAnswered,
        level: newLevel, categoryMasteryPct: masteryPct,
      },
      profile.achievements || {}
    );

    const achievements = { ...(profile.achievements || {}) };
    newAchievements.forEach((id) => {
      achievements[id] = Date.now();
    });

    tx.set(attemptRef, {
      userId: user.uid,
      displayName: user.displayName,
      categoryId: category.id,
      categoryName: category.name,
      score,
      total,
      accuracyPct,
      xpGained,
      isDaily,
      isChallenge,
      timeTakenMs,
      createdAt: serverTimestamp(),
    });

    if (dailyRef) {
      tx.set(dailyRef, {
        userId: user.uid,
        dateKey: todayKey,
        score,
        total,
        accuracyPct,
        createdAt: serverTimestamp(),
      });
    }

    tx.set(userRef, {
      ...profile,
      displayName: user.displayName,
      xp: newXp,
      currentStreak: streak,
      longestStreak: Math.max(profile.longestStreak || 0, streak),
      lastPlayedDate: todayKey,
      quizzesCompleted: (profile.quizzesCompleted || 0) + 1,
      questionsAnswered,
      correctAnswers: (profile.correctAnswers || 0) + score,
      bestScorePct: Math.max(profile.bestScorePct || 0, accuracyPct),
      weeklyXp,
      weekStart,
      achievements,
      categoryStats,
      updatedAt: serverTimestamp(),
    }, { merge: false });

    return {
      xpGained,
      level: newLevel,
      levelName: getLevelName(newXp),
      leveledUp: newLevel > prevLevel,
      streak,
      newAchievements,
      accuracyPct,
      attemptId,
    };
  });
}

export const getProfile = async (uid) => {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  return snap.exists() ? { ...DEFAULT_PROFILE, ...snap.data() } : null;
};