import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { 
  BATTLE_ROYALE_RULES, 
  getBattleRoyalPhase, 
  selectBattleRoyalCullTargets, 
  rankBattleRoyalPlayers, 
  closestToTarget, 
  hasReachedTarget, 
  getDensityBracket, 
  isCullingFrozen, 
  isKoFloorReached, 
  applyKoPenalty, 
  finalScoreWithDecay, 
  DYNAMIC_RULES 
} from './battleRoyal.js';

const app = express();
const httpServer = createServer(app);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'https://cascade-aurelius-block-quartet-aurelius.vercel.app'];

const io = new Server(httpServer, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const MATCH_DURATION_MS = 4 * 60 * 1000; // Updated to 4 minutes
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
  if (room.dynamicRuleTimer) clearTimeout(room.dynamicRuleTimer);
  if (room.idleSweepTimer) clearInterval(room.idleSweepTimer);
  room.countdownTimer = null;
  room.matchTimer = null;
  room.pregameTimer = null;
  room.matchEndsAt = null;
  room.battleRoyalStartedAt = null;
  room.battleRoyalPhase = null;
  room.battleRoyalCullTimers = [];
  room.battleRoyalSuddenDeathTimer = null;
  room.battleRoyalSuddenDeathCursor = 0;
  room.dynamicRuleTimer = null;
  room.idleSweepTimer = null;
  room.activeDynamicRule = null;
  room.dynamicRuleIndex = 0;
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

function activePlayerCount(room) {
  return Array.from(room.players.values()).filter(p => p.state === 'playing').length;
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
      remainingPlayers: activePlayerCount(room),
      totalLobbyPlayers: room.players.size,
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
      koCount: player.koCount || 0,
      finalScore: finalScoreWithDecay(player.score || 0, player.koCount || 0),
      eliminatedAt: player.eliminatedAt || null,
      isBot: !!player.isBot,
      ownerId: player.ownerId || null,
      classId: player.classId || 'SPEEDSTER',
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
  const alive = activePlayerCount(room);
  if (alive <= 1) finishEliminationMatch(roomId);
}

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = { 0: 400, 1: 800, 2: 1200, 3: 1600 };

function activeScoreMultiplier(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let mult = phase.scoreMultiplier || 1;
  if (room.activeDynamicRule?.scoreMultiplier) mult *= room.activeDynamicRule.scoreMultiplier;
  return mult;
}

function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let rate = phase.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  rate *= 1 + (bracket.garbageSpeedBonus || 0);
  return rate;
}

function computeScoreEvent(room, player, { type, lines, combo, multiplier }) {
  const comboStep = Math.max(0, Math.min(20, Math.floor(Number(combo) || 0)));
  const cleared = Math.max(0, Math.min(5, Math.floor(Number(lines) || 0)));
  const itemMult = Number(multiplier) === 2 ? 2 : 1;
  let base = 0;

  if (type === 'lines') {
    const clamped = Math.min(4, cleared);
    const extra = Math.max(0, cleared - 4);
    base = (LINE_SCORES[clamped] || 0) + extra * 200;
  }
  else if (type === 'tspin') base = TSPIN_SCORES[Math.min(4, cleared)] ?? 400;
  else if (type === 'softdrop') base = Math.min(20, Math.max(0, Math.floor(Number(lines) || 0)));
  else if (type === 'harddrop') base = Math.min(40, Math.max(0, Math.floor(Number(lines) || 0)));
  else if (type === 'garbage_eater') base = 800;
  else return 0;

  if (type === 'lines' || type === 'tspin') base += 50 * comboStep;
  return Math.floor(base * itemMult * activeScoreMultiplier(room));
}

// --- K.O. system ---------------------------------------------------------
// Applied ONLY when active players <= 4
function handleKnockout(roomId, socketId) {
  const room = rooms.get(roomId);
  const player = room?.players.get(socketId);
  if (!room || !player) return false;

  // Safeguard: Prevent K.O. triggers faster than once every 1.5 seconds
  const now = Date.now();
  if (player.lastKoAt && now - player.lastKoAt < 1500) {
    return false;
  }
  player.lastKoAt = now;

  player.koCount = (player.koCount || 0) + 1;
  player.score = applyKoPenalty(player.score || 0); //[cite: 4]
  player.lastClearAt = now; //[cite: 4]

  io.to(socketId).emit('ko-recover', {
    koCount: player.koCount,
    score: player.score,
    clearGarbageOnly: false, // Explicitly tell client to clear entire board
  }); //[cite: 4]

  io.to(roomId).emit('player-knocked-out', {
    playerId: socketId,
    playerIndex: player.index,
    koCount: player.koCount,
    score: player.score,
  }); //[cite: 4]

  emitRoomState(roomId); //[cite: 4]
  return true;
}

