import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { 
  BATTLE_ROYALE_RULES, 
  getBattleRoyalRound, 
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
  for (const p of room.players?.values() || []) {
    if (p.tdmRespawnTimeout) {
      clearTimeout(p.tdmRespawnTimeout);
      p.tdmRespawnTimeout = null;
    }
  }
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
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let mult = round.scoreMultiplier || 1;
  if (room.activeDynamicRule?.scoreMultiplier) mult *= room.activeDynamicRule.scoreMultiplier;
  return mult;
}

function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let rate = round.garbageRate || 1;
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

function handleTdmKnockout(roomId, socketId, killerIndex) {
  const room = rooms.get(roomId);
  const player = room?.players.get(socketId);
  if (!room || !player || room.phase !== 'in-game' || !room.mode.isTeamMode) return false;

  const now = Date.now();
  if (player.lastKoAt && now - player.lastKoAt < 1500) {
    return false;
  }
  player.lastKoAt = now;

  player.koCount = (player.koCount || 0) + 1;
  // Apply -20% score penalty on topped-out player
  player.score = Math.max(0, Math.round((player.score || 0) * 0.8));

  const opposingTeam = player.team === 'cyan' ? 'magenta' : 'cyan';
  const BOUNTY_POINTS = 2500;

  let killer = null;
  if (Number.isInteger(killerIndex)) {
    killer = Array.from(room.players.values()).find(
      candidate => candidate.index === killerIndex && candidate.team === opposingTeam
    );
  }
  if (!killer) {
    const livingEnemies = Array.from(room.players.values()).filter(
      candidate => candidate.team === opposingTeam && candidate.state === 'playing'
    );
    if (livingEnemies.length > 0) {
      killer = livingEnemies[0];
    }
  }

  if (killer) {
    killer.kills = (killer.kills || 0) + 1;
    killer.score = (killer.score || 0) + BOUNTY_POINTS;
  } else {
    const anyEnemy = Array.from(room.players.values()).find(p => p.team === opposingTeam);
    if (anyEnemy) {
      anyEnemy.score = (anyEnemy.score || 0) + BOUNTY_POINTS;
    }
  }

  player.state = 'rebooting';

  const rebootDurationMs = 3000;
  const teamScores = calculateTeamScores(room);

  io.to(roomId).emit('tdm-player-rebooting', {
    playerId: socketId,
    playerIndex: player.index,
    team: player.team,
    killerIndex: killer ? killer.index : null,
    score: player.score,
    koCount: player.koCount,
    durationMs: rebootDurationMs,
    teamScores,
  });

  // Check for Team Ace Wipeout (all members of this squad currently down)
  const teamMembers = Array.from(room.players.values()).filter(p => p.team === player.team);
  const allTeamKnockedOut = teamMembers.length > 0 && teamMembers.every(p => p.state === 'rebooting' || p.state === 'spectating');

  if (allTeamKnockedOut) {
    const ACE_BONUS = 10000;
    const enemyMembers = Array.from(room.players.values()).filter(p => p.team === opposingTeam);
    if (enemyMembers.length > 0) {
      const perPlayer = Math.round(ACE_BONUS / enemyMembers.length);
      for (const ep of enemyMembers) {
        ep.score = (ep.score || 0) + perPlayer;
      }
    }
    const updatedTeamScores = calculateTeamScores(room);
    io.to(roomId).emit('team-ace-wipeout', {
      victimTeam: player.team,
      scoringTeam: opposingTeam,
      bonusPoints: ACE_BONUS,
      teamScores: updatedTeamScores,
    });
  }

  emitRoomState(roomId);

  if (player.tdmRespawnTimeout) {
    clearTimeout(player.tdmRespawnTimeout);
  }

  player.tdmRespawnTimeout = setTimeout(() => {
    player.tdmRespawnTimeout = null;
    const currentRoom = rooms.get(roomId);
    if (!currentRoom || currentRoom.phase !== 'in-game') return;
    const currentPlayer = currentRoom.players.get(socketId);
    if (!currentPlayer || currentPlayer.state !== 'rebooting') return;

    currentPlayer.state = 'playing';

    io.to(roomId).emit('tdm-player-respawned', {
      playerId: socketId,
      playerIndex: currentPlayer.index,
      team: currentPlayer.team,
    });

    emitRoomState(roomId);
  }, rebootDurationMs);

  return true;
}

