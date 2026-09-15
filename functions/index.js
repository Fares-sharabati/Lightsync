const { onValueWritten } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.revealLotteryOnSchedule = onValueWritten(
  {
    ref: '/lotteries/{showId}',
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '128MiB',
  },
  async (event) => {
    const { showId } = event.params;
    const after = event.data.after.val();
    const before = event.data.before.val();

    // Only schedule a newly-started run. A runId makes this invocation
    // permanently tied to one lottery, so an old 10-second timer can never
    // reveal a newer run for the same event.
    if (!after || after.status !== 'running' || !after.runId || !after.revealAt) return;
    if (before && before.status === 'running' && before.runId === after.runId) return;

    const runId = after.runId;
    const revealAt = after.revealAt;
    const delay = revealAt - Date.now();
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    const db = admin.database();
    const currentSnapshot = await db.ref(`lotteries/${showId}`).get();
    const current = currentSnapshot.val();

    // The event may have been cancelled or replaced by a newer run.
    if (!current || current.status !== 'running' || current.runId !== runId) {
      logger.info(`Lottery ${showId}/${runId}: no longer current, skipping.`);
      return;
    }

    const statusRef = db.ref(`lotteries/${showId}/status`);
    const result = await statusRef.transaction(currentStatus => (
      currentStatus === 'running' ? 'revealed' : undefined
    ));
    if (!result.committed || result.snapshot.val() !== 'revealed') {
      logger.info(`Lottery ${showId}/${runId}: reveal already handled elsewhere.`);
      return;
    }

    // Publish only this run's winners. The immutable runId prevents a stale
    // invocation from ever writing into a later lottery.
    const winnersSnapshot = await db.ref(`lotteryPrivate/${showId}/${runId}/winnerIds`).get();
    const winnerIds = winnersSnapshot.val() || {};
    const updates = {};
    for (const uid of Object.keys(winnerIds)) {
      updates[`lotteryResults/${showId}/${runId}/${uid}`] = true;
    }
    if (Object.keys(updates).length) await db.ref().update(updates);

    logger.info(`Lottery ${showId}/${runId} revealed by Cloud Function.`);
  },
);
