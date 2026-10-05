content = open('Server/index.js', 'r', encoding='utf-8').read()

old_start = """function startBattleRoyalRound(roomId) {
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

  emitBattleRoyalRound(roomId, round);"""

new_start = """function startBattleRoyalRound(roomId) {
  try {
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
  } catch (err) {
    console.error("ERROR IN startBattleRoyalRound:", err);
  }"""

if old_start in content:
    content = content.replace(old_start, new_start)
    open('Server/index.js', 'w', encoding='utf-8').write(content)
    print("Added try/catch to startBattleRoyalRound")
else:
    print("Could not find startBattleRoyalRound to add try/catch")
