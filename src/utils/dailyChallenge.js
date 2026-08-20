import { categories } from './categories';
import { questionBank } from './questionBank';
import { mulberry32, seededSample } from './dates';

export const DAILY_QUESTION_COUNT = 10;

const BANK_KEYS = ['frontend', 'backend', 'currentAffairs', 'relationships'];

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Deterministic daily challenge — same category and questions for the whole
 * day for every user, stable across reloads.
 * @param {string} dateKey - YYYY-MM-DD
 */
export function getDailyChallenge(dateKey) {
  const seed = hashString(`apex-daily-${dateKey}`);
  const rand = mulberry32(seed);

  const bankKey = BANK_KEYS[Math.floor(rand() * BANK_KEYS.length)];
  const category = categories.find((c) => c.id === bankKey) || categories[0];
  const questions = seededSample(questionBank[bankKey] || [], DAILY_QUESTION_COUNT, seed);

  return { category, questions };
}