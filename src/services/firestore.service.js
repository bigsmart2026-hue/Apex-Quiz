import { query, collection, limit, getDocs, where } from 'firebase/firestore';
import { db } from './firebase.config';
import { QUIZ_COLLECTION } from '../utils/constants';

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

// NOTE: The historical `results` collection writes were superseded by
// `quizAttempts` (see profile.service.js) and the XP-based `users` leaderboard
// (see leaderboard.service.js). The old `orderBy('score')` read never worked
// with the previous security rules and has been removed.