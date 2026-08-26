/**
 * Local question bank service.
 * Loads questions from the hardcoded questionBank.js for Firestore-only categories.
 * Tags them with difficulty levels and saves to Firestore for caching.
 */
import { questionBank } from '../../utils/questionBank';
import { saveQuestionsToFirestore, fetchFirestoreQuestions } from '../trivia/firestoreQuestionService';

const CATEGORY_MAP = {
  relationships: 'relationships',
  'current-affairs': 'currentAffairs',
  'digital-marketing': 'digitalMarketing',
  'product-design': 'productDesign',
};

function tagQuestionDifficulty(questions) {
  const total = questions.length;
  return questions.map((q, i) => {
    const pct = i / total;
    let difficulty = 'easy';
    if (pct >= 0.75) difficulty = 'hard';
    else if (pct >= 0.4) difficulty = 'medium';
    return { ...q, difficulty };
  });
}

export async function loadLocalBankQuestions(categoryId, difficulty, amount) {
  const bankKey = CATEGORY_MAP[categoryId];
  const bank = questionBank[bankKey];
  if (!bank?.length) return [];

  const tagged = tagQuestionDifficulty(bank);
  const filtered = tagged.filter((q) => q.difficulty === difficulty);
  const selected = filtered.length >= amount
    ? filtered.slice(0, amount)
    : [...filtered, ...tagged.filter((q) => q.difficulty !== difficulty)].slice(0, amount);

  return selected.map((q, i) => ({
    id: `local_${categoryId}_${difficulty}_${i}`,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    difficulty: q.difficulty,
    category: categoryId,
    source: 'local',
    sourceId: q.id || `local_${i}`,
    explanation: '',
  }));
}

export async function seedLocalQuestionsToFirestore(categoryId) {
  const bankKey = CATEGORY_MAP[categoryId];
  const bank = questionBank[bankKey];
  if (!bank?.length) return 0;

  const existing = await fetchFirestoreQuestions({ categoryId, difficulty: null, amount: 100 });
  if (existing.length >= bank.length) return 0;

  const tagged = tagQuestionDifficulty(bank);
  const questions = tagged.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    difficulty: q.difficulty,
    category: categoryId,
    source: 'local',
    sourceId: q.id || '',
    explanation: '',
  }));

  return saveQuestionsToFirestore(questions);
}
