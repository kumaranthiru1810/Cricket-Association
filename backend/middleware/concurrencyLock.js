/**
 * middleware/concurrencyLock.js
 * In-process per-match promise queue (mutex) for single-instance speed (0ms polling),
 * with optional MongoDB distributed lock when MULTI_INSTANCE=true.
 */

const crypto = require('crypto');
const db = require('../config/db');

// In-process per-match promise queue: matchId -> Promise tail
const matchPromiseQueues = new Map();

async function acquireInProcessMutex(matchId) {
  const prev = matchPromiseQueues.get(matchId) || Promise.resolve();
  let releaseFn;
  const current = new Promise((resolve) => {
    releaseFn = resolve;
  });
  const tail = prev.then(() => current).catch(() => current);
  matchPromiseQueues.set(matchId, tail);

  await prev;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseFn();
    if (matchPromiseQueues.get(matchId) === tail) {
      matchPromiseQueues.delete(matchId);
    }
  };
}

async function acquireDbLock(matchId, lockId) {
  const maxWaitMs = 2500;
  const pollIntervalMs = 50;
  const startTime = Date.now();
  const lockTimeoutMs = 5000;

  while (Date.now() - startTime < maxWaitMs) {
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
      if (updated) return true;
    } catch (_err) {
      return true;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

async function acquireMatchLock(req, res, next) {
  const matchId = req.params.matchId;
  if (!matchId) return next();

  const releaseInProcess = await acquireInProcessMutex(matchId);
  const useMultiInstance = process.env.MULTI_INSTANCE === 'true';
  const lockId = useMultiInstance
    ? (crypto.randomUUID ? crypto.randomUUID() : `lock_${Date.now()}_${Math.random()}`)
    : null;

  if (useMultiInstance) {
    const acquired = await acquireDbLock(matchId, lockId);
    if (!acquired) {
      releaseInProcess();
      return res.status(409).json({
        success: false,
        error: 'Conflict: Another scoring operation is currently in progress for this match. Please retry.',
        code: 'CONCURRENT_SCORING_LOCK'
      });
    }
  }

  let cleaned = false;
  const release = async () => {
    if (cleaned) return;
    cleaned = true;
    releaseInProcess();
    if (useMultiInstance && db.models && db.models.Match) {
      try {
        await db.models.Match.updateOne(
          { id: matchId, 'scoring_lock.lock_id': lockId },
          { $set: { 'scoring_lock.locked_at': null, 'scoring_lock.lock_id': null } }
        );
      } catch (_) {}
    }
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
