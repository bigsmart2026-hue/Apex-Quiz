import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme/muiTheme';
import useQuizStore from './store/useQuizStore';
import { useProfileStore } from './store/useProfileStore';
import { updateLastSeen } from './services/profile.service';
import ProtectedRoute from './components/ProtectedRoute';
import PageTransition from './components/PageTransition';
import { Background } from './components/Background';
import ToastHost from './components/ToastHost';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CategorySelector = lazy(() => import('./components/CategorySelector'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const theme = useQuizStore((s) => s.theme);
  const user = useQuizStore((s) => s.user);
  const location = useLocation();
  const muiTheme = theme === 'dark' ? darkTheme : lightTheme;
  const loadProfile = useProfileStore((s) => s.loadProfile);
  const clearProfile = useProfileStore((s) => s.clearProfile);

  useEffect(() => {
    if (user) {
      loadProfile(user);
      updateLastSeen(user.uid);
    } else {
      clearProfile();
    }
  }, [user, loadProfile, clearProfile]);

  useEffect(() => {
    if (!user) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') updateLastSeen(user.uid);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <Background />
        <ToastHost />
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <PageTransition>
                      <CategorySelector />
                    </PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz"
                element={
                  <ProtectedRoute>
                    <PageTransition>
                      <QuizPage />
                    </PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/results"
                element={
                  <ProtectedRoute>
                    <PageTransition>
                      <ResultsPage />
                    </PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leaderboard"
                element={
                  <ProtectedRoute>
                    <PageTransition>
                      <LeaderboardPage />
                    </PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <PageTransition>
                      <ProfilePage />
                    </PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/challenges"
                element={
                  <ProtectedRoute>
                    <PageTransition>
                      <ChallengesPage />
                    </PageTransition>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}