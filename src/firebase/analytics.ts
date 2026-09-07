import { get, onValue, ref, runTransaction, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStats = { totalJoined: number; peakConnected: number };

export function watchShowStats(showId: string, callback: (stats: ShowStats) => void): Unsubscribe {
  return onValue(ref(db, `showStats/${showId}`), snapshot => callback((snapshot.val() ?? { totalJoined: 0, peakConnected: 0 }) as ShowStats));
}

export async function syncShowStats(showId: string, connected: number) {
  const participantsSnapshot = await get(ref(db, `showParticipants/${showId}`));
  let totalJoined = 0;
  participantsSnapshot.forEach(() => {
    totalJoined += 1;
  });

  const statsRef = ref(db, `showStats/${showId}`);
  await runTransaction(statsRef, current => {
    const previous = (current ?? {}) as Partial<ShowStats>;
    return {
      totalJoined,
      peakConnected: Math.max(typeof previous.peakConnected === 'number' ? previous.peakConnected : 0, connected),
    };
  });
}
