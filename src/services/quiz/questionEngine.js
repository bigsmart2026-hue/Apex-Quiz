/**
 * Centralized question engine.
 * Orchestrates question loading from Firestore cache → external API → fallback.
 * Normalizes, validates, deduplicates, and caches questions.
 */
import { getCategoryConfig } from '../../config/categories';
import { getDifficultyForLevel } from '../../config/levels';
import { fetchOpenTdbQuestions } from '../trivia/openTriviaService';
import { fetchQuizApiQuestions } from '../trivia/quizApiService';
import {
  fetchFirestoreQuestions,
  saveQuestionsToFirestore,
} from '../trivia/firestoreQuestionService';
import { validateQuestion } from '../../utils/questionValidator';
import { shuffleArray, shuffleQuestionOptions } from '../../utils/shuffleArray';

const MIN_QUESTIONS_NEEDED = 5;

function computeQuestionHash(text, options) {
  const key = text.toLowerCase().trim() + options.map((o) => o.toLowerCase().trim()).sort().join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function deduplicateById(questions) {
  const seen = new Set();
  return questions.filter((q) => {
    const hash = computeQuestionHash(q.text, q.options);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

function tagWithPoints(questions) {
  return questions.map((q) => {
    const diffConfig = { easy: 10, medium: 20, hard: 30, master: 50 };
    return { ...q, points: diffConfig[q.difficulty] || 10 };
  });
}

function attachCorrectIndex(question) {
  if (typeof question.correctAnswer === 'number') return question;
  const idx = question.options.findIndex(
    (o) => o.toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim()
  );
  return { ...question, correctAnswer: idx >= 0 ? idx : 0 };
}

async function fetchFromProvider(config, difficulty, amount) {
  switch (config.provider) {
    case 'opentdb':
      return fetchOpenTdbQuestions({
        categoryId: config.opentdbCategory,
        difficulty,
        amount,
      });
    case 'quizapi':
      return fetchQuizApiQuestions({
        topic: config.topic,
        difficulty,
        amount,
      });
    default:
      return [];
  }
}

/**
 * Main entry point: get quiz questions for a category and user level.
 */
export async function getQuizQuestions({ categoryId, userLevel = 1, amount = 10 }) {
  const config = getCategoryConfig(categoryId);
  if (!config) throw new Error(`Unknown category: ${categoryId}`);

  const difficulty = getDifficultyForLevel(userLevel);
  let questions = [];
  const sessionHashes = new Set();

  // Step 1: Try Firestore cache
  try {
    const cached = await fetchFirestoreQuestions({ categoryId, difficulty, amount: amount + 10 });
    const valid = cached.filter((q) => validateQuestion(q));
    const deduped = deduplicateById(valid);
    questions = deduped.slice(0, amount);
    questions.forEach((q) => sessionHashes.add(computeQuestionHash(q.text, q.options)));
  } catch {
    // Firestore cache miss — continue to API
  }

  // Step 2: If not enough, call external API
  if (questions.length < amount && config.provider !== 'firestore') {
    try {
      const apiQuestions = await fetchFromProvider(config, difficulty, amount - questions.length);
      const fresh = apiQuestions.filter((q) => {
        const hash = computeQuestionHash(q.text, q.options);
        if (sessionHashes.has(hash)) return false;
        sessionHashes.add(hash);
        return true;
      });
      questions = [...questions, ...fresh];

      // Cache API questions in Firestore in background
      const toCache = fresh.map((q) => ({
        ...q,
        category: categoryId,
      }));
      saveQuestionsToFirestore(toCache).catch(() => {});
    } catch {
      // API failed — rely on what we have from Firestore
    }
  }

  // Step 3: Firestore-only categories — load any available difficulty if current is empty
  if (questions.length < MIN_QUESTIONS_NEEDED && config.provider === 'firestore') {
    const fallbackDifficulties = ['medium', 'easy', 'hard', 'master'].filter((d) => d !== difficulty);
    for (const fallback of fallbackDifficulties) {
      if (questions.length >= amount) break;
      try {
        const more = await fetchFirestoreQuestions({ categoryId, difficulty: fallback, amount: amount - questions.length });
        const valid = more.filter((q) => validateQuestion(q));
        const deduped = deduplicateById(valid).filter((q) => {
          const hash = computeQuestionHash(q.text, q.options);
          if (sessionHashes.has(hash)) return false;
          sessionHashes.add(hash);
          return true;
        });
        questions = [...questions, ...deduped];
      } catch {
        // continue
      }
    }
  }

  if (questions.length === 0) {
    throw new Error('NO_QUESTIONS_AVAILABLE');
  }

  // Normalize and finalize
  questions = questions.map(attachCorrectIndex);
  questions = shuffleQuestionOptions(questions);
  questions = shuffleArray(questions);
  questions = tagWithPoints(questions);
  questions = questions.slice(0, amount);

  return questions;
}
