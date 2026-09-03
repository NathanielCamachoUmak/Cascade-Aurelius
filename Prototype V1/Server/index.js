import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const MATCH_DURATION_MS = 3 * 60 * 1000;
const DEFAULT_MODE_ID = 'team-deathmatch';

const MODES = {
  'classic-pvp': {
    id: 'classic-pvp',
    title: 'Classic PvP',
    format: '1v1',
    capacity: 2,
    teamSize: 0,
    isTeamMode: false,
    winnerRule: 'Last board standing',
  },
  'free-for-all': {
    id: 'free-for-all',
    title: 'Free For All',
    format: '1v1v1v1',
    capacity: 4,
    teamSize: 0,
    isTeamMode: false,
    winnerRule: 'Last board standing',
  },
  'team-deathmatch': {
    id: 'team-deathmatch',
    title: '3v3 Deathmatch',
    format: '3v3',
    capacity: 6,
    teamSize: 3,
    isTeamMode: true,
    winnerRule: 'Highest combined team score at the horn',
  },
};

const teams = {
  cyan: { label: 'Cyan Circuit' },
  magenta: { label: 'Magenta Voltage' },
};

const rooms = new Map();

function getMode(modeId) {
  return MODES[modeId] ?? MODES[DEFAULT_MODE_ID];
}

function publicMode(mode) {
  return {
    id: mode.id,
    title: mode.title,
    format: mode.format,
    capacity: mode.capacity,
    teamSize: mode.teamSize,
    isTeamMode: mode.isTeamMode,
    winnerRule: mode.winnerRule,
  };
}

function getOrCreateRoom(roomId, requestedModeId) {
  if (!rooms.has(roomId)) {
    const mode = getMode(requestedModeId);
    rooms.set(roomId, {
      mode,
      players: new Map(),
      phase: 'lobby',
      rematchVotes: new Set(),
      countdownTimer: null,
      matchTimer: null,
      pregameTimer: null,
      matchEndsAt: null,
    });
  }
  return rooms.get(roomId);
}

function clearTimers(room) {
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  if (room.matchTimer) clearTimeout(room.matchTimer);
  if (room.pregameTimer) clearTimeout(room.pregameTimer);
  room.countdownTimer = null;
  room.matchTimer = null;
  room.pregameTimer = null;
  room.matchEndsAt = null;
}

function teamForOpenSlot(room) {
  const cyanCount = Array.from(room.players.values()).filter(player => player.team === 'cyan').length;
  return cyanCount < room.mode.teamSize ? 'cyan' : 'magenta';
}

function calculateTeamScores(room) {
  const totals = { cyan: 0, magenta: 0 };
  if (!room.mode.isTeamMode) return totals;
  for (const player of room.players.values()) {
    if (player.team) totals[player.team] += player.score || 0;
  }
  return totals;
}

function highestScoringTeam(teamScores) {
  if (teamScores.cyan === teamScores.magenta) return null;
  return teamScores.cyan > teamScores.magenta ? 'cyan' : 'magenta';
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId,
    phase: room.phase,
    mode: publicMode(room.mode),
    capacity: room.mode.capacity,
    teamSize: room.mode.teamSize,
    matchEndsAt: room.matchEndsAt,
    teamScores: calculateTeamScores(room),
    players: Array.from(room.players.entries()).map(([id, player]) => ({
      id,
      name: player.name,
      ready: player.ready,
      state: player.state,
      index: player.index,
      team: player.team,
      score: player.score || 0,
      lines: player.lines || 0,
    })),
  };
}

function emitRoomState(roomId) {
  const state = getRoomState(roomId);
  if (state) io.to(roomId).emit('room-update', state);
}

function resetAfterMatch(room) {
  room.phase = 'post-game';
  room.rematchVotes.clear();
  for (const player of room.players.values()) {
    player.ready = false;
    player.state = 'lobby';
  }
}

