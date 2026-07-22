import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Allow the Vite dev server (localhost:5173) to connect to this backend.
// When you deploy for real, replace "*" with your actual frontend URL.
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_ROOM = 4;

// In-memory storage for now — no database needed yet.
// Shape: { roomId: { players: Map<socketId, { name, ready, index, alive }>, state: 'lobby' | 'playing' } }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { players: new Map(), state: 'lobby' });
  }
  return rooms.get(roomId);
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId,
    players: Array.from(room.players.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      ready: data.ready,
    })),
  };
}

/**
 * Check if all players in the room are ready (and there are at least 2).
 * If so, start the game.
 */
function checkAllReady(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.state !== 'lobby') return;
  if (room.players.size < 2) return;

  let allReady = true;
  for (const [, data] of room.players) {
    if (!data.ready) {
      allReady = false;
      break;
    }
  }

  if (allReady) {
    // Assign indices and mark everyone alive
    let index = 0;
    const playerList = [];
    for (const [id, data] of room.players) {
      data.index = index;
      data.alive = true;
      playerList.push({ id, name: data.name, index });
      index++;
    }

    room.state = 'playing';

    console.log(`[game-start] Room "${roomId}" starting with ${playerList.length} players`);

    // Send game-start to each player individually so they know their own index
    for (const [socketId, data] of room.players) {
      io.to(socketId).emit('game-start', {
        players: playerList,
        myIndex: data.index,
      });
    }
  }
}

/**
 * Check if the game should end (only 0 or 1 player alive).
 */
function checkGameOver(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.state !== 'playing') return;

  const alivePlayers = [];
  for (const [id, data] of room.players) {
    if (data.alive) {
      alivePlayers.push({ id, name: data.name, index: data.index });
    }
  }

  if (alivePlayers.length <= 1) {
    const winner = alivePlayers.length === 1
      ? { id: alivePlayers[0].id, name: alivePlayers[0].name }
      : { id: '', name: 'Nobody' };

    console.log(`[game-over] Room "${roomId}" — Winner: ${winner.name}`);

    io.to(roomId).emit('game-over', { winnerId: winner.id, winnerName: winner.name });

    // Reset room to lobby state
    room.state = 'lobby';
    for (const [, data] of room.players) {
      data.ready = false;
      data.alive = true;
    }

    // Send updated lobby state
    io.to(roomId).emit('room-update', getRoomState(roomId));
  }
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join-room', ({ roomId, name }) => {
    // Check if player is already in a lobby
    if (socket.data.roomId && rooms.has(socket.data.roomId)) {
      socket.emit('join-error', { message: "You're already in a lobby. Leave your current room first." });
      return;
    }

    const room = getOrCreateRoom(roomId);

    // Don't allow joining a game in progress
    if (room.state === 'playing') {
      socket.emit('join-error', { message: 'Game is already in progress.' });
      return;
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('join-error', { message: 'Room is full (max 4 players).' });
      return;
    }

    socket.join(roomId);
    room.players.set(socket.id, { name: name || 'Player', ready: false, index: -1, alive: true });
    socket.data.roomId = roomId;

    console.log(`[join-room] ${socket.id} -> ${roomId} (${room.players.size}/${MAX_PLAYERS_PER_ROOM})`);

    // Tell everyone in the room (including the new player) the current lobby state.
    io.to(roomId).emit('room-update', getRoomState(roomId));
  });

  socket.on('player-ready', ({ ready }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    const player = room.players.get(socket.id);
    if (player) {
      player.ready = ready;
      io.to(roomId).emit('room-update', getRoomState(roomId));

      // Check if everyone is now ready to start
      checkAllReady(roomId);
    }
  });

  // --- In-Game State Sync ---

  socket.on('grid-update', ({ grid }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.state !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Broadcast grid to everyone else in the room
    socket.to(roomId).emit('opponent-grid-update', {
      playerIndex: player.index,
      grid,
    });
  });

  socket.on('piece-update', ({ piece }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.state !== 'playing') return;

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
    if (room.state !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    socket.to(roomId).emit('opponent-score-update', {
      playerIndex: player.index,
      ...data,
    });
  });

  socket.on('player-topped-out', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.state !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.alive = false;
    console.log(`[topped-out] ${socket.id} (${player.name}) in room "${roomId}"`);

    socket.to(roomId).emit('opponent-topped-out', {
      playerIndex: player.index,
    });

    checkGameOver(roomId);
  });

  socket.on('send-garbage', ({ count }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    if (room.state !== 'playing') return;

    const sender = room.players.get(socket.id);
    if (!sender) return;

    // Send garbage to all other alive players
    for (const [id, data] of room.players) {
      if (id !== socket.id && data.alive) {
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
      const wasPlaying = room.state === 'playing';
      room.players.delete(socket.id);

      if (room.players.size === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room-update', getRoomState(roomId));

        // If game was in progress, check if it should end now
        if (wasPlaying) {
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