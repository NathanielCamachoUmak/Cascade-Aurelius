content = open('Server/index.js', 'r', encoding='utf-8').read()

old_post_game = """  io.to(roomId).emit('post-game-start', {
    winnerId: winnerEntry ? (winnerEntry[1].isBot ? winnerEntry[1].ownerId : winnerEntry[0]) : null,
    winnerTeam: winner ? winner.team : null,
    teamScores: { cyan: 0, magenta: 0 },
    reason
  });"""

new_post_game = """  io.to(roomId).emit('post-game-start', {
    winnerId: winnerEntry ? (winnerEntry[1].isBot ? winnerEntry[1].ownerId : winnerEntry[0]) : null,
    winnerName: winner ? winner.name : 'Draw — no survivor',
    winnerTeam: winner ? winner.team : null,
    teamScores: { cyan: 0, magenta: 0 },
    reason
  });"""

if old_post_game in content:
    content = content.replace(old_post_game, new_post_game)
    print("Fixed finishBattleRoyalMatch!")
else:
    print("Could not find old_post_game in Server/index.js")

old_post_game_ffa = """  io.to(roomId).emit('post-game-start', {
    winnerId: winner?.id ?? '',
    winnerName: winner?.name ?? 'Draw — no boards remaining',
    winnerTeam: winner?.team ?? null,
    teamScores: calculateTeamScores(room),
    reason
  });"""

# Actually finishBattleRoyalMatch is the only broken one probably?
open('Server/index.js', 'w', encoding='utf-8').write(content)
