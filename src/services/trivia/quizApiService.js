/**
 * QuizAPI.io service.
 * Fetches questions from https://quizapi.io/api/v1/questions
 * Supports topic-based filtering and difficulty levels.
 */
import { normalizeQuizApiQuestion } from '../../utils/normalizeQuestion';
import { filterValidQuestions } from '../../utils/questionValidator';

const API_URL = 'https://quizapi.io/api/v1/questions';
const REQUEST_TIMEOUT_MS = 10000;

const DIFFICULTY_MAP = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  master: 'Hard',
};

const TOPIC_MAP = {
  frontend: ['html', 'css', 'javascript'],
  backend: ['nodejs', 'api', 'databases'],
  technology: ['general'],
  cybersecurity: ['cybersecurity'],
  'data-analytics': ['sql', 'python'],
  'mobile-app-dev': ['react', 'general'],
};

export async function fetchQuizApiQuestions({ topic = 'general', difficulty = 'medium', amount = 10 }) {
  const apiKey = import.meta.env.VITE_QUIZ_API_KEY;
  if (!apiKey) throw new Error('MISSING_API_KEY');

  const params = new URLSearchParams({ limit: String(Math.min(amount, 30)) });
  const mapped = DIFFICULTY_MAP[difficulty];
  if (mapped) params.set('difficulty', mapped);

  const topicFilters = TOPIC_MAP[topic] || [topic];
  topicFilters.forEach((t) => params.append('tags[]', t));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}?${params}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: controller.signal,
    });
    if (res.ok === false) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      if (res.status === 429) throw new Error('RATE_LIMITED');
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('INVALID_RESPONSE');
    const normalized = data.map(normalizeQuizApiQuestion);
    return filterValidQuestions(normalized);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
