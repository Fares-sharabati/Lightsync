import { get, increment, onValue, push, ref, runTransaction, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStats = {
  totalScans: number;
  totalJoined: number;
  peakConnected: number;
};

export type ScanInfo = {
  scannedAt: number;
};

export function watchShowStats(showId: string, callback: (stats: ShowStats) => void): Unsubscribe {
  return onValue(ref(db, `showStats/${showId}`), snapshot => {
    callback((snapshot.val() ?? { totalScans: 0, totalJoined: 0, peakConnected: 0 }) as ShowStats);
  });
}

export async function recordQrScan(showId: string, uid: string) {
  const scanRef = push(ref(db, `scanEvents/${showId}/${uid}`));
  await set(scanRef, { scannedAt: Date.now() } satisfies ScanInfo);
}

export async function recordJoin(showId: string) {
  await runTransaction(ref(db, `showStats/${showId}/totalJoined`), current => (typeof current === 'number' ? current + 1 : 1));
}

export async function updatePeakConnected(showId: string, connected: number) {
  const peakRef = ref(db, `showStats/${showId}/peakConnected`);
  await runTransaction(peakRef, current => Math.max(typeof current === 'number' ? current : 0, connected));
}

export async function getScanCount(showId: string): Promise<number> {
  const snapshot = await get(ref(db, `scanEvents/${showId}`));
  if (!snapshot.exists()) return 0;
  let count = 0;
  snapshot.forEach(uidSnapshot => uidSnapshot.forEach(() => { count += 1; }));
  return count;
}

export async function syncTotalScans(showId: string) {
  const totalScans = await getScanCount(showId);
  await set(ref(db, `showStats/${showId}/totalScans`), totalScans);
  return totalScans;
}

export async function syncTotalJoined(showId: string) {
  const snapshot = await get(ref(db, `showParticipants/${showId}`));
  const totalJoined = snapshot.exists() ? snapshot.size : 0;
  await set(ref(db, `showStats/${showId}/totalJoined`), totalJoined);
  return totalJoined;
}
