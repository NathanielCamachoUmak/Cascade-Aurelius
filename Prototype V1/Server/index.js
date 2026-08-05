import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Allow the Vite dev server (localhost:5173) to connect to this backend.
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_ROOM = 4;

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { 
      players: new Map(), 
      phase: 'lobby', 
      rematchVotes: new Set(),
      countdownTimer: null 
    });
  }
  return rooms.get(roomId);
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId,
    phase: room.phase,
    players: Array.from(room.players.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      ready: data.ready,
      state: data.state
    })),
  };
}

function checkAllReady(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby') return;
  if (room.players.size < 2) return;

  let allReady = true;
  for (const [, data] of room.players) {
    if (!data.ready) {
      allReady = false;
      break;
    }
  }

  if (allReady) {
    room.phase = 'countdown';
    
    io.to(roomId).emit('countdown-start', 5);

    room.countdownTimer = setTimeout(() => {
      room.phase = 'in-game';
      
      let index = 0;
      const playerList = [];
      for (const [id, data] of room.players) {
        data.index = index;
        data.state = 'playing';
        playerList.push({ id, name: data.name, index });
        index++;
      }

      console.log(`[game-start] Room "${roomId}" starting with ${playerList.length} players`);

      for (const [socketId, data] of room.players) {
        io.to(socketId).emit('game-start', {
          players: playerList,
          myIndex: data.index,
        });
      }
      
      io.to(roomId).emit('pre-game-countdown', 3);
    }, 5000);
  }
}

function cancelCountdown(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'countdown') return;
  
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }
  
  room.phase = 'lobby';
  io.to(roomId).emit('countdown-cancel');
}

function checkGameOver(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game') return;

  const playingPlayers = [];
  for (const [id, data] of room.players) {
    if (data.state === 'playing') {
      playingPlayers.push({ id, name: data.name, index: data.index });
    }
  }

  if (playingPlayers.length <= 1) {
    const winner = playingPlayers.length === 1
      ? { id: playingPlayers[0].id, name: playingPlayers[0].name }
      : { id: '', name: 'Nobody' };

    console.log(`[game-over] Room "${roomId}" — Winner: ${winner.name}`);

    room.phase = 'post-game';
    room.rematchVotes.clear();
    
    for (const [, data] of room.players) {
      data.ready = false;
      data.state = 'lobby';
    }

    io.to(roomId).emit('post-game-start', { winnerId: winner.id, winnerName: winner.name });
  }
}

