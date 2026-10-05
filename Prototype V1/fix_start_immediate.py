import re

content = open('Server/index.js', 'r', encoding='utf-8').read()

old_block = """  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.currentRoundIndex = 0;
      startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    } else {
      startTeamMatchTimer(roomId);
    }
  }, 5000);"""

new_block = """  if (room.mode.id === 'battle-royale') {
    room.currentRoundIndex = 0;
    startBattleRoyalRound(roomId);
    emitRoomState(roomId);
  } else {
    room.pregameTimer = setTimeout(() => {
      startTeamMatchTimer(roomId);
    }, 5000);
  }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    open('Server/index.js', 'w', encoding='utf-8').write(content)
    print("Fixed startMatch to emit BR phase immediately!")
else:
    print("Could not find startMatch block!")
