const fs = require('fs');
let code = fs.readFileSync('Server/index.js', 'utf8');

const kickLogic = `
  socket.on('kick-player', (targetId) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    
    if (room.players.has(targetId)) {
      const target = room.players.get(targetId);
      room.players.delete(targetId);
      
      if (!target.isBot) {
        io.to(targetId).emit('kicked');
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          targetSocket.leave(roomId);
          targetSocket.data.roomId = null;
        }
      }
      emitRoomState(roomId);
    }
  });
`;

code = code.replace(/socket\.on\('add-bot',/, kickLogic + "\n  socket.on('add-bot',");

fs.writeFileSync('Server/index.js', code);
