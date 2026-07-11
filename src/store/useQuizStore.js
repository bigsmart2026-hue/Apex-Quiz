import { create } from 'zustand';
import { fetchTriviaQuestions } from '../services/triviaApi';
import { fetchQuiz, saveResult, getLeaderboard } from '../services/firestore.service';
import { questionBank } from '../utils/questionBank';
import { TIMER_DURATION } from '../utils/constants';

const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('apex-theme') || 'light' : 'light';

const useQuizStore = create((set, get) => ({
  theme: storedTheme,
  user: null,
  isLoading: false,
  error: null,
  category: null,
  questions: [],
  currentIndex: 0,
  selectedAnswers: {},
  score: 0,
  isFinished: false,
  timer: TIMER_DURATION,
  leaderboard: [],

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('apex-theme', next);
    set({ theme: next });
  },

  login: (user) => set({ user }),

  logout: () => set({
    user: null,
    category: null,
    questions: [],
    currentIndex: 0,
    selectedAnswers: {},
    score: 0,
    isFinished: false,
    error: null,
    timer: TIMER_DURATION,
    leaderboard: [],
  }),

  setCategory: (category) => set({ category }),

  /**
   * Fetches questions for a given category. Tries the Open Trivia DB API first;
   * on failure, falls back to the Firestore quizzes collection.
   * @param {number} apiId - The Open Trivia DB category identifier
   * @param {string} categoryName - The category name for Firestore fallback
   * @returns {Promise<void>}
   */
  fetchQuestions: async (apiId, categoryName) => {
    set({ isLoading: true, error: null, timer: TIMER_DURATION });

    const loadFromFirestore = async () => {
      try {
        const quiz = await fetchQuiz(categoryName);
        set({
          questions: quiz.questions,
          isLoading: false,
          currentIndex: 0,
          selectedAnswers: {},
          score: 0,
        });
      } catch (fallbackErr) {
        set({ error: fallbackErr.message, isLoading: false });
      }
    };

    const loadFromLocalBank = () => {
      const nameLower = categoryName.toLowerCase();
      const bankMap = {
        'relationship quiz': 'relationships',
      };
      const bankKey = bankMap[nameLower] || nameLower.replace(/[\s-]+/g, '');
      const questions = questionBank[bankKey];
      if (questions && questions.length > 0) {
        set({
          questions,
          isLoading: false,
          currentIndex: 0,
          selectedAnswers: {},
          score: 0,
        });
        return true;
      }
      return false;
    };

    if (!apiId) {
      if (loadFromLocalBank()) return;
      return loadFromFirestore();
    }

    try {
      const questions = await fetchTriviaQuestions(apiId);
      set({ questions, isLoading: false, currentIndex: 0, selectedAnswers: {}, score: 0 });
    } catch {
      if (!loadFromLocalBank()) {
        loadFromFirestore();
      }
    }
  },

  /**
   * Records the user's selected answer for a question and increments score if correct.
   * @param {string} questionId - The unique question identifier
   * @param {number} optionIndex - The index of the selected option
   */
  selectAnswer: (questionId, optionIndex) => {
    const { questions, selectedAnswers } = get();
    if (selectedAnswers[questionId] !== undefined) return;

    const question = questions.find((q) => q.id === questionId);
    const isCorrect = question && question.correctAnswer === optionIndex;

    set((state) => ({
      selectedAnswers: { ...state.selectedAnswers, [questionId]: optionIndex },
      score: isCorrect ? state.score + 1 : state.score,
    }));
  },

  decrementTimer: () => {
    const { timer } = get();
    if (timer > 0) {
      set({ timer: timer - 1 });
    }
  },

  goToNext: () => {
    const { questions, currentIndex, selectedAnswers, user, category } = get();
    const isLast = currentIndex === questions.length - 1;

    if (isLast) {
      let finalScore = 0;
      questions.forEach((q) => {
        if (selectedAnswers[q.id] === q.correctAnswer) {
          finalScore++;
        }
      });
      set({ isFinished: true, score: finalScore });

      if (user && category) {
        saveResult(user.uid, user.displayName, category.name, finalScore, questions.length)
          .catch(() => {});
      }
    } else {
      set({ currentIndex: currentIndex + 1, timer: TIMER_DURATION });
    }
  },

  fetchLeaderboard: async () => {
    try {
      const entries = await getLeaderboard();
      set({ leaderboard: entries });
    } catch {
      set({ error: 'Failed to load leaderboard' });
    }
  },

  reset: () => set({
    category: null,
    questions: [],
    currentIndex: 0,
    selectedAnswers: {},
    score: 0,
    isFinished: false,
    error: null,
    timer: TIMER_DURATION,
    leaderboard: [],
  }),
}));

export default useQuizStore;
