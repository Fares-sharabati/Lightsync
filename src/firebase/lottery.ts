import { get, onValue, ref, runTransaction, update, type Unsubscribe } from 'firebase/database';
import { db } from './config';
import { serverNow } from './serverTime';

export type LotteryStatus = 'idle' | 'running' | 'revealed';

export type LotteryState = {
  runId: string;
  status: LotteryStatus;
  winnerCount: number;
  eligibleCount: number;
  startedAt: number;
  revealAt: number;
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

export function watchLotteryEligibility(showId: string, runId: string, uid: string, callback: (eligible: boolean) => void): Unsubscribe {
  return onValue(ref(db, `lotteryEligibility/${showId}/${runId}/${uid}`), snapshot => callback(snapshot.val() === true));
}

export function watchLotteryResult(showId: string, runId: string, uid: string, callback: (winner: boolean) => void): Unsubscribe {
  return onValue(ref(db, `lotteryResults/${showId}/${runId}/${uid}`), snapshot => callback(snapshot.val() === true));
}

export function watchLotteryContact(showId: string, uid: string, callback: (contact: LotteryContact | null) => void): Unsubscribe {
  return onValue(ref(db, `lotteryContacts/${showId}/${uid}`), snapshot => callback(snapshot.exists() ? snapshot.val() as LotteryContact : null));
}

export function watchLotteryContacts(showId: string, callback: (contacts: Record<string, LotteryContact>) => void): Unsubscribe {
  return onValue(ref(db, `lotteryContacts/${showId}`), snapshot => callback((snapshot.val() ?? {}) as Record<string, LotteryContact>));
}

function createRunId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function startLottery(showId: string, winnerIds: string[], eligibleIds: string[], eligibleCount: number, winnerCount: number) {
  const runId = createRunId();
  const startedAt = serverNow();
  const updates: Record<string, unknown> = {
    [`lotteryPrivate/${showId}/${runId}`]: { winnerIds: Object.fromEntries(winnerIds.map(uid => [uid, true])) },
    [`lotteries/${showId}`]: {
      runId,
      status: 'running' as LotteryStatus,
      winnerCount,
      eligibleCount,
      startedAt,
      revealAt: startedAt + 10_000,
    } satisfies LotteryState,
  };
  for (const uid of eligibleIds) updates[`lotteryEligibility/${showId}/${runId}/${uid}`] = true;
  await update(ref(db), updates);
}

export async function cancelLottery(showId: string) {
  await runTransaction(ref(db, `lotteries/${showId}/status`), current => (current === 'running' ? 'idle' : current));
}

export async function revealLottery(showId: string) {
  const lotterySnapshot = await get(ref(db, `lotteries/${showId}`));
  const lottery = lotterySnapshot.val() as LotteryState | null;
  if (!lottery || lottery.status !== 'running' || !lottery.runId) return;
  if (serverNow() < lottery.revealAt) return;

  const statusRef = ref(db, `lotteries/${showId}/status`);
  const { committed, snapshot } = await runTransaction(statusRef, current => current === 'running' ? 'revealed' : undefined);
  if (!committed || snapshot.val() !== 'revealed') return;

  // The result is stored under the immutable runId. If a new lottery starts
  // immediately after this reveal, it can never receive the previous run's
  // winners by accident.
  const winnersSnapshot = await get(ref(db, `lotteryPrivate/${showId}/${lottery.runId}/winnerIds`));
  const winnerIds = (winnersSnapshot.val() ?? {}) as Record<string, boolean>;
  const updates: Record<string, boolean> = {};
  for (const uid of Object.keys(winnerIds)) updates[`lotteryResults/${showId}/${lottery.runId}/${uid}`] = true;
  if (Object.keys(updates).length > 0) await update(ref(db), updates);
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
