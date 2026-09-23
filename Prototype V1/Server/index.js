import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { BATTLE_ROYALE_RULES, getBattleRoyalPhase, selectBattleRoyalCullTargets, rankBattleRoyalPlayers, closestToTarget, hasReachedTarget, getDensityBracket, isCullingFrozen, isKoFloorReached, applyKoPenalty, finalScoreWithDecay, DYNAMIC_RULES } from './battleRoyal.js';

const app = express();
const httpServer = createServer(app);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, { cors: { origin: ALLOWED_ORIGINS } });

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
      koCount: player.koCount || 0,
      finalScore: finalScoreWithDecay(player.score || 0, player.koCount || 0),
      eliminatedAt: player.eliminatedAt || null,
      isBot: !!player.isBot,
      ownerId: player.ownerId || null,
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

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = { 0: 400, 1: 800, 2: 1200, 3: 1600 };

// The multiplier currently in force = phase multiplier x any active dynamic rule.
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

// Server-side point computation. The client tells us what happened; the
// numbers themselves are decided here and nowhere else.
function computeScoreEvent(room, player, { type, lines, combo }) {
  const comboStep = Math.max(0, Math.min(20, Math.floor(Number(combo) || 0)));
  const cleared = Math.max(0, Math.min(4, Math.floor(Number(lines) || 0)));
  let base = 0;

  if (type === 'lines') base = LINE_SCORES[cleared] || 0;
  else if (type === 'tspin') base = TSPIN_SCORES[cleared] ?? 400;
  else if (type === 'softdrop') base = Math.min(20, Math.max(0, Math.floor(Number(lines) || 0)));
  else if (type === 'harddrop') base = Math.min(40, Math.max(0, Math.floor(Number(lines) || 0)));
  else return 0;

  if (type === 'lines' || type === 'tspin') base += 50 * comboStep;
  return Math.floor(base * activeScoreMultiplier(room));
}

function activePlayerCount(room) {
  return Array.from(room.players.values()).filter(p => p.state === 'playing').length;
}

