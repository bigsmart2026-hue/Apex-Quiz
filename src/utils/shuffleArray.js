export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffles the options array within each question and updates correctAnswer
 * to point to the new index of the correct option.
 */
export function shuffleQuestionOptions(questions) {
  return questions.map((q) => {
    const correctText = q.options[q.correctAnswer];
    const shuffled = shuffleArray(q.options);
    return { ...q, options: shuffled, correctAnswer: shuffled.indexOf(correctText) };
  });
}
