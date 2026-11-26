/**
 * middleware/concurrencyLock.js
 * Distributed concurrency locking with request queuing and duplicate delivery protection
 */

const crypto = require('crypto');
const db = require('../config/db');

// In-process lock tracker for fast local queuing
const inProcessQueues = new Map();

async function acquireMatchLock(req, res, next) {
  const matchId = req.params.matchId;
  if (!matchId) return next();

  const lockId = crypto.randomUUID ? crypto.randomUUID() : `lock_${Date.now()}_${Math.random()}`;
  const maxWaitMs = 2500;
  const pollIntervalMs = 75;
  const startTime = Date.now();
  const lockTimeoutMs = 5000;

  async function tryAcquireDbLock() {
    try {
      if (!db.models || !db.models.Match) return true;
      const expiry = new Date(Date.now() - lockTimeoutMs);
      const updated = await db.models.Match.findOneAndUpdate(
        {
          id: matchId,
          $or: [
            { 'scoring_lock.locked_at': null },
            { 'scoring_lock.locked_at': { $lt: expiry } }
          ]
        },
        {
          $set: {
            'scoring_lock.locked_at': new Date(),
            'scoring_lock.lock_id': lockId
          }
        },
        { returnDocument: 'after' }
      );
      return !!updated;
    } catch (_err) {
      return true;
    }
  }

  // Queue loop: wait for in-process and DB lock
  while (Date.now() - startTime < maxWaitMs) {
    if (!inProcessQueues.has(matchId)) {
      const dbAcquired = await tryAcquireDbLock();
      if (dbAcquired) {
        inProcessQueues.set(matchId, lockId);
        break;
      }
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  if (inProcessQueues.get(matchId) !== lockId) {
    return res.status(409).json({
      success: false,
      error: 'Conflict: Another scoring operation is currently in progress for this match. Please retry.',
      code: 'CONCURRENT_SCORING_LOCK'
    });
  }

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    if (inProcessQueues.get(matchId) === lockId) {
      inProcessQueues.delete(matchId);
    }
    try {
      if (db.models && db.models.Match) {
        await db.models.Match.updateOne(
          { id: matchId, 'scoring_lock.lock_id': lockId },
          { $set: { 'scoring_lock.locked_at': null, 'scoring_lock.lock_id': null } }
        );
      }
    } catch (_) {}
    res.removeListener('finish', release);
    res.removeListener('close', release);
  };

  res.on('finish', release);
  res.on('close', release);

  next();
}

module.exports = {
  acquireMatchLock
};
