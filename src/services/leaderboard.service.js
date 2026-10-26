import { query, collection, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase.config';
import { USERS_COLLECTION } from '../utils/constants';
import { getLevel, getLevelName } from '../utils/progression';

const LEADERBOARD_LIMIT = 50;

const decorate = (snapshot) =>
  snapshot.docs.map((docSnap, index) => {
    const data = docSnap.data();
    const lastSeen = data.lastSeen?.toDate?.() ?? null;
    const isOnline = lastSeen && (Date.now() - lastSeen.getTime() < 3 * 60 * 1000);
    return {
      uid: docSnap.id,
      displayName: data.displayName || 'Anonymous',
      photoURL: data.photoURL || null,
      xp: data.xp || 0,
      weeklyXp: data.weeklyXp || 0,
      level: getLevel(data.xp || 0),
      levelName: getLevelName(data.xp || 0),
      rank: index + 1,
      isOnline,
    };
  });

function localLeaderboard() {
  try {
    const raw = localStorage.getItem('apex-quiz-local-profile');
    const profile = raw ? JSON.parse(raw) : {};
    return [{
      uid: 'local-guest',
      displayName: 'Guest',
      photoURL: null,
      xp: profile.xp || 0,
      weeklyXp: profile.weeklyXp || 0,
      level: getLevel(profile.xp || 0),
      levelName: getLevelName(profile.xp || 0),
      rank: 1,
      isOnline: true,
    }];
  } catch {
    return [];
  }
}

/** Global leaderboard — top users by total XP. */
export async function getGlobalLeaderboard() {
  if (!db) return localLeaderboard();
  const q = query(
    collection(db, USERS_COLLECTION),
    orderBy('xp', 'desc'),
    limit(LEADERBOARD_LIMIT)
  );
  const snapshot = await getDocs(q);
  return decorate(snapshot);
}

/** Weekly leaderboard — top users by XP earned this week. */
export async function getWeeklyLeaderboard() {
  if (!db) return localLeaderboard();
  const q = query(
    collection(db, USERS_COLLECTION),
    orderBy('weeklyXp', 'desc'),
    limit(LEADERBOARD_LIMIT)
  );
  const snapshot = await getDocs(q);
  return decorate(snapshot);
}

/** Finds the requesting user's position in a leaderboard result set. */
export function findUserRank(entries, uid) {
  const index = entries.findIndex((e) => e.uid === uid);
  if (index === -1) return null;
  return { rank: index + 1, entry: entries[index] };
}
