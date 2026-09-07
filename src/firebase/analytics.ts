import { onValue, ref, runTransaction, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type ShowStats = { totalJoined: number; peakConnected: number };

export function watchShowStats(showId: string, callback: (stats: ShowStats) => void): Unsubscribe {
  return onValue(ref(db, `showStats/${showId}`), snapshot => callback((snapshot.val() ?? { totalJoined: 0, peakConnected: 0 }) as ShowStats));
}

/**
 * Persist the live audience counters.
 *
 * IMPORTANT: `totalJoined` and `connected` must be values the caller
 * already has in memory (e.g. from an existing `watchParticipants`
 * listener). This function intentionally does NOT re-read the full
 * participant list from the database on every call — doing that once
 * per connect/disconnect event turns every single join into a
 * full-collection download. At a handful of attendees that's
 * invisible; at thousands of attendees it means thousands of
 * full-collection reads racing each other on the organizer's one
 * browser tab, which is exactly the kind of thing that freezes the
 * dashboard right when the show is starting.
 */
export async function syncShowStats(showId: string, totalJoined: number, connected: number) {
  const statsRef = ref(db, `showStats/${showId}`);
  await runTransaction(statsRef, current => {
    const previous = (current ?? {}) as Partial<ShowStats>;
    return {
      totalJoined: Math.max(totalJoined, typeof previous.totalJoined === 'number' ? previous.totalJoined : 0),
      peakConnected: Math.max(typeof previous.peakConnected === 'number' ? previous.peakConnected : 0, connected),
    };
  });
}