function updateRematchVotes(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'post-game') return;
  
  const presentPlayersCount = room.players.size;
  const votesCount = room.rematchVotes.size;
  
  io.to(roomId).emit('rematch-update', { votes: votesCount, required: presentPlayersCount });
  
  if (presentPlayersCount > 1 && votesCount >= presentPlayersCount) {
    room.phase = 'lobby';
    room.rematchVotes.clear();
    
    for (const [, data] of room.players) {
      data.ready = true;
    }
    
    io.to(roomId).emit('room-update', getRoomState(roomId));
    checkAllReady(roomId);
  }
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join-room', ({ roomId, name }) => {
    if (socket.data.roomId && rooms.has(socket.data.roomId) && socket.data.roomId !== roomId) {
      socket.emit('confirm-join', { currentRoom: socket.data.roomId, newRoom: roomId });
      return;
    }
    
    const room = getOrCreateRoom(roomId);

    if (room.phase === 'in-game' || room.phase === 'countdown') {
      socket.emit('join-error', { message: 'Game is already in progress.' });
      return;
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('join-error', { message: 'Room is full (max 4 players).' });
      return;
    }

    socket.join(roomId);
    room.players.set(socket.id, { name: name || 'Player', ready: false, index: -1, state: 'lobby' });
    socket.data.roomId = roomId;

    console.log(`[join-room] ${socket.id} -> ${roomId} (${room.players.size}/${MAX_PLAYERS_PER_ROOM})`);

    io.to(roomId).emit('room-update', getRoomState(roomId));
  });

  socket.on('confirm-join', ({ newRoomId, name }) => {
    if (socket.data.roomId && rooms.has(socket.data.roomId)) {
      const oldRoomId = socket.data.roomId;
      const oldRoom = rooms.get(oldRoomId);
      oldRoom.players.delete(socket.id);
      oldRoom.rematchVotes.delete(socket.id);
      
      socket.leave(oldRoomId);
      
      if (oldRoom.players.size === 0) {
        if (oldRoom.countdownTimer) clearTimeout(oldRoom.countdownTimer);
        rooms.delete(oldRoomId);
      } else {
        io.to(oldRoomId).emit('room-update', getRoomState(oldRoomId));
        if (oldRoom.phase === 'countdown') cancelCountdown(oldRoomId);
        if (oldRoom.phase === 'post-game') updateRematchVotes(oldRoomId);
        if (oldRoom.phase === 'in-game') {
          io.to(oldRoomId).emit('player-disconnected', { playerId: socket.id });
          checkGameOver(oldRoomId);
        }
      }
    }
    
    socket.data.roomId = null;
    
    const room = getOrCreateRoom(newRoomId);

    if (room.phase === 'in-game' || room.phase === 'countdown') {
      socket.emit('join-error', { message: 'Game is already in progress.' });
      return;
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('join-error', { message: 'Room is full (max 4 players).' });
      return;
    }

    socket.join(newRoomId);
    room.players.set(socket.id, { name: name || 'Player', ready: false, index: -1, state: 'lobby' });
    socket.data.roomId = newRoomId;

    console.log(`[confirm-join] ${socket.id} -> ${newRoomId}`);
    io.to(newRoomId).emit('room-update', getRoomState(newRoomId));
  });
  
  socket.on('leave-lobby', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    room.players.delete(socket.id);
    room.rematchVotes.delete(socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;
    
    if (room.players.size === 0) {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      rooms.delete(roomId);
    } else {
      io.to(roomId).emit('room-update', getRoomState(roomId));
      if (room.phase === 'countdown') cancelCountdown(roomId);
      if (room.phase === 'post-game') updateRematchVotes(roomId);
      if (room.phase === 'in-game') {
        io.to(roomId).emit('player-disconnected', { playerId: socket.id });
        checkGameOver(roomId);
      }
    }
  });

  socket.on('player-ready', ({ ready }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    if (room.phase !== 'lobby' && room.phase !== 'countdown') return;

    const player = room.players.get(socket.id);
    if (player) {
      player.ready = ready;
      io.to(roomId).emit('room-update', getRoomState(roomId));

      if (ready) {
        checkAllReady(roomId);
      } else if (room.phase === 'countdown') {
        cancelCountdown(roomId);
      }
    }
  });
  
  socket.on('vote-rematch', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.phase !== 'post-game') return;
    
    room.rematchVotes.add(socket.id);
    updateRematchVotes(roomId);
  });

  socket.on('grid-update', ({ grid }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.phase !== 'in-game') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    socket.to(roomId).emit('opponent-grid-update', {
      playerIndex: player.index,
      grid,
    });
  });

  socket.on('piece-update', ({ piece }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.phase !== 'in-game') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    socket.to(roomId).emit('opponent-piece-update', {
      playerIndex: player.index,
      piece,
    });
  });

  socket.on('score-update', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.phase !== 'in-game') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    socket.to(roomId).emit('opponent-score-update', {
      playerIndex: player.index,
      ...data,
    });
  });

  socket.on('player-eliminated', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.phase !== 'in-game') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.state = 'spectating';
    console.log(`[eliminated] ${socket.id} (${player.name}) in room "${roomId}"`);

    socket.to(roomId).emit('opponent-topped-out', {
      playerIndex: player.index,
    });
    
    io.to(roomId).emit('player-state-update', {
      playerId: socket.id,
      state: 'spectating'
    });

    checkGameOver(roomId);
  });

  socket.on('game-over', ({ winnerName }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    checkGameOver(roomId);
  });

  socket.on('send-garbage', ({ count }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.phase !== 'in-game') return;

    const sender = room.players.get(socket.id);
    if (!sender) return;

    for (const [id, data] of room.players) {
      if (id !== socket.id && data.state === 'playing') {
        io.to(id).emit('receive-garbage', { count, fromIndex: sender.index });
      }
    }
  });

  socket.on('broadcast-ribbon', ({ message }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    socket.to(roomId).emit('show-ribbon', { message });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    console.log(`[disconnect] ${socket.id}`);

    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.players.delete(socket.id);
      room.rematchVotes.delete(socket.id);

      if (room.players.size === 0) {
        if (room.countdownTimer) clearTimeout(room.countdownTimer);
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room-update', getRoomState(roomId));

        if (room.phase === 'countdown') cancelCountdown(roomId);
        if (room.phase === 'post-game') updateRematchVotes(roomId);
        if (room.phase === 'in-game') {
          io.to(roomId).emit('player-disconnected', { playerId: socket.id });
          checkGameOver(roomId);
        }
      }
    }
  });
});

app.get('/', (_req, res) => {
  res.send('Block Quartet server is running.');
});

httpServer.listen(PORT, () => {
  console.log(`Block Quartet server listening on http://localhost:${PORT}`);
});