import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA0cQS3OrOMsKfjcOn7lFJS-n1YydYxmT0",
  authDomain: "apex-quiz-2e25e.firebaseapp.com",
  projectId: "apex-quiz-2e25e",
  storageBucket: "apex-quiz-2e25e.firebasestorage.app",
  messagingSenderId: "829895508188",
  appId: "1:829895508188:web:276a9fdcb368a943307419",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const quizData = {
  title: "Apex Quiz",
  questions: [
    {
      id: "q1",
      text: "What is the capital of France?",
      options: ["London", "Paris", "Berlin", "Madrid"],
      correctAnswer: 1,
    },
    {
      id: "q2",
      text: "Which planet is known as the Red Planet?",
      options: ["Venus", "Jupiter", "Mars", "Saturn"],
      correctAnswer: 2,
    },
    {
      id: "q3",
      text: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctAnswer: 1,
    },
    {
      id: "q4",
      text: "Who wrote 'Romeo and Juliet'?",
      options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
      correctAnswer: 1,
    },
    {
      id: "q5",
      text: "What is the largest ocean on Earth?",
      options: ["Atlantic", "Indian", "Arctic", "Pacific"],
      correctAnswer: 3,
    },
  ],
};

async function seed() {
  try {
    await setDoc(doc(db, "quizzes", "apex-quiz-001"), quizData);
    console.log("Quiz seeded successfully!");
  } catch (err) {
    console.error("Failed to seed:", err.message);
  }
}

seed();
