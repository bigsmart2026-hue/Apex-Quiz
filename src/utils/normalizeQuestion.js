/**
 * Normalize questions from different API sources into a common format.
 */
import { decodeHtmlEntities } from './decodeHtmlEntities';

let _counter = 0;
const genId = () => `q_${Date.now()}_${++_counter}`;

/**
 * Normalize an Open Trivia DB question.
 */
export function normalizeOpenTdbQuestion(raw) {
  const options = [raw.correct_answer, ...raw.incorrect_answers].map(decodeHtmlEntities);
  return {
    id: genId(),
    text: decodeHtmlEntities(raw.question),
    options,
    correctAnswer: 0,
    difficulty: raw.difficulty || 'easy',
    category: raw.category || '',
    source: 'opentdb',
    sourceId: raw.id || null,
    explanation: '',
  };
}

/**
 * Normalize a QuizAPI.io question.
 */
export function normalizeQuizApiQuestion(raw) {
  const options = [raw.correct_answer, ...raw.answers.filter(Boolean)].map(decodeHtmlEntities);
  return {
    id: genId(),
    text: decodeHtmlEntities(raw.question),
    options,
    correctAnswer: 0,
    difficulty: raw.difficulty?.toLowerCase() || 'medium',
    category: raw.tags?.[0]?.name || '',
    source: 'quizapi',
    sourceId: String(raw.id || ''),
    explanation: raw.description ? decodeHtmlEntities(raw.description) : '',
  };
}

/**
 * Normalize a Firestore-stored question.
 */
export function normalizeFirestoreQuestion(doc) {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || genId(),
    text: data.text || data.question || '',
    options: data.options || [],
    correctAnswer: typeof data.correctAnswer === 'number' ? data.correctAnswer : 0,
    difficulty: data.difficulty || 'easy',
    category: data.categoryId || '',
    source: data.source || 'firestore',
    sourceId: data.sourceId || doc.id || '',
    explanation: data.explanation || '',
  };
}

/**
 * Normalize The Trivia API question.
 */
export function normalizeTriviaApiQuestion(raw) {
  const allAnswers = [
    ...(raw.correctAnswer ? [raw.correctAnswer] : []),
    ...(raw.incorrectAnswers || []),
  ].filter(Boolean);
  const options = allAnswers.map(decodeHtmlEntities);
  const correctIdx = raw.correctAnswer
    ? options.findIndex((o) => o.toLowerCase().trim() === decodeHtmlEntities(raw.correctAnswer).toLowerCase().trim())
    : 0;
  return {
    id: genId(),
    text: decodeHtmlEntities(raw.question || ''),
    options,
    correctAnswer: correctIdx >= 0 ? correctIdx : 0,
    difficulty: raw.difficulty?.toLowerCase() || 'medium',
    category: raw.category || '',
    source: 'triviaapi',
    sourceId: raw.id || '',
    explanation: raw.correctAcceptableResponses?.[0]?.text || '',
  };
}
