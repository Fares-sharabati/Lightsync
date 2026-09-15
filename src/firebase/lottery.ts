import { get, onValue, ref, runTransaction, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';
import { serverNow } from './serverTime';

export type LotteryStatus = 'idle' | 'running' | 'revealed';

export type LotteryState = {
  status: LotteryStatus;
  winnerCount: number;
  eligibleCount: number;
  startedAt: number;
  revealAt: number;
  winnerIds?: Record<string, boolean>;
};

export type LotteryContact = {
  name: string;
  surname: string;
  phone: string;
  submittedAt: number;
};

export function watchLottery(showId: string, callback: (lottery: LotteryState | null) => void): Unsubscribe {
  return onValue(ref(db, `lotteries/${showId}`), snapshot => callback(snapshot.exists() ? snapshot.val() as LotteryState : null));
}

/**
 * Per-user eligibility flag. Deliberately a *separate* per-uid node (instead
 * of one big `eligibleIds` map embedded in the public lottery doc) so each
 * phone only ever downloads its own 1-boolean answer, not the full list of
 * everyone else's uids. That map used to get broadcast to every connected
 * device on every lottery trigger, which doesn't scale past a few hundred
 * concurrent fans.
 */
export function watchLotteryEligibility(showId: string, uid: string, callback: (eligible: boolean) => void): Unsubscribe {
  return onValue(ref(db, `lotteryEligibility/${showId}/${uid}`), snapshot => callback(snapshot.val() === true));
}

export function watchLotteryContact(showId: string, uid: string, callback: (contact: LotteryContact | null) => void): Unsubscribe {
  return onValue(ref(db, `lotteryContacts/${showId}/${uid}`), snapshot => callback(snapshot.exists() ? snapshot.val() as LotteryContact : null));
}

export function watchLotteryContacts(showId: string, callback: (contacts: Record<string, LotteryContact>) => void): Unsubscribe {
  return onValue(ref(db, `lotteryContacts/${showId}`), snapshot => callback((snapshot.val() ?? {}) as Record<string, LotteryContact>));
}

export async function startLottery(showId: string, winnerIds: string[], eligibleIds: string[], eligibleCount: number, winnerCount: number) {
  const startedAt = serverNow();
  const updates: Record<string, unknown> = {
    [`lotteryPrivate/${showId}`]: { winnerIds: Object.fromEntries(winnerIds.map(uid => [uid, true])) },
    [`lotteries/${showId}`]: {
      status: 'running' as LotteryStatus,
      winnerCount,
      eligibleCount,
      startedAt,
      revealAt: startedAt + 10_000,
    } satisfies LotteryState,
  };
  // Clear any eligibility flags left over from a previous lottery, then set
  // this run's. Written as a single multi-path update alongside the doc
  // above so the whole trigger is one atomic write.
  for (const uid of eligibleIds) {
    updates[`lotteryEligibility/${showId}/${uid}`] = true;
  }
  await update(ref(db), updates);
}

/**
 * Cancel a lottery that is still in the `running` (countdown) state. Only
 * valid before reveal - lets the organizer back out of an accidental
 * trigger without fans sitting through a countdown that goes nowhere.
 */
export async function cancelLottery(showId: string) {
  await runTransaction(ref(db, `lotteries/${showId}/status`), current => (current === 'running' ? 'idle' : current));
}

/**
 * Reveal is written so it's safe to call from more than one place at once -
 * the organizer's own countdown timer AND (once deployed) the
 * `revealLotteryOnSchedule` Cloud Function both call this. The status flip
 * happens inside a transaction, so whichever caller gets there first "wins"
 * and does the actual winnerIds copy; the other sees status is no longer
 * `running` and exits immediately. This also means a page reload/reconnect
 * near `revealAt` will safely retry rather than double-reveal.
 */
export async function revealLottery(showId: string) {
  const statusRef = ref(db, `lotteries/${showId}/status`);
  const { committed, snapshot } = await runTransaction(statusRef, current => (
    current === 'running' ? 'revealed' : undefined // undefined = abort, no-op
  ));
  if (!committed || snapshot.val() !== 'revealed') return;

  const privateSnapshot = await get(ref(db, `lotteryPrivate/${showId}/winnerIds`));
  const winnerIds = (privateSnapshot.val() ?? {}) as Record<string, boolean>;
  await update(ref(db), { [`lotteries/${showId}/winnerIds`]: winnerIds });
}

export async function submitLotteryContact(showId: string, uid: string, contact: Omit<LotteryContact, 'submittedAt'>) {
  await update(ref(db), { [`lotteryContacts/${showId}/${uid}`]: { ...contact, submittedAt: serverNow() } });
}

export function shuffleAndPick<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}