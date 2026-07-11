import { createTheme } from '@mui/material/styles';

const shared = {
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    h3: { fontFamily: '"DM Serif Display", Georgia, "Times New Roman", serif', fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontFamily: '"DM Serif Display", Georgia, "Times New Roman", serif', fontWeight: 600, letterSpacing: '-0.015em' },
    h5: { fontFamily: '"DM Serif Display", Georgia, "Times New Roman", serif', fontWeight: 600 },
    h6: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif', fontWeight: 600 },
    subtitle1: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif', fontWeight: 500 },
    subtitle2: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          boxShadow: 'none',
          transition: 'transform 0.12s ease, box-shadow 0.15s ease',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'scale(0.98)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
          },
        },
        containedPrimary: {
          backgroundColor: '#f59e0b',
          '&:hover': { backgroundColor: '#d97706' },
          '&:active': { backgroundColor: '#b45309' },
        },
        containedSecondary: {
          backgroundColor: '#64748b',
          '&:hover': { backgroundColor: '#475569' },
        },
      },
    },
    MuiStepper: {
      styleOverrides: {
        root: { backgroundColor: 'transparent' },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontWeight: 500,
          '&.Mui-active': { color: '#f59e0b', fontWeight: 600 },
          '&.Mui-completed': { color: '#16a34a' },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 6 },
        bar: { borderRadius: 6 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...shared,
  palette: {
    mode: 'light',
    primary: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706', contrastText: '#ffffff' },
    secondary: { main: '#64748b', light: '#94a3b8', dark: '#475569', contrastText: '#ffffff' },
    success: { main: '#16a34a' },
    error: { main: '#dc2626' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e2e8f0',
  },
  components: {
    ...shared.components,
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: '#e2e8f0', borderRadius: 10 },
      },
    },
  },
});

export const darkTheme = createTheme({
  ...shared,
  palette: {
    mode: 'dark',
    primary: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706', contrastText: '#0f172a' },
    secondary: { main: '#94a3b8', light: '#cbd5e1', dark: '#64748b', contrastText: '#0f172a' },
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
    background: { default: '#0b1120', paper: '#1e293b' },
    text: { primary: '#f1f5f9', secondary: '#94a3b8' },
    divider: '#334155',
  },
  components: {
    ...shared.components,
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: '#334155', borderRadius: 10 },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontWeight: 500,
          '&.Mui-active': { color: '#f59e0b', fontWeight: 600 },
          '&.Mui-completed': { color: '#22c55e' },
        },
      },
    },
  },
});
