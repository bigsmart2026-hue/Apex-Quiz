import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Trophy, Swords, Bell, Check } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import { useProfileStore } from '../store/useProfileStore';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { listenNotifications, markAllRead, markNotificationRead } from '../services/notification.service';
import { joinChallenge } from '../services/challenge.service';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';

/**
 * Shared app bar rendered across all authenticated pages.
 */
export default function Navbar({ showLeaderboard = true }) {
  const user = useQuizStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const levelInfo = useProfileStore((s) => s.levelInfo);
  const { logoutUser } = useFirebaseAuth();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;
    const unsub = listenNotifications(user.uid, setNotifications);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!panelOpen) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [panelOpen]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logoutUser();
      navigate('/login', { replace: true });
    } catch {
      // Session may already be cleared; login guard handles the rest
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      markNotificationRead(user.uid, notif.id).catch(() => {});
    }
    setPanelOpen(false);

    if ((notif.type === 'challenge' || notif.type === 'challenge-created') && notif.challengeCode) {
      try {
        const challenge = await joinChallenge(notif.challengeCode, user);
        useQuizStore.getState().startChallenge(challenge, challenge.questions);
        navigate('/quiz');
      } catch {
        setSearchParams({ code: notif.challengeCode });
        navigate('/challenges');
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-3 sm:px-6 py-2.5 sm:py-3">
      <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" aria-label="Apex Quiz home">
          <Logo animate />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {profile && (
            <Badge variant="amber" className="hidden md:inline-flex">
              Level {levelInfo.level} · {levelInfo.xp.toLocaleString()} XP
            </Badge>
          )}

          <ThemeToggle />

          {showLeaderboard && (
            <Link
              to="/leaderboard"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Leaderboard"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>
          )}

          <Link
            to="/challenges"
            className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            title="Friend challenges"
          >
            <Swords className="w-4 h-4" />
            <span className="hidden sm:inline">Challenges</span>
          </Link>

          {/* Notifications */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className="relative p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-h-96 overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50"
                >
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead(user.uid).catch(() => {})}
                        className="text-xs text-amber-600 dark:text-amber-400 font-semibold cursor-pointer hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-600 dark:text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`flex items-start gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                            !notif.read ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                          }`}
                        >
                          <button
                            onClick={() => handleNotificationClick(notif)}
                            className="flex-1 text-left cursor-pointer min-w-0"
                          >
                            <div className="flex items-start gap-2.5">
                              <Swords className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                {notif.type === 'challenge-created' ? (
                                  <>
                                    <p className="text-sm text-slate-900 dark:text-white">
                                      Challenge sent to <span className="font-semibold">{notif.opponentName}</span>!
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                      {notif.categoryName} · {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : ''}
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                      Tap to view
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm text-slate-900 dark:text-white">
                                      <span className="font-semibold">{notif.fromName}</span> challenged you to a quiz!
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                      {notif.categoryName} · {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : ''}
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                      Tap to join
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                          {!notif.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(user.uid, notif.id).catch(() => {});
                              }}
                              className="flex-shrink-0 p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer mt-0.5"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user && (
            <Link
              to="/profile"
              className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              title={user.displayName}
            >
              <Avatar src={user.photoURL} name={user.displayName} size={30} />
              <span className="hidden lg:inline text-slate-600 dark:text-slate-400 max-w-24 truncate">
                {user.displayName}
              </span>
            </Link>
          )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
