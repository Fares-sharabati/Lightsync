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
  resultsReady?: boolean;
};
export type LotteryContact = { name: string; surname: string; phone: string; submittedAt: number };

export function watchLottery(showId: string, callback: (lottery: LotteryState | null) => void): Unsubscribe {
  return onValue(ref(db, `lotteries/${showId}`), snapshot => callback(snapshot.exists() ? snapshot.val() as LotteryState : null));
}

export function watchLotteryPrivate(showId: string, runId: string | null, callback: (winnerIds: Record<string, boolean>) => void): Unsubscribe | undefined {
  if (!runId) { callback({}); return undefined; }
  return onValue(ref(db, `lotteryPrivate/${showId}/${runId}/winnerIds`), snapshot => callback((snapshot.val() ?? {}) as Record<string, boolean>));
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
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') webCrypto.getRandomValues(bytes);
  else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function startLottery(showId: string, winnerIds: string[], eligibleIds: string[], eligibleCount: number, winnerCount: number) {
  const runId = createRunId();
  const startedAt = serverNow();
  const lotteryState: LotteryState = {
    runId,
    status: 'running',
    winnerCount,
    eligibleCount,
    startedAt,
    revealAt: startedAt + 10_000,
    resultsReady: false,
  };

  // Write the run-specific data first. The actual lottery state is then
  // reserved transactionally so two organizer tabs cannot both start a
  // different run and race to become the active lottery.
  const runData: Record<string, unknown> = {
    [`lotteryPrivate/${showId}/${runId}`]: { winnerIds: Object.fromEntries(winnerIds.map(uid => [uid, true])) },
  };
  for (const uid of eligibleIds) runData[`lotteryEligibility/${showId}/${runId}/${uid}`] = true;
  await update(ref(db), runData);

  const reservation = await runTransaction(ref(db, `lotteries/${showId}`), current => {
    if (current && current.status === 'running') return;
    return lotteryState;
  });

  if (!reservation.committed) {
    // Another organizer action won the race. Remove the unused run data so
    // abandoned eligibility/winner records do not accumulate.
    const cleanup: Record<string, null> = {
      [`lotteryPrivate/${showId}/${runId}`]: null,
      [`lotteryEligibility/${showId}/${runId}`]: null,
    };
    await update(ref(db), cleanup);
    throw new Error('A lottery is already running.');
  }
}

export async function cancelLottery(showId: string) {
  await runTransaction(ref(db, `lotteries/${showId}/status`), current => (current === 'running' ? 'idle' : current));
}

export async function revealLottery(showId: string) {
  const lotterySnapshot = await get(ref(db, `lotteries/${showId}`));
  const lottery = lotterySnapshot.val() as LotteryState | null;
  if (!lottery || lottery.status !== 'running' || !lottery.runId || serverNow() < lottery.revealAt) return;

  const { committed, snapshot } = await runTransaction(ref(db, `lotteries/${showId}/status`), current => current === 'running' ? 'revealed' : undefined);
  if (!committed || snapshot.val() !== 'revealed') return;

  const winnersSnapshot = await get(ref(db, `lotteryPrivate/${showId}/${lottery.runId}/winnerIds`));
  const winnerIds = (winnersSnapshot.val() ?? {}) as Record<string, boolean>;
  const updates: Record<string, unknown> = {};
  for (const uid of Object.keys(winnerIds)) updates[`lotteryResults/${showId}/${lottery.runId}/${uid}`] = true;
  updates[`lotteries/${showId}/resultsReady`] = true;
  await update(ref(db), updates);
}

export async function submitLotteryContact(showId: string, uid: string, contact: Omit<LotteryContact, 'submittedAt'>) {
  await update(ref(db), { [`lotteryContacts/${showId}/${uid}`]: { ...contact, submittedAt: serverNow() } });
}

export function shuffleAndPick<T>(items: T[], count: number): T[] {
  const copy = [...items];
  const webCrypto = globalThis.crypto;

  // Fisher-Yates with rejection sampling. Using random % range directly
  // introduces a small modulo bias whenever 2^32 is not evenly divisible by
  // the requested range. Rejection sampling keeps every item equally likely.
  function secureIndex(maxExclusive: number): number {
    if (maxExclusive <= 1) return 0;
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const random = new Uint32Array(1);

    do {
      if (webCrypto && typeof webCrypto.getRandomValues === 'function') webCrypto.getRandomValues(random);
      else random[0] = Math.floor(Math.random() * 0x100000000);
    } while (random[0] >= limit);

    return random[0] % maxExclusive;
  }

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = secureIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}