function finishTeamMatch(roomId, reason = 'time') {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || !room.mode.isTeamMode) return;

  clearTimers(room);
  const teamScores = calculateTeamScores(room);
  const winnerTeam = highestScoringTeam(teamScores);
  resetAfterMatch(room);
  const winnerName = winnerTeam ? teams[winnerTeam].label : 'Draw — teams tied';

  io.to(roomId).emit('post-game-start', {
    winnerId: winnerTeam ? `team:${winnerTeam}` : '',
    winnerName,
    winnerTeam,
    teamScores,
    reason,
    modeId: room.mode.id,
  });
  emitRoomState(roomId);
}

function finishEliminationMatch(roomId, reason = 'elimination') {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.isTeamMode) return;

  clearTimers(room);
  const survivors = Array.from(room.players.entries()).filter(([, player]) => player.state === 'playing');
  const winner = survivors.length === 1 ? { id: survivors[0][0], name: survivors[0][1].name } : null;
  resetAfterMatch(room);

  io.to(roomId).emit('post-game-start', {
    winnerId: winner?.id ?? '',
    winnerName: winner?.name ?? 'Draw — no boards remaining',
    winnerTeam: null,
    teamScores: { cyan: 0, magenta: 0 },
    reason,
    modeId: room.mode.id,
  });
  emitRoomState(roomId);
}

function checkEliminationGameOver(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.isTeamMode) return;
  const alive = Array.from(room.players.values()).filter(player => player.state === 'playing').length;
  if (alive <= 1) finishEliminationMatch(roomId);
}

function startTeamMatchTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || !room.mode.isTeamMode) return;
  room.matchEndsAt = Date.now() + MATCH_DURATION_MS;
  io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: MATCH_DURATION_MS });
  room.matchTimer = setTimeout(() => finishTeamMatch(roomId, 'time'), MATCH_DURATION_MS);
  emitRoomState(roomId);
}

function startMatch(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'countdown' || room.players.size !== room.mode.capacity) return;

  room.phase = 'in-game';
  room.countdownTimer = null;
  const playerList = [];
  let index = 0;
  for (const [id, player] of room.players) {
    player.index = index;
    player.state = 'playing';
    player.score = 0;
    player.lines = 0;
    playerList.push({ id, name: player.name, index, team: player.team });
    index += 1;
  }

  console.log(`[game-start] ${room.mode.id} room "${roomId}" (${room.mode.capacity} players)`);
  for (const [socketId, player] of room.players) {
    io.to(socketId).emit('game-start', {
      players: playerList,
      myIndex: player.index,
      teamScores: calculateTeamScores(room),
      modeId: room.mode.id,
      mode: publicMode(room.mode),
    });
  }
  io.to(roomId).emit('pre-game-countdown', 3);
  if (room.mode.isTeamMode) io.to(roomId).emit('team-score-update', { teamScores: calculateTeamScores(room) });
  emitRoomState(roomId);

  room.pregameTimer = setTimeout(() => startTeamMatchTimer(roomId), 3000);
}

function checkAllReady(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby') return;
  if (room.players.size !== room.mode.capacity) return;
  if (!Array.from(room.players.values()).every(player => player.ready)) return;

  room.phase = 'countdown';
  io.to(roomId).emit('countdown-start', 5);
  emitRoomState(roomId);
  room.countdownTimer = setTimeout(() => startMatch(roomId), 5000);
}

function cancelCountdown(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'countdown') return;
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  room.countdownTimer = null;
  room.phase = 'lobby';
  io.to(roomId).emit('countdown-cancel');
  emitRoomState(roomId);
}

function updateRematchVotes(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'post-game') return;
  const required = room.players.size;
  io.to(roomId).emit('rematch-update', { votes: room.rematchVotes.size, required });
  if (required === room.mode.capacity && room.rematchVotes.size >= required) {
    room.phase = 'lobby';
    room.rematchVotes.clear();
    for (const player of room.players.values()) player.ready = true;
    emitRoomState(roomId);
    checkAllReady(roomId);
  }
}

