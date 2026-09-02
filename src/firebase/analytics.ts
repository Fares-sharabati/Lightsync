import { get, onValue, push, ref, runTransaction, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStats = { totalScans: number; totalJoined: number; peakConnected: number };

export function watchShowStats(showId: string, callback: (stats: ShowStats) => void): Unsubscribe {
  return onValue(ref(db, `showStats/${showId}`), snapshot => callback((snapshot.val() ?? { totalScans: 0, totalJoined: 0, peakConnected: 0 }) as ShowStats));
}

export function watchScanCount(showId: string, callback: (count: number) => void): Unsubscribe {
  return onValue(ref(db, `scanEvents/${showId}`), snapshot => {
    let count = 0;
    snapshot.forEach(uidSnapshot => uidSnapshot.forEach(() => { count += 1; }));
    callback(count);
  });
}

export async function recordQrScan(showId: string, uid: string) {
  await set(push(ref(db, `scanEvents/${showId}/${uid}`)), { scannedAt: Date.now() });
}

export async function syncShowStats(showId: string, totalScans: number, _totalJoined: number, connected: number) {
  const participantsSnapshot = await get(ref(db, `showParticipants/${showId}`));
  let totalJoined = 0;
  participantsSnapshot.forEach(() => {
    totalJoined += 1;
  });

  const statsRef = ref(db, `showStats/${showId}`);
  await runTransaction(statsRef, current => {
    const previous = (current ?? {}) as Partial<ShowStats>;
    return {
      totalScans,
      totalJoined,
      peakConnected: Math.max(typeof previous.peakConnected === 'number' ? previous.peakConnected : 0, connected),
    };
  });
}