function emitBattleRoyalRound(roomId, round) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale') return;
  room.battleRoyalPhase = round.id;
  const alive = activePlayerCount(room);
  // toEliminate: how many bottom players will be cut at round end
  const toEliminate = Math.max(0, alive - round.targetSurvivors);
  io.to(roomId).emit('battle-royale-phase', {
    phase: round.id,
    label: round.label,
    remainingPlayers: alive,
    cullThreshold: toEliminate,
    scoreMultiplier: round.scoreMultiplier,
    atMs: 0,
    nextAtMs: round.durationMs,
    solidGarbage: Boolean(round.solidGarbage),
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
  io.to(roomId).emit('game-over', {
    winnerId: winnerEntry ? (winnerEntry[1].isBot ? winnerEntry[1].ownerId : winnerEntry[0]) : null,
    winnerTeam: winner ? winner.team : null,
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
  // Don't trigger mid-intermission - round timer handles transitions
  if (room.battleRoyalPhase === 'intermission') return;
  const alive = Array.from(room.players.values()).filter(player => player.state === 'playing');
  const round = getBattleRoyalRound(room.currentRoundIndex || 0);
  if (alive.length <= round.targetSurvivors) {
    if ((room.currentRoundIndex || 0) >= BATTLE_ROYALE_RULES.rounds.length - 1 || alive.length <= 1) {
      finishBattleRoyalMatch(roomId, 'last-survivor', alive[0] || null);
    } else {
      endBattleRoyalRound(roomId);
    }
  }
}

function startBattleRoyalRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  
  if (room.currentRoundIndex === undefined) {
    room.currentRoundIndex = 0;
  }
  
  const round = getBattleRoyalRound(room.currentRoundIndex);
  room.battleRoyalStartedAt = Date.now();
  
  emitBattleRoyalRound(roomId, round);
  
  // Send start garbage
  if (round.startGarbage > 0) {
    for (const [id, player] of room.players) {
      if (player.state === 'playing') {
        const socketId = player.isBot ? player.ownerId : id;
        io.to(socketId).emit('receive-garbage', { count: round.startGarbage, fromIndex: -1, targetIndex: player.index });
      }
    }
  }

  // Setup round end timer
  if (round.durationMs > 0) {
    if (room.matchTimer) clearTimeout(room.matchTimer);
    room.matchTimer = setTimeout(() => {
      endBattleRoyalRound(roomId);
    }, round.durationMs);
  }
}

function endBattleRoyalRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  
  const round = getBattleRoyalRound(room.currentRoundIndex || 0);
  
  // Cull players if needed
  let alivePlayers = Array.from(room.players.values()).filter(p => p.state === 'playing');
  if (alivePlayers.length > round.targetSurvivors) {
    const sorted = rankBattleRoyalPlayers(alivePlayers);
    const toCull = sorted.slice(round.targetSurvivors); // The ones after targetSurvivors are lowest
    for (const player of toCull) {
      player.state = 'spectating';
      const socketId = player.isBot ? player.ownerId : Array.from(room.players.entries()).find(([, p]) => p === player)[0];
      io.to(socketId).emit('player-eliminated-prompt', {
        message: 'You did not qualify for the next round! Choose to spectate or return to lobby.',
        canSpectate: true,
      });
      io.to(roomId).emit('player-topped-out', { playerIndex: player.index, killerIndex: -1 });
    }
  }
  
  // Check if it's the final round or 1 survivor
  alivePlayers = Array.from(room.players.values()).filter(p => p.state === 'playing');
  if ((room.currentRoundIndex || 0) >= BATTLE_ROYALE_RULES.rounds.length - 1 || alivePlayers.length <= 1) {
    finishBattleRoyalMatch(roomId, 'last-survivor', alivePlayers[0] || null);
    return;
  }
  
  // Proceed to next round with intermission
  room.currentRoundIndex++;
  room.battleRoyalPhase = 'intermission';
  const nextRound = getBattleRoyalRound(room.currentRoundIndex);
  io.to(roomId).emit('battle-royale-phase', {
    phase: 'intermission',
    label: `Round ${room.currentRoundIndex + 1} — ${nextRound.label}`,
    remainingPlayers: activePlayerCount(room),
    cullThreshold: 0,
    atMs: 0,
    nextAtMs: BATTLE_ROYALE_RULES.intermissionMs,
    scoreMultiplier: nextRound.scoreMultiplier,
  });
  
  // Clear boards for remaining players
  for (const [id, player] of room.players) {
    if (player.state === 'playing') {
      const socketId = player.isBot ? player.ownerId : id;
      io.to(socketId).emit('round-start'); // Tells client to clear board
    }
  }
  
  if (room.matchTimer) clearTimeout(room.matchTimer);
  room.matchTimer = setTimeout(() => {
    startBattleRoyalRound(roomId);
  }, BATTLE_ROYALE_RULES.intermissionMs);
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
    playerList.push({
      id,
      name: player.name,
      index,
      team: player.team,
      kills: 0,
      isBot: !!player.isBot,
      ownerId: player.ownerId || null,
      classId: player.classId || 'SPEEDSTER',
    });
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
      remainingPlayers: playerList.length,
    });
  }
  io.to(roomId).emit('pre-game-countdown', 5);
  if (room.mode.isTeamMode) io.to(roomId).emit('team-score-update', { teamScores: calculateTeamScores(room) });
  emitRoomState(roomId);

  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.currentRoundIndex = 0;
      startBattleRoyalRound(roomId);
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

  // Auto-fill with bots for battle royale if lobby has less than capacity players
  if (room.mode.id === 'battle-royale') {
    const classes = ['SPEEDSTER', 'TANK', 'SABOTEUR', 'SUPPORT'];
    const humanCount = Array.from(room.players.values()).filter(p => !p.isBot).length;
    // Only auto-fill if there's exactly 1 human player (solo queue)
    if (humanCount === 1) {
      while (room.players.size < room.mode.capacity) {
        const botId = 'bot-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        room.players.set(botId, {
          name: 'AI Bot ' + (room.players.size),
          ready: true,
          index: -1,
          state: 'lobby',
          team: null,
          score: 0,
          lines: 0,
          kills: 0,
          koCount: 0,
          eliminatedAt: null,
          isBot: true,
          ownerId: room.hostId,
          classId: randomClass,
          lastClearAt: Date.now(),
          lastScoreEventAt: 0,
        });
      }
    }
  }

  if (room.mode.id === 'battle-royale') {
    while (room.players.size < room.mode.capacity) {
      const botId = 'bot-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const classes = ['SPEEDSTER', 'TANK', 'SABOTEUR', 'SUPPORT'];
      const randomClass = classes[Math.floor(Math.random() * classes.length)];
      room.players.set(botId, {
        name: 'AI Bot ' + room.players.size,
        ready: true,
        index: -1,
        state: 'lobby',
        team: null,
        score: 0,
        lines: 0,
        kills: 0,
        eliminatedAt: null,
        isBot: true,
        ownerId: room.hostId,
        classId: randomClass,
      });
    }
  }
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
  if (room.phase === 'post-game') updateRematchVotes(roomId);
}

