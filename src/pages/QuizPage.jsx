import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Swords, Flame, Target } from 'lucide-react';
import { Skeleton, Snackbar, Alert } from '@mui/material';
import { useShallow } from 'zustand/react/shallow';
import useQuizStore from '../store/useQuizStore';
import { CATEGORY_LEVELS } from '../config/levels';
import { DIFFICULTY_CONFIG } from '../config/difficulty';
import Navbar from '../components/Navbar';
import ProgressStepper from '../components/ProgressStepper';
import QuestionCard from '../components/QuestionCard';
import TimerBar from '../components/TimerBar';

export default function QuizPage() {
  const navigate = useNavigate();
  const category = useQuizStore((s) => s.category);
  const challenge = useQuizStore((s) => s.challenge);
  const isDaily = useQuizStore((s) => s.isDaily);
  const {
    questions,
    currentIndex,
    selectedAnswers,
    isLoading,
    error,
    isFinished,
    timer,
    selectAnswer,
    goToNext,
    categoryProgress,
    currentDifficulty,
  } = useQuizStore(
    useShallow((s) => ({
      questions: s.questions,
      currentIndex: s.currentIndex,
      selectedAnswers: s.selectedAnswers,
      isLoading: s.isLoading,
      error: s.error,
      isFinished: s.isFinished,
      timer: s.timer,
      selectAnswer: s.selectAnswer,
      goToNext: s.goToNext,
      categoryProgress: s.categoryProgress,
      currentDifficulty: s.currentDifficulty,
    }))
  );

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    if (error) setSnackbarOpen(true);
  }, [error]);

  useEffect(() => {
    if (isFinished) navigate('/results', { replace: true });
  }, [isFinished, navigate]);

  const currentQuestion = questions[currentIndex] || null;
  const selectedAnswer = currentQuestion ? (selectedAnswers[currentQuestion.id] ?? null) : null;
  const hasAnswered = selectedAnswer !== null;
  const isLast = currentIndex === questions.length - 1;

  const decrementTimer = useQuizStore((s) => s.decrementTimer);

  useEffect(() => {
    if (hasAnswered || isFinished || questions.length === 0) return;
    advancedRef.current = false;

    const interval = setInterval(() => {
      const state = useQuizStore.getState();
      if (state.timer <= 0 && !advancedRef.current) {
        advancedRef.current = true;
        clearInterval(interval);
        state.goToNext();
      } else if (state.timer > 0) {
        state.decrementTimer();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasAnswered, isFinished, questions.length, currentIndex, decrementTimer, goToNext]);

  const handleSelectAnswer = useCallback(
    (optionIndex) => {
      if (currentQuestion) selectAnswer(currentQuestion.id, optionIndex);
    },
    [currentQuestion, selectAnswer]
  );

  const handleNext = useCallback(() => {
    if (!hasAnswered) return;
    goToNext();
  }, [hasAnswered, goToNext]);

  useEffect(() => {
    if (!currentQuestion) return;

    const handleKeyDown = (e) => {
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key) && !hasAnswered) {
        handleSelectAnswer(Number(key) - 1);
      } else if ((key === 'Enter' || key === ' ') && hasAnswered) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, hasAnswered, handleSelectAnswer, handleNext]);

  if (!category) return <Navigate to="/" replace />;

  const currentLevel = categoryProgress?.currentLevel || 1;
  const levelInfo = CATEGORY_LEVELS[currentLevel];
  const difficultyInfo = DIFFICULTY_CONFIG[currentDifficulty];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center p-4">
        <div className="w-full max-w-2xl space-y-4 sm:space-y-6 py-4 sm:py-8">
          {(challenge || isDaily) && (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm font-semibold">
              {challenge ? (
                <>
                  <Swords className="w-4 h-4" />
                  Friend challenge · {challenge.categoryName}
                </>
              ) : (
                <><Flame className="w-4 h-4" /> Daily challenge · 2x XP</>
              )}
            </div>
          )}

          {!isLoading && questions.length > 0 && (
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Target className="w-3.5 h-3.5" />
                <span className="font-medium">Level {currentLevel} · {levelInfo?.name || 'Beginner'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                currentDifficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                currentDifficulty === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                currentDifficulty === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {difficultyInfo?.label || 'Easy'} · {difficultyInfo?.points || 10}pts
              </span>
            </div>
          )}

          {!isLoading && questions.length > 0 && (
            <ProgressStepper total={questions.length} current={currentIndex} />
          )}

          {!isLoading && questions.length > 0 && <TimerBar timer={timer} />}

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm">
            {isLoading ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <Skeleton variant="text" width={120} height={20} className="mx-auto" />
                  <Skeleton variant="text" width="80%" height={28} className="mx-auto" />
                </div>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" width="100%" height={52} />
                ))}
              </div>
            ) : currentQuestion ? (
              <>
                <QuestionCard
                  question={currentQuestion}
                  selectedAnswer={selectedAnswer}
                  onSelect={handleSelectAnswer}
                  questionNumber={currentIndex + 1}
                  totalQuestions={questions.length}
                />
                <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400 hidden sm:block">
                  Tip: press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-semibold">1</kbd>–
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-semibold">4</kbd> to answer,{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-semibold">Enter</kbd> to continue
                </p>
              </>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-rose-600 dark:text-rose-400 font-medium mb-2">Failed to load quiz</p>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">No questions available</p>
              </div>
            )}
          </div>

          {!isLoading && currentQuestion && (
            <div className="flex items-center justify-between">
              <div />
              <motion.button
                whileTap={hasAnswered ? { scale: 0.97 } : undefined}
                onClick={handleNext}
                disabled={!hasAnswered}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  hasAnswered
                    ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLast ? 'Submit' : 'Next'}
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          )}
        </div>
      </main>

      <Snackbar
        open={snackbarOpen && !!error}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
}