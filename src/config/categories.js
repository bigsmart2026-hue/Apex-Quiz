/**
 * Centralized category configuration.
 * Each category lists multiple providers in priority order.
 * The question engine randomly rotates through them.
 */

export const QUIZ_CATEGORIES = {
  'general-knowledge': {
    name: 'General Knowledge',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 9,
    triviaApiCategory: 'general_knowledge',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  science: {
    name: 'Science',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 17,
    triviaApiCategory: 'science',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  movies: {
    name: 'Movies',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 11,
    triviaApiCategory: 'film_and_tv',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  music: {
    name: 'Music',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 12,
    triviaApiCategory: 'music',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'video-games': {
    name: 'Video Games',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 15,
    triviaApiCategory: 'video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  geography: {
    name: 'Geography',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 22,
    triviaApiCategory: 'geography',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  history: {
    name: 'History',
    providers: ['opentdb', 'triviaapi'],
    opentdbCategory: 23,
    triviaApiCategory: 'history',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  technology: {
    name: 'Technology',
    providers: ['triviaapi', 'opentdb'],
    opentdbCategory: 18,
    triviaApiCategory: 'tech_and_video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  frontend: {
    name: 'Front-end Development',
    providers: ['triviaapi', 'opentdb'],
    opentdbCategory: 18,
    triviaApiCategory: 'tech_and_video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  backend: {
    name: 'Back-end Development',
    providers: ['triviaapi', 'opentdb'],
    opentdbCategory: 18,
    triviaApiCategory: 'tech_and_video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'current-affairs': {
    name: 'Current Affairs',
    providers: ['triviaapi'],
    triviaApiCategory: 'science',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  relationships: {
    name: 'Relationship Quiz',
    providers: ['triviaapi'],
    triviaApiCategory: 'society_and_culture',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  cybersecurity: {
    name: 'Cybersecurity',
    providers: ['triviaapi', 'opentdb'],
    opentdbCategory: 18,
    triviaApiCategory: 'tech_and_video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'digital-marketing': {
    name: 'Digital Marketing',
    providers: ['triviaapi'],
    triviaApiCategory: 'arts_and_literature',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  'product-design': {
    name: 'Product Design',
    providers: ['triviaapi'],
    triviaApiCategory: 'arts_and_literature',
    supportedDifficulties: ['easy', 'medium', 'hard', 'master'],
  },
  'data-analytics': {
    name: 'Data Analytics',
    providers: ['triviaapi', 'opentdb'],
    opentdbCategory: 18,
    triviaApiCategory: 'tech_and_video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
  'mobile-app-dev': {
    name: 'Mobile App Development',
    providers: ['triviaapi', 'opentdb'],
    opentdbCategory: 18,
    triviaApiCategory: 'tech_and_video_games',
    supportedDifficulties: ['easy', 'medium', 'hard'],
  },
};

export const getCategoryConfig = (categoryId) => QUIZ_CATEGORIES[categoryId] || null;
export const getAllCategoryIds = () => Object.keys(QUIZ_CATEGORIES);
