import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Loader2 } from 'lucide-react';
import { toDateKey } from '../utils/dates';
import { getDailyChallenge, DAILY_QUESTION_COUNT } from '../utils/dailyChallenge';
import useQuizStore from '../store/useQuizStore';
import { useProfileStore } from '../store/useProfileStore';
import Card from './ui/Card';
import Button from './ui/Button';

export default function DailyChallengeCard({ completedToday = false, streak = 0 }) {
  const navigate = useNavigate();
  const setDailyChallenge = useQuizStore((s) => s.setDailyChallenge);
  const [loading, setLoading] = useState(false);
  const { category } = getDailyChallenge(toDateKey());
  const profile = useProfileStore((s) => s.profile);

  const handleStart = async () => {
    setLoading(true);
    try {
      const { getQuizQuestions } = await import('../services/quiz/questionEngine');
      const userLevel = profile?.unlockedLevel || 1;
      const questions = await getQuizQuestions({
        categoryId: category.id,
        userLevel,
        amount: DAILY_QUESTION_COUNT,
      });
      setDailyChallenge(category, questions);
      navigate('/quiz');
    } catch {
      setDailyChallenge(category, []);
      navigate('/quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" aria-hidden="true" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between relative">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Daily Challenge
            </p>
            <h3 className="text-lg font-heading text-slate-900 dark:text-white">
              {category.name}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {DAILY_QUESTION_COUNT} questions · 2x XP
              {streak > 0 && ` · ${streak} day streak`}
            </p>
          </div>
        </div>

        <Button
          onClick={handleStart}
          disabled={completedToday || loading}
          size="md"
        >
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</span>
          ) : completedToday ? 'Completed today' : 'Start Challenge'}
        </Button>
      </div>
    </Card>
  );
}
