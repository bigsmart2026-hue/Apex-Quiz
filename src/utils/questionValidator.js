/**
 * Question validation utilities.
 * Ensures every question meets quality standards before display or storage.
 */

export function validateQuestion(question) {
  if (!question || typeof question !== 'object') return false;
  if (!question.text || typeof question.text !== 'string' || question.text.trim().length === 0) return false;
  if (!Array.isArray(question.options) || question.options.length < 2) return false;
  if (typeof question.correctAnswer !== 'number' && typeof question.correctAnswer !== 'string') return false;

  const normalizedOptions = question.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (normalizedOptions.length < 2) return false;

  const idx = typeof question.correctAnswer === 'number'
    ? question.correctAnswer
    : normalizedOptions.indexOf(question.correctAnswer);
  if (idx < 0 || idx >= normalizedOptions.length) return false;

  const uniqueOptions = new Set(normalizedOptions.map((o) => o.toLowerCase()));
  if (uniqueOptions.size < normalizedOptions.length) return false;

  return true;
}

export function filterValidQuestions(questions) {
  return questions.filter(validateQuestion);
}
