import { QUESTIONS_PER_QUIZ } from '../utils/constants';

function decodeHtml(text) {
  const txt = document.createElement('textarea');
  txt.innerHTML = text;
  return txt.value;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Fetches trivia questions from the Open Trivia Database API.
 * Transforms the response into the internal question schema.
 * @param {number} categoryApiId - The Open Trivia DB category identifier
 * @returns {Promise<Array<{id: string, text: string, options: string[], correctAnswer: number}>>}
 */
export async function fetchTriviaQuestions(categoryApiId) {
  const url = `https://opentdb.com/api.php?amount=${QUESTIONS_PER_QUIZ}&category=${categoryApiId}&type=multiple`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.response_code !== 0) {
    throw new Error('Failed to fetch trivia questions from remote API');
  }

  return data.results.map((q, index) => {
    const options = [...q.incorrect_answers, q.correct_answer].map(decodeHtml);
    const shuffled = shuffleArray(options);
    const correctAnswer = shuffled.indexOf(decodeHtml(q.correct_answer));

    return {
      id: `q-${index}`,
      text: decodeHtml(q.question),
      options: shuffled,
      correctAnswer,
    };
  });
}
