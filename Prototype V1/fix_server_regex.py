import re

content = open('Server/index.js', 'r', encoding='utf-8').read()

# Replace the block
new_block = """  room.pregameTimer = setTimeout(() => {
    if (room.mode.id === 'battle-royale') {
      room.currentRoundIndex = 0;
      startBattleRoyalRound(roomId);
      emitRoomState(roomId);
    } else {
      startTeamMatchTimer(roomId);
    }
  }, 5000);"""

content = re.sub(
    r'  room\.pregameTimer = setTimeout\(\(\) => \{.*?startTeamMatchTimer\(roomId\);\n    \}\n  \}, 5000\);',
    new_block,
    content,
    flags=re.DOTALL
)

# Delete startBattleRoyalSchedule safely
content = re.sub(
    r'function startBattleRoyalSchedule.*?emitRoomState\(roomId\);\n}',
    '',
    content,
    flags=re.DOTALL
)

open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Regex replaced Server/index.js")
