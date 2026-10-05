import re

content = open('Server/index.js', 'r', encoding='utf-8').read()

old_start = """  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.matchEndsAt = Date.now() + BATTLE_ROYALE_RULES.durationMs;
      io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: BATTLE_ROYALE_RULES.durationMs });
      room.matchTimer = setTimeout(() => finishBattleRoyalMatch(roomId, 'time'), BATTLE_ROYALE_RULES.durationMs);
      startBattleRoyalSchedule(roomId);
      emitRoomState(roomId);
    } else {
      startTeamMatchTimer(roomId);
    }
  }, 5000);"""

new_start = """  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.currentRoundIndex = 0;
      startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    } else {
      startTeamMatchTimer(roomId);
    }
  }, 5000);"""

content = content.replace(old_start, new_start)

# Delete startBattleRoyalSchedule safely
content = re.sub(
    r'function startBattleRoyalSchedule.*?emitRoomState\(roomId\);\n}',
    '',
    content,
    flags=re.DOTALL
)

open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Fixed Server/index.js")
