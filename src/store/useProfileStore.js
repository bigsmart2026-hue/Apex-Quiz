import { create } from 'zustand';
import { getOrCreateProfile, getProfile } from '../services/profile.service';
import { getLevel, getLevelName, xpProgress, xpToNextLevel } from '../utils/progression';

const computeLevelInfo = (xp = 0) => ({
  level: getLevel(xp),
  name: getLevelName(xp),
  xp,
  progress: xpProgress(xp),
  xpToNext: xpToNextLevel(xp),
});

export const useProfileStore = create((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  levelInfo: computeLevelInfo(0),

  loadProfile: async (user) => {
    if (!user) return;
    set({ loading: true, error: null });
    try {
      const profile = await getOrCreateProfile(user);
      set({ profile, levelInfo: computeLevelInfo(profile.xp), loading: false });
      return profile;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  refreshProfile: async (uid) => {
    try {
      const profile = await getProfile(uid);
      if (profile) set({ profile, levelInfo: computeLevelInfo(profile.xp) });
    } catch {
      // cached profile remains
    }
  },

  clearProfile: () => set({ profile: null, error: null, levelInfo: computeLevelInfo(0) }),

  applyCompletion: (summary) => {
    const profile = get().profile;
    if (!profile) return;
    const updated = {
      ...profile,
      xp: (profile.xp || 0) + (summary.xpGained || 0),
      currentStreak: summary.streak,
      longestStreak: Math.max(profile.longestStreak || 0, summary.streak || 0),
      quizzesCompleted: (profile.quizzesCompleted || 0) + 1,
      questionsAnswered: (profile.questionsAnswered || 0) + (summary.totalAnswered || 0),
      correctAnswers: (profile.correctAnswers || 0) + (summary.correctAnswers || 0),
      bestScorePct: Math.max(profile.bestScorePct || 0, summary.accuracyPct || 0),
      lastPlayedDate: summary.dateKey,
    };
    set({ profile: updated, levelInfo: computeLevelInfo(updated.xp) });
  },
}));