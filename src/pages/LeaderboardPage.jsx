import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Medal, Crown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useQuizStore from '../store/useQuizStore';
import Navbar from '../components/Navbar';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';

const TABS = [
  { id: 'global', label: 'Global' },
  { id: 'weekly', label: 'Weekly' },
];

const RANK_STYLES = [
  { ring: 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20', icon: <Crown className="w-5 h-5 text-amber-500" /> },
  { ring: 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800', icon: <Medal className="w-5 h-5 text-slate-400" /> },
  { ring: 'border-amber-700/40 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20', icon: <Medal className="w-5 h-5 text-amber-700 dark:text-amber-400" /> },
];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { leaderboard, user, leaderboardTab, leaderboardError, fetchLeaderboard, clearLeaderboardError } =
    useQuizStore(
      useShallow((s) => ({
        leaderboard: s.leaderboard,
        user: s.user,
        leaderboardTab: s.leaderboardTab,
        leaderboardError: s.leaderboardError,
        fetchLeaderboard: s.fetchLeaderboard,
        clearLeaderboardError: s.clearLeaderboardError,
      }))
    );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(leaderboardTab).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchLeaderboard, leaderboardTab]);

  const myRank = leaderboard.findIndex((e) => e.uid === user?.uid);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showLeaderboard={false} />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-2xl py-6 sm:py-8 space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => {
                clearLeaderboardError();
                navigate(-1);
              }}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center space-y-1"
          >
            <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white font-heading">
              Leaderboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {leaderboardTab === 'weekly'
                ? 'Most XP earned this week'
                : 'Top players by total XP'}
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex justify-center" role="tablist" aria-label="Leaderboard periods">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={leaderboardTab === tab.id}
                  onClick={() => fetchLeaderboard(tab.id)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    leaderboardTab === tab.id
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {leaderboardError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm text-center space-y-2"
            >
              <p>{leaderboardError}</p>
              <button
                onClick={() => fetchLeaderboard(leaderboardTab)}
                className="text-xs font-bold underline cursor-pointer"
              >
                Try Again
              </button>
            </motion.div>
          )}

          {loading ? (
            <LoadingScreen label="Loading leaderboard…" />
          ) : leaderboard.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-6 h-6" />}
              title="No rankings yet"
              description="Complete your first quiz to enter the leaderboard."
              action={
                <button
                  onClick={() => navigate('/')}
                  className="text-sm font-semibold text-amber-600 dark:text-amber-400 cursor-pointer"
                >
                  Browse categories
                </button>
              }
            />
          ) : (
            <>
              {/* Your position */}
              {myRank !== -1 && myRank >= 3 && (
                <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-900/20 flex items-center gap-3">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    #{myRank + 1}
                  </span>
                  <Avatar src={user?.photoURL} name={user?.displayName} size={36} />
                  <span className="font-semibold text-slate-900 dark:text-white flex-1 truncate">
                    You
                  </span>
                  <Badge variant="amber">{leaderboard[myRank].xp.toLocaleString()} XP</Badge>
                </div>
              )}

              <div className="space-y-2">
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = entry.uid === user?.uid;
                  const podium = RANK_STYLES[index];

                  return (
                    <motion.div
                      key={entry.uid}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.04, 0.5) }}
                      className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-colors ${
                        isCurrentUser
                          ? 'border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-900/20'
                          : podium?.ring || 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        {podium ? (
                          podium.icon
                        ) : (
                          <span className="text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      <Avatar src={entry.photoURL} name={entry.displayName} size={32} />
                      <span className={`flex-1 min-w-0 text-sm font-semibold truncate ${isCurrentUser ? 'text-amber-900 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {entry.displayName}
                        {isCurrentUser && <span className="text-amber-600 dark:text-amber-400 text-xs ml-1.5">(you)</span>}
                      </span>

                      <Badge variant="slate">LVL {entry.level}</Badge>
                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums w-20 text-right">
                        {leaderboardTab === 'weekly' ? entry.weeklyXp : entry.xp}
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500"> XP</span>
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}