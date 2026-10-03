import re

with open("Server/index.js", "r", encoding="utf-8") as f:
    content = f.read()

bad_snippet = """    if (room.mode.id === 'battle-royale') {
      room.matchEndsAt = Date.now() + BATTLE_ROYALE_RULES.durationMs;
      io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: BATTLE_ROYALE_RULES.durationMs });
      room.matchTimer = setTimeout(() => finishBattleRoyalMatch(roomId, 'time'), BATTLE_ROYALE_RULES.durationMs);
      room.currentRoundIndex = 0; startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    } else {"""
good_snippet = """    if (room.mode.id === 'battle-royale') {
      room.currentRoundIndex = 0;
      startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    } else {"""
content = content.replace(bad_snippet, good_snippet)

with open("Server/index.js", "w", encoding="utf-8") as f:
    f.write(content)
