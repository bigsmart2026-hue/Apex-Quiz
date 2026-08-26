/**
 * Centralized difficulty configuration and scoring.
 */

export const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', points: 10, color: 'emerald' },
  medium: { label: 'Medium', points: 20, color: 'amber' },
  hard: { label: 'Hard', points: 30, color: 'rose' },
  master: { label: 'Master', points: 50, color: 'purple' },
};

export const calculateQuestionPoints = (difficulty, isCorrect) => {
  if (!isCorrect) return 0;
  return DIFFICULTY_CONFIG[difficulty]?.points ?? 10;
};

export const calculateQuizResult = (answers, questions) => {
  let correctAnswers = 0;
  let totalPoints = 0;

  questions.forEach((q) => {
    const userAnswer = answers[q.id];
    const isCorrect = userAnswer === q.correctAnswer;
    if (isCorrect) correctAnswers++;
    totalPoints += calculateQuestionPoints(q.difficulty, isCorrect);
  });

  const total = questions.length;
  const incorrectAnswers = total - correctAnswers;
  const percentage = total > 0 ? Math.round((correctAnswers / total) * 100) : 0;

  return { correctAnswers, incorrectAnswers, percentage, totalPoints, total };
};
