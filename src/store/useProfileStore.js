import { create } from 'zustand';
import { getOrCreateProfile, getProfile } from '../services/profile.service';
import { getLevelInfo, LEVELS, MAX_LEVEL } from '../utils/progression';

const computeLevelInfo = (unlockedLevel = 1, xp = 0) => {
  const info = getLevelInfo(unlockedLevel);
  const nextLevel = unlockedLevel < MAX_LEVEL ? LEVELS.find((l) => l.level === unlockedLevel + 1) : null;
  return {
    level: info.level,
    name: info.name,
    description: info.description,
    minScorePct: nextLevel?.minScorePct || 0,
    xp,
    unlockedLevel,
  };
};

export const useProfileStore = create((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  levelInfo: computeLevelInfo(1, 0),

  loadProfile: async (user) => {
    if (!user) return;
    set({ loading: true, error: null });
    try {
      const profile = await getOrCreateProfile(user);
      set({ profile, levelInfo: computeLevelInfo(profile.unlockedLevel || 1, profile.xp), loading: false });
      return profile;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  refreshProfile: async (uid) => {
    try {
      const profile = await getProfile(uid);
      if (profile) set({ profile, levelInfo: computeLevelInfo(profile.unlockedLevel || 1, profile.xp) });
    } catch {
      // cached profile remains
    }
  },

  clearProfile: () => set({ profile: null, error: null, levelInfo: computeLevelInfo(1, 0) }),

  applyCompletion: (summary) => {
    const profile = get().profile;
    if (!profile) return;
    const newUnlockedLevel = summary.unlockedLevel || profile.unlockedLevel || 1;
    const updated = {
      ...profile,
      xp: (profile.xp || 0) + (summary.xpGained || 0),
      unlockedLevel: newUnlockedLevel,
      currentStreak: summary.streak,
      longestStreak: Math.max(profile.longestStreak || 0, summary.streak || 0),
      quizzesCompleted: (profile.quizzesCompleted || 0) + 1,
      questionsAnswered: (profile.questionsAnswered || 0) + (summary.totalAnswered || 0),
      correctAnswers: (profile.correctAnswers || 0) + (summary.correctAnswers || 0),
      bestScorePct: Math.max(profile.bestScorePct || 0, summary.accuracyPct || 0),
      lastPlayedDate: summary.dateKey,
    };
    set({ profile: updated, levelInfo: computeLevelInfo(newUnlockedLevel, updated.xp) });
  },
}));
