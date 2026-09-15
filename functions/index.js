const { onValueWritten } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Server-authoritative backstop for the Lottery reveal.
 *
 * Today, the 10-second reveal is scheduled entirely inside the organizer's
 * browser tab (a `setTimeout` in LotteryOrganizer.tsx). If that tab closes,
 * sleeps, gets backgrounded, or loses its connection during the countdown,
 * the lottery never reveals and every connected phone is stuck frozen at
 * "0" indefinitely.
 *
 * This function fires the instant `lotteries/{showId}/status` becomes
 * "running", waits out the remaining time until `revealAt` on Google's
 * infrastructure (not the organizer's device), and performs the reveal
 * itself. It is safe to have both this function AND the client's own timer
 * active at the same time: revealLottery()'s status flip is guarded by a
 * Realtime Database transaction, so whichever caller gets there first wins
 * and the other becomes a no-op. Nothing can double-reveal or race.
 */
exports.revealLotteryOnSchedule = onValueWritten(
  {
    ref: '/lotteries/{showId}/status',
    // If your Realtime Database instance is NOT in us-central1, uncomment
    // and set this to match (deploy will fail otherwise):
    // region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '128MiB',
  },
  async (event) => {
    const { showId } = event.params;
    const after = event.data.after.val();

    // Only react to the transition INTO "running" - ignore the write this
    // function itself makes when it flips status to "revealed", and ignore
    // "idle"/cancellations.
    if (after !== 'running') return;

    const db = admin.database();
    const lotterySnapshot = await db.ref(`lotteries/${showId}`).get();
    const lottery = lotterySnapshot.val();
    if (!lottery || lottery.status !== 'running' || typeof lottery.revealAt !== 'number') return;

    const delay = lottery.revealAt - Date.now();
    if (delay > 0) {
      // Cloud Functions run on Google's infrastructure with an accurate
      // system clock, so no client-clock-drift correction is needed here.
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Re-check right before acting: the organizer may have cancelled the
    // lottery, or another invocation may already be mid-reveal.
    const statusRef = db.ref(`lotteries/${showId}/status`);
    const result = await statusRef.transaction((current) => (
      current === 'running' ? 'revealed' : undefined // undefined = abort
    ));
    if (!result.committed || result.snapshot.val() !== 'revealed') {
      logger.info(`Lottery ${showId}: reveal already handled elsewhere, skipping.`);
      return;
    }

    const winnersSnapshot = await db.ref(`lotteryPrivate/${showId}/winnerIds`).get();
    await db.ref(`lotteries/${showId}/winnerIds`).set(winnersSnapshot.val() ?? {});
    logger.info(`Lottery ${showId} revealed by Cloud Function (server-authoritative path).`);
  },
);