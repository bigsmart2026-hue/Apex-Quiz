/**
 * The Trivia API service.
 * Fetches questions from https://the-trivia-api.com/api/v2/questions
 * Free tier: 1000 requests/day, no key required.
 * Supports category and difficulty filtering.
 */
import { normalizeTriviaApiQuestion } from '../../utils/normalizeQuestion';
import { filterValidQuestions } from '../../utils/questionValidator';

const API_URL = 'https://the-trivia-api.com/api/v2/questions';
const REQUEST_TIMEOUT_MS = 10000;

const CATEGORY_MAP = {
  'general-knowledge': 'general_knowledge',
  science: 'science',
  music: 'music',
  'video-games': 'video_games',
  geography: 'geography',
  history: 'history',
  technology: 'tech_and_video_games',
};

const DIFFICULTY_MAP = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  master: 'hard',
};

export async function fetchTriviaApiQuestions({ category, difficulty = 'easy', amount = 10 }) {
  const params = new URLSearchParams({ limit: String(Math.min(amount, 50)) });
  const mappedCategory = CATEGORY_MAP[category];
  if (mappedCategory) params.set('categories', mappedCategory);
  const mapped = DIFFICULTY_MAP[difficulty];
  if (mapped) params.set('difficulties', mapped);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 429) throw new Error('RATE_LIMITED');
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('INVALID_RESPONSE');
    const normalized = data.map(normalizeTriviaApiQuestion);
    return filterValidQuestions(normalized);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
