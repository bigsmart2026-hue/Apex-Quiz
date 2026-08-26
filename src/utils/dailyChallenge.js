import { categories } from './categories';
import { mulberry32 } from './dates';

export const DAILY_QUESTION_COUNT = 10;

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Deterministic daily challenge — picks a category for each day,
 * stable across reloads. Different category every day from the full list.
 * @param {string} dateKey - YYYY-MM-DD
 */
export function getDailyChallenge(dateKey) {
  const seed = hashString(`apex-daily-${dateKey}`);
  const rand = mulberry32(seed);

  const categoryIndex = Math.floor(rand() * categories.length);
  const category = categories[categoryIndex];

  return { category, questions: [] };
}
