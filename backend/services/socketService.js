/**
 * services/socketService.js
 * Socket.IO real-time scoring broadcaster
 */

const { Server } = require('socket.io');
const { getCorsOptions } = require('../middleware/securityMiddleware');

let io = null;

function isValidMatchId(matchId) {
  return typeof matchId === 'string' && matchId.length > 0 && matchId.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(matchId);
}

function initSocket(server) {
  io = new Server(server, {
    cors: getCorsOptions(),
    pingTimeout: 30000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    socket.on('join:match', (matchId) => {
      if (!isValidMatchId(matchId)) {
        return;
      }
      socket.join(`match:${matchId}`);
    });

    socket.on('leave:match', (matchId) => {
      if (!isValidMatchId(matchId)) {
        return;
      }
      socket.leave(`match:${matchId}`);
    });
  });

  return io;
}

function broadcastScoreUpdate(matchId, payload) {
  if (!io || !isValidMatchId(matchId)) return;
  
  // Minimal payload optimization: emit strictly to clients in room match:<id>
  io.to(`match:${matchId}`).emit('score:update', payload);
}

module.exports = {
  initSocket,
  broadcastScoreUpdate,
  emitScoreUpdate: broadcastScoreUpdate,
  getIO: () => io
};
