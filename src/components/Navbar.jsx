import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Swords, Bell, Check, ChevronRight, FilePlus2, LogOut, Menu, X } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import { useProfileStore } from '../store/useProfileStore';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import SubscriptionBadge from './SubscriptionBadge';
import { listenNotifications, markAllRead, markNotificationRead } from '../services/notification.service';
import { joinChallenge } from '../services/challenge.service';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';

const NAV_LINKS = [
  { to: '/create', label: 'Create', title: 'Create a quiz from PDF or text', icon: FilePlus2 },
  { to: '/leaderboard', label: 'Leaderboard', title: 'Leaderboard', icon: Trophy, leaderboardOnly: true },
  { to: '/challenges', label: 'Challenges', title: 'Friend challenges', icon: Swords },
];

/**
 * Shared app bar rendered across all authenticated pages.
 */
export default function Navbar({ showLeaderboard = true }) {
  const user = useQuizStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const levelInfo = useProfileStore((s) => s.levelInfo);
  const { logoutUser } = useFirebaseAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef(null);
  const headerRef = useRef(null);

  const links = NAV_LINKS.filter((link) => !link.leaderboardOnly || showLeaderboard);
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

  useEffect(() => {
    if (!mobileOpen) return;
    const onClick = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
    setPanelOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setPanelOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const closeMenus = () => {
    setMobileOpen(false);
    setPanelOpen(false);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      markNotificationRead(user.uid, notif.id).catch(() => {});
    }
    closeMenus();

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

  const handleLogout = async () => {
    closeMenus();
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

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-3 sm:px-6 py-2 sm:py-3"
    >
      <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" onClick={closeMenus} aria-label="Apex Quiz home" className="flex-shrink-0">
          <Logo size={56} className="sm:hidden" animate />
          <Logo size={80} className="hidden sm:flex" animate />
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {profile && levelInfo && (
            <Badge variant="amber" className="hidden md:inline-flex">
              Level {levelInfo.level} · {levelInfo.xp.toLocaleString()} XP
            </Badge>
          )}

          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          <div className="hidden md:block">
            <SubscriptionBadge />
          </div>

          {links.map(({ to, label, title, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={title}
              className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}

          {/* Notifications */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => {
                setMobileOpen(false);
                setPanelOpen((o) => !o);
              }}
              className="hidden md:inline-flex relative p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
              title="Notifications"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={panelOpen}
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
                  className="fixed inset-x-3 top-20 z-50 max-h-[70vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-96 sm:w-80"
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
              onClick={closeMenus}
              className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              title={user.displayName}
            >
              <Avatar src={user.photoURL} name={user.displayName} size={30} />
              <span className="hidden lg:inline text-slate-600 dark:text-slate-400 max-w-24 truncate">
                {user.displayName}
              </span>
            </Link>
          )}

          {user && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              disabled={logoutLoading}
              className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          )}

          <button
            onClick={() => {
              setPanelOpen(false);
              setMobileOpen((o) => !o);
            }}
            className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            id="mobile-nav"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="md:hidden absolute inset-x-0 top-full border-t border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="px-3 pt-3 pb-4 max-h-[calc(100dvh-5rem)] overflow-y-auto space-y-3">
              {profile && levelInfo && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Level {levelInfo.level}
                  </span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {levelInfo.xp.toLocaleString()} XP
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {links.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={closeMenus}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/60 dark:bg-slate-800/60 px-2 py-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-amber-400/60 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="truncate max-w-full">{label}</span>
                  </Link>
                ))}
              </div>

              <button
                onClick={() => {
                  setMobileOpen(false);
                  setPanelOpen(true);
                }}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Bell className="w-4 h-4" />
                  Notifications
                </span>
                <span className="flex items-center gap-2">
                  {unreadCount > 0 ? (
                    <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-bold px-1.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">None</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </span>
              </button>

              <div className="flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Theme</span>
                <ThemeToggle />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Plan</span>
                <SubscriptionBadge />
              </div>

              {user && (
                <Link
                  to="/profile"
                  onClick={closeMenus}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <Avatar src={user.photoURL} name={user.displayName} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user.displayName}
                    </p>
                    {user.email && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    )}
                  </div>
                </Link>
              )}

              {user && (
                <button
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-900/20 px-3 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {logoutLoading ? 'Signing out…' : 'Log out'}
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
