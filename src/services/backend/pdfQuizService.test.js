import { describe, it, expect } from 'vitest';
import { normalizeGeneratedQuestion, normalizeGeneratedQuestions } from './pdfQuizService';

describe('normalizeGeneratedQuestion', () => {
  it('maps a string correct answer to its option index', () => {
    const q = normalizeGeneratedQuestion({
      id: 'g1',
      type: 'multiple_choice',
      question_text: 'What is 2+2?',
      options: ['3', '4', '5'],
      correct_answer: '4',
      difficulty: 'easy',
    });
    expect(q).toMatchObject({ text: 'What is 2+2?', correctAnswer: 1, difficulty: 'easy', points: 10 });
    expect(q.options).toHaveLength(3);
  });

  it('keeps a numeric correct answer', () => {
    const q = normalizeGeneratedQuestion({
      id: 'g2',
      type: 'multiple_choice',
      question_text: 'Capital of France?',
      options: ['Paris', 'Rome'],
      correct_answer: 0,
      difficulty: 'hard',
    });
    expect(q.correctAnswer).toBe(0);
    expect(q.points).toBe(30);
  });

  it('normalizes true/false without explicit options', () => {
    const q = normalizeGeneratedQuestion({
      id: 'g3',
      type: 'true_false',
      question_text: 'The sky is blue.',
      correct_answer: 'True',
    });
    expect(q.options).toEqual(['True', 'False']);
    expect(q.correctAnswer).toBe(0);
  });

  it('drops short-answer questions without options', () => {
    expect(
      normalizeGeneratedQuestion({
        id: 'g4',
        type: 'short_answer',
        question_text: 'Explain gravity.',
        correct_answer: 'See source text',
      })
    ).toBeNull();
  });

  it('drops questions with empty text', () => {
    expect(
      normalizeGeneratedQuestion({ id: 'g5', type: 'multiple_choice', question_text: '  ', options: ['a', 'b'], correct_answer: 'a' })
    ).toBeNull();
  });
});

describe('normalizeGeneratedQuestions', () => {
  it('partitions playable questions from skipped ones', () => {
    const { questions, skipped } = normalizeGeneratedQuestions([
      { id: 'a', type: 'multiple_choice', question_text: 'Q1?', options: ['x', 'y'], correct_answer: 'x' },
      { id: 'b', type: 'short_answer', question_text: 'Q2?', correct_answer: 'text' },
    ]);
    expect(questions).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});
