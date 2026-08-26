/**
 * Open Trivia DB service.
 * Fetches questions from https://opentdb.com/api.php
 * Supports category, difficulty, amount, and type filtering.
 */
import { normalizeOpenTdbQuestion } from '../../utils/normalizeQuestion';
import { filterValidQuestions } from '../../utils/questionValidator';

const API_URL = 'https://opentdb.com/api.php';
const REQUEST_TIMEOUT_MS = 10000;

const DIFFICULTY_MAP = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  master: 'hard',
};

export async function fetchOpenTdbQuestions({ categoryId, difficulty = 'easy', amount = 10 }) {
  const params = new URLSearchParams({
    amount: String(amount),
    type: 'multiple',
  });
  if (categoryId) params.set('category', String(categoryId));
  const mapped = DIFFICULTY_MAP[difficulty] || 'easy';
  if (mapped) params.set('difficulty', mapped);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 429) throw new Error('RATE_LIMITED');
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.response_code !== 0 || !data.results?.length) {
      throw new Error('NO_RESULTS');
    }
    const normalized = data.results.map(normalizeOpenTdbQuestion);
    return filterValidQuestions(normalized);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