function removePlayer(socket, { announceDisconnect = false } = {}) {
  const roomId = socket.data.roomId;
  if (!roomId || !rooms.has(roomId)) return;
  const room = rooms.get(roomId);

  if (room.phase === 'in-game' && room.mode.isTeamMode) finishTeamMatch(roomId, 'disconnect');

  room.players.delete(socket.id);
  room.rematchVotes.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (room.players.size === 0) {
    clearTimers(room);
    rooms.delete(roomId);
    return;
  }

  if (room.phase === 'countdown') cancelCountdown(roomId);
  if (announceDisconnect) io.to(roomId).emit('player-disconnected', { playerId: socket.id });

  // In elimination modes, removing a live board can leave exactly one winner.
  checkEliminationGameOver(roomId);
  emitRoomState(roomId);
  if (room.phase === 'post-game') updateRematchVotes(roomId);
}

function addPlayer(socket, roomId, name, requestedModeId) {
  const room = getOrCreateRoom(roomId, requestedModeId);
  const requestedMode = getMode(requestedModeId);
  if (room.mode.id !== requestedMode.id) {
    socket.emit('join-error', { message: `Room uses ${room.mode.title}. Choose the same mode to join it.` });
    return;
  }
  if (room.phase === 'in-game' || room.phase === 'countdown') {
    socket.emit('join-error', { message: 'Game is already in progress.' });
    return;
  }
  if (room.players.size >= room.mode.capacity) {
    socket.emit('join-error', { message: `${room.mode.title} room is full (${room.mode.capacity} players).` });
    return;
  }

  const team = room.mode.isTeamMode ? teamForOpenSlot(room) : null;
  room.players.set(socket.id, {
    name: name || 'Player',
    ready: false,
    index: -1,
    state: 'lobby',
    team,
    score: 0,
    lines: 0,
  });
  socket.join(roomId);
  socket.data.roomId = roomId;
  console.log(`[join-room] ${socket.id} -> ${roomId} (${room.mode.id}, ${room.players.size}/${room.mode.capacity})`);
  emitRoomState(roomId);
}

