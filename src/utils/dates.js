/**
 * Date helpers with a single consistent strategy: local calendar dates
 * keyed as `YYYY-MM-DD` strings, Monday-start week keys.
 */

export const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDaysKey = (dateKey, days) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return toDateKey(date);
};

export const diffInDays = (fromKey, toKey) => {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
};

export const isYesterday = (dateKey) => diffInDays(dateKey, toDateKey()) === 1;
export const isToday = (dateKey) => dateKey === toDateKey();

export const getWeekStartKey = (date = new Date()) => {
  const day = date.getDay();
  const offset = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - offset);
  return toDateKey(monday);
};

export const weekChanged = (storedWeekStart) =>
  !storedWeekStart || storedWeekStart !== getWeekStartKey();

/**
 * Deterministic pseudo-random generator (mulberry32) so daily challenges
 * and samples are stable for a given seed (e.g. the date).
 */
export const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const seededPick = (array, seed) => {
  if (!array || array.length === 0) return null;
  const rand = mulberry32(seed);
  return array[Math.floor(rand() * array.length)];
};

export const seededSample = (array, count, seed) => {
  const rand = mulberry32(seed);
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
};