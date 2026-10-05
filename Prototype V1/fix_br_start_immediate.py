content = open('Server/index.js', 'r', encoding='utf-8').read()

old_start = """  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.currentRoundIndex = 0;
      startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    } else {
      startTeamMatchTimer(roomId);
    }
  }, 5000);"""

new_start = """  if (room.mode.id === 'battle-royale') {
    room.currentRoundIndex = 0;
    startBattleRoyalRound(roomId);
    emitRoomState(roomId);
  } else {
    room.pregameTimer = setTimeout(() => {
      startTeamMatchTimer(roomId);
    }, 5000);
  }"""

if old_start in content:
    content = content.replace(old_start, new_start)
    open('Server/index.js', 'w', encoding='utf-8').write(content)
    print("Modified startMatch to start BR round immediately!")
else:
    print("Could not find startMatch timer block!")
