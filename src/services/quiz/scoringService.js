/**
 * Scoring service.
 * Calculates points, percentages, and pass/fail status using centralized config.
 */
import { calculateQuizResult } from '../../config/difficulty';
import { canUnlockLevel, MAX_CATEGORY_LEVEL } from '../../config/levels';

export function scoreQuiz(answers, questions, currentLevel) {
  const result = calculateQuizResult(answers, questions);
  const { canUnlock, requiredPct, nextLevel } = canUnlockLevel(currentLevel, result.percentage);

  const leveledUp = canUnlock && nextLevel !== null && currentLevel < MAX_CATEGORY_LEVEL;
  const newLevel = leveledUp ? nextLevel : currentLevel;

  return {
    ...result,
    currentLevel,
    newLevel,
    leveledUp,
    requiredPct,
    passed: canUnlock,
    difficulty: questions[0]?.difficulty || 'easy',
  };
}
