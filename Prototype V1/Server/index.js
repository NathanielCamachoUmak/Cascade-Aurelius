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
// Shape: { roomId: { players: Map<socketId, { name, ready }> } }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { players: new Map() });
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

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join-room', ({ roomId, name }) => {
    const room = getOrCreateRoom(roomId);

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('join-error', { message: 'Room is full (max 4 players).' });
      return;
    }

    socket.join(roomId);
    room.players.set(socket.id, { name: name || 'Player', ready: false });
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
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    console.log(`[disconnect] ${socket.id}`);

    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.players.delete(socket.id);

      if (room.players.size === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('room-update', getRoomState(roomId));
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