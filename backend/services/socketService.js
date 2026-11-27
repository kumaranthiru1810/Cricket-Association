/**
 * services/socketService.js
 * Socket.IO real-time scoring broadcaster
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getCorsOptions } = require('../middleware/securityMiddleware');

let io = null;
const MAX_ROOMS_PER_SOCKET = 5;

function isValidMatchId(matchId) {
  return typeof matchId === 'string' && matchId.length > 0 && matchId.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(matchId);
}

function initSocket(server) {
  io = new Server(server, {
    cors: getCorsOptions(),
    maxHttpBufferSize: 10 * 1024, // 10KB
    pingTimeout: 30000,
    pingInterval: 25000
  });

  io.use((socket, next) => {
    const rawToken =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    if (rawToken) {
      try {
        socket.user = jwt.verify(rawToken, env.JWT_SECRET);
      } catch (_err) {
        return next(new Error('Unauthorized socket token'));
      }
    }
    return next();
  });

  io.on('connection', (socket) => {
    let eventCount = 0;
    const rateWindow = setInterval(() => { eventCount = 0; }, 10000);
    socket.on('disconnect', () => clearInterval(rateWindow));

    socket.on('join:match', (matchId) => {
      eventCount += 1;
      if (eventCount > 30 || !isValidMatchId(matchId)) return;
      const matchRooms = [...socket.rooms].filter(r => r.startsWith('match:'));
      if (matchRooms.length >= MAX_ROOMS_PER_SOCKET) return;
      socket.join(`match:${matchId}`);
    });

    socket.on('leave:match', (matchId) => {
      eventCount += 1;
      if (eventCount > 30 || !isValidMatchId(matchId)) return;
      socket.leave(`match:${matchId}`);
    });

    socket.on('join:live', () => {
      eventCount += 1;
      if (eventCount > 30) return;
      socket.join('live');
    });

    socket.on('leave:live', () => {
      eventCount += 1;
      if (eventCount > 30) return;
      socket.leave('live');
    });
  });

  return io;
}

function broadcastScoreUpdate(matchId, payload) {
  if (!io || !isValidMatchId(matchId)) return;

  // Emit minimal delta to match:<id> and public 'live' room (deduplicated by Socket.IO)
  io.to(`match:${matchId}`).to('live').emit('score:update', payload);
}

module.exports = {
  initSocket,
  broadcastScoreUpdate,
  emitScoreUpdate: broadcastScoreUpdate,
  getIO: () => io
};
