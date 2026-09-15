import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { db } from './config';

/**
 * Firebase Realtime Database exposes a special, always-available node at
 * `.info/serverTimeOffset` containing the number of milliseconds between the
 * client's local clock and the Firebase server's clock. Phones can have
 * clocks that are off by a few seconds (wrong timezone data, no NTP sync,
 * battery-saver throttling, etc.), which is enough to visibly desync a
 * 10-second countdown across a crowd.
 *
 * Call `now()` anywhere you would have called `Date.now()` for something
 * that needs to agree with other clients (countdown math, show-sync math).
 */

let cachedOffset = 0;
let subscriberCount = 0;
let stopListening: Unsubscribe | null = null;

function startListening() {
  if (stopListening) return;
  stopListening = onValue(ref(db, '.info/serverTimeOffset'), snapshot => {
    const value = snapshot.val();
    cachedOffset = typeof value === 'number' ? value : 0;
  });
}

/** Best-effort server-corrected timestamp. Falls back to local time until the first offset arrives. */
export function serverNow(): number {
  return Date.now() + cachedOffset;
}

/** Subscribe to live offset updates (in ms). Returns an unsubscribe function. */
export function watchServerTimeOffset(callback: (offsetMs: number) => void): Unsubscribe {
  startListening();
  subscriberCount += 1;
  const stop = onValue(ref(db, '.info/serverTimeOffset'), snapshot => {
    const value = snapshot.val();
    callback(typeof value === 'number' ? value : 0);
  });
  return () => {
    stop();
    subscriberCount -= 1;
    if (subscriberCount <= 0 && stopListening) {
      stopListening();
      stopListening = null;
      subscriberCount = 0;
    }
  };
}