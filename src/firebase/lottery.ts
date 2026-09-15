import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { db } from './config';

export type LotteryStatus = 'idle' | 'running' | 'revealed';

export type LotteryState = {
  status: LotteryStatus;
  winnerCount: number;
  eligibleCount: number;
  startedAt: number;
  revealAt: number;
  eligibleIds?: Record<string, boolean>;
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

export function watchLotteryContact(showId: string, uid: string, callback: (contact: LotteryContact | null) => void): Unsubscribe {
  return onValue(ref(db, `lotteryContacts/${showId}/${uid}`), snapshot => callback(snapshot.exists() ? snapshot.val() as LotteryContact : null));
}

export function watchLotteryContacts(showId: string, callback: (contacts: Record<string, LotteryContact>) => void): Unsubscribe {
  return onValue(ref(db, `lotteryContacts/${showId}`), snapshot => callback((snapshot.val() ?? {}) as Record<string, LotteryContact>));
}

export async function startLottery(showId: string, winnerIds: string[], eligibleIds: string[], eligibleCount: number, winnerCount: number) {
  const startedAt = Date.now();
  await set(ref(db, `lotteryPrivate/${showId}`), { winnerIds: Object.fromEntries(winnerIds.map(uid => [uid, true])) });
  await set(ref(db, `lotteries/${showId}`), {
    status: 'running' as LotteryStatus,
    winnerCount,
    eligibleCount,
    startedAt,
    revealAt: startedAt + 10_000,
    eligibleIds: Object.fromEntries(eligibleIds.map(uid => [uid, true])),
  } satisfies LotteryState);
}

export async function revealLottery(showId: string) {
  const privateSnapshot = await get(ref(db, `lotteryPrivate/${showId}/winnerIds`));
  const winnerIds = (privateSnapshot.val() ?? {}) as Record<string, boolean>;
  await set(ref(db, `lotteries/${showId}/winnerIds`), winnerIds);
  await set(ref(db, `lotteries/${showId}/status`), 'revealed');
}

export async function submitLotteryContact(showId: string, uid: string, contact: Omit<LotteryContact, 'submittedAt'>) {
  await set(ref(db, `lotteryContacts/${showId}/${uid}`), { ...contact, submittedAt: Date.now() });
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
