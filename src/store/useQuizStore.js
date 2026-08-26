import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { recordQuizCompletion } from '../services/profile.service';
import { submitChallengeScore } from '../services/challenge.service';
import { getQuizQuestions } from '../services/quiz/questionEngine';
import { scoreQuiz } from '../services/quiz/scoringService';
import {
  getCategoryProgress,
  saveCategoryProgress,
} from '../services/quiz/progressService';
import { TIMER_DURATION, getQuizConfig } from '../utils/constants';
import { shuffleArray, shuffleQuestionOptions } from '../utils/shuffleArray';
import { toDateKey } from '../utils/dates';
import { getAccuracy } from '../utils/progression';
import { toast } from './useToastStore';
import { useProfileStore } from './useProfileStore';
import { getCategoryConfig } from '../config/categories';

const initialState = {
  user: null,
  isLoading: false,
  error: null,
  category: null,
  questions: [],
  currentIndex: 0,
  selectedAnswers: {},
  answerTimes: {},
  score: 0,
  isFinished: false,
  timer: TIMER_DURATION,
  quizTimerDuration: TIMER_DURATION,
  startedAt: 0,
  completionSummary: null,
  challenge: null,
  isDaily: false,
  leaderboard: [],
  leaderboardTab: 'global',
  leaderboardError: null,
  savingResult: false,
  categoryProgress: null,
  currentDifficulty: 'easy',
};

const applyQuestions = (set, questions, timerDuration = TIMER_DURATION, extra = {}) =>
  set({
    questions: shuffleQuestionOptions(shuffleArray(questions)),
    currentIndex: 0,
    selectedAnswers: {},
    answerTimes: {},
    score: 0,
    isFinished: false,
    timer: timerDuration,
    quizTimerDuration: timerDuration,
    startedAt: Date.now(),
    completionSummary: null,
    error: null,
    isLoading: false,
    ...extra,
  });

const useQuizStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      theme: 'light',

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      login: (user) => set({ user }),

      logout: () => set({ ...initialState, theme: get().theme }),

      setCategory: (category) => set({ category }),

      setDailyChallenge: (category, questions) => {
        const playerLevel = useProfileStore.getState().profile?.unlockedLevel || 1;
        const { timerDuration } = getQuizConfig(playerLevel);
        set({ category, isDaily: true, challenge: null });
        applyQuestions(set, questions, timerDuration);
      },

      startChallenge: (challenge, questions) => {
        const playerLevel = useProfileStore.getState().profile?.unlockedLevel || 1;
        const { timerDuration } = getQuizConfig(playerLevel);
        set({
          category: { id: challenge.categoryId, name: challenge.categoryName },
          isDaily: false,
          challenge,
        });
        applyQuestions(set, questions, timerDuration);
      },

      clearChallenge: () => set({ challenge: null, isDaily: false }),

      /**
       * Loads questions for a category using the centralized question engine.
       * Reads per-category progress to determine difficulty level.
       */
      fetchQuestions: async (categoryId, categoryName) => {
        set({ isLoading: true, error: null, timer: TIMER_DURATION, isDaily: false, challenge: null });

        const { user } = get();
        const config = getCategoryConfig(categoryId);
        if (!config) {
          set({ error: `Unknown category: ${categoryName}`, isLoading: false });
          return;
        }

        let userLevel = 1;
        let progress = null;

        if (user?.uid) {
          try {
            progress = await getCategoryProgress(user.uid, categoryId);
            userLevel = progress.currentLevel || 1;
          } catch {
            // Use default level 1
          }
        }

        const { questionCount, timerDuration } = getQuizConfig(userLevel);

        try {
          const seenHashes = progress?.seenQuestionHashes || [];
          const questions = await getQuizQuestions({
            categoryId,
            userLevel,
            amount: questionCount,
            seenHashes,
          });

          const difficulty = questions[0]?.difficulty || 'easy';
          applyQuestions(set, questions, timerDuration, {
            categoryProgress: progress,
            currentDifficulty: difficulty,
          });
        } catch (err) {
          const msg = err.message === 'NO_QUESTIONS_AVAILABLE'
            ? "We couldn't load questions for this category. Please try again later or choose another category."
            : 'Failed to load questions. Please try again.';
          set({ error: msg, isLoading: false });
        }
      },

      selectAnswer: (questionId, optionIndex) => {
        const { questions, selectedAnswers } = get();
        if (selectedAnswers[questionId] !== undefined) return;

        const question = questions.find((q) => q.id === questionId);
        const isCorrect = question?.correctAnswer === optionIndex;

        set((state) => ({
          selectedAnswers: { ...state.selectedAnswers, [questionId]: optionIndex },
          answerTimes: { ...state.answerTimes, [questionId]: Date.now() },
          score: isCorrect ? state.score + 1 : state.score,
        }));
      },

      decrementTimer: () => {
        const { timer } = get();
        if (timer > 0) set({ timer: timer - 1 });
      },

      /**
       * Advances the quiz. On the final question, finishes the quiz and
       * records the completion using per-category progress + XP system.
       */
      goToNext: async () => {
        const {
          questions, currentIndex, selectedAnswers, user, category,
          startedAt, isDaily, challenge, categoryProgress,
        } = get();
        const isLast = currentIndex === questions.length - 1;

        if (!isLast) {
          set({ currentIndex: currentIndex + 1, timer: get().quizTimerDuration });
          return;
        }

        const finalScore = questions.reduce(
          (acc, q) => acc + (selectedAnswers[q.id] === q.correctAnswer ? 1 : 0),
          0
        );
        const total = questions.length;
        const timeTakenMs = startedAt ? Date.now() - startedAt : 0;
        const avgAnswerSec = total > 0 ? timeTakenMs / 1000 / total : 0;

        set({ isFinished: true, score: finalScore, savingResult: true });

        if (!user?.uid) {
          console.error('[quiz] user not authenticated — cannot save');
          set({
            completionSummary: {
              xpGained: 0, level: null, leveledUp: false, streak: null,
              newAchievements: [], accuracyPct: getAccuracy(finalScore, total),
              timeTakenMs, avgAnswerSec, totalAnswered: total, correctAnswers: finalScore,
              error: 'Not signed in — result saved locally only.',
            },
            savingResult: false,
          });
          return;
        }

        try {
          if (challenge) {
            const isCreator = challenge.creatorId === user.uid;
            await submitChallengeScore(challenge.code, user, {
              score: finalScore,
              total,
              accuracyPct: getAccuracy(finalScore, total),
            });

            let myWon = false;
            let opponentScore = null;
            try {
              const { getChallenge, resolveWinner } = await import('../services/challenge.service');
              const updated = await getChallenge(challenge.code);
              const winner = updated ? resolveWinner(updated) : null;
              myWon = winner === (isCreator ? 'creator' : 'opponent');
              opponentScore = isCreator ? updated?.opponentScore : updated?.creatorScore;
            } catch {
              // comparison unavailable
            }

            set({
              completionSummary: {
                xpGained: 0, level: null, leveledUp: false, streak: null,
                newAchievements: [], accuracyPct: getAccuracy(finalScore, total),
                timeTakenMs, avgAnswerSec,
                challenge: { ...challenge, won: myWon, opponentScore, myScore: finalScore },
              },
              savingResult: false,
            });
            return;
          }

          const currentLevel = categoryProgress?.currentLevel || 1;
          const quizResult = scoreQuiz(selectedAnswers, questions, currentLevel);

          const summary = await recordQuizCompletion(user, category, {
            score: finalScore,
            total,
            timeTakenMs,
            avgAnswerSec,
            isDaily,
          });

          // Track seen question hashes to avoid repeats
          const computeHash = (text, opts) => {
            const key = text.toLowerCase().trim() + opts.map((o) => o.toLowerCase().trim()).sort().join('|');
            let h = 0;
            for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
            return String(h);
          };
          const newHashes = questions.map((q) => computeHash(q.text, q.options));

          saveCategoryProgress(user.uid, category.id, quizResult, newHashes).catch(() => {});

          set({
            completionSummary: {
              ...summary,
              ...quizResult,
              timeTakenMs,
              avgAnswerSec,
              totalAnswered: total,
              correctAnswers: finalScore,
              dateKey: toDateKey(),
              totalPoints: quizResult.totalPoints,
            },
            savingResult: false,
          });

          useProfileStore.getState().applyCompletion(get().completionSummary);

          if (quizResult.leveledUp) {
            const { CATEGORY_LEVELS } = await import('../config/levels');
            const nextLevelInfo = CATEGORY_LEVELS[quizResult.newLevel];
            toast.success(
              `Level ${quizResult.newLevel} Unlocked!`,
              `${nextLevelInfo?.name || 'Next level'} — ${nextLevelInfo?.description || ''}`
            );
          } else if (summary.xpGained > 0) {
            toast.success(
              isDaily ? 'Daily challenge complete!' : 'Quiz complete!',
              `+${summary.xpGained} XP${summary.leveledUp ? ` · Level ${summary.level}!` : ''}`
            );
          }
          if (summary.newAchievements?.length > 0) {
            summary.newAchievements.forEach((id) => {
              toast.achievement('Achievement unlocked', id.split('-').join(' '));
            });
          }
        } catch (err) {
          console.error('[quiz] save failed:', err);
          const alreadyPlayed = err.message === 'QUIZ_ALREADY_PLAYED';
          set({
            completionSummary: {
              xpGained: 0, level: null, leveledUp: false, streak: null,
              newAchievements: [], accuracyPct: getAccuracy(finalScore, total),
              timeTakenMs, avgAnswerSec, totalAnswered: total, correctAnswers: finalScore,
              dateKey: toDateKey(),
              error: alreadyPlayed
                ? 'You already played this quiz today — no extra XP awarded.'
                : 'Could not save your result. You can still review your answers.',
            },
            savingResult: false,
          });
        }
      },

      fetchLeaderboard: async (tab = 'global') => {
        const { getGlobalLeaderboard, getWeeklyLeaderboard } = await import('../services/leaderboard.service');
        set({ leaderboardError: null, leaderboardTab: tab });
        try {
          const entries = tab === 'weekly' ? await getWeeklyLeaderboard() : await getGlobalLeaderboard();
          set({ leaderboard: entries });
        } catch (err) {
          console.error('[leaderboard] load failed:', err);
          set({
            leaderboard: [],
            leaderboardError: err?.code === 'permission-denied'
              ? 'Leaderboard access denied — deploy the Firestore security rules.'
              : 'Something went wrong while loading the leaderboard.',
          });
        }
      },

      clearLeaderboardError: () => set({ leaderboardError: null }),

      reset: () =>
        set({
          ...initialState,
          theme: get().theme,
          user: get().user,
        }),
    }),
    {
      name: 'apex-quiz-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

export default useQuizStore;
