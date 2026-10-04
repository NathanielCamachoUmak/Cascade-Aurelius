import re

with open('Server/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# BLOCK 1: Fix imports - swap getBattleRoyalPhase -> getBattleRoyalRound
# ============================================================
content = content.replace(
    "  getBattleRoyalPhase,",
    "  getBattleRoyalRound,"
)

# ============================================================
# BLOCK 2: beginRoomCountdown - auto-fill bots for battle royale
# ============================================================
old_countdown = """function beginRoomCountdown(roomId, initiatedBy = null) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'lobby' || room.players.size < 1) return false;
  if (initiatedBy && room.hostId !== initiatedBy) return false;"""

new_countdown = """function beginRoomCountdown(roomId, initiatedBy = null) {
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
  }"""

content = content.replace(old_countdown, new_countdown)

# ============================================================
# BLOCK 3: activeScoreMultiplier - use round system
# ============================================================
old_score_mult = """function activeScoreMultiplier(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let mult = phase.scoreMultiplier || 1;
  if (room.activeDynamicRule?.scoreMultiplier) mult *= room.activeDynamicRule.scoreMultiplier;
  return mult;
}"""

new_score_mult = """function activeScoreMultiplier(room) {
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let mult = round.scoreMultiplier || 1;
  if (room.activeDynamicRule?.scoreMultiplier) mult *= room.activeDynamicRule.scoreMultiplier;
  return mult;
}"""

content = content.replace(old_score_mult, new_score_mult)

# ============================================================
# BLOCK 4: activeGarbageRate - use round system
# ============================================================
old_garbage_rate = """function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let rate = phase.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  if (bracket.garbageSpeedBonus) rate += bracket.garbageSpeedBonus;
  return rate;
}"""

new_garbage_rate = """function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let rate = round.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  if (bracket.garbageSpeedBonus) rate += bracket.garbageSpeedBonus;
  return rate;
}"""

content = content.replace(old_garbage_rate, new_garbage_rate)

# ============================================================
# BLOCK 5: Replace startBattleRoyalSchedule with new round system
# ============================================================
# Find and remove old function
old_schedule_marker = "function startBattleRoyalSchedule(roomId) {"
old_schedule_end_marker = "function startTeamMatchTimer(roomId) {"

idx_start = content.find(old_schedule_marker)
idx_end = content.find(old_schedule_end_marker)

if idx_start >= 0 and idx_end > idx_start:
    old_block = content[idx_start:idx_end]
    new_block = """function emitBattleRoyalRound(roomId, round) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale') return;
  room.battleRoyalPhase = round.id;
  const alive = activePlayerCount(room);
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
  const winner = winnerOverride || survivors.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
  const rankings = rankBattleRoyalPlayers(Array.from(room.players.values())).map((p, i) => ({
    rank: i + 1,
    name: p.name || 'Player',
    score: p.score || 0,
    finalScore: p.score || 0,
    lines: p.lines || 0,
    kills: p.kills || 0,
    koCount: p.koCount || 0,
  }));
  clearTimers(room);
  resetAfterMatch(room);
  const winnerEntry = winner ? Array.from(room.players.entries()).find(([, player]) => player === winner) : null;
  io.to(roomId).emit('post-game-start', {
    winnerId: winnerEntry ? (winnerEntry[1].isBot ? winnerEntry[1].ownerId : winnerEntry[0]) : null,
    winnerName: winner ? winner.name : 'No winner',
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
  // Don't trigger during intermission
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
  room.battleRoyalPhase = round.id;

  // Emit the round start to all players (clear boards first)
  for (const [id, player] of room.players) {
    if (player.state === 'playing') {
      const socketId = player.isBot ? player.ownerId : id;
      io.to(socketId).emit('round-start'); // client clears grid
    }
  }

  emitBattleRoyalRound(roomId, round);

  // Send start garbage lines after a small delay (gives client time to clear board)
  if (round.startGarbage > 0) {
    setTimeout(() => {
      for (const [id, player] of room.players) {
        if (player.state === 'playing') {
          const socketId = player.isBot ? player.ownerId : id;
          io.to(socketId).emit('receive-garbage', { count: round.startGarbage, fromIndex: -1, targetIndex: player.index });
        }
      }
    }, 500);
  }

  // Setup round timer (only if round has a time limit)
  if (room.matchTimer) clearTimeout(room.matchTimer);
  if (round.durationMs > 0) {
    room.matchTimer = setTimeout(() => {
      endBattleRoyalRound(roomId);
    }, round.durationMs);
  }
}

function endBattleRoyalRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;

  const round = getBattleRoyalRound(room.currentRoundIndex || 0);
  if (room.matchTimer) clearTimeout(room.matchTimer);
  room.matchTimer = null;

  // Cull players: sort by score descending and eliminate those past targetSurvivors
  const alivePlayers = Array.from(room.players.entries())
    .filter(([, p]) => p.state === 'playing')
    .sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

  if (alivePlayers.length > round.targetSurvivors) {
    const toCull = alivePlayers.slice(round.targetSurvivors);
    for (const [id, player] of toCull) {
      player.state = 'spectating';
      player.eliminatedAt = Date.now();
      const socketId = player.isBot ? player.ownerId : id;
      io.to(socketId).emit('player-eliminated-prompt', {
        message: 'You did not qualify for the next round!',
        canSpectate: true,
      });
      io.to(roomId).emit('player-topped-out', { playerIndex: player.index, killerIndex: -1 });
    }
  }

  const aliveAfter = Array.from(room.players.values()).filter(p => p.state === 'playing');

  // If final round or only 1 left, finish the match
  if ((room.currentRoundIndex || 0) >= BATTLE_ROYALE_RULES.rounds.length - 1 || aliveAfter.length <= 1) {
    finishBattleRoyalMatch(roomId, 'last-survivor', aliveAfter[0] || null);
    return;
  }

  // Proceed to next round
  room.currentRoundIndex = (room.currentRoundIndex || 0) + 1;
  room.battleRoyalPhase = 'intermission';
  const nextRound = getBattleRoyalRound(room.currentRoundIndex);
  const aliveNow = activePlayerCount(room);

  io.to(roomId).emit('battle-royale-phase', {
    phase: 'intermission',
    label: `Round ${room.currentRoundIndex + 1} — ${nextRound.label}`,
    remainingPlayers: aliveNow,
    cullThreshold: 0,
    atMs: 0,
    nextAtMs: BATTLE_ROYALE_RULES.intermissionMs,
    scoreMultiplier: nextRound.scoreMultiplier,
  });

  // Schedule next round after intermission
  room.matchTimer = setTimeout(() => {
    startBattleRoyalRound(roomId);
  }, BATTLE_ROYALE_RULES.intermissionMs);
}

function startTeamMatchTimer(roomId) {"""

    content = content[:idx_start] + new_block + content[idx_end + len(old_schedule_end_marker):]
else:
    print("ERROR: Could not find startBattleRoyalSchedule or startTeamMatchTimer")

# ============================================================
# BLOCK 6: Fix startMatch - use new round system instead of old schedule
# ============================================================
old_br_start = """      if (room.mode.id === 'battle-royale') {
        room.matchEndsAt = Date.now() + BATTLE_ROYALE_RULES.durationMs;
        io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: BATTLE_ROYALE_RULES.durationMs });
        room.matchTimer = setTimeout(() => finishBattleRoyalMatch(roomId, 'time'), BATTLE_ROYALE_RULES.durationMs);
        startBattleRoyalSchedule(roomId);"""

new_br_start = """      if (room.mode.id === 'battle-royale') {
        room.currentRoundIndex = 0;
        startBattleRoyalRound(roomId);"""

if old_br_start in content:
    content = content.replace(old_br_start, new_br_start)
else:
    # Try without the old schedule call - just fix the timer portion
    content = content.replace(
        "startBattleRoyalSchedule(roomId);",
        "room.currentRoundIndex = 0;\n        startBattleRoyalRound(roomId);"
    )

# ============================================================
# BLOCK 7: Remove old checkBattleRoyalGameOver if still there
# ============================================================
old_check = """function checkBattleRoyalGameOver(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.id !== 'battle-royale') return;
  const survivors = Array.from(room.players.entries()).filter(([, player]) => player.state === 'playing');
  const winner = survivors.length === 1 ? { id: survivors[0][0], name: survivors[0][1].name } : null;
  if (winner) finishBattleRoyalMatch(roomId, 'last-survivor', survivors[0][1]);
}"""

if old_check in content:
    content = content.replace(old_check, "")

with open('Server/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done writing!")
