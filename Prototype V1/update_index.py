import re
import os

with open("Server/index.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
content = content.replace("getBattleRoyalPhase,", "getBattleRoyalRound,")

# 2. Add auto-bots logic in beginRoomCountdown
countdown_func = """function beginRoomCountdown(roomId, initiatedBy = null) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby' || room.players.size < 1) return false;
  if (initiatedBy && room.hostId !== initiatedBy) return false;"""
countdown_replacement = """function beginRoomCountdown(roomId, initiatedBy = null) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby' || room.players.size < 1) return false;
  if (initiatedBy && room.hostId !== initiatedBy) return false;

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
  }"""
content = content.replace(countdown_func, countdown_replacement)

# 3. Modify activeScoreMultiplier and activeGarbageRate
score_mult_old = """function activeScoreMultiplier(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let mult = phase.scoreMultiplier || 1;
  if (room.activeDynamicRule?.scoreMultiplier) mult *= room.activeDynamicRule.scoreMultiplier;
  return mult;
}"""
score_mult_new = """function activeScoreMultiplier(room) {
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let mult = round.scoreMultiplier || 1;
  if (room.activeDynamicRule?.scoreMultiplier) mult *= room.activeDynamicRule.scoreMultiplier;
  return mult;
}"""
content = content.replace(score_mult_old, score_mult_new)

garbage_rate_old = """function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let rate = phase.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  if (bracket.garbageSpeedBonus) rate += bracket.garbageSpeedBonus;
  return rate;
}"""
garbage_rate_new = """function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let rate = round.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  if (bracket.garbageSpeedBonus) rate += bracket.garbageSpeedBonus;
  return rate;
}"""
content = content.replace(garbage_rate_old, garbage_rate_new)

# 4. Modify startBattleRoyalSchedule and related logic
schedule_old = r"function emitBattleRoyalPhase.*?function startTeamMatchTimer\(roomId\) \{"
schedule_new = """function emitBattleRoyalRound(roomId, round) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale') return;
  room.battleRoyalPhase = round.id;
  io.to(roomId).emit('battle-royale-phase', {
    phase: round.id,
    label: round.label,
    remainingPlayers: activePlayerCount(room),
    cullThreshold: round.targetSurvivors,
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
  io.to(roomId).emit('battle-royale-phase', {
    phase: 'intermission',
    label: 'Intermission - Prepare for next round',
    remainingPlayers: activePlayerCount(room),
    cullThreshold: 0,
    atMs: 0,
    nextAtMs: BATTLE_ROYALE_RULES.intermissionMs,
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

function startTeamMatchTimer(roomId) {"""
content = re.sub(schedule_old, schedule_new, content, flags=re.DOTALL)

# Replace startBattleRoyalSchedule(roomId);
content = content.replace("startBattleRoyalSchedule(roomId);", "room.currentRoundIndex = 0; startBattleRoyalRound(roomId);")

with open("Server/index.js", "w", encoding="utf-8") as f:
    f.write(content)