function emitBattleRoyalPhase(roomId, phase, extra = {}) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale') return;
  room.battleRoyalPhase = phase.id;
  io.to(roomId).emit('battle-royale-phase', {
    phase: phase.id,
    label: phase.label,
    atMs: phase.atMs,
    remainingPlayers: activePlayerCount(room),
    ...extra,
  });
  emitRoomState(roomId);
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

function startBattleRoyalSchedule(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  room.battleRoyalStartedAt = Date.now();
  room.activeDynamicRule = null;
  room.dynamicRuleIndex = 0;
  emitBattleRoyalPhase(roomId, getBattleRoyalPhase(0));

  const startingPlayers = activePlayerCount(room);
  const timers = [];

  for (const phase of BATTLE_ROYALE_RULES.phaseBreaks) {
    if (phase.atMs === 0) continue;
    timers.push(setTimeout(() => {
      emitBattleRoyalPhase(roomId, phase, {
        gravityScale: phase.gravityScale,
        scoreMultiplier: phase.scoreMultiplier,
        garbageRate: phase.garbageRate,
        itemBlockRate: phase.itemBlockRate,
        idlePenaltyMs: phase.idlePenaltyMs,
        solidGarbage: Boolean(phase.solidGarbage),
      });
    }, phase.atMs));
  }

  room.idleSweepTimer = setInterval(() => {
    const current = rooms.get(roomId);
    if (!current || current.phase !== 'in-game' || !current.battleRoyalStartedAt) return;
    const phase = getBattleRoyalPhase(Date.now() - current.battleRoyalStartedAt);
    if (!phase.idlePenaltyMs) return;
    const now = Date.now();
    for (const [id, player] of current.players) {
      if (player.state !== 'playing') continue;
      const last = player.lastClearAt || current.battleRoyalStartedAt;
      if (now - last >= phase.idlePenaltyMs) {
        player.lastClearAt = now;
        io.to(id).emit('receive-garbage', { count: 1, fromIndex: -1, reason: 'idle-penalty' });
      }
    }
  }, 5 * 1000);

  room.battleRoyalCullTimers = timers;
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
    player.koCount = 0;
    player.lastClearAt = Date.now();
    player.lastScoreEventAt = 0;
    player.eliminatedAt = null;
    playerList.push({ id, name: player.name, index, team: player.team, kills: 0, isBot: !!player.isBot, ownerId: player.ownerId || null, classId: player.classId || 'SPEEDSTER' });
    playerList.push({ id, name: player.name, index, team: player.team, kills: 0, isBot: !!player.isBot, ownerId: player.ownerId || null, classId: player.classId });
    index += 1;
  }

  for (const [socketId, player] of room.players) {
    io.to(socketId).emit('game-start', {
      players: playerList,
      myIndex: player.index,
      teamScores: calculateTeamScores(room),
      modeId: room.mode.id,
      mode: publicMode(room.mode),
      remainingPlayers: playerList.length,
    });
  }
  io.to(roomId).emit('pre-game-countdown', 5);
  emitRoomState(roomId);

  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.matchEndsAt = Date.now() + BATTLE_ROYALE_RULES.durationMs;
      io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: BATTLE_ROYALE_RULES.durationMs });
      room.matchTimer = setTimeout(() => finishBattleRoyalMatch(roomId, 'time'), BATTLE_ROYALE_RULES.durationMs);
      startBattleRoyalSchedule(roomId);
      emitRoomState(roomId);
    }
  }, 5000);
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
  if (room.players.size < 2) return;
  if (room.players.size > room.mode.capacity) return;
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

