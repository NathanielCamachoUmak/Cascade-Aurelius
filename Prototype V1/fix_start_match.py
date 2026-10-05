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

if old_start in content:
    content = content.replace(old_start, new_start)
    open('Server/index.js', 'w', encoding='utf-8').write(content)
    print("Fixed startMatch to use startBattleRoyalRound!")
else:
    print("Could not find old startMatch block!")
