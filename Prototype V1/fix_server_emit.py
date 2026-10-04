content = open('Server/index.js', 'r', encoding='utf-8').read()

# 1. Fix emitBattleRoyalRound - send round info with toEliminate count (how many will be cut)
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
  // toEliminate: how many players will be cut at end of round
  const toEliminate = Math.max(0, alive - round.targetSurvivors);
  io.to(roomId).emit('battle-royale-phase', {
    phase: round.id,
    label: round.label,
    remainingPlayers: alive,
    cullThreshold: toEliminate,   // now means "X players eliminated at end"
    scoreMultiplier: round.scoreMultiplier,
    atMs: 0,
    nextAtMs: round.durationMs,   // duration of THIS round (so client counts down from this)
    solidGarbage: Boolean(round.solidGarbage),
  });
  emitRoomState(roomId);
}"""

content = content.replace(old_emit, new_emit)

# 2. Fix intermission emit - also send toEliminate for next round display
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
  const aliveNow = activePlayerCount(room);
  io.to(roomId).emit('battle-royale-phase', {
    phase: 'intermission',
    label: `ROUND ${room.currentRoundIndex} — ${nextRound.label}`,
    remainingPlayers: aliveNow,
    cullThreshold: 0,
    atMs: 0,
    nextAtMs: BATTLE_ROYALE_RULES.intermissionMs,
    scoreMultiplier: nextRound.scoreMultiplier,
  });"""

content = content.replace(old_inter, new_inter)

open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Done!")
