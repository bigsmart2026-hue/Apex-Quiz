import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Trophy, Puzzle, Zap, ChevronRight } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import { useProfileStore } from '../store/useProfileStore';
import Navbar from './Navbar';
import LevelBadge from './LevelBadge';
import DailyChallengeCard from './DailyChallengeCard';
import StatCard from './ui/StatCard';
import Card from './ui/Card';
import { categories } from '../utils/categories';
import { QUESTIONS_PER_QUIZ } from '../utils/constants';
import { hasCompletedDailyChallenge } from '../services/dailyChallenge.service';
import { getAchievement } from '../utils/achievements';

export default function CategorySelector() {
  const navigate = useNavigate();
  const user = useQuizStore((s) => s.user);
  const setCategory = useQuizStore((s) => s.setCategory);
  const fetchQuestions = useQuizStore((s) => s.fetchQuestions);
  const [hoveredId, setHoveredId] = useState(null);
  const [dailyDone, setDailyDone] = useState(false);

  const profile = useProfileStore((s) => s.profile);
  const levelInfo = useProfileStore((s) => s.levelInfo);

  useEffect(() => {
    if (user) hasCompletedDailyChallenge(user.uid).then(setDailyDone).catch(() => {});
  }, [user]);

  const handleSelect = (category) => {
    setCategory(category);
    fetchQuestions(category.apiId, category.name);
    navigate('/quiz');
  };

  const achievementCount = profile?.achievements ? Object.keys(profile.achievements).length : 0;
  const recentAchievements = profile?.achievements
    ? Object.entries(profile.achievements)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-4xl py-6 sm:py-8 space-y-6">
          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 sm:gap-6 sm:grid-cols-[1fr_auto] items-center"
          >
            <div>
              <p className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
                Apex Quiz
              </p>
              <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white font-heading mb-2">
                Choose Your Challenge
              </h1>
              <p className="text-slate-700 dark:text-slate-200 text-sm sm:text-base">
                Test your knowledge, earn XP and climb the leaderboard.
              </p>
            </div>
            {profile && <LevelBadge level={levelInfo.level} name={levelInfo.name} xp={levelInfo.xp} progress={levelInfo.progress} />}
          </motion.section>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <StatCard
              label="Questions"
              value={`${categories.length * QUESTIONS_PER_QUIZ}+`}
              icon={<Puzzle className="w-5 h-5" />}
              sub={`${categories.length} categories`}
            />
            <StatCard
              label="Current streak"
              value={profile ? `${profile.currentStreak} days` : '—'}
              icon={<Flame className="w-5 h-5" />}
            />
            <StatCard
              label="Quizzes completed"
              value={profile ? profile.quizzesCompleted : '—'}
              icon={<Trophy className="w-5 h-5" />}
            />
            <StatCard
              label="Best score"
              value={profile ? `${profile.bestScorePct}%` : '—'}
              icon={<Zap className="w-5 h-5" />}
            />
          </motion.div>

          {/* Daily challenge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <DailyChallengeCard completedToday={dailyDone} streak={profile?.currentStreak || 0} />
          </motion.div>

          {/* Achievements preview */}
          {profile && achievementCount > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading text-slate-900 dark:text-white">Achievements</h2>
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentAchievements.map(([id]) => {
                    const def = getAchievement(id);
                    if (!def) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                        title={def.description}
                      >
                        <span aria-hidden="true">{def.icon}</span>
                        {def.title}
                      </span>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Category grid */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-heading text-slate-900 dark:text-white mb-4 px-1">
              Categories
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {categories.map((category, index) => {
                const Icon = category.icon;
                const isHovered = hoveredId === category.id;
                const stat = profile?.categoryStats?.[category.id];
                const masteryPct = stat?.answered
                  ? Math.min(100, Math.round((stat.correct / stat.answered) * 100))
                  : 0;

                return (
                  <motion.button
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.03, duration: 0.3 }}
                    whileTap={{ scale: 0.97 }}
                    onMouseEnter={() => setHoveredId(category.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleSelect(category)}
                    className={`text-left p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all duration-200 cursor-pointer group relative ${
                      isHovered
                        ? 'border-amber-400 shadow-lg shadow-amber-500/10 -translate-y-0.5'
                        : 'border-slate-200 dark:border-slate-700 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          isHovered
                            ? 'bg-amber-100 dark:bg-amber-900/40 scale-105'
                            : 'bg-amber-50 dark:bg-amber-900/20'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white leading-tight truncate">
                          {category.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {QUESTIONS_PER_QUIZ} questions · {category.apiId ? 'Open Trivia' : 'Apex Bank'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Mastery</span>
                        <span className={`font-semibold tabular-nums ${masteryPct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {stat?.answered ? `${masteryPct}%` : 'New'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            masteryPct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${masteryPct}%` }}
                        />
                      </div>
                    </div>

                    {isHovered && (
                      <div className="absolute inset-0 rounded-2xl bg-amber-400/5 pointer-events-none" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}