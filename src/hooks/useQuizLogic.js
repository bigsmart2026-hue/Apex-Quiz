import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useQuizStore from '../store/useQuizStore';

export function useQuizLogic() {
  const state = useQuizStore(
    useShallow((s) => ({
      user: s.user,
      questions: s.questions,
      currentIndex: s.currentIndex,
      selectedAnswers: s.selectedAnswers,
      isLoading: s.isLoading,
      error: s.error,
      isFinished: s.isFinished,
      score: s.score,
      timer: s.timer,
      fetchQuestions: s.fetchQuestions,
      selectAnswer: s.selectAnswer,
      goToNext: s.goToNext,
      reset: s.reset,
    }))
  );

  const { user, questions, isLoading, error, fetchQuestions } = state;

  useEffect(() => {
    if (user && questions.length === 0 && !isLoading && !error) {
      fetchQuestions();
    }
  }, [user, questions.length, isLoading, error, fetchQuestions]);

  const currentQuestion = questions[state.currentIndex] || null;
  const selectedAnswer = currentQuestion
    ? (state.selectedAnswers[currentQuestion.id] ?? null)
    : null;

  const handleSelectAnswer = (optionIndex) => {
    if (currentQuestion) {
      state.selectAnswer(currentQuestion.id, optionIndex);
    }
  };

  return {
    questions,
    currentQuestion,
    currentIndex: state.currentIndex,
    selectedAnswer,
    isLoading,
    error,
    isFinished: state.isFinished,
    score: state.score,
    timer: state.timer,
    totalQuestions: questions.length,
    selectAnswer: handleSelectAnswer,
    goToNext: state.goToNext,
    reset: state.reset,
  };
}
