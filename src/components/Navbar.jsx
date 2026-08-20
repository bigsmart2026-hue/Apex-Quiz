import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Trophy, Swords } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import { useProfileStore } from '../store/useProfileStore';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
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
  const [logoutLoading, setLogoutLoading] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 px-6 py-3">
      <div className="w-full flex items-center justify-between gap-3">
        <Link to="/" aria-label="Apex Quiz home">
          <Logo animate />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {profile && (
            <Badge variant="amber" className="hidden md:inline-flex">
              LVL {levelInfo.level} · {levelInfo.xp.toLocaleString()} XP
            </Badge>
          )}

          <ThemeToggle />

          {showLeaderboard && (
            <Link
              to="/leaderboard"
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Leaderboard"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>
          )}

          <Link
            to="/challenges"
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            title="Friend challenges"
          >
            <Swords className="w-4 h-4" />
            <span className="hidden sm:inline">Challenges</span>
          </Link>

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
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}