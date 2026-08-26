/**
 * Per-category level configuration.
 * Each category has 4 levels: Beginner → Intermediate → Advanced → Master.
 * User must pass each level to unlock the next.
 */

export const CATEGORY_LEVELS = {
  1: {
    name: 'Beginner',
    difficulty: 'easy',
    passingPercentage: 80,
    nextLevel: 2,
    description: 'Easy questions to get you started',
  },
  2: {
    name: 'Intermediate',
    difficulty: 'medium',
    passingPercentage: 80,
    nextLevel: 3,
    description: 'Harder questions with more reasoning',
  },
  3: {
    name: 'Advanced',
    difficulty: 'hard',
    passingPercentage: 80,
    nextLevel: 4,
    description: 'Challenging questions requiring deeper understanding',
  },
  4: {
    name: 'Master',
    difficulty: 'master',
    passingPercentage: 90,
    nextLevel: null,
    description: 'The hardest questions — competitive mode',
  },
};

export const MAX_CATEGORY_LEVEL = 4;

export const getDifficultyForLevel = (level) => {
  return CATEGORY_LEVELS[level]?.difficulty || 'easy';
};

export const getLevelConfig = (level) => {
  return CATEGORY_LEVELS[level] || CATEGORY_LEVELS[1];
};

export const canUnlockLevel = (currentLevel, accuracyPct) => {
  const config = CATEGORY_LEVELS[currentLevel];
  if (!config) return { canUnlock: false, requiredPct: 80, nextLevel: null };
  return {
    canUnlock: accuracyPct >= config.passingPercentage,
    requiredPct: config.passingPercentage,
    nextLevel: config.nextLevel,
  };
};