io.on('connection', socket => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join-room', ({ roomId, name, modeId }) => {
    if (socket.data.roomId && socket.data.roomId !== roomId && rooms.has(socket.data.roomId)) {
      socket.emit('confirm-join', { currentRoom: socket.data.roomId, newRoom: roomId, newModeId: modeId });
      return;
    }
    if (!socket.data.roomId) addPlayer(socket, roomId, name, modeId);
  });

  socket.on('confirm-join', ({ newRoomId, name, modeId }) => {
    if (socket.data.roomId) removePlayer(socket);
    addPlayer(socket, newRoomId, name, modeId);
  });

  socket.on('leave-lobby', () => removePlayer(socket));

  socket.on('player-ready', ({ ready }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || (room.phase !== 'lobby' && room.phase !== 'countdown')) return;
    if (room.phase === 'countdown' && !ready) {
      player.ready = false;
      cancelCountdown(roomId);
      return;
    }
    if (room.phase !== 'lobby') return;
    player.ready = Boolean(ready);
    emitRoomState(roomId);
    checkAllReady(roomId);
  });

  socket.on('vote-rematch', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'post-game') return;
    room.rematchVotes.add(socket.id);
    updateRematchVotes(roomId);
  });

  socket.on('grid-update', ({ grid }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase !== 'in-game') return;
    socket.to(roomId).emit('opponent-grid-update', { playerIndex: player.index, grid });
  });

  socket.on('piece-update', ({ piece }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase !== 'in-game') return;
    socket.to(roomId).emit('opponent-piece-update', { playerIndex: player.index, piece });
  });

  socket.on('score-update', data => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase !== 'in-game') return;

    player.score = Math.max(0, Math.min(999999, Math.floor(Number(data.score) || 0)));
    player.lines = Math.max(0, Math.min(9999, Math.floor(Number(data.lines) || 0)));
    socket.to(roomId).emit('opponent-score-update', { playerIndex: player.index, ...data });
    if (room.mode.isTeamMode) {
      io.to(roomId).emit('team-score-update', {
        playerIndex: player.index,
        playerId: socket.id,
        team: player.team,
        score: player.score,
        lines: player.lines,
        teamScores: calculateTeamScores(room),
      });
    }
  });

  socket.on('player-eliminated', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase !== 'in-game') return;
    player.state = 'spectating';
    socket.to(roomId).emit('opponent-topped-out', { playerIndex: player.index });
    io.to(roomId).emit('player-state-update', { playerId: socket.id, state: 'spectating' });
    if (!room.mode.isTeamMode) checkEliminationGameOver(roomId);
    emitRoomState(roomId);
  });

  socket.on('game-over', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (room && !room.mode.isTeamMode) checkEliminationGameOver(roomId);
  });

  socket.on('send-garbage', ({ count }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const sender = room?.players.get(socket.id);
    if (!room || !sender || room.phase !== 'in-game') return;
    for (const [id, player] of room.players) {
      const isOpponent = room.mode.isTeamMode ? player.team !== sender.team : id !== socket.id;
      if (id !== socket.id && isOpponent && player.state === 'playing') {
        io.to(id).emit('receive-garbage', { count, fromIndex: sender.index });
      }
    }
  });

  socket.on('reflect-garbage', ({ targetIndex, count }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const sender = room?.players.get(socket.id);
    if (!room || !sender || room.phase !== 'in-game') return;
    const targetEntry = Array.from(room.players.entries()).find(([, player]) => player.index === targetIndex && player.state === 'playing');
    if (!targetEntry) return;
    const [targetId, target] = targetEntry;
    const isOpponent = room.mode.isTeamMode ? target.team !== sender.team : targetId !== socket.id;
    if (!isOpponent) return;
    io.to(targetId).emit('receive-garbage', { count: Math.max(1, Math.min(20, Number(count) || 0)), fromIndex: sender.index });
  });

  socket.on('class-ability', ({ type, durationMs, amount, direction, targetIndex }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const sender = room?.players.get(socket.id);
    if (!room || !sender || room.phase !== 'in-game') return;

    const opponents = Array.from(room.players.entries()).filter(([id, player]) => {
      if (id === socket.id || player.state !== 'playing') return false;
      return room.mode.isTeamMode ? player.team !== sender.team : true;
    });
    const selectedOpponent = opponents.find(([, player]) => player.index === targetIndex) ?? opponents[0];
    const safeDuration = Math.max(0, Math.min(10_000, Number(durationMs) || 0));
    const safeAmount = Math.max(0, Math.min(20, Number(amount) || 0));

    if (type === 'QUICKSILVER' || type === 'CHAOS') {
      const effect = { type, durationMs: safeDuration };
      opponents.forEach(([id]) => io.to(id).emit('class-effect', effect));
    } else if (type === 'ABILITY_FREEZE') {
      const effect = { type: 'ABILITY_FREEZE', durationMs: safeDuration || 3000 };
      opponents.forEach(([id]) => io.to(id).emit('class-effect', effect));
    } else if (type === 'SCRAMBLE' && selectedOpponent) {
      io.to(selectedOpponent[0]).emit('class-effect', { type: 'SCRAMBLE', amount: Math.max(1, Math.min(5, safeAmount || 5)) });
    } else if (type === 'GRID_SHIFT' && selectedOpponent) {
      io.to(selectedOpponent[0]).emit('class-effect', { type: 'GRID_SHIFT', direction: direction === -1 ? -1 : 1 });
    } else if (type === 'EARTHQUAKE') {
      opponents.forEach(([id]) => io.to(id).emit('receive-garbage', { count: safeAmount || 10, fromIndex: sender.index }));
    } else if (type === 'GUARDIAN_ANGEL') {
      const allies = room.mode.isTeamMode
        ? Array.from(room.players.entries()).filter(([id, player]) => id !== socket.id && player.team === sender.team && player.state === 'playing')
        : null;
      const selectedAlly = allies?.find(([, player]) => player.index === targetIndex) ?? allies?.[0];
      io.to(selectedAlly?.[0] ?? socket.id).emit('class-effect', { type: 'GUARDIAN_ANGEL', amount: safeAmount || 4 });
    }
  });

  socket.on('broadcast-ribbon', ({ message }) => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('show-ribbon', { message });
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    removePlayer(socket, { announceDisconnect: true });
  });
});

app.get('/', (_req, res) => res.send('Block Quartet multi-mode server is running.'));
httpServer.listen(PORT, () => console.log(`Block Quartet server listening on http://localhost:${PORT}`));