// --- K.O. system ---------------------------------------------------------
// At or below the K.O. floor, a top-out no longer eliminates. The player is
// revived with a penalty instead, so a thin lobby doesn't collapse instantly.
function handleKnockout(roomId, socketId) {
  const room = rooms.get(roomId);
  const player = room?.players.get(socketId);
  if (!room || !player) return false;

  player.koCount = (player.koCount || 0) + 1;
  player.score = applyKoPenalty(player.score || 0);
  player.lastClearAt = Date.now();

  // Selective board clear is executed client-side (it owns the grid);
  // the server just authorizes it and broadcasts the K.O. for HUD/stamps.
  io.to(socketId).emit('ko-recover', {
    koCount: player.koCount,
    score: player.score,
    clearGarbageOnly: true,
  });
  io.to(roomId).emit('player-knocked-out', {
    playerId: socketId,
    playerIndex: player.index,
    koCount: player.koCount,
    score: player.score,
  });
  emitRoomState(roomId);
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
  room.activeDynamicRule = null;
  room.dynamicRuleIndex = 0;
  emitBattleRoyalPhase(roomId, getBattleRoyalPhase(0));

  const startingPlayers = activePlayerCount(room);
  const timers = [];

  // Phase transitions straight off the rules timeline.
  for (const phase of BATTLE_ROYALE_RULES.phaseBreaks) {
    if (phase.atMs === 0) continue;
    timers.push(setTimeout(() => {
      emitBattleRoyalPhase(roomId, phase, {
        gravityScale: phase.gravityScale,
        scoreMultiplier: phase.scoreMultiplier,
        garbageRate: phase.garbageRate,
        idlePenaltyMs: phase.idlePenaltyMs,
        solidGarbage: Boolean(phase.solidGarbage),
      });
      if (phase.solidGarbage && !room.battleRoyalSuddenDeathTimer) {
        room.battleRoyalSuddenDeathTimer = setInterval(() => runBattleRoyalSuddenDeath(roomId), 8 * 1000);
        runBattleRoyalSuddenDeath(roomId);
      }
    }, phase.atMs));
  }

  // Dynamic rule rotation — cadence comes from the current density bracket.
  const rotate = () => {
    const current = rooms.get(roomId);
    if (!current || current.phase !== 'in-game') return;
    const elapsed = Date.now() - current.battleRoyalStartedAt;
    const phase = getBattleRoyalPhase(elapsed);
    if (phase.dynamicRules || elapsed >= BATTLE_ROYALE_RULES.phaseBreaks[1].atMs) {
      const rule = DYNAMIC_RULES[current.dynamicRuleIndex % DYNAMIC_RULES.length];
      current.dynamicRuleIndex++;
      current.activeDynamicRule = rule;
      const bracket = getDensityBracket(activePlayerCount(current));
      io.to(roomId).emit('battle-royale-event', {
        rule: rule.id,
        label: rule.label,
        density: bracket.id,
        densityLabel: bracket.label,
        randomizedTargeting: Boolean(bracket.randomizedTargeting),
        boardHeightLimit: bracket.boardHeightLimit ?? null,
        forcedRivalDuels: Boolean(bracket.forcedRivalDuels),
        rotationMs: bracket.eventRotationMs,
      });
    }
    const nextBracket = getDensityBracket(activePlayerCount(current));
    current.dynamicRuleTimer = setTimeout(rotate, nextBracket.eventRotationMs);
  };
  room.dynamicRuleTimer = setTimeout(rotate, getDensityBracket(startingPlayers).eventRotationMs);

  // Idle penalty sweep: from Culling Escalation on, players who haven't
  // cleared a line recently take garbage.
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

  // Culling passes. Frozen entirely while the lobby is under the player floor.
  for (const phase of BATTLE_ROYALE_RULES.phaseBreaks) {
    if (!phase.eliminate) continue;
    const scaled = Math.max(1, Math.round(startingPlayers * (phase.eliminate / BATTLE_ROYALE_RULES.capacity)));
    timers.push(setTimeout(() => {
      const alive = activePlayerCount(room);
      if (isCullingFrozen(alive)) {
        io.to(roomId).emit('battle-royale-event', {
          rule: 'culling-frozen',
          label: `Culling frozen — needs ${BATTLE_ROYALE_RULES.minPlayers}+ players`,
          density: getDensityBracket(alive).id,
        });
        return;
      }
      if (alive <= 1) return;
      eliminateBattleRoyalPlayers(roomId, Math.min(scaled, alive - 1), phase.primary, phase.tieBreakers, `${phase.primary}-cull`);
    }, phase.atMs));
  }

  room.battleRoyalCullTimers = timers;
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
    player.koCount = 0;
    player.lastClearAt = Date.now();
    player.lastScoreEventAt = 0;
    player.eliminatedAt = null;
    playerList.push({ id, name: player.name, index, team: player.team, kills: 0, isBot: !!player.isBot, ownerId: player.ownerId || null });
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
  io.to(roomId).emit('pre-game-countdown', 5);
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
  // Start once everyone currently in the room is ready (min 2 players).
  // Requiring the mode's full capacity meant a 40-player Battle Royale
  // could never start from ready-up alone.
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

function updateRematchVotes(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'post-game') return;
  const required = room.players.size;
  io.to(roomId).emit('rematch-update', { votes: room.rematchVotes.size, required });
  if (room.rematchVotes.size >= required && required >= 1) {
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
  
  // Also delete any bots owned by this socket
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
    // Find the first human player to become the new host
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

  socket.on('add-bot', (payload) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'lobby') return;
    if (room.players.size >= room.mode.capacity) return;

    const botId = 'bot-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const team = room.mode.isTeamMode ? teamForOpenSlot(room) : null;
    const requestedName = payload?.name || 'AI Bot';
    
    room.players.set(botId, {
      name: requestedName,
      ready: true,
      index: -1,
      state: 'lobby',
      team,
      score: 0,
      lines: 0,
      kills: 0,
      eliminatedAt: null,
      isBot: true,
      ownerId: socket.id,
    });
    emitRoomState(roomId);
  });

  socket.on('remove-bot', ({ botId }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'lobby') return;
    
    const bot = room.players.get(botId);
    if (bot && bot.isBot) {
      room.players.delete(botId);
      emitRoomState(roomId);
    }
  });

  socket.on('switch-team', () => {
  const roomId = socket.data.roomId;
  const room = roomId && rooms.get(roomId);
  const player = room?.players.get(socket.id);
  if (!room || !player || !room.mode.isTeamMode) return;
  if (room.phase !== 'lobby') return;

  const targetTeam = player.team === 'cyan' ? 'magenta' : 'cyan';
  const targetTeamCount = Array.from(room.players.values()).filter(p => p.team === targetTeam).length;
  if (targetTeamCount >= room.mode.teamSize) {
    socket.emit('join-error', { message: `${teams[targetTeam].label} is full (${room.mode.teamSize} players).` });
    return;
  }

  player.team = targetTeam;
  player.ready = false;
  emitRoomState(roomId);
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
    
    for (const [id, player] of room.players) {
      if (player.isBot) {
        room.rematchVotes.add(id);
      }
    }

    updateRematchVotes(roomId);
  });

  socket.on('grid-update', ({ grid, botId }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || (botId && player.ownerId !== socket.id)) return;
    socket.to(roomId).emit('opponent-grid-update', { playerIndex: player.index, grid });
  });

  socket.on('piece-update', ({ piece, botId }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || (botId && player.ownerId !== socket.id)) return;
    socket.to(roomId).emit('opponent-piece-update', { playerIndex: player.index, piece });
  });

  // --- Server-authoritative scoring ---------------------------------------
  // Clients no longer send a raw score. They report WHAT happened (a line
  // clear, T-spin, combo step) and the server computes the points itself,
  // so a tampered client can't just claim an arbitrary score.
  socket.on('score-event', payload => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;

    const { botId, type, lines, combo, clientTs } = payload || {};
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || (botId && player.ownerId !== socket.id)) return;

    const now = Date.now();
    // Timestamp validation: reject events dated in the future or far in the
    // past (replayed/stale), and rate-limit to a humanly-possible cadence.
    if (!botId && typeof clientTs === 'number') {
      const drift = now - clientTs;
      if (drift < -2000 || drift > 30_000) return;
    }
    if (player.lastScoreEventAt && now - player.lastScoreEventAt < 40) return;
    player.lastScoreEventAt = now;

    const points = computeScoreEvent(room, player, { type, lines, combo });
    if (points <= 0 && type !== 'lines') return;

    const scoreCap = room.mode.id === 'battle-royale' ? 5_000_000 : 999_999;
    player.score = Math.max(0, Math.min(scoreCap, Math.floor((player.score || 0) + points)));
    if (type === 'lines') {
      const cleared = Math.max(0, Math.min(4, Math.floor(Number(lines) || 0)));
      player.lines = Math.max(0, Math.min(9999, (player.lines || 0) + cleared));
      player.lastClearAt = now;
    }

    if (room.mode.id === 'battle-royale' && hasReachedTarget(player.score)) {
      finishBattleRoyalMatch(roomId, 'target-score', player);
      return;
    }

    // Authoritative echo — clients render from this, not their local guess.
    io.to(roomId).emit('opponent-score-update', {
      playerIndex: player.index,
      score: player.score,
      lines: player.lines,
      combo: Math.max(0, Math.floor(Number(combo) || 0)),
    });

    if (room.mode.isTeamMode) {
      io.to(roomId).emit('team-score-update', {
        playerIndex: player.index,
        playerId: botId || socket.id,
        team: player.team,
        score: player.score,
        lines: player.lines,
        teamScores: calculateTeamScores(room),
      });
    }
  });

  socket.on('player-eliminated', ({ killerIndex, botId } = {}) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || (botId && player.ownerId !== socket.id)) return;

    // At or below the K.O. floor, a top-out is survivable: the player is
    // revived with a score penalty instead of being eliminated outright.
    if (room.mode.id === 'battle-royale' && isKoFloorReached(activePlayerCount(room))) {
      if (handleKnockout(roomId, botId || socket.id)) return;
    }

    player.state = 'spectating';
    player.eliminatedAt = Date.now();
    if (room.mode.id === 'battle-royale' && Number.isInteger(killerIndex)) {
      const killer = Array.from(room.players.values()).find(candidate => candidate.index === killerIndex && candidate.state === 'playing');
      if (killer) killer.kills = (killer.kills || 0) + 1;
    }
    socket.to(roomId).emit('opponent-topped-out', { playerIndex: player.index });
    io.to(roomId).emit('player-state-update', { playerId: botId || socket.id, state: 'spectating' });
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

  socket.on('send-garbage', ({ count, targetIndex }) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    const sender = room?.players.get(socket.id);
    if (!room || !sender || room.phase !== 'in-game') return;

    // Clamp what the client claims, then apply the phase + density rate.
    const requested = Math.max(0, Math.min(20, Math.floor(Number(count) || 0)));
    if (requested === 0) return;
    const scaled = Math.max(1, Math.round(requested * activeGarbageRate(room)));

    // Find valid opponents
    const validOpponents = Array.from(room.players.entries()).filter(([id, player]) => {
      const isOpponent = room.mode.isTeamMode ? player.team !== sender.team : id !== socket.id;
      return id !== socket.id && isOpponent && player.state === 'playing';
    });

    if (validOpponents.length === 0) return;

    // Pick a random opponent to receive the garbage by default
    let targetEntry = validOpponents[Math.floor(Math.random() * validOpponents.length)];
    
    // If the sender specified a valid target index, use that instead
    if (targetIndex !== undefined && targetIndex !== null) {
      const explicitTarget = validOpponents.find(([, player]) => player.index === targetIndex);
      if (explicitTarget) {
        targetEntry = explicitTarget;
      }
    }
    
    const [targetId, targetPlayer] = targetEntry;
    io.to(targetId).emit('receive-garbage', { count: scaled, fromIndex: sender.index, targetIndex: targetPlayer.index });
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
    io.to(targetId).emit('receive-garbage', { count: Math.max(1, Math.min(20, Number(count) || 0)), fromIndex: sender.index, targetIndex: target.index });
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
      opponents.forEach(([id, player]) => io.to(id).emit('receive-garbage', { count: safeAmount || 10, fromIndex: sender.index, targetIndex: player.index }));
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


app.get('/', (_req, res) => res.send('Cascade multi-mode server is running.'));
httpServer.listen(PORT, () => console.log(`Cascade server listening on http://localhost:${PORT}`));