function removePlayer(socket, { announceDisconnect = false } = {}) {
  const roomId = socket.data.roomId;
  if (!roomId || !rooms.has(roomId)) return;
  const room = rooms.get(roomId);

  if (room.phase === 'in-game' && room.mode.isTeamMode) finishTeamMatch(roomId, 'disconnect');

  room.players.delete(socket.id);
  
  for (const [id, player] of room.players.entries()) {
    if (player.isBot && player.ownerId === socket.id) {
      room.players.delete(id);
    }
  }

  room.rematchVotes.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (room.players.size === 0) {
    clearTimers(room);
    rooms.delete(roomId);
    return;
  }

  if (room.hostId === socket.id) {
    let nextHost = null;
    for (const [id, player] of room.players.entries()) {
      if (!player.isBot) {
        nextHost = id;
        break;
      }
    }
    room.hostId = nextHost;
    io.to(roomId).emit('room-host-changed', { hostId: room.hostId });
  }

  if (room.phase === 'countdown') cancelCountdown(roomId);
  if (announceDisconnect) io.to(roomId).emit('player-disconnected', { playerId: socket.id });

  if (room.mode.id === 'battle-royale') checkBattleRoyalGameOver(roomId);
  else checkEliminationGameOver(roomId);
  emitRoomState(roomId);
}

function addPlayer(socket, roomId, name, requestedModeId, classId, { create = false } = {}) {
  if (!rooms.has(roomId) && !create) {
    socket.emit('join-error', { message: 'Room not found.' });
    return;
  }
  const room = getOrCreateRoom(roomId, requestedModeId);
  const requestedMode = getMode(requestedModeId);
  if (room.mode.id !== requestedMode.id) {
    socket.emit('join-error', { message: `Room uses ${room.mode.title}.` });
    return;
  }
  if (room.phase === 'in-game' || room.phase === 'countdown') {
    socket.emit('join-error', { message: 'Game is already in progress.' });
    return;
  }
  if (room.players.size >= room.mode.capacity) {
    socket.emit('join-error', { message: `${room.mode.title} room is full.` });
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
    classId: classId || 'SPEEDSTER',
  });
  if (!room.hostId) room.hostId = socket.id;
  socket.join(roomId);
  socket.data.roomId = roomId;
  emitRoomState(roomId);
}

