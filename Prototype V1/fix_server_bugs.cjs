const fs = require('fs');
let code = fs.readFileSync('Server/index.js', 'utf8');

code = code.replace(
  /socket\.on\('changeClass', \(classId\) => \{[\s\S]*?\}\);/g,
  `socket.on('changeClass', ({ classId, targetId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    
    // If targetId is provided, check if we're host and the target is a bot
    let target = null;
    if (targetId && room.hostId === socket.id) {
      target = room.players.get(targetId);
      if (target && !target.isBot) target = null; // can only change bots
    } else {
      target = room.players.get(socket.id);
    }
    
    if (target) {
      target.classId = classId;
      broadcastRoomState(roomId);
    }
  });`
);

code = code.replace(
  /socket\.on\('chatMessage', \(msg\) => \{[\s\S]*?\}\);/g,
  `socket.on('chatMessage', (msg) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      io.to(roomId).emit('chatMessage', { sender: player.name, text: msg });
    }
  });`
);

fs.writeFileSync('Server/index.js', code);
