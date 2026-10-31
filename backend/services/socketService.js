/**
 * services/socketService.js
 * Socket.IO real-time scoring broadcaster
 */

const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:match', (matchId) => {
      socket.join(`match:${matchId}`);
    });

    socket.on('leave:match', (matchId) => {
      socket.leave(`match:${matchId}`);
    });
  });

  return io;
}

function broadcastScoreUpdate(matchId, payload) {
  if (!io) return;
  // Emit to specific match room and global listeners
  io.to(`match:${matchId}`).emit('score:update', payload);
  io.emit('score:update', payload);
}

module.exports = {
  initSocket,
  broadcastScoreUpdate,
  emitScoreUpdate: broadcastScoreUpdate,
  getIO: () => io
};
