/**
 * Centralized progression logic — XP, levels, streaks.
 * All XP math lives here so it is never hardcoded across the UI.
 */

export const LEVELS = [
  { level: 1, name: 'Rookie', minXp: 0 },
  { level: 2, name: 'Learner', minXp: 100 },
  { level: 3, name: 'Challenger', minXp: 250 },
  { level: 4, name: 'Scholar', minXp: 450 },
  { level: 5, name: 'Expert', minXp: 700 },
  { level: 6, name: 'Master', minXp: 1000 },
  { level: 7, name: 'Apex', minXp: 1400 },
];

export const XP_PER_CORRECT = 10;
export const XP_COMPLETION = 20;
export const XP_PERFECT_BONUS = 30;
export const XP_DAILY_MULTIPLIER = 2;
export const XP_STREAK_BONUS_CAP = 7;
export const XP_STREAK_BONUS = 2;

// Absolute ceiling for a single legitimate quiz completion:
// perfect (150) + streak bonus (14) doubled by the daily multiplier = 328.
// The Firestore rules bound per-write XP deltas by this constant.
export const MAX_XP_PER_QUIZ = 340;

const levelFromXp = (xp) => {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXp) current = lvl;
    else break;
  }
  return current;
};

export const getLevel = (xp) => levelFromXp(xp).level;
export const getLevelName = (xp) => levelFromXp(xp).name;

export const getLevelBounds = (level) => {
  const idx = LEVELS.findIndex((l) => l.level === level);
  const minXp = LEVELS[idx]?.minXp ?? 0;
  const maxXp = LEVELS[idx + 1]?.minXp ?? Infinity;
  return { minXp, maxXp };
};

export const xpProgress = (xp) => {
  const level = getLevel(xp);
  const { minXp, maxXp } = getLevelBounds(level);
  if (!isFinite(maxXp)) return 1;
  return Math.min(1, (xp - minXp) / (maxXp - minXp));
};

export const xpToNextLevel = (xp) => {
  const { maxXp } = getLevelBounds(getLevel(xp));
  return isFinite(maxXp) ? Math.max(0, maxXp - xp) : 0;
};

/**
 * Computes XP awarded for a finished quiz.
 * @param {{ score: number, total: number, isDaily?: boolean, streak?: number }} params
 */
export const computeQuizXp = ({ score, total, isDaily = false, streak = 0 }) => {
  if (total <= 0) return 0;
  const base = score * XP_PER_CORRECT + XP_COMPLETION;
  const perfect = score === total ? XP_PERFECT_BONUS : 0;
  const streakBonus = Math.min(Math.max(streak, 0), XP_STREAK_BONUS_CAP) * XP_STREAK_BONUS;
  const raw = base + perfect + streakBonus;
  return isDaily ? Math.round(raw * XP_DAILY_MULTIPLIER) : raw;
};

export const getAccuracy = (score, total) => (total > 0 ? Math.round((score / total) * 100) : 0);

export const DEFAULT_PROFILE = {
  xp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: null,
  quizzesCompleted: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  bestScorePct: 0,
  weeklyXp: 0,
  weekStart: null,
  achievements: {},
  categoryStats: {},
};