io.on('connection', socket => {
  socket.on('host-room', ({ roomId, name, modeId, classId }) => {
    addPlayer(socket, roomId, name, modeId, classId, { create: true });
  });

  socket.on('join-room', ({ roomId, name, modeId, classId }) => {
    addPlayer(socket, roomId, name, modeId, classId, { create: false });
  });

  socket.on('host-start-now', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    for (const player of room.players.values()) player.ready = true;
    beginRoomCountdown(roomId, socket.id);
  });

  socket.on('score-event', payload => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;

    const { botId, type, lines, combo, multiplier } = payload || {};
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player) return;

    const points = computeScoreEvent(room, player, { type, lines, combo, multiplier });
    player.score = Math.max(0, Math.min(5_000_000, Math.floor((player.score || 0) + points)));
    
    if (type === 'lines') {
      const cleared = Math.max(0, Math.min(5, Math.floor(Number(lines) || 0)));
      player.lines = (player.lines || 0) + cleared;
      player.lastClearAt = Date.now();
    }

    io.to(roomId).emit('opponent-score-update', {
      playerIndex: player.index,
      score: player.score,
      lines: player.lines,
      combo: Math.max(0, Math.floor(Number(combo) || 0)),
    });
  });

  const handlePlayerToppedOut = ({ killerIndex, botId } = {}) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || player.state !== 'playing') return;

    const currentAlive = activePlayerCount(room);

    // If active players <= 4, apply K.O. mechanism instead of elimination!
    if (room.mode.id === 'battle-royale' && isKoFloorReached(currentAlive)) {
      if (handleKnockout(roomId, botId || socket.id)) return;
    }

    // Otherwise (> 4 players remaining), trigger Elimination and allow Spectator / Lobby Choice
    player.state = 'spectating';
    player.eliminatedAt = Date.now();

    if (room.mode.id === 'battle-royale' && Number.isInteger(killerIndex)) {
      const killer = Array.from(room.players.values()).find(candidate => candidate.index === killerIndex && candidate.state === 'playing');
      if (killer) killer.kills = (killer.kills || 0) + 1;
    }

    // Emit elimination choice to player
    const socketId = botId || socket.id;
    io.to(socketId).emit('player-eliminated-prompt', {
      message: 'You were eliminated! Choose to spectate or return to lobby.',
      canSpectate: true,
      canReturnToLobby: true
    });

    socket.to(roomId).emit('opponent-topped-out', { playerIndex: player.index });
    io.to(roomId).emit('player-state-update', { 
      playerId: socketId, 
      playerIndex: player.index, 
      state: 'spectating',
      remainingPlayers: activePlayerCount(room) 
    });

    if (room.mode.id === 'battle-royale') {
      checkBattleRoyalGameOver(roomId);
    } else {
      checkEliminationGameOver(roomId);
    }
    emitRoomState(roomId);
  };

  socket.on('player-eliminated', handlePlayerToppedOut);
  socket.on('player-topped-out', (payload) => handlePlayerToppedOut(payload || {}));

  // Direct Return to Lobby Request from Spectator Prompt
  socket.on('return-to-lobby', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (player && player.state === 'spectating') {
      player.state = 'lobby';
      socket.leave(roomId);
      socket.data.roomId = null;
      emitRoomState(roomId);
    }
  });

  socket.on('send-garbage', ({ count, targetIndex, strategy }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const sender = room?.players.get(socket.id);
    if (!room || !sender || room.phase !== 'in-game') return;

    const requested = Math.max(0, Math.min(20, Math.floor(Number(count) || 0)));
    if (requested === 0) return;
    const scaled = Math.max(1, Math.round(requested * activeGarbageRate(room)));

    const validOpponents = Array.from(room.players.entries()).filter(([id, player]) => {
      const isOpponent = room.mode.isTeamMode ? player.team !== sender.team : id !== socket.id;
      return id !== socket.id && isOpponent && player.state === 'playing';
    });

    if (validOpponents.length === 0) return;

    let targetEntry = null;

    // Resolve Strategy-Based Targeting
    if (strategy === 'HIGHEST_SCORE') {
      targetEntry = [...validOpponents].sort((a, b) => (b[1].score || 0) - (a[1].score || 0))[0];
    } else if (strategy === 'LOWEST_SCORE') {
      targetEntry = [...validOpponents].sort((a, b) => (a[1].score || 0) - (b[1].score || 0))[0];
    } else if (strategy === 'NEIGHBOR_LEFT' || strategy === 'NEIGHBOR_RIGHT') {
      const sortedByPos = [...validOpponents].sort((a, b) => a[1].index - b[1].index);
      targetEntry = strategy === 'NEIGHBOR_LEFT' ? sortedByPos[0] : sortedByPos[sortedByPos.length - 1];
    }

    if (!targetEntry && targetIndex !== undefined && targetIndex !== null) {
      targetEntry = validOpponents.find(([, player]) => player.index === targetIndex);
    }

    if (!targetEntry) {
      targetEntry = validOpponents[Math.floor(Math.random() * validOpponents.length)];
    }

    const [targetId, targetPlayer] = targetEntry;
    const socketTargetId = targetPlayer.isBot ? targetPlayer.ownerId : targetId;
    io.to(socketTargetId).emit('receive-garbage', { count: scaled, fromIndex: sender.index, targetIndex: targetPlayer.index });
  });

  socket.on('class-ability', ({ type, durationMs, amount, direction, targetIndex, strategy }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const sender = room?.players.get(socket.id);
    if (!room || !sender || room.phase !== 'in-game') return;

    const opponents = Array.from(room.players.entries()).filter(([id, player]) => {
      if (id === socket.id || player.state !== 'playing') return false;
      return room.mode.isTeamMode ? player.team !== sender.team : true;
    });

    let selectedOpponent = null;
    if (strategy === 'HIGHEST_SCORE') {
      selectedOpponent = [...opponents].sort((a, b) => (b[1].score || 0) - (a[1].score || 0))[0];
    } else if (strategy === 'LOWEST_SCORE') {
      selectedOpponent = [...opponents].sort((a, b) => (a[1].score || 0) - (b[1].score || 0))[0];
    }

    if (!selectedOpponent && targetIndex !== undefined) {
      selectedOpponent = opponents.find(([, player]) => player.index === targetIndex);
    }
    if (!selectedOpponent) selectedOpponent = opponents[0];

    const safeDuration = Math.max(0, Math.min(10_000, Number(durationMs) || 0));
    const safeAmount = Math.max(0, Math.min(20, Number(amount) || 0));

    if (selectedOpponent) {
      const targetSockId = selectedOpponent[1].isBot ? selectedOpponent[1].ownerId : selectedOpponent[0];
      io.to(targetSockId).emit('class-effect', { 
        type, 
        durationMs: safeDuration, 
        amount: safeAmount, 
        direction, 
        targetIndex: selectedOpponent[1].index 
      });
    }
  });

  socket.on('disconnect', () => {
    removePlayer(socket, { announceDisconnect: true });
  });
});

app.get('/', (_req, res) => res.send('Cascade multi-mode server is running.'));
httpServer.listen(PORT, () => console.log(`Cascade server listening on http://localhost:${PORT}`));