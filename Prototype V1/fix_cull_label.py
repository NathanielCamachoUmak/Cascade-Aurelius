content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_thresh = "threshEl.textContent = battleRoyalCullThreshold > 0 ? `MIN ${battleRoyalCullThreshold.toLocaleString()} PTS` : 'NO CULL YET';"
new_thresh = "threshEl.textContent = battleRoyalCullThreshold > 0 ? `${battleRoyalCullThreshold} BOTTOM PLAYERS` : 'NO CULL YET';"

if old_thresh in content:
    content = content.replace(old_thresh, new_thresh)
    print("Fixed threshold label.")
else:
    print("Could not find threshEl line.")

# Also verify the emitBattleRoyalRound bug where round-start is missing
server_content = open('Server/index.js', 'r', encoding='utf-8').read()
old_start_round = """function startBattleRoyalRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  
  if (room.currentRoundIndex === undefined) {
    room.currentRoundIndex = 0;
  }
  
  const round = getBattleRoyalRound(room.currentRoundIndex);
  room.battleRoyalStartedAt = Date.now();
  
  emitBattleRoyalRound(roomId, round);
  
  // Send start garbage"""

new_start_round = """function startBattleRoyalRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  
  if (room.currentRoundIndex === undefined) {
    room.currentRoundIndex = 0;
  }
  
  const round = getBattleRoyalRound(room.currentRoundIndex);
  room.battleRoyalStartedAt = Date.now();
  
  // Clear boards for all active players before new round
  for (const [id, player] of room.players) {
    if (player.state === 'playing') {
      const socketId = player.isBot ? player.ownerId : id;
      io.to(socketId).emit('round-start');
    }
  }

  emitBattleRoyalRound(roomId, round);
  
  // Send start garbage"""

if old_start_round in server_content:
    server_content = server_content.replace(old_start_round, new_start_round)
    print("Fixed round-start emit.")
else:
    print("Could not find startBattleRoyalRound line.")

open('src/lobby.ts', 'w', encoding='utf-8').write(content)
open('Server/index.js', 'w', encoding='utf-8').write(server_content)
