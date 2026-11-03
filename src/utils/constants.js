export const QUIZ_COLLECTION = 'quizzes';
export const RESULTS_COLLECTION = 'results';
export const USERS_COLLECTION = 'users';
export const ATTEMPTS_COLLECTION = 'quizAttempts';
export const DAILY_ATTEMPTS_COLLECTION = 'dailyChallengeAttempts';
export const CHALLENGES_COLLECTION = 'challenges';
export const QUESTIONS_COLLECTION = 'questions';
export const CATEGORY_PROGRESS_COLLECTION = 'categoryProgress';
export const TIMER_DURATION = 15;
export const QUESTIONS_PER_QUIZ = 10;

/** AI quiz-generation tiers (mirror backend settings). */
export const FREE_TIER = Object.freeze({ id: 'free', maxQuestions: 10, minQuestions: 5 });
export const PREMIUM_TIER = Object.freeze({ id: 'premium', maxQuestions: 50, minQuestions: 10 });

/** Max PDF upload size (mirrors backend PDF_MAX_MB). */
export const PDF_MAX_MB = 20;

/**
 * Returns quiz config based on the player's unlocked level.
 * Levels 1-2: 10 questions, 15s timer (Easy / Medium)
 * Levels 3+: 20 questions, 10s timer (Hard / Very Hard / Apex)
 */
export function getQuizConfig(level = 1) {
  if (level >= 3) {
    return { questionCount: 20, timerDuration: 10 };
  }
  return { questionCount: 10, timerDuration: 15 };
}
