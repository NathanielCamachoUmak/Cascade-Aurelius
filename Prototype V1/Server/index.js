import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { BATTLE_ROYALE_RULES, getBattleRoyalPhase, selectBattleRoyalCullTargets, rankBattleRoyalPlayers, closestToTarget, hasReachedTarget } from './battleRoyal.js';

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
  'battle-royale': BATTLE_ROYALE_RULES,
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
    durationMs: mode.durationMs || null,
    targetScore: mode.targetScore || null,
  };
}

function getOrCreateRoom(roomId, requestedModeId) {
  if (!rooms.has(roomId)) {
    const mode = getMode(requestedModeId);
    rooms.set(roomId, {
      mode,
      hostId: null,
      players: new Map(),
      phase: 'lobby',
      rematchVotes: new Set(),
      countdownTimer: null,
      matchTimer: null,
      pregameTimer: null,
      matchEndsAt: null,
      battleRoyalStartedAt: null,
      battleRoyalPhase: null,
      battleRoyalCullTimers: [],
      battleRoyalSuddenDeathTimer: null,
      battleRoyalSuddenDeathCursor: 0,
    });
  }
  return rooms.get(roomId);
}

function clearTimers(room) {
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  if (room.matchTimer) clearTimeout(room.matchTimer);
  if (room.pregameTimer) clearTimeout(room.pregameTimer);
  for (const timer of room.battleRoyalCullTimers || []) clearTimeout(timer);
  if (room.battleRoyalSuddenDeathTimer) clearInterval(room.battleRoyalSuddenDeathTimer);
  room.countdownTimer = null;
  room.matchTimer = null;
  room.pregameTimer = null;
  room.matchEndsAt = null;
  room.battleRoyalStartedAt = null;
  room.battleRoyalPhase = null;
  room.battleRoyalCullTimers = [];
  room.battleRoyalSuddenDeathTimer = null;
  room.battleRoyalSuddenDeathCursor = 0;
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
    hostId: room.hostId,
    mode: publicMode(room.mode),
    capacity: room.mode.capacity,
    teamSize: room.mode.teamSize,
    matchEndsAt: room.matchEndsAt,
    teamScores: calculateTeamScores(room),
    battleRoyal: room.mode.id === 'battle-royale' ? {
      startedAt: room.battleRoyalStartedAt,
      phase: room.battleRoyalPhase,
      targetScore: BATTLE_ROYALE_RULES.targetScore,
      remainingPlayers: Array.from(room.players.values()).filter(player => player.state === 'playing').length,
      elapsedMs: room.battleRoyalStartedAt ? Math.max(0, Date.now() - room.battleRoyalStartedAt) : 0,
    } : null,
    players: Array.from(room.players.entries()).map(([id, player]) => ({
      id,
      name: player.name,
      ready: player.ready,
      state: player.state,
      index: player.index,
      team: player.team,
      score: player.score || 0,
      lines: player.lines || 0,
      kills: player.kills || 0,
      eliminatedAt: player.eliminatedAt || null,
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

function emitBattleRoyalPhase(roomId, phase, extra = {}) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale') return;
  room.battleRoyalPhase = phase.id;
  io.to(roomId).emit('battle-royale-phase', {
    phase: phase.id,
    label: phase.label,
    atMs: phase.atMs,
    remainingPlayers: Array.from(room.players.values()).filter(player => player.state === 'playing').length,
    ...extra,
  });
  emitRoomState(roomId);
}

function eliminateBattleRoyalPlayers(roomId, count, primary, tieBreakers, reason) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return [];
  const entries = Array.from(room.players.entries());
  const selected = selectBattleRoyalCullTargets(entries.map(([, player]) => ({ ...player, id: player.index })), count, primary, tieBreakers);
  const selectedIndexes = new Set(selected.map(player => player.index));
  const eliminated = [];
  for (const [id, player] of entries) {
    if (!selectedIndexes.has(player.index)) continue;
    player.state = 'spectating';
    player.eliminatedAt = Date.now();
    eliminated.push({ id, name: player.name, score: player.score, lines: player.lines, kills: player.kills });
    io.to(roomId).emit('player-state-update', { playerId: id, state: 'spectating', reason, forced: true });
  }
  io.to(roomId).emit('battle-royale-cull', {
    reason,
    eliminated,
    remainingPlayers: Array.from(room.players.values()).filter(player => player.state === 'playing').length,
  });
  emitRoomState(roomId);
  checkBattleRoyalGameOver(roomId);
  return eliminated;
}

function runBattleRoyalSuddenDeath(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.id !== 'battle-royale') return;
  const alive = Array.from(room.players.entries())
    .filter(([, player]) => player.state === 'playing')
    .sort(([, a], [, b]) => (a.score || 0) - (b.score || 0) || (a.lines || 0) - (b.lines || 0) || (a.kills || 0) - (b.kills || 0));
  if (!alive.length) return;
  const [targetId, target] = alive[room.battleRoyalSuddenDeathCursor % alive.length];
  room.battleRoyalSuddenDeathCursor += 1;
  io.to(targetId).emit('receive-garbage', { count: 5, solid: true, unClearable: true, fromIndex: target.index, source: 'battle-royale-sudden-death' });
  io.to(roomId).emit('battle-royale-sudden-death', { targetId, targetIndex: target.index, remainingPlayers: alive.length, cursor: room.battleRoyalSuddenDeathCursor });
}

function startBattleRoyalSchedule(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  room.battleRoyalStartedAt = Date.now();
  emitBattleRoyalPhase(roomId, getBattleRoyalPhase(0));
  room.battleRoyalCullTimers = [
    setTimeout(() => { emitBattleRoyalPhase(roomId, getBattleRoyalPhase(3 * 60 * 1000)); eliminateBattleRoyalPlayers(roomId, 10, 'score', ['lines', 'kills'], 'score-cull'); }, 3 * 60 * 1000),
    setTimeout(() => { emitBattleRoyalPhase(roomId, getBattleRoyalPhase(6 * 60 * 1000)); eliminateBattleRoyalPlayers(roomId, 12, 'lines', ['score', 'kills'], 'line-cull'); }, 6 * 60 * 1000),
    setTimeout(() => {
      emitBattleRoyalPhase(roomId, getBattleRoyalPhase(8 * 60 * 1000));
      eliminateBattleRoyalPlayers(roomId, 10, 'kills', ['lines', 'score'], 'kill-cull');
      emitBattleRoyalPhase(roomId, BATTLE_ROYALE_RULES.phaseBreaks[4]);
    }, 8 * 60 * 1000),
    setTimeout(() => {
      emitBattleRoyalPhase(roomId, getBattleRoyalPhase(9 * 60 * 1000));
      room.battleRoyalSuddenDeathTimer = setInterval(() => runBattleRoyalSuddenDeath(roomId), 8 * 1000);
      runBattleRoyalSuddenDeath(roomId);
    }, 9 * 60 * 1000),
  ];
}

function finishBattleRoyalMatch(roomId, reason = 'time', winnerOverride = null) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.id !== 'battle-royale') return;
  const survivors = Array.from(room.players.values()).filter(player => player.state === 'playing');
  const winner = winnerOverride || closestToTarget(survivors);
  const rankings = rankBattleRoyalPlayers(Array.from(room.players.values()));
  clearTimers(room);
  resetAfterMatch(room);
  const winnerEntry = winner ? Array.from(room.players.entries()).find(([, player]) => player === winner) : null;
  io.to(roomId).emit('post-game-start', {
    winnerId: winnerEntry?.[0] || '',
    winnerName: winner?.name || 'No survivor',
    winnerTeam: null,
    teamScores: { cyan: 0, magenta: 0 },
    reason,
    modeId: room.mode.id,
    battleRoyal: true,
    rankings,
    targetScore: BATTLE_ROYALE_RULES.targetScore,
  });
  emitRoomState(roomId);
}

