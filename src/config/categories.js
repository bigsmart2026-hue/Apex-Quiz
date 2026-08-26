/**
 * Centralized category configuration.
 * Maps each category to its provider, API parameters, and supported difficulties.
 */

export const QUIZ_CATEGORIES = {
  'general-knowledge': {
    name: 'General Knowledge',
    provider: 'opentdb',
    opentdbCategory: 9,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  science: {
    name: 'Science',
    provider: 'opentdb',
    opentdbCategory: 17,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  movies: {
    name: 'Movies',
    provider: 'opentdb',
    opentdbCategory: 11,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  music: {
    name: 'Music',
    provider: 'opentdb',
    opentdbCategory: 12,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'video-games': {
    name: 'Video Games',
    provider: 'opentdb',
    opentdbCategory: 15,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  geography: {
    name: 'Geography',
    provider: 'opentdb',
    opentdbCategory: 22,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  history: {
    name: 'History',
    provider: 'opentdb',
    opentdbCategory: 23,
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  technology: {
    name: 'Technology',
    provider: 'quizapi',
    topic: 'general',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  frontend: {
    name: 'Front-end Development',
    provider: 'quizapi',
    topic: 'frontend',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  backend: {
    name: 'Back-end Development',
    provider: 'quizapi',
    topic: 'backend',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'current-affairs': {
    name: 'Current Affairs',
    provider: 'firestore',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  relationships: {
    name: 'Relationship Quiz',
    provider: 'firestore',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  cybersecurity: {
    name: 'Cybersecurity',
    provider: 'quizapi',
    topic: 'cybersecurity',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'digital-marketing': {
    name: 'Digital Marketing',
    provider: 'firestore',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  'product-design': {
    name: 'Product Design',
    provider: 'firestore',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  'data-analytics': {
    name: 'Data Analytics',
    provider: 'quizapi',
    topic: 'data-analytics',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'mobile-app-dev': {
    name: 'Mobile App Development',
    provider: 'quizapi',
    topic: 'mobile-development',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
};

export const getCategoryConfig = (categoryId) => QUIZ_CATEGORIES[categoryId] || null;
export const getAllCategoryIds = () => Object.keys(QUIZ_CATEGORIES);
