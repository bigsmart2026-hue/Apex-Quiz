/**
 * Firestore question bank service.
 * Stores, retrieves, and manages questions in the Firestore 'questions' collection.
 */
import {
  collection, query, where, limit as firestoreLimit, getDocs,
  doc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { normalizeFirestoreQuestion } from '../../utils/normalizeQuestion';
import { QUESTIONS_COLLECTION } from '../../utils/constants';

function computeQuestionHash(text, options) {
  const key = text.toLowerCase().trim() + options.map((o) => o.toLowerCase().trim()).sort().join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export async function fetchFirestoreQuestions({ categoryId, difficulty, amount }) {
  const constraints = [
    where('categoryId', '==', categoryId),
    where('active', '==', true),
  ];
  if (difficulty) constraints.push(where('difficulty', '==', difficulty));
  constraints.push(firestoreLimit(amount));

  const q = query(collection(db, QUESTIONS_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(normalizeFirestoreQuestion);
}

export async function saveQuestionsToFirestore(questions) {
  if (!questions.length) return;
  const batch = writeBatch(db);
  const col = collection(db, QUESTIONS_COLLECTION);
  let saved = 0;

  for (const q of questions) {
    const hash = computeQuestionHash(q.text, q.options);
    const docRef = doc(col);
    batch.set(docRef, {
      categoryId: q.category,
      difficulty: q.difficulty,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      source: q.source,
      sourceId: q.sourceId || '',
      questionHash: hash,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    saved++;
  }

  if (saved > 0) await batch.commit();
  return saved;
}

export async function isDuplicateQuestion(categoryId, hash) {
  const q = query(
    collection(db, QUESTIONS_COLLECTION),
    where('categoryId', '==', categoryId),
    where('questionHash', '==', hash),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
