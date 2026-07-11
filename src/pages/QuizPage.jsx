import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, LogOut, User, Trophy } from 'lucide-react';
import { Skeleton, Snackbar, Alert } from '@mui/material';
import { useShallow } from 'zustand/react/shallow';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import useQuizStore from '../store/useQuizStore';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import ProgressStepper from '../components/ProgressStepper';
import QuestionCard from '../components/QuestionCard';
import TimerBar from '../components/TimerBar';

export default function QuizPage({ onShowLeaderboard }) {
  const user = useQuizStore((s) => s.user);
  const {
    questions,
    currentIndex,
    selectedAnswers,
    isLoading,
    error,
    isFinished,
    score,
    timer,
    selectAnswer,
    goToNext,
    reset,
  } = useQuizStore(
    useShallow((s) => ({
      questions: s.questions,
      currentIndex: s.currentIndex,
      selectedAnswers: s.selectedAnswers,
      isLoading: s.isLoading,
      error: s.error,
      isFinished: s.isFinished,
      score: s.score,
      timer: s.timer,
      selectAnswer: s.selectAnswer,
      goToNext: s.goToNext,
      reset: s.reset,
    }))
  );

  const { logoutUser } = useFirebaseAuth();
  const [direction, setDirection] = useState(1);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    if (error) {
      setSnackbarOpen(true);
    }
  }, [error]);

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

  const handleSelectAnswer = useCallback((optionIndex) => {
    if (currentQuestion) {
      selectAnswer(currentQuestion.id, optionIndex);
    }
  }, [currentQuestion, selectAnswer]);

  const handleNext = useCallback(() => {
    setDirection(1);
    goToNext();
  }, [goToNext]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logoutUser();
    } catch {
      // Silently fail
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-6 py-3">
        <div className="w-full flex items-center justify-between">
          <Logo animate />

          <div className="flex items-center gap-4 sm:gap-6">
            <ThemeToggle />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onShowLeaderboard}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </motion.button>

            {user && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                )}
                <span className="text-slate-600 dark:text-slate-400">{user.displayName}</span>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4">
        <div className="w-full max-w-2xl space-y-6 py-4 sm:py-8">
          {!isLoading && questions.length > 0 && (
            <ProgressStepper total={questions.length} current={currentIndex} />
          )}

          {!isLoading && questions.length > 0 && (
            <TimerBar timer={timer} />
          )}

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
              <QuestionCard
                question={currentQuestion}
                selectedAnswer={selectedAnswer}
                onSelect={handleSelectAnswer}
                questionNumber={currentIndex + 1}
                totalQuestions={questions.length}
                direction={direction}
              />
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-rose-600 dark:text-rose-400 font-medium mb-2">Failed to load quiz</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">No questions available</p>
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
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
