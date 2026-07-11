import { useState, useEffect } from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme/muiTheme';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import useQuizStore from './store/useQuizStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CategorySelector from './components/CategorySelector';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';
import LeaderboardPage from './pages/LeaderboardPage';

export default function App() {
  const { user, loginWithGoogle, loginWithEmail, registerWithEmail, logoutUser } = useFirebaseAuth();
  const theme = useQuizStore((s) => s.theme);
  const category = useQuizStore((s) => s.category);
  const isFinished = useQuizStore((s) => s.isFinished);
  const fetchQuestions = useQuizStore((s) => s.fetchQuestions);
  const setCategory = useQuizStore((s) => s.setCategory);
  const reset = useQuizStore((s) => s.reset);

  const [view, setView] = useState('categories');
  const [authView, setAuthView] = useState('login');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!ready) setReady(true);
  }, [user]);

  const muiTheme = theme === 'dark' ? darkTheme : lightTheme;

  const handleCategorySelect = (selected) => {
    setCategory(selected);
    fetchQuestions(selected.apiId, selected.name);
    setView('quiz');
  };

  const handleRestart = () => {
    reset();
    setView('categories');
  };

  const handleShowLeaderboard = () => {
    setView('leaderboard');
  };

  const handleBackFromLeaderboard = () => {
    if (isFinished) {
      setView('results');
    } else if (category) {
      setView('quiz');
    } else {
      setView('categories');
    }
  };

  const bgStyle = {
    backgroundImage: 'url(/andrey-metelev-DEuansgqjns-unsplash.jpg)',
  };

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <div className="noise-overlay" />
        <div
          className="fixed inset-0 bg-fixed bg-cover bg-center -z-10"
          style={bgStyle}
        />
        {!ready ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user ? (
          authView === 'register' ? (
            <RegisterPage
              onRegister={registerWithEmail}
              onGoogleLogin={loginWithGoogle}
              onSwitchToLogin={() => setAuthView('login')}
            />
          ) : (
            <LoginPage
              onLogin={loginWithEmail}
              onGoogleLogin={loginWithGoogle}
              onSwitchToRegister={() => setAuthView('register')}
            />
          )
        ) : (
          <div className="min-h-screen bg-white/75 dark:bg-slate-950/75">
            {view === 'leaderboard' && (
              <LeaderboardPage onBack={handleBackFromLeaderboard} />
            )}
            {view === 'categories' && !category && (
              <CategorySelector onSelect={handleCategorySelect} onLogout={logoutUser} />
            )}
            {view === 'quiz' && category && !isFinished && (
              <QuizPage onShowLeaderboard={() => setView('leaderboard')} />
            )}
            {isFinished && view !== 'leaderboard' && (
              <ResultsPage
                onRestart={handleRestart}
                onShowLeaderboard={handleShowLeaderboard}
              />
            )}
          </div>
        )}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
