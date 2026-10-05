content = open('Server/index.js', 'r', encoding='utf-8').read()
import re

old_ebr = re.search(r'function endBattleRoyalRound\(roomId\) \{.*?function startTeamMatchTimer', content, re.DOTALL).group(0)

new_ebr = """function endBattleRoyalRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode.id !== 'battle-royale' || room.phase !== 'in-game') return;
  
  const round = getBattleRoyalRound(room.currentRoundIndex || 0);
  room.battleRoyalPhase = 'intermission';
  
  if (room.matchTimer) clearTimeout(room.matchTimer);

  // 1. Cull players immediately (Visually removes their grids)
  const allMatchPlayers = Array.from(room.players.values()).filter(p => !p.brPermanentlyEliminated);
  if (allMatchPlayers.length > round.targetSurvivors) {
    const sorted = rankBattleRoyalPlayers(allMatchPlayers);
    const toCull = sorted.slice(round.targetSurvivors);
    const eliminatedIds = [];
    for (const player of toCull) {
      player.brPermanentlyEliminated = true;
      player.state = 'eliminated';
      player.eliminatedAt = Date.now();
      const entry = Array.from(room.players.entries()).find(([, p]) => p === player);
      if (entry) {
        const socketId = player.isBot ? player.ownerId : entry[0];
        eliminatedIds.push(entry[0]); // Add map key
        io.to(socketId).emit('player-eliminated-prompt', {
          message: 'You have been eliminated from the Battle Royale! You may spectate the rest of the match.',
          canSpectate: true,
        });
        io.to(roomId).emit('player-state-update', { playerId: socketId, playerIndex: player.index, state: 'eliminated' });
        io.to(roomId).emit('player-topped-out', { playerIndex: player.index, killerIndex: -1 });
      }
    }
    io.to(roomId).emit('battle-royale-cull', { eliminatedIds });
    
    // Set survivors ready to play (un-spectate them, but grids not cleared yet)
    const survivors = sorted.slice(0, round.targetSurvivors);
    for (const player of survivors) {
      if (player.state === 'spectating' || player.state === 'eliminated') {
        player.state = 'playing';
        const entry = Array.from(room.players.entries()).find(([, p]) => p === player);
        if (entry) {
          const socketId = player.isBot ? player.ownerId : entry[0];
          io.to(roomId).emit('player-state-update', { playerId: socketId, playerIndex: player.index, state: 'playing' });
        }
      }
    }
  }
  
  const alivePlayers = Array.from(room.players.values()).filter(p => p.state === 'playing');
  if ((room.currentRoundIndex || 0) >= BATTLE_ROYALE_RULES.rounds.length - 1 || alivePlayers.length <= 1) {
    finishBattleRoyalMatch(roomId, 'last-survivor', alivePlayers[0] || null);
    return;
  }
  
  room.currentRoundIndex++;
  const nextRound = getBattleRoyalRound(room.currentRoundIndex);
  io.to(roomId).emit('battle-royale-phase', {
    phase: 'intermission',
    label: `Round ${room.currentRoundIndex + 1} — ${nextRound.label}`,
    remainingPlayers: alivePlayers.length,
    cullThreshold: 0,
    atMs: 0,
    nextAtMs: 6000,
    scoreMultiplier: nextRound.scoreMultiplier,
  });
  
  // 2. Clear all boards after 3 seconds
  setTimeout(() => {
    for (const [id, player] of room.players) {
      if (player.state === 'playing') {
        const socketId = player.isBot ? player.ownerId : id;
        io.to(socketId).emit('round-start'); // client handles p.reset()
      }
    }
    
    // 3. Start Round 2 after another 3 seconds (6 seconds total)
    room.matchTimer = setTimeout(() => {
      startBattleRoyalRound(roomId);
    }, 3000);
  }, 3000);
}

function startTeamMatchTimer"""

content = content.replace(old_ebr, new_ebr)

# Also block inputs during intermission in handleMove and handleLock
old_move = """function handleMove(socket, data) {
  const room = rooms.get(socket.roomId);
  if (!room || room.phase !== 'in-game') return;"""
new_move = """function handleMove(socket, data) {
  const room = rooms.get(socket.roomId);
  if (!room || room.phase !== 'in-game' || room.battleRoyalPhase === 'intermission') return;"""
content = content.replace(old_move, new_move)

old_lock = """function handleLock(socket, data) {
  const room = rooms.get(socket.roomId);
  if (!room || room.phase !== 'in-game') return;"""
new_lock = """function handleLock(socket, data) {
  const room = rooms.get(socket.roomId);
  if (!room || room.phase !== 'in-game' || room.battleRoyalPhase === 'intermission') return;"""
content = content.replace(old_lock, new_lock)

open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Updated server for sequential intermission")
