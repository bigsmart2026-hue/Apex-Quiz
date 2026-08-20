import { describe, it, expect, vi, beforeEach } from 'vitest';
import useQuizStore from './useQuizStore';
import { recordQuizCompletion } from '../services/profile.service';
import { submitChallengeScore } from '../services/challenge.service';
import { TIMER_DURATION } from '../utils/constants';

vi.mock('../services/profile.service', () => ({
  recordQuizCompletion: vi.fn().mockResolvedValue({
    xpGained: 50,
    level: 2,
    levelName: 'Learner',
    leveledUp: false,
    streak: 2,
    newAchievements: [],
    accuracyPct: 80,
    attemptId: 'attempt-1',
  }),
}));

vi.mock('../services/challenge.service', () => ({
  submitChallengeScore: vi.fn().mockResolvedValue(undefined),
  getChallenge: vi.fn().mockResolvedValue({ code: 'ABC123', creatorScore: 8, opponentScore: 6, total: 10 }),
  resolveWinner: vi.fn().mockReturnValue('creator'),
}));

vi.mock('../services/triviaApi', () => ({
  fetchTriviaQuestions: vi.fn().mockRejectedValue(new Error('network down')),
}));

vi.mock('../services/firestore.service', () => ({
  fetchQuiz: vi.fn().mockRejectedValue(new Error('no quiz')),
}));

const questions = [
  { id: 'q1', text: 'A', options: ['x', 'y'], correctAnswer: 0 },
  { id: 'q2', text: 'B', options: ['x', 'y'], correctAnswer: 1 },
];

const baseState = {
  user: { uid: 'u1', displayName: 'Tester' },
  isLoading: false,
  error: null,
  category: { id: 'science', name: 'Science', apiId: 17 },
  questions: [],
  currentIndex: 0,
  selectedAnswers: {},
  answerTimes: {},
  score: 0,
  isFinished: false,
  timer: TIMER_DURATION,
  startedAt: 0,
  completionSummary: null,
  challenge: null,
  isDaily: false,
  leaderboard: [],
  leaderboardTab: 'global',
  leaderboardError: null,
  savingResult: false,
};

beforeEach(() => {
  localStorage.clear();
  useQuizStore.setState({ ...baseState, theme: 'light' });
  vi.clearAllMocks();
  recordQuizCompletion.mockResolvedValue({
    xpGained: 50,
    level: 2,
    levelName: 'Learner',
    leveledUp: false,
    streak: 2,
    newAchievements: [],
    accuracyPct: 80,
    attemptId: 'attempt-1',
  });
});

describe('selectAnswer', () => {
  it('increments score on a correct answer', () => {
    useQuizStore.setState({ questions });
    useQuizStore.getState().selectAnswer('q1', 0);
    expect(useQuizStore.getState().score).toBe(1);
  });

  it('does not increment score on an incorrect answer', () => {
    useQuizStore.setState({ questions });
    useQuizStore.getState().selectAnswer('q1', 1);
    expect(useQuizStore.getState().score).toBe(0);
  });

  it('locks the answer after the first selection', () => {
    useQuizStore.setState({ questions });
    useQuizStore.getState().selectAnswer('q1', 1);
    useQuizStore.getState().selectAnswer('q1', 0);

    const state = useQuizStore.getState();
    expect(state.selectedAnswers.q1).toBe(1);
    expect(state.score).toBe(0);
  });
});

describe('goToNext', () => {
  it('advances the index and resets the timer', () => {
    useQuizStore.setState({ questions, currentIndex: 0 });
    useQuizStore.getState().goToNext();

    const state = useQuizStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.timer).toBe(TIMER_DURATION);
  });

  it('finishes the quiz and records the completion on the last question', async () => {
    useQuizStore.setState({
      questions,
      currentIndex: 1,
      selectedAnswers: { q1: 0, q2: 1 },
      startedAt: Date.now() - 10000,
    });

    await useQuizStore.getState().goToNext();

    const state = useQuizStore.getState();
    expect(state.isFinished).toBe(true);
    expect(state.score).toBe(2);
    expect(recordQuizCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u1' }),
      expect.objectContaining({ id: 'science' }),
      expect.objectContaining({ score: 2, total: 2 })
    );
    expect(state.completionSummary.xpGained).toBe(50);
  });

  it('submits a challenge score instead of awarding XP in challenge mode', async () => {
    useQuizStore.setState({
      questions,
      currentIndex: 1,
      selectedAnswers: { q1: 0, q2: 1 },
      challenge: { code: 'ABC123', categoryId: 'frontend', categoryName: 'Front-end Development', creatorId: 'u1' },
    });

    await useQuizStore.getState().goToNext();

    const state = useQuizStore.getState();
    expect(submitChallengeScore).toHaveBeenCalledWith('ABC123', expect.anything(), expect.objectContaining({ score: 2 }));
    expect(recordQuizCompletion).not.toHaveBeenCalled();
    expect(state.completionSummary.challenge.won).toBe(true);
  });

  it('marks the quiz as played when the attempt already exists', async () => {
    recordQuizCompletion.mockRejectedValue(new Error('QUIZ_ALREADY_PLAYED'));
    useQuizStore.setState({
      questions,
      currentIndex: 1,
      selectedAnswers: { q1: 0, q2: 1 },
    });

    await useQuizStore.getState().goToNext();

    const state = useQuizStore.getState();
    expect(state.isFinished).toBe(true);
    expect(state.completionSummary.xpGained).toBe(0);
    expect(state.completionSummary.error).toContain('already played');
  });
});

describe('theme', () => {
  it('toggles between light and dark', () => {
    useQuizStore.setState({ theme: 'light' });
    useQuizStore.getState().toggleTheme();
    expect(useQuizStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('apex-quiz-storage')).toContain('"theme":"dark"');
  });
});