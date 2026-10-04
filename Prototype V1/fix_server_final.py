with open('Server/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ================================================================
# FIX 1: activeGarbageRate - still uses old getBattleRoyalPhase
# ================================================================
old_garbage = """function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || !room.battleRoyalStartedAt) return 1;
  const phase = getBattleRoyalPhase(Date.now() - room.battleRoyalStartedAt);
  let rate = phase.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  rate *= 1 + (bracket.garbageSpeedBonus || 0);
  return rate;
}"""

new_garbage = """function activeGarbageRate(room) {
  if (room.mode.id !== 'battle-royale' || room.currentRoundIndex === undefined) return 1;
  const round = getBattleRoyalRound(room.currentRoundIndex);
  let rate = round.garbageRate || 1;
  if (room.activeDynamicRule?.garbageRate) rate *= room.activeDynamicRule.garbageRate;
  const bracket = getDensityBracket(activePlayerCount(room));
  rate *= 1 + (bracket.garbageSpeedBonus || 0);
  return rate;
}"""

if old_garbage in content:
    content = content.replace(old_garbage, new_garbage)
    print("FIX 1: activeGarbageRate - DONE")
else:
    print("FIX 1: activeGarbageRate - NOT FOUND (checking alternate)")
    # Try to find what's there
    idx = content.find('function activeGarbageRate')
    if idx >= 0:
        print("  Found at:", idx, repr(content[idx:idx+300]))

# ================================================================
# FIX 2: emitBattleRoyalRound - ensure scoreMultiplier is included
#         and cullThreshold is "number to eliminate" not "targetSurvivors"
# ================================================================
old_emit = """function emitBattleRoyalRound(roomId, round) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale') return;
  room.battleRoyalPhase = round.id;
  io.to(roomId).emit('battle-royale-phase', {
    phase: round.id,
    label: round.label,
    remainingPlayers: activePlayerCount(room),
    cullThreshold: round.targetSurvivors,
    scoreMultiplier: round.scoreMultiplier,
    atMs: 0,
    nextAtMs: round.durationMs,
    solidGarbage: Boolean(round.solidGarbage),
  });
  emitRoomState(roomId);
}"""

new_emit = """function emitBattleRoyalRound(roomId, round) {
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
}"""

if old_emit in content:
    content = content.replace(old_emit, new_emit)
    print("FIX 2: emitBattleRoyalRound - DONE")
else:
    print("FIX 2: emitBattleRoyalRound - NOT FOUND")
    idx = content.find('function emitBattleRoyalRound')
    if idx >= 0:
        print("  Found at:", idx, repr(content[idx:idx+400]))

# ================================================================
# FIX 3: endBattleRoyalRound intermission - update emit to include
#         scoreMultiplier from next round
# ================================================================
old_inter = """  // Proceed to next round with intermission
  room.currentRoundIndex++;
  room.battleRoyalPhase = 'intermission';
  io.to(roomId).emit('battle-royale-phase', {
    phase: 'intermission',
    label: 'Intermission - Prepare for next round',
    remainingPlayers: activePlayerCount(room),
    cullThreshold: 0,
    atMs: 0,
    nextAtMs: BATTLE_ROYALE_RULES.intermissionMs,
  });"""

new_inter = """  // Proceed to next round with intermission
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
  });"""

if old_inter in content:
    content = content.replace(old_inter, new_inter)
    print("FIX 3: intermission emit - DONE")
else:
    print("FIX 3: intermission emit - NOT FOUND (may already be updated)")
    # Check what's there
    idx = content.find('Intermission - Prepare')
    if idx >= 0:
        print("  Found old text at:", idx)
    idx2 = content.find('intermission')
    if idx2 >= 0:
        print("  Found 'intermission' at:", idx2, repr(content[idx2:idx2+200]))

# ================================================================
# FIX 4: checkBattleRoyalGameOver - don't trigger during intermission
# ================================================================
old_check = """function checkBattleRoyalGameOver(roomId) {
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
}"""

new_check = """function checkBattleRoyalGameOver(roomId) {
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
}"""

if old_check in content:
    content = content.replace(old_check, new_check)
    print("FIX 4: checkBattleRoyalGameOver - DONE")
else:
    print("FIX 4: checkBattleRoyalGameOver - NOT FOUND (checking existing)")
    idx = content.find('function checkBattleRoyalGameOver')
    if idx >= 0:
        print("  Found at:", idx, repr(content[idx:idx+400]))

with open('Server/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nAll fixes complete!")