function checkBattleRoyalGameOver(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.id !== 'battle-royale') return;
  const alive = Array.from(room.players.values()).filter(player => player.state === 'playing');
  if (alive.length <= 1) finishBattleRoyalMatch(roomId, 'last-survivor', alive[0] || null);
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
  if (!room || room.phase !== 'countdown' || room.players.size < 1) return;

  room.phase = 'in-game';
  room.countdownTimer = null;
  const playerList = [];
  let index = 0;
  for (const [id, player] of room.players) {
    player.index = index;
    player.state = 'playing';
    player.score = 0;
    player.lines = 0;
    player.kills = 0;
    player.eliminatedAt = null;
    playerList.push({ id, name: player.name, index, team: player.team, kills: 0 });
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

  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.matchEndsAt = Date.now() + BATTLE_ROYALE_RULES.durationMs;
      io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: BATTLE_ROYALE_RULES.durationMs });
      room.matchTimer = setTimeout(() => finishBattleRoyalMatch(roomId, 'time'), BATTLE_ROYALE_RULES.durationMs);
      startBattleRoyalSchedule(roomId);
      emitRoomState(roomId);
    } else {
      startTeamMatchTimer(roomId);
    }
  }, 3000);
}

function beginRoomCountdown(roomId, initiatedBy = null) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby' || room.players.size < 1) return false;
  if (initiatedBy && room.hostId !== initiatedBy) return false;
  room.phase = 'countdown';
  io.to(roomId).emit('countdown-start', 5);
  emitRoomState(roomId);
  room.countdownTimer = setTimeout(() => startMatch(roomId), 5000);
  return true;
}

