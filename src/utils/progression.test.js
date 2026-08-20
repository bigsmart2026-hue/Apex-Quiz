import { describe, it, expect } from 'vitest';
import {
  computeQuizXp, getLevel, getLevelName, xpProgress, xpToNextLevel,
  getAccuracy, MAX_XP_PER_QUIZ,
} from './progression';
import { evaluateNewAchievements, ACHIEVEMENTS } from './achievements';
import {
  toDateKey, isYesterday, isToday, getWeekStartKey, seededSample, mulberry32,
} from './dates';
import { generateChallengeCode, isValidChallengeCode, CHALLENGE_CODE_PATTERN } from './challengeCode';
import { getDailyChallenge } from './dailyChallenge';

describe('progression', () => {
  it('maps XP to levels', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevelName(0)).toBe('Rookie');
    expect(getLevel(100)).toBe(2);
    expect(getLevel(1400)).toBe(7);
    expect(getLevel(99999)).toBe(7);
    expect(getLevelName(5000)).toBe('Apex');
  });

  it('computes level progress within bounds', () => {
    expect(xpProgress(0)).toBe(0);
    expect(xpProgress(100)).toBe(0);
    expect(xpProgress(250)).toBe(0);
    expect(xpProgress(175)).toBeCloseTo(0.5);
    expect(xpToNextLevel(0)).toBe(100);
    expect(xpToNextLevel(1400)).toBe(0);
  });

  it('awards XP for a completed quiz', () => {
    expect(computeQuizXp({ score: 0, total: 10 })).toBe(20);
    expect(computeQuizXp({ score: 5, total: 10 })).toBe(70);
    expect(computeQuizXp({ score: 10, total: 10 })).toBe(150);
  });

  it('applies daily multiplier and streak bonus, capped', () => {
    expect(computeQuizXp({ score: 5, total: 10, isDaily: true })).toBe(140);
    expect(computeQuizXp({ score: 5, total: 10, streak: 3 })).toBe(76);
    expect(computeQuizXp({ score: 5, total: 10, streak: 50 })).toBe(84);
  });

  it('never exceeds the per-quiz XP cap (rules bound by MAX_XP_PER_QUIZ)', () => {
    expect(computeQuizXp({ score: 10, total: 10, streak: 7, isDaily: true })).toBeLessThanOrEqual(MAX_XP_PER_QUIZ);
    expect(computeQuizXp({ score: 10, total: 10 })).toBeLessThanOrEqual(MAX_XP_PER_QUIZ);
  });

  it('computes accuracy', () => {
    expect(getAccuracy(8, 10)).toBe(80);
    expect(getAccuracy(0, 0)).toBe(0);
  });
});

describe('achievements', () => {
  it('evaluates unlocks', () => {
    const ctx = {
      score: 10, total: 10, accuracyPct: 100, avgAnswerSec: 3,
      isDaily: false, isChallenge: false, wonChallenge: false,
      newStreak: 1, totalQuestionsAnswered: 10, level: 1, categoryMasteryPct: 0,
    };
    expect(evaluateNewAchievements(ctx, {})).toEqual(
      expect.arrayContaining(['first-victory', 'perfect-score', 'speed-demon', 'accuracy-90'])
    );
  });

  it('does not re-award owned achievements', () => {
    const ctx = { score: 10, total: 10, accuracyPct: 100, avgAnswerSec: 3, isDaily: false, isChallenge: false, wonChallenge: false, newStreak: 1, totalQuestionsAnswered: 10, level: 1, categoryMasteryPct: 0 };
    expect(evaluateNewAchievements(ctx, { 'first-victory': 1, 'perfect-score': 1 })).not.toEqual(
      expect.arrayContaining(['first-victory', 'perfect-score'])
    );
  });

  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('dates', () => {
  it('keys dates as YYYY-MM-DD and detects yesterday/today', () => {
    const today = toDateKey();
    expect(isToday(today)).toBe(true);
    expect(isYesterday(today)).toBe(false);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('computes Monday-start week keys', () => {
    const monday = new Date(2026, 7, 17); // Aug 17 2026 is a Monday
    expect(getWeekStartKey(monday)).toBe('2026-08-17');
  });

  it('seeded sampling is deterministic', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededSample(arr, 4, 42)).toEqual(seededSample(arr, 4, 42));
    expect(seededSample(arr, 4, 42)).toHaveLength(4);
  });

  it('mulberry32 is deterministic', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
  });
});

describe('challenge codes', () => {
  it('generates valid 6-char codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateChallengeCode();
      expect(isValidChallengeCode(code)).toBe(true);
      expect(code).toMatch(CHALLENGE_CODE_PATTERN);
    }
  });

  it('rejects invalid codes', () => {
    expect(isValidChallengeCode('')).toBe(false);
    expect(isValidChallengeCode('AB1')).toBe(false);
    expect(isValidChallengeCode('ABCDEFG')).toBe(false);
    expect(isValidChallengeCode('O0I1L2')).toBe(false);
  });
});

describe('daily challenge', () => {
  it('is deterministic per day', () => {
    const a = getDailyChallenge('2026-08-20');
    const b = getDailyChallenge('2026-08-20');
    const c = getDailyChallenge('2026-08-21');
    expect(a.category.id).toBe(b.category.id);
    expect(a.questions).toEqual(b.questions);
    expect(a.questions).toHaveLength(10);
    expect(a.questions).not.toEqual(c.questions);
  });
});