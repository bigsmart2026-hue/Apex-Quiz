import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTriviaQuestions } from './triviaApi';

const mockApiResponse = {
  response_code: 0,
  results: [
    {
      category: 'Science',
      type: 'multiple',
      question: 'What is the chemical symbol for &quot;gold&quot;?',
      correct_answer: 'Au',
      incorrect_answers: ['Ag', 'Fe', 'Gd'],
    },
    {
      category: 'Science',
      type: 'multiple',
      question: 'Which planet is largest?',
      correct_answer: 'Jupiter',
      incorrect_answers: ['Earth', 'Mars', 'Venus'],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchTriviaQuestions', () => {
  it('transforms API results into the internal schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
    );

    const questions = await fetchTriviaQuestions(17);

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      id: 'q-0',
      text: 'What is the chemical symbol for "gold"?',
    });
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].options[questions[0].correctAnswer]).toBe('Au');
    expect(questions[1].options[questions[1].correctAnswer]).toBe('Jupiter');
  });

  it('throws when the API reports an error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response_code: 1, results: [] }),
      })
    );

    await expect(fetchTriviaQuestions(17)).rejects.toThrow('Failed to fetch trivia questions');
  });

  it('throws on non-OK HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      })
    );

    await expect(fetchTriviaQuestions(17)).rejects.toThrow('status 503');
  });
});