import { QUESTIONS_PER_QUIZ } from '../utils/constants';
import { shuffleArray } from '../utils/shuffleArray';

function decodeHtml(text) {
  const txt = document.createElement('textarea');
  txt.innerHTML = text;
  return txt.value;
}

const API_URL = 'https://opentdb.com/api.php';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Fetches trivia questions from the Open Trivia Database API.
 * Transforms the response into the internal question schema.
 * @param {number} categoryApiId - The Open Trivia DB category identifier
 * @returns {Promise<Array<{id: string, text: string, options: string[], correctAnswer: number}>>}
 */
export async function fetchTriviaQuestions(categoryApiId) {
  const url = `${API_URL}?amount=${QUESTIONS_PER_QUIZ}&category=${categoryApiId}&type=multiple`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Trivia API responded with status ${response.status}`);
    }
    const data = await response.json();

    if (data.response_code !== 0) {
      throw new Error('Failed to fetch trivia questions from remote API');
    }

    return data.results.map((q, index) => {
      const correctAnswer = decodeHtml(q.correct_answer);
      const options = shuffleArray([...q.incorrect_answers, q.correct_answer].map(decodeHtml));
      return {
        id: `q-${index}`,
        text: decodeHtml(q.question),
        options,
        correctAnswer: options.indexOf(correctAnswer),
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}