/**
 * Seeds the Firestore `quizzes` collection from the local question bank.
 *
 * Requires a Firebase service account to bypass security rules.
 *
 * Usage:
 *   npm install          # firebase-admin is a devDependency
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json npm run seed
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { questionBank } from './src/utils/questionBank.js';
import { categories } from './src/utils/categories.js';
import { QUIZ_COLLECTION } from './src/utils/constants.js';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error(
    'Missing FIREBASE_SERVICE_ACCOUNT_PATH. Download your service account JSON from ' +
      'Firebase Console > Project settings > Service accounts and set the env var.'
  );
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(resolve(serviceAccountPath), 'utf8'));
} catch (err) {
  console.error(`Failed to read service account file "${serviceAccountPath}":`, err.message);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const bankToCategoryName = {
  relationships: 'Relationship Quiz',
  frontend: 'Front-end Development',
  backend: 'Back-end Development',
  currentAffairs: 'Current Affairs',
};

async function seed() {
  const entries = Object.entries(questionBank);
  if (entries.length === 0) {
    console.error('No question banks found to seed.');
    process.exit(1);
  }

  const validCategoryNames = new Set(categories.map((c) => c.name));

  for (const [bankKey, questions] of entries) {
    const categoryName = bankToCategoryName[bankKey] || bankKey;
    if (!validCategoryNames.has(categoryName)) {
      console.warn(`Skipping "${bankKey}": no matching category in categories.js`);
      continue;
    }

    const docRef = db.collection(QUIZ_COLLECTION).doc(`bank-${bankKey}`);
    await docRef.set({
      title: `${categoryName} Quiz`,
      category: categoryName,
      questions,
    });
    console.log(`Seeded "${categoryName}" (${questions.length} questions)`);
  }

  console.log('\nSeed complete.');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => process.exit(0));