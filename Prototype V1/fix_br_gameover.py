content = open('Server/index.js', 'r', encoding='utf-8').read()

old_check = """function checkBattleRoyalGameOver(roomId) {
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

new_check = """function checkBattleRoyalGameOver(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'in-game' || room.mode.id !== 'battle-royale') return;
  const alive = Array.from(room.players.values()).filter(player => player.state === 'playing');
  if (alive.length <= 1) {
    finishBattleRoyalMatch(roomId, 'last-survivor', alive[0] || null);
  }
}"""

content = content.replace(old_check, new_check)
open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Patched checkBattleRoyalGameOver")
