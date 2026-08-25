/**
 * Centralized progression logic — XP, levels, streaks.
 * 5-tier level system: Beginner → Intermediate → Advanced → Expert → Apex
 * Players unlock the next level by scoring above a threshold.
 */

export const LEVELS = [
  { level: 1, name: 'Beginner', minScorePct: 0, description: 'Easy questions to get you started' },
  { level: 2, name: 'Intermediate', minScorePct: 70, description: 'Harder questions with more reasoning' },
  { level: 3, name: 'Advanced', minScorePct: 75, description: 'Challenging questions requiring deeper understanding' },
  { level: 4, name: 'Expert', minScorePct: 80, description: 'Very difficult questions under time pressure' },
  { level: 5, name: 'Apex', minScorePct: 85, description: 'The hardest questions — competitive mode' },
];

export const MAX_LEVEL = LEVELS.length;

/** XP rewards */
export const XP_PER_CORRECT = 10;
export const XP_COMPLETION = 20;
export const XP_PERFECT_BONUS = 100;
export const XP_DAILY_MULTIPLIER = 2;
export const XP_STREAK_BONUS_CAP = 7;
export const XP_STREAK_BONUS = 2;
export const XP_SPEED_BONUS = 5;
export const XP_SPEED_THRESHOLD_SEC = 8;
export const XP_LEVEL_COMPLETION = 50;

// Absolute ceiling for a single legitimate quiz completion.
export const MAX_XP_PER_QUIZ = 340;

/**
 * Returns the player's current level object based on unlockedLevel.
 * @param {number} unlockedLevel - highest level unlocked (1-5)
 */
export const getLevelInfo = (unlockedLevel = 1) => {
  return LEVELS.find((l) => l.level === Math.min(unlockedLevel, MAX_LEVEL)) || LEVELS[0];
};

/** Legacy compat: derive level number from xp for leaderboard display */
export const getLevel = (xp) => {
  if (xp >= 1400) return 7;
  if (xp >= 1000) return 6;
  if (xp >= 700) return 5;
  if (xp >= 450) return 4;
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
};

export const getLevelName = (xp) => {
  const lvl = getLevel(xp);
  const names = { 1: 'Rookie', 2: 'Learner', 3: 'Challenger', 4: 'Scholar', 5: 'Expert', 6: 'Master', 7: 'Apex' };
  return names[lvl] || 'Rookie';
};

/**
 * Check if a quiz score qualifies the player to unlock the next level.
 * @param {number} currentLevel - player's current level (1-5)
 * @param {number} accuracyPct - quiz accuracy percentage (0-100)
 * @returns {{ canUnlock: boolean, requiredPct: number, nextLevel: number|null }}
 */
export const checkLevelUnlock = (currentLevel, accuracyPct) => {
  if (currentLevel >= MAX_LEVEL) {
    return { canUnlock: false, requiredPct: 0, nextLevel: null };
  }
  const nextLevel = LEVELS.find((l) => l.level === currentLevel + 1);
  if (!nextLevel) return { canUnlock: false, requiredPct: 0, nextLevel: null };
  return {
    canUnlock: accuracyPct >= nextLevel.minScorePct,
    requiredPct: nextLevel.minScorePct,
    nextLevel: nextLevel.level,
  };
};

/**
 * Returns difficulty label for the current level.
 */
export const getDifficultyLabel = (level) => {
  const labels = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Very Hard', 5: 'Apex' };
  return labels[level] || 'Easy';
};

/**
 * Computes XP awarded for a finished quiz.
 * @param {{ score: number, total: number, isDaily?: boolean, streak?: number,
 *           avgAnswerSec?: number, levelCompleted?: boolean }} params
 */
export const computeQuizXp = ({ score, total, isDaily = false, streak = 0, avgAnswerSec = 0, levelCompleted = false }) => {
  if (total <= 0) return 0;
  const base = score * XP_PER_CORRECT + XP_COMPLETION;
  const perfect = score === total ? XP_PERFECT_BONUS : 0;
  const speed = avgAnswerSec > 0 && avgAnswerSec < XP_SPEED_THRESHOLD_SEC ? XP_SPEED_BONUS : 0;
  const streakBonus = Math.min(Math.max(streak, 0), XP_STREAK_BONUS_CAP) * XP_STREAK_BONUS;
  const levelBonus = levelCompleted ? XP_LEVEL_COMPLETION : 0;
  const raw = base + perfect + speed + streakBonus + levelBonus;
  return isDaily ? Math.round(raw * XP_DAILY_MULTIPLIER) : raw;
};

export const getAccuracy = (score, total) => (total > 0 ? Math.round((score / total) * 100) : 0);

export const DEFAULT_PROFILE = {
  xp: 0,
  unlockedLevel: 1,
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
  lastSeen: null,
};
