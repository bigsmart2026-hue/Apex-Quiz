import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchTriviaQuestions } from '../services/triviaApi';
import { fetchQuiz } from '../services/firestore.service';
import { recordQuizCompletion } from '../services/profile.service';
import { submitChallengeScore } from '../services/challenge.service';
import { questionBank, getQuestionsForLevel } from '../utils/questionBank';
import { TIMER_DURATION, getQuizConfig } from '../utils/constants';
import { shuffleArray, shuffleQuestionOptions } from '../utils/shuffleArray';
import { toDateKey } from '../utils/dates';
import { getAccuracy } from '../utils/progression';
import { toast } from './useToastStore';
import { useProfileStore } from './useProfileStore';

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
};

const normalizeBankKey = (categoryName) => {
  const nameLower = categoryName.toLowerCase();
  const bankMap = {
    'relationship quiz': 'relationships',
    'front-end development': 'frontend',
    'back-end development': 'backend',
    'current affairs': 'currentAffairs',
    'cybersecurity': 'cybersecurity',
    'digital marketing': 'digitalMarketing',
    'product design': 'productDesign',
    'data analytics': 'dataAnalytics',
    'mobile app development': 'mobileAppDev',
  };
  return bankMap[nameLower] || nameLower.replace(/[\s-]+/g, '');
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
       * Loads questions for a category. Order: Open Trivia DB -> local bank -> Firestore.
       * Local bank questions are filtered by the player's unlocked level.
       */
      fetchQuestions: async (apiId, categoryName) => {
        set({ isLoading: true, error: null, timer: TIMER_DURATION, isDaily: false, challenge: null });

        if (apiId) {
          try {
            const questions = await fetchTriviaQuestions(apiId);
            applyQuestions(set, questions);
            return;
          } catch {
            // fall through to local bank / Firestore
          }
        }

        const bankKey = normalizeBankKey(categoryName);
        const localBank = questionBank[bankKey];
        if (localBank?.length) {
          const { useProfileStore } = await import('./useProfileStore');
          const playerLevel = useProfileStore.getState().profile?.unlockedLevel || 1;
          const { questionCount, timerDuration } = getQuizConfig(playerLevel);
          const filtered = getQuestionsForLevel(localBank, playerLevel);
          const limited = filtered.slice(0, questionCount);
          applyQuestions(set, limited.length ? limited : localBank.slice(0, questionCount), timerDuration);
          return;
        }

        try {
          const quiz = await fetchQuiz(categoryName);
          if (!quiz.questions?.length) throw new Error('No questions found for this category');
          applyQuestions(set, quiz.questions);
        } catch (err) {
          set({ error: err.message || 'Failed to load questions', isLoading: false });
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
       * records the completion (attempt doc + profile update) through
       * the trusted profile service.
       */
      goToNext: async () => {
        const { questions, currentIndex, selectedAnswers, user, category, startedAt, isDaily, challenge } = get();
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
              // comparison unavailable — show neutral result
            }

            set({
              completionSummary: {
                xpGained: 0,
                level: null,
                leveledUp: false,
                streak: null,
                newAchievements: [],
                accuracyPct: getAccuracy(finalScore, total),
                timeTakenMs,
                avgAnswerSec,
                challenge: { ...challenge, won: myWon, opponentScore, myScore: finalScore },
              },
              savingResult: false,
            });
            return;
          }

          const summary = await recordQuizCompletion(user, category, {
            score: finalScore,
            total,
            timeTakenMs,
            avgAnswerSec,
            isDaily,
          });

          set({
            completionSummary: {
              ...summary,
              timeTakenMs,
              avgAnswerSec,
              totalAnswered: total,
              correctAnswers: finalScore,
              dateKey: toDateKey(),
            },
            savingResult: false,
          });

          useProfileStore.getState().applyCompletion(get().completionSummary);

          if (summary.levelCompleted) {
            const { LEVELS } = await import('../utils/progression');
            const nextLevelInfo = LEVELS.find((l) => l.level === summary.unlockedLevel);
            toast.success(
              `Level ${summary.unlockedLevel} Unlocked!`,
              `${nextLevelInfo?.name || 'Next level'} — ${nextLevelInfo?.description || ''}`
            );
          } else if (summary.xpGained > 0) {
            toast.success(
              isDaily ? 'Daily challenge complete!' : 'Quiz complete!',
              `+${summary.xpGained} XP${summary.leveledUp ? ` · Level ${summary.level} — ${summary.levelName}!` : ''}`
            );
          }
          if (summary.newAchievements.length > 0) {
            summary.newAchievements.forEach((id) => {
              toast.achievement('Achievement unlocked', id.split('-').join(' '));
            });
          }
        } catch (err) {
          console.error('[quiz] save failed:', err);
          const alreadyPlayed = err.message === 'QUIZ_ALREADY_PLAYED';
          set({
            completionSummary: {
              xpGained: 0,
              level: null,
              leveledUp: false,
              streak: null,
              newAchievements: [],
              accuracyPct: getAccuracy(finalScore, total),
              timeTakenMs,
              avgAnswerSec,
              totalAnswered: total,
              correctAnswers: finalScore,
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
              ? 'Leaderboard access denied — deploy the Firestore security rules (firebase deploy --only firestore:rules).'
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