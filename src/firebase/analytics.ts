import { onValue, ref, runTransaction, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStats = { totalJoined: number; peakConnected: number };

export function watchShowStats(showId: string, callback: (stats: ShowStats) => void): Unsubscribe {
  return onValue(ref(db, `showStats/${showId}`), snapshot => callback((snapshot.val() ?? { totalJoined: 0, peakConnected: 0 }) as ShowStats));
}

export async function syncShowStats(showId: string, connected: number, totalJoined?: number) {
  const statsRef = ref(db, `showStats/${showId}`);
  await runTransaction(statsRef, current => {
    const previous = (current ?? {}) as Partial<ShowStats>;
    const previousTotal = typeof previous.totalJoined === 'number' ? previous.totalJoined : 0;
    const nextTotal = typeof totalJoined === 'number' ? Math.max(0, totalJoined) : previousTotal;
    const safeConnected = Math.max(0, connected);
    return {
      totalJoined: nextTotal,
      peakConnected: Math.max(typeof previous.peakConnected === 'number' ? previous.peakConnected : 0, safeConnected),
    };
  });
}
