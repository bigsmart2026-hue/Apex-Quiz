import { motion } from 'framer-motion';
import { Flame, Puzzle, Target, Zap, TrendingUp, Lock } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import { useProfileStore } from '../store/useProfileStore';
import Navbar from '../components/Navbar';
import Avatar from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import { ACHIEVEMENTS } from '../utils/achievements';
import { categories } from '../utils/categories';

export default function ProfilePage() {
  const user = useQuizStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const levelInfo = useProfileStore((s) => s.levelInfo);

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar showLeaderboard={false} />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  const accuracy = profile.questionsAnswered > 0
    ? Math.round((profile.correctAnswers / profile.questionsAnswered) * 100)
    : 0;

  const unlockedAchievements = Object.keys(profile.achievements || {});

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showLeaderboard={false} />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-2xl py-6 sm:py-8 space-y-6">
          {/* Identity + level */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <Avatar src={user?.photoURL} name={user?.displayName} size={72} />
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-2xl sm:text-3xl font-heading text-slate-900 dark:text-white">
                  {user?.displayName}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                  <Badge variant="amber">Level {levelInfo.level} — {levelInfo.name}</Badge>
                  <Badge variant="emerald">
                    <Flame className="w-3.5 h-3.5" /> {profile.currentStreak} day streak
                  </Badge>
                </div>
              </div>
              <div className="w-full sm:w-48 flex-shrink-0">
                <ProgressBar value={levelInfo.progress} label="Level progress" />
                <p className="text-xs text-slate-600 dark:text-slate-400 text-right mt-1 tabular-nums">
                  {levelInfo.xp.toLocaleString()} XP{levelInfo.xpToNext > 0 ? ` · ${levelInfo.xpToNext} to next` : ''}
                </p>
              </div>
            </div>
          </motion.section>

          {/* Stats */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <StatCard label="Quizzes" value={profile.quizzesCompleted} icon={<Zap className="w-5 h-5" />} />
            <StatCard label="Answered" value={profile.questionsAnswered} icon={<Puzzle className="w-5 h-5" />} />
            <StatCard label="Accuracy" value={`${accuracy}%`} icon={<Target className="w-5 h-5" />} />
            <StatCard label="Best score" value={`${profile.bestScorePct}%`} icon={<TrendingUp className="w-5 h-5" />} />
          </motion.section>

          {/* Category mastery */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-xl font-heading text-slate-900 dark:text-white mb-3 px-1">
              Category Mastery
            </h2>
            <Card className="p-5 space-y-4">
              {categories.map((category) => {
                const stat = profile.categoryStats?.[category.id];
                const mastery = stat?.answered
                  ? Math.min(100, Math.round((stat.correct / stat.answered) * 100))
                  : 0;
                return (
                  <div key={category.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2">
                        <category.icon className="w-4 h-4 text-amber-500" />
                        {category.name}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        {stat?.answered ? `${stat.answered} answered · ${mastery}%` : 'Not played'}
                      </span>
                    </div>
                    <ProgressBar
                      value={mastery / 100}
                      barClassName={mastery >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}
                    />
                  </div>
                );
              })}
            </Card>
          </motion.section>

          {/* Achievements */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-xl font-heading text-slate-900 dark:text-white mb-3 px-1">
              Achievements{' '}
              <span className="text-sm font-sans text-slate-600 dark:text-slate-400">
                ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = profile.achievements?.[achievement.id];
                return (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      unlocked
                        ? 'border-amber-200 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className={`text-2xl mb-2 ${unlocked ? '' : 'opacity-30 grayscale'}`} aria-hidden="true">
                      {unlocked ? <achievement.Icon className="w-6 h-6 text-amber-500" /> : <Lock className="w-6 h-6 text-slate-300 dark:text-slate-600 inline" />}
                    </div>
                    <p className={`text-sm font-semibold ${unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                      {achievement.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {achievement.description}
                    </p>
                  </div>
                );
              })}
            </div>
            {unlockedAchievements.length === 0 && (
              <EmptyState
                icon={<Lock className="w-6 h-6" />}
                title="No badges yet"
                description="Complete quizzes to unlock your first achievement."
              />
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
}