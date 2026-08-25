import {
  collection, addDoc, query, orderBy, onSnapshot,
  updateDoc, doc, serverTimestamp, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.config';
import { USERS_COLLECTION } from '../utils/constants';

const notifsCol = (uid) => collection(db, USERS_COLLECTION, uid, 'notifications');

/**
 * Sends a challenge notification to a user.
 */
export function sendChallengeNotification(targetUid, { fromUid, fromName, challengeCode, categoryName }) {
  return addDoc(notifsCol(targetUid), {
    type: 'challenge',
    fromUid,
    fromName,
    challengeCode,
    categoryName,
    read: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Subscribes to a user's notifications in real-time.
 * Returns an unsubscribe function.
 */
export function listenNotifications(uid, callback) {
  const q = query(notifsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const notifications = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() ?? null,
    }));
    callback(notifications);
  });
}

/**
 * Marks a single notification as read.
 */
export function markNotificationRead(uid, notifId) {
  return updateDoc(doc(db, USERS_COLLECTION, uid, 'notifications', notifId), {
    read: true,
  });
}

/**
 * Marks all unread notifications as read.
 */
export async function markAllRead(uid) {
  const q = query(notifsCol(uid), where('read', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  return batch.commit();
}
