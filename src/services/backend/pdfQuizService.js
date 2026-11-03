/**
 * AI quiz generation: PDF upload, text input, and history.
 * Backed by the FastAPI backend; questions are normalized into the
 * frontend question shape so generated quizzes play like any other quiz.
 */
import { apiFetch } from './apiClient';

const POINTS_BY_DIFFICULTY = { easy: 10, medium: 20, hard: 30, master: 50 };

let _counter = 0;
const genId = (prefix = 'gen') => `${prefix}_${Date.now()}_${++_counter}`;

function coerceIndex(options, correctAnswer) {
  if (typeof correctAnswer === 'number' && options[correctAnswer] !== undefined) return correctAnswer;
  const needle = String(correctAnswer ?? '').toLowerCase().trim();
  if (!needle) return 0;
  const found = options.findIndex((o) => String(o).toLowerCase().trim() === needle);
  return found >= 0 ? found : 0;
}

function normalizeDifficulty(raw) {
  const d = String(raw || 'medium').toLowerCase();
  return ['easy', 'medium', 'hard', 'master'].includes(d) ? d : 'medium';
}

/**
 * Normalizes one backend GeneratedQuestion.
 * Returns null when the question is not playable in the quiz UI
 * (e.g. short-answer without options).
 */
export function normalizeGeneratedQuestion(raw) {
  const type = raw?.type || 'multiple_choice';
  const difficulty = normalizeDifficulty(raw?.difficulty);
  const text = String(raw?.question_text || raw?.question || '').trim();
  if (!text) return null;

  const base = {
    id: raw?.id || genId(),
    text,
    difficulty,
    category: 'custom',
    source: 'pdf',
    sourceId: raw?.id || null,
    explanation: raw?.explanation || '',
    topicTags: raw?.topic_tags || [],
    points: POINTS_BY_DIFFICULTY[difficulty] || 10,
  };

  if (type === 'true_false') {
    const options = Array.isArray(raw?.options) && raw.options.length >= 2
      ? raw.options.slice(0, 2)
      : ['True', 'False'];
    return { ...base, options, correctAnswer: coerceIndex(options, raw?.correct_answer) };
  }

  if (type === 'multiple_choice') {
    const options = (raw?.options || []).map(String).filter(Boolean);
    if (options.length < 2) return null;
    return { ...base, options, correctAnswer: coerceIndex(options, raw?.correct_answer) };
  }

  return null;
}

/**
 * Normalizes a backend questions array.
 * @returns {{ questions: Array, skipped: number }}
 */
export function normalizeGeneratedQuestions(rawQuestions) {
  const questions = [];
  let skipped = 0;
  for (const raw of rawQuestions || []) {
    const q = normalizeGeneratedQuestion(raw);
    if (q) questions.push(q);
    else skipped += 1;
  }
  return { questions, skipped };
}

/**
 * Generate a quiz from an uploaded PDF file.
 * Form fields mirror POST /api/quiz/generate.
 */
export async function generateQuizFromPdf(file, { questionCount, difficulty, topics, questionTypes } = {}) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('question_count', String(questionCount));
  if (difficulty) formData.append('difficulty', difficulty);
  if (topics?.length) formData.append('topics', topics.join(','));
  if (questionTypes?.length) formData.append('question_types', questionTypes.join(','));

  const { data } = await apiFetch('/api/quiz/generate', { method: 'POST', formData });
  const { questions, skipped } = normalizeGeneratedQuestions(data.questions);
  return {
    quizId: data.quiz_id,
    questions,
    skipped,
    totalGenerated: data.total_generated,
    requestedCount: data.requested_count,
    generationTimeMs: data.generation_time_ms,
    warnings: data.warnings || [],
  };
}

/** Generate a quiz from pasted text (min 100 chars). */
export async function generateQuizFromText({ text, questionCount, difficulty, topics, questionTypes }) {
  const { data } = await apiFetch('/api/quiz/generate/text', {
    method: 'POST',
    json: { text, question_count: questionCount, difficulty: difficulty || undefined, topics, question_types: questionTypes },
  });
  const { questions, skipped } = normalizeGeneratedQuestions(data.questions);
  return {
    quizId: data.quiz_id,
    questions,
    skipped,
    totalGenerated: data.total_generated,
    requestedCount: data.requested_count,
    generationTimeMs: data.generation_time_ms,
    warnings: data.warnings || [],
  };
}

/** List previously generated quizzes. */
export async function getQuizHistory({ limit = 20, offset = 0 } = {}) {
  const { data } = await apiFetch(`/api/quiz/history?limit=${limit}&offset=${offset}`);
  return (data || []).map((item) => ({
    quizId: item.quiz_id,
    questionCount: item.question_count,
    createdAt: item.created_at,
    sourceFilename: item.source_filename,
  }));
}

/** Fetch a full generated quiz by id (questions normalized). */
export async function getGeneratedQuiz(quizId) {
  const { data } = await apiFetch(`/api/quiz/${quizId}`);
  const { questions, skipped } = normalizeGeneratedQuestions(data.questions);
  return {
    quizId: data.quiz_id,
    questions,
    skipped,
    createdAt: data.created_at,
    sourceFilename: data.source_filename,
    params: data.generation_params || {},
  };
}

/** Delete a generated quiz. */
export async function deleteGeneratedQuiz(quizId) {
  await apiFetch(`/api/quiz/${quizId}`, { method: 'DELETE' });
}