function checkAllReady(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby') return;
  if (room.players.size !== room.mode.capacity) return;
  if (!Array.from(room.players.values()).every(player => player.ready)) return;

  beginRoomCountdown(roomId);
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

  if (room.hostId === socket.id) {
    room.hostId = room.players.keys().next().value || null;
    io.to(roomId).emit('room-host-changed', { hostId: room.hostId });
  }

  if (room.phase === 'countdown') cancelCountdown(roomId);
  if (announceDisconnect) io.to(roomId).emit('player-disconnected', { playerId: socket.id });

  // In elimination modes, removing a live board can leave exactly one winner.
  if (room.mode.id === 'battle-royale') checkBattleRoyalGameOver(roomId);
  else checkEliminationGameOver(roomId);
  emitRoomState(roomId);
  if (room.phase === 'post-game') updateRematchVotes(roomId);
}

function addPlayer(socket, roomId, name, requestedModeId, { create = false } = {}) {
  if (!rooms.has(roomId) && !create) {
    socket.emit('join-error', { message: 'Room not found. Host this room first or enter an existing room code.' });
    return;
  }
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
    kills: 0,
    eliminatedAt: null,
  });
  if (!room.hostId) room.hostId = socket.id;
  socket.join(roomId);
  socket.data.roomId = roomId;
  console.log(`[join-room] ${socket.id} -> ${roomId} (${room.mode.id}, ${room.players.size}/${room.mode.capacity})`);
  emitRoomState(roomId);
}

io.on('connection', socket => {
  console.log(`[connect] ${socket.id}`);

  socket.on('host-room', ({ roomId, name, modeId }) => {
    if (socket.data.roomId) {
      socket.emit('join-error', { message: 'Leave your current room before hosting another lobby.' });
      return;
    }
    addPlayer(socket, roomId, name, modeId, { create: true });
  });

  socket.on('join-room', ({ roomId, name, modeId }) => {
    if (socket.data.roomId && socket.data.roomId !== roomId && rooms.has(socket.data.roomId)) {
      socket.emit('confirm-join', { currentRoom: socket.data.roomId, newRoom: roomId, newModeId: modeId });
      return;
    }
    if (!socket.data.roomId) addPlayer(socket, roomId, name, modeId, { create: false });
  });

  socket.on('confirm-join', ({ newRoomId, name, modeId }) => {
    if (socket.data.roomId) removePlayer(socket);
    addPlayer(socket, newRoomId, name, modeId, { create: false });
  });

  socket.on('leave-lobby', () => removePlayer(socket));

  socket.on('host-start-now', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.hostId !== socket.id) {
      socket.emit('join-error', { message: 'Only the host can start this lobby.' });
      return;
    }
    if (room.phase !== 'lobby' || room.players.size < 1) return;
    for (const player of room.players.values()) player.ready = true;
    beginRoomCountdown(roomId, socket.id);
  });

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

    const scoreCap = room.mode.id === 'battle-royale' ? 5_000_000 : 999999;
    player.score = Math.max(0, Math.min(scoreCap, Math.floor(Number(data.score) || 0)));
    player.lines = Math.max(0, Math.min(9999, Math.floor(Number(data.lines) || 0)));
    if (room.mode.id === 'battle-royale' && hasReachedTarget(player.score)) {
      finishBattleRoyalMatch(roomId, 'target-score', player);
      return;
    }
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

  socket.on('player-eliminated', ({ killerIndex } = {}) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase !== 'in-game') return;
    player.state = 'spectating';
    player.eliminatedAt = Date.now();
    if (room.mode.id === 'battle-royale' && Number.isInteger(killerIndex)) {
      const killer = Array.from(room.players.values()).find(candidate => candidate.index === killerIndex && candidate.state === 'playing');
      if (killer) killer.kills = (killer.kills || 0) + 1;
    }
    socket.to(roomId).emit('opponent-topped-out', { playerIndex: player.index });
    io.to(roomId).emit('player-state-update', { playerId: socket.id, state: 'spectating' });
    if (room.mode.id === 'battle-royale') checkBattleRoyalGameOver(roomId);
    else if (!room.mode.isTeamMode) checkEliminationGameOver(roomId);
    emitRoomState(roomId);
  });

  socket.on('game-over', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (room?.mode.id === 'battle-royale') checkBattleRoyalGameOver(roomId);
    else if (room && !room.mode.isTeamMode) checkEliminationGameOver(roomId);
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