function addPlayer(socket, roomId, name, requestedModeId, classId, { create = false } = {}) {
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
    classId: classId || 'SPEEDSTER',
  });
  if (!room.hostId) room.hostId = socket.id;
  socket.join(roomId);
  socket.data.roomId = roomId;
  console.log(`[join-room] ${socket.id} -> ${roomId} (${room.mode.id}, ${room.players.size}/${room.mode.capacity})`);
  emitRoomState(roomId);
}

io.on('connection', socket => {
  console.log(`[connect] ${socket.id}`);

  socket.on('host-room', ({ roomId, name, modeId, classId }) => {
    if (socket.data.roomId) {
      socket.emit('join-error', { message: 'Leave your current room before hosting another lobby.' });
      return;
    }
    addPlayer(socket, roomId, name, modeId, classId, { create: true });
  });

  socket.on('join-room', ({ roomId, name, modeId, classId }) => {
    if (socket.data.roomId && socket.data.roomId !== roomId && rooms.has(socket.data.roomId)) {
      socket.emit('confirm-join', { currentRoom: socket.data.roomId, newRoom: roomId, newModeId: modeId });
      return;
    }
    if (!socket.data.roomId) addPlayer(socket, roomId, name, modeId, classId, { create: false });
  });

  socket.on('confirm-join', ({ newRoomId, name, modeId, classId }) => {
    if (socket.data.roomId) removePlayer(socket);
    addPlayer(socket, newRoomId, name, modeId, classId, { create: false });
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

  socket.on('add-bot', (payload) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'lobby') return;
    if (room.players.size >= room.mode.capacity) return;

    const botId = 'bot-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    let team = payload?.team;
    if (!team) team = room.mode.isTeamMode ? teamForOpenSlot(room) : null;
    const requestedName = payload?.name || 'AI Bot';
    const classes = ['SPEEDSTER', 'TANK', 'SABOTEUR', 'SUPPORT'];
    const randomClass = classes[Math.floor(Math.random() * classes.length)];
    
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
      classId: randomClass,
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

  socket.on('score-event', payload => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;

    const { botId, type, lines, combo, multiplier, clientTs } = payload || {};
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || (botId && player.ownerId !== socket.id)) return;

    const now = Date.now();
    if (!botId && typeof clientTs === 'number') {
      const drift = now - clientTs;
      if (drift < -2000 || drift > 30_000) return;
    }
    if (player.lastScoreEventAt && now - player.lastScoreEventAt < 40) return;
    player.lastScoreEventAt = now;

    const points = computeScoreEvent(room, player, { type, lines, combo, multiplier });
    if (points <= 0 && type !== 'lines') return;

    const scoreCap = room.mode.id === 'battle-royale' ? 5_000_000 : 999_999;
    player.score = Math.max(0, Math.min(scoreCap, Math.floor((player.score || 0) + points)));
    
    if (type === 'lines') {
      const cleared = Math.max(0, Math.min(5, Math.floor(Number(lines) || 0)));
      player.lines = Math.max(0, Math.min(9999, (player.lines || 0) + cleared));
      player.lastClearAt = now;
    }

    if (room.mode.id === 'battle-royale' && hasReachedTarget(player.score)) {
      finishBattleRoyalMatch(roomId, 'target-score', player);
      return;
    }

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

  const handlePlayerToppedOut = ({ killerIndex, botId } = {}) => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (!room || room.phase !== 'in-game') return;
    const player = botId ? room.players.get(botId) : room.players.get(socket.id);
    if (!player || (botId && player.ownerId !== socket.id)) return;
    if (player.state !== 'playing') return;

    const currentAlive = activePlayerCount(room);

    // If active players <= 4, apply K.O. mechanism instead of elimination!
    if (room.mode.id === 'battle-royale' && isKoFloorReached(currentAlive)) {
      if (handleKnockout(roomId, botId || socket.id)) return;
    }

    // In 3v3 Team Deathmatch, topped-out players suffer -20% score penalty, enemy team gets bounty, and player reboots for 3s
    if (room.mode.isTeamMode) {
      if (handleTdmKnockout(roomId, botId || socket.id, killerIndex)) return;
    }

    // Otherwise (> 4 players remaining in elimination modes), trigger Elimination and allow Spectator / Lobby Choice
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
    } else if (room.mode.isTeamMode) {
      if (activePlayerCount(room) === 0) finishTeamMatch(roomId, 'elimination');
    } else {
      checkEliminationGameOver(roomId);
    }
    emitRoomState(roomId);
  };

  socket.on('player-eliminated', handlePlayerToppedOut);
  socket.on('player-topped-out', (payload) => handlePlayerToppedOut(payload || {}));

  socket.on('game-over', () => {
    const roomId = socket.data.roomId;
    const room = roomId && rooms.get(roomId);
    if (room?.mode.id === 'battle-royale') checkBattleRoyalGameOver(roomId);
    else if (room && !room.mode.isTeamMode) checkEliminationGameOver(roomId);
  });

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
    const socketTargetId = target.isBot ? target.ownerId : targetId;
    io.to(socketTargetId).emit('receive-garbage', { count: Math.max(1, Math.min(20, Number(count) || 0)), fromIndex: sender.index, targetIndex: target.index });
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
    if (!selectedOpponent && targetIndex !== undefined && targetIndex !== null) {
      selectedOpponent = opponents.find(([, player]) => player.index === targetIndex);
    }
    if (!selectedOpponent) selectedOpponent = opponents[0];

    const safeDuration = Math.max(0, Math.min(10_000, Number(durationMs) || 0));
    const safeAmount = Math.max(0, Math.min(20, Number(amount) || 0));

    const emitToOpponents = (eventName, dataFactory) => {
      opponents.forEach(([id, player]) => {
        const socketId = player.isBot ? player.ownerId : id;
        const payload = dataFactory(player);
        if (typeof payload === 'object' && payload !== null) payload.targetIndex = player.index;
        io.to(socketId).emit(eventName, payload);
      });
    };

    if (type === 'QUICKSILVER' || type === 'CHAOS') {
      emitToOpponents('class-effect', () => ({ type, durationMs: safeDuration }));
    } else if (type === 'ABILITY_FREEZE') {
      emitToOpponents('class-effect', () => ({ type: 'ABILITY_FREEZE', durationMs: safeDuration || 3000 }));
    } else if (type === 'SPRINT' && selectedOpponent) {
      const socketId = selectedOpponent[1].isBot ? selectedOpponent[1].ownerId : selectedOpponent[0];
      io.to(socketId).emit('class-effect', { type: 'SPRINT', amount: Math.max(1, Math.min(5, safeAmount || 3)), targetIndex: selectedOpponent[1].index });
    } else if (type === 'SCRAMBLE' && selectedOpponent) {
      const socketId = selectedOpponent[1].isBot ? selectedOpponent[1].ownerId : selectedOpponent[0];
      io.to(socketId).emit('class-effect', { type: 'SCRAMBLE', amount: Math.max(1, Math.min(5, safeAmount || 5)), targetIndex: selectedOpponent[1].index });
    } else if (type === 'GRID_SHIFT' && selectedOpponent) {
      const socketId = selectedOpponent[1].isBot ? selectedOpponent[1].ownerId : selectedOpponent[0];
      io.to(socketId).emit('class-effect', { type: 'GRID_SHIFT', direction: direction === -1 ? -1 : 1, targetIndex: selectedOpponent[1].index });
    } else if (type === 'EARTHQUAKE') {
      emitToOpponents('receive-garbage', (player) => ({ count: safeAmount || 4, fromIndex: sender.index, targetIndex: player.index }));
    } else if (type === 'RECYCLE') {
      const allies = room.mode.isTeamMode
        ? Array.from(room.players.entries()).filter(([id, player]) => id !== socket.id && player.team === sender.team && player.state === 'playing')
        : null;
      const selectedAlly = (targetIndex !== undefined && targetIndex !== null)
        ? allies?.find(([, player]) => player.index === targetIndex)
        : null;
      const targetSockId = selectedAlly ? (selectedAlly[1].isBot ? selectedAlly[1].ownerId : selectedAlly[0]) : socket.id;
      io.to(targetSockId).emit('class-effect', { type: 'RECYCLE', amount: safeAmount || 4, targetIndex: selectedAlly ? selectedAlly[1].index : sender.index });
    } else if (type === 'GUARDIAN_ANGEL') {
      const allies = room.mode.isTeamMode
        ? Array.from(room.players.entries()).filter(([id, player]) => id !== socket.id && player.team === sender.team && player.state === 'playing')
        : null;
      const selectedAlly = (targetIndex !== undefined && targetIndex !== null)
        ? allies?.find(([, player]) => player.index === targetIndex)
        : null;
      const targetSockId = selectedAlly ? (selectedAlly[1].isBot ? selectedAlly[1].ownerId : selectedAlly[0]) : socket.id;
      io.to(targetSockId).emit('class-effect', { type: 'GUARDIAN_ANGEL', amount: safeAmount || 4, targetIndex: selectedAlly ? selectedAlly[1].index : sender.index });
    } else if (selectedOpponent) {
      const targetSockId = selectedOpponent[1].isBot ? selectedOpponent[1].ownerId : selectedOpponent[0];
      io.to(targetSockId).emit('class-effect', {
        type,
        durationMs: safeDuration,
        amount: safeAmount,
        direction,
        targetIndex: selectedOpponent[1].index,
      });
    }
  });

  socket.on('broadcast-ribbon', ({ message }) => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('show-ribbon', { message });
  });

  socket.on('changeClass', ({ classId, targetId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    
    let target = null;
    if (targetId && room.hostId === socket.id) {
      target = room.players.get(targetId);
      if (target && !target.isBot) target = null;
    } else {
      target = room.players.get(socket.id);
    }
    
    if (target) {
      target.classId = classId;
      emitRoomState(roomId);
    }
  });

  socket.on('chatMessage', (msg) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      io.to(roomId).emit('chatMessage', { sender: player.name, text: msg });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    removePlayer(socket, { announceDisconnect: true });
  });
});

app.get('/', (_req, res) => res.send('Cascade multi-mode server is running.'));
httpServer.listen(PORT, () => console.log(`Cascade server listening on http://localhost:${PORT}`));
