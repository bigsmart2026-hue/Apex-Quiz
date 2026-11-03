/**
 * Per-category progress service.
 * Tracks user progress for each category independently.
 * Firestore when configured, otherwise localStorage.
 */
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { USERS_COLLECTION } from '../../utils/constants';
import { MAX_CATEGORY_LEVEL, CATEGORY_LEVELS } from '../../config/levels';

const DEFAULT_CATEGORY_PROGRESS = {
  currentLevel: 1,
  highestLevel: 1,
  totalQuestions: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  totalPoints: 0,
  lastQuizPercentage: 0,
  lastPlayedAt: null,
  quizzesCompleted: 0,
  levelsUnlocked: { 1: true },
  seenQuestionHashes: [],
};

const localKey = (uid, categoryId) => `apex-quiz-progress:${uid}:${categoryId}`;

function readLocalProgress(uid, categoryId) {
  try {
    const raw = localStorage.getItem(localKey(uid, categoryId));
    if (raw) return { ...DEFAULT_CATEGORY_PROGRESS, ...JSON.parse(raw) };
  } catch {
    // start fresh
  }
  return { ...DEFAULT_CATEGORY_PROGRESS };
}

export async function getCategoryProgress(uid, categoryId) {
  if (!db) return readLocalProgress(uid, categoryId);
  const ref = doc(db, USERS_COLLECTION, uid, 'categoryProgress', categoryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ...DEFAULT_CATEGORY_PROGRESS };
  return { ...DEFAULT_CATEGORY_PROGRESS, ...snap.data() };
}

export async function saveCategoryProgress(uid, categoryId, result, newHashes = []) {
  const current = await getCategoryProgress(uid, categoryId);

  const newTotal = current.totalQuestions + result.total;
  const newCorrect = current.correctAnswers + result.correctAnswers;
  const newIncorrect = current.incorrectAnswers + result.incorrectAnswers;
  const newPoints = current.totalPoints + result.totalPoints;
  const masteryPct = newTotal > 0 ? Math.min(100, Math.round((newCorrect / newTotal) * 100)) : 0;

  const levelsUnlocked = { ...current.levelsUnlocked };
  if (result.leveledUp && result.newLevel <= MAX_CATEGORY_LEVEL) {
    levelsUnlocked[result.newLevel] = true;
  }

  const newLevel = result.leveledUp ? result.newLevel : current.currentLevel;
  const newHighest = Math.max(current.highestLevel, newLevel);

  // Keep last 200 seen hashes to avoid duplicates, cap at 500
  const prevHashes = Array.isArray(current.seenQuestionHashes) ? current.seenQuestionHashes : [];
  const seenQuestionHashes = [...new Set([...prevHashes, ...newHashes])].slice(-500);

  const updated = {
    currentLevel: newLevel,
    highestLevel: newHighest,
    totalQuestions: newTotal,
    correctAnswers: newCorrect,
    incorrectAnswers: newIncorrect,
    totalPoints: newPoints,
    lastQuizPercentage: result.percentage,
    lastPlayedAt: Date.now(),
    quizzesCompleted: current.quizzesCompleted + 1,
    masteryPercentage: masteryPct,
    levelsUnlocked,
    seenQuestionHashes,
  };

  if (!db) {
    try {
      localStorage.setItem(localKey(uid, categoryId), JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }

  const ref = doc(db, USERS_COLLECTION, uid, 'categoryProgress', categoryId);
  await setDoc(ref, { ...updated, lastPlayedAt: serverTimestamp() }, { merge: true });
  return updated;
}

export function getMasteryPercentage(progress) {
  if (!progress || progress.totalQuestions === 0) return 0;
  return Math.min(100, Math.round((progress.correctAnswers / progress.totalQuestions) * 100));
}

export function getLevelStatuses(progress) {
  const statuses = [];
  for (let i = 1; i <= MAX_CATEGORY_LEVEL; i++) {
    const config = CATEGORY_LEVELS[i];
    const unlocked = progress?.levelsUnlocked?.[i] || i === 1;
    const isCurrent = progress?.currentLevel === i;
    statuses.push({
      level: i,
      name: config.name,
      difficulty: config.difficulty,
      passingPercentage: config.passingPercentage,
      unlocked,
      isCurrent,
      locked: !unlocked,
    });
  }
  return statuses;
}
