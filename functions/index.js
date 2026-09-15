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

    if (!after || after.status !== 'running' || !after.runId || !after.revealAt) return;
    if (before && before.status === 'running' && before.runId === after.runId) return;

    const runId = after.runId;
    const revealAt = after.revealAt;
    const delay = revealAt - Date.now();
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    const db = admin.database();
    const currentSnapshot = await db.ref(`lotteries/${showId}`).get();
    const current = currentSnapshot.val();

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

    const winnersSnapshot = await db.ref(`lotteryPrivate/${showId}/${runId}/winnerIds`).get();
    const winnerIds = winnersSnapshot.val() || {};
    const updates = {};
    for (const uid of Object.keys(winnerIds)) {
      updates[`lotteryResults/${showId}/${runId}/${uid}`] = true;
    }
    updates[`lotteries/${showId}/resultsReady`] = true;
    await db.ref().update(updates);

    logger.info(`Lottery ${showId}/${runId} revealed by Cloud Function.`);
  },
);
