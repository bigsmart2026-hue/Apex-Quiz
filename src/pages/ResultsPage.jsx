import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RotateCcw, Flame, Timer, Target, Swords, Award } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useQuizStore from '../store/useQuizStore';
import Navbar from '../components/Navbar';
import ResultCard from '../components/ResultCard';
import Confetti from '../components/Confetti';
import ScoreRing from '../components/ui/ScoreRing';
import Button from '../components/ui/Button';
import StatCard from '../components/ui/StatCard';

const formatTime = (ms) => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

export default function ResultsPage() {
  const navigate = useNavigate();
  const {
    questions,
    selectedAnswers,
    score,
    isFinished,
    reset,
    completionSummary,
    challenge,
    isDaily,
  } = useQuizStore(
    useShallow((s) => ({
      questions: s.questions,
      selectedAnswers: s.selectedAnswers,
      score: s.score,
      isFinished: s.isFinished,
      reset: s.reset,
      completionSummary: s.completionSummary,
      challenge: s.challenge,
      isDaily: s.isDaily,
    }))
  );

  const [expanded, setExpanded] = useState({});
  const [allExpanded, setAllExpanded] = useState(false);

  const total = questions.length;
  const accuracy = completionSummary?.accuracyPct ?? (total > 0 ? Math.round((score / total) * 100) : 0);
  const timeTakenMs = completionSummary?.timeTakenMs ?? 0;

  const { gradeColor, gradeText, gradeMessage } = useMemo(() => {
    if (accuracy >= 80)
      return { gradeColor: 'text-emerald-600 dark:text-emerald-400', gradeText: 'Excellent!', gradeMessage: 'You are on fire — keep that streak going!' };
    if (accuracy >= 50)
      return { gradeColor: 'text-amber-600 dark:text-amber-400', gradeText: 'Good Effort', gradeMessage: 'Solid round. A little practice goes a long way.' };
    return { gradeColor: 'text-rose-600 dark:text-rose-400', gradeText: 'Keep Trying', gradeMessage: 'Every expert was once a beginner. Try again!' };
  }, [accuracy]);

  if (!isFinished) return <Navigate to="/" replace />;

  const challengeResult = challenge && completionSummary?.challenge;

  const handleRestart = () => {
    reset();
    navigate('/');
  };

  const handleChallengeFriend = () => {
    reset();
    navigate('/challenges');
  };

  const toggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    const map = {};
    questions.forEach((q, i) => {
      map[i] = next;
    });
    setExpanded(map);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {accuracy >= 80 && <Confetti />}
      <Navbar />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-2xl space-y-6 py-6 sm:py-8">
          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 md:p-8 shadow-sm"
          >
            {challengeResult && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <Swords className="w-5 h-5 text-amber-500" />
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {challengeResult.opponentScore != null
                    ? `${challengeResult.myScore} — ${challengeResult.opponentScore} · ${challengeResult.won ? 'You won!' : 'Better luck next time'}`
                    : 'Score submitted — waiting for your opponent'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 justify-center">
              <ScoreRing value={accuracy} colorClass={accuracy >= 80 ? 'text-emerald-500' : 'text-amber-500'} />

              <div className="text-center sm:text-left space-y-1">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Quiz Complete {isDaily && '· Daily Challenge'}
                </p>
                <h1 className={`text-3xl sm:text-4xl font-heading ${gradeColor}`}>{gradeText}</h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {score} / {total} correct · {gradeMessage}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <StatCard
                label="XP earned"
                value={completionSummary?.xpGained ? `+${completionSummary.xpGained}` : '—'}
                icon={<Target className="w-5 h-5" />}
                sub={completionSummary?.levelCompleted
                  ? `Level ${completionSummary.unlockedLevel} unlocked!`
                  : completionSummary?.leveledUp
                    ? `Level up to ${completionSummary.level}!`
                    : undefined}
              />
              <StatCard
                label="Streak"
                value={completionSummary?.streak != null ? `${completionSummary.streak} days` : '—'}
                icon={<Flame className="w-5 h-5" />}
                sub="days"
              />
              <StatCard
                label="Time"
                value={timeTakenMs > 0 ? formatTime(timeTakenMs) : '—'}
                icon={<Timer className="w-5 h-5" />}
              />
              <StatCard
                label="Accuracy"
                value={`${accuracy}%`}
                icon={<Target className="w-5 h-5" />}
              />
            </div>

            {completionSummary?.newAchievements?.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {completionSummary.newAchievements.map((id) => (
                  <span
                    key={id}
                    className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                  >
                    <span className="inline-flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {id.split('-').join(' ')}</span>
                  </span>
                ))}
              </div>
            )}

            {completionSummary?.error && (
              <p className="mt-4 text-center text-sm text-rose-600 dark:text-rose-400">
                {completionSummary.error}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Button onClick={handleRestart} icon={<RotateCcw className="w-4 h-4" />}>
                Play Again
              </Button>
              {!challenge && (
                <Button variant="outline" onClick={handleChallengeFriend} icon={<Swords className="w-4 h-4" />}>
                  Challenge a Friend
                </Button>
              )}
            </div>
          </motion.div>

          {/* Review */}
          <div>
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="text-xl font-heading text-slate-900 dark:text-white">
                Detailed Review
              </h2>
              <button
                onClick={toggleAll}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer"
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <ResultCard
                  key={question.id}
                  question={question}
                  selectedAnswer={selectedAnswers[question.id]}
                  index={index}
                  expanded={Boolean(expanded[index])}
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}