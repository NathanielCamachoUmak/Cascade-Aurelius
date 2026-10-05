content = open('Server/index.js', 'r', encoding='utf-8').read()

old_start = """  if (room.mode.id === 'battle-royale') {
    room.currentRoundIndex = 0;
    setTimeout(() => {
      startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    }, 500);
  } else {
    room.pregameTimer = setTimeout(() => {
      startTeamMatchTimer(roomId);
    }, 5000);
  }"""

new_start = """  if (room.mode.id === 'battle-royale') {
    room.pregameTimer = setTimeout(() => {
      room.matchEndsAt = Date.now() + 90 * 1000;
      io.to(roomId).emit('match-timer-start', { endsAt: room.matchEndsAt, durationMs: 90 * 1000 });
      room.matchTimer = setTimeout(() => finishBattleRoyalMatch(roomId, 'time'), 90 * 1000);
      for (const [id, player] of room.players) {
        if (player.state === 'playing') {
          io.to(player.isBot ? player.ownerId : id).emit('round-start');
        }
      }
      emitRoomState(roomId);
    }, 5000);
  } else {
    room.pregameTimer = setTimeout(() => {
      startTeamMatchTimer(roomId);
    }, 5000);
  }"""

content = content.replace(old_start, new_start)
open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Updated startMatch for BR 90-second simple timer")
