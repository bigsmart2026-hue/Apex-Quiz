import { doc, getDoc, setDoc, serverTimestamp, query, collection, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from './firebase.config';
import { QUIZ_COLLECTION, RESULTS_COLLECTION } from '../utils/constants';

/**
 * Fetches a quiz document from Firestore by category name.
 * @param {string} categoryName - The category name to look up
 * @returns {Promise<{id: string, title: string, category: string, questions: Array}>}
 */
export async function fetchQuiz(categoryName) {
  const q = query(
    collection(db, QUIZ_COLLECTION),
    where('category', '==', categoryName),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error(`No quiz found for category: ${categoryName}`);
  }
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Saves a user's quiz result to the results collection in Firestore.
 * @param {string} userId - The authenticated user's unique ID
 * @param {string} displayName - The user's display name
 * @param {string} category - The quiz category name
 * @param {number} score - The number of correct answers
 * @param {number} total - The total number of questions
 * @returns {Promise<void>}
 */
export async function saveResult(userId, displayName, category, score, total) {
  const resultRef = doc(db, RESULTS_COLLECTION, `${userId}_${category}_${Date.now()}`);
  await setDoc(resultRef, {
    userId,
    displayName,
    category,
    score,
    total,
    timestamp: serverTimestamp(),
  });
}

/**
 * Fetches the top 10 quiz results from Firestore, ordered by score descending.
 * @returns {Promise<Array<{id: string, userId: string, displayName: string, category: string, score: number, total: number, timestamp: object}>>}
 */
export async function getLeaderboard() {
  const q = query(
    collection(db, RESULTS_COLLECTION),
    orderBy('score', 'desc'),
    limit(10)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}
