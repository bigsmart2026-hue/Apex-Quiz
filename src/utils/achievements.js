import { Trophy, Target, Flame, Brain, Zap, Crosshair, BookOpen, Medal, CalendarDays, Shield, Crown, Star, Gem } from 'lucide-react';
import { getLevel } from './progression';

/**
 * Achievement catalogue. IDs are stable keys stored in the user profile.
 * `check` receives the completion context and returns true when unlocked.
 */
export const ACHIEVEMENTS = [
  {
    id: 'first-victory',
    title: 'First Victory',
    description: 'Complete your first quiz',
    Icon: Trophy,
  },
  {
    id: 'perfect-score',
    title: 'Perfect Score',
    description: 'Answer every question correctly in one quiz',
    Icon: Target,
  },
  {
    id: 'streak-7',
    title: '7-Day Streak',
    description: 'Play on 7 consecutive days',
    Icon: Flame,
  },
  {
    id: 'questions-100',
    title: '100 Questions',
    description: 'Answer 100 questions in total',
    Icon: Brain,
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Perfect quiz with under 4s average per question',
    Icon: Zap,
  },
  {
    id: 'accuracy-90',
    title: 'Sharp Shooter',
    description: 'Score 90% or higher in a quiz',
    Icon: Crosshair,
  },
  {
    id: 'level-2',
    title: 'Level 2 Unlocked',
    description: 'Score 70%+ to reach Intermediate',
    Icon: Shield,
  },
  {
    id: 'level-3',
    title: 'Level 3 Unlocked',
    description: 'Score 75%+ to reach Advanced',
    Icon: Star,
  },
  {
    id: 'level-4',
    title: 'Level 4 Unlocked',
    description: 'Score 80%+ to reach Expert',
    Icon: Crown,
  },
  {
    id: 'level-5',
    title: 'Apex Reached',
    description: 'Score 85%+ to reach the highest level',
    Icon: Gem,
  },
  {
    id: 'category-master',
    title: 'Category Master',
    description: 'Reach 80% mastery in any category',
    Icon: BookOpen,
  },
  {
    id: 'challenge-victor',
    title: 'Challenge Victor',
    description: 'Win a friend challenge',
    Icon: Medal,
  },
  {
    id: 'daily-challenge',
    title: 'Daily Grinder',
    description: 'Complete your first daily challenge',
    Icon: CalendarDays,
  },
];

export const getAchievement = (id) => ACHIEVEMENTS.find((a) => a.id === id);

/**
 * Evaluates which achievements unlock given the completion context.
 * Pure function — safe to test and reuse in any awarding path.
 * @param {{
 *   score: number, total: number, accuracyPct: number, avgAnswerSec: number,
 *   isDaily: boolean, isChallenge: boolean, wonChallenge: boolean,
 *   newStreak: number, totalQuestionsAnswered: number, level: number,
 *   categoryMasteryPct: number
 * }} ctx
 * @param {Record<string, number>} owned - achievements already unlocked
 * @returns {string[]} newly unlocked achievement ids
 */
export function evaluateNewAchievements(ctx, owned = {}) {
  const unlocked = [];
  const grant = (id) => {
    if (!owned[id]) unlocked.push(id);
  };

  if (ctx.total > 0) grant('first-victory');
  if (ctx.score === ctx.total && ctx.total > 0) grant('perfect-score');
  if (ctx.newStreak >= 7) grant('streak-7');
  if (ctx.totalQuestionsAnswered >= 100) grant('questions-100');
  if (ctx.score === ctx.total && ctx.avgAnswerSec < 4 && ctx.total > 0) grant('speed-demon');
  if (ctx.accuracyPct >= 90 && ctx.total > 0) grant('accuracy-90');
  if (ctx.unlockedLevel >= 2) grant('level-2');
  if (ctx.unlockedLevel >= 3) grant('level-3');
  if (ctx.unlockedLevel >= 4) grant('level-4');
  if (ctx.unlockedLevel >= 5) grant('level-5');
  if (ctx.categoryMasteryPct >= 80) grant('category-master');
  if (ctx.wonChallenge) grant('challenge-victor');
  if (ctx.isDaily) grant('daily-challenge');

  return unlocked;
}

export { getLevel };