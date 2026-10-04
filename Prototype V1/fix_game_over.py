content = open('Server/index.js', 'r', encoding='utf-8').read()

old_finish = """  const winnerEntry = winner ? Array.from(room.players.entries()).find(([, player]) => player === winner) : null;
  io.to(roomId).emit('game-over', {"""

new_finish = """  const winnerEntry = winner ? Array.from(room.players.entries()).find(([, player]) => player === winner) : null;
  io.to(roomId).emit('post-game-start', {"""

if old_finish in content:
    content = content.replace(old_finish, new_finish)
    open('Server/index.js', 'w', encoding='utf-8').write(content)
    print("Replaced game-over with post-game-start in finishBattleRoyalMatch!")
else:
    print("Could not find exact string to replace.")
