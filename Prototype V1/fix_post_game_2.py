content = open('Server/index.js', 'r', encoding='utf-8').read()

old_post_game = """  io.to(roomId).emit('post-game-start', {
    winnerId: winnerEntry ? (winnerEntry[1].isBot ? winnerEntry[1].ownerId : winnerEntry[0]) : null,
    winnerTeam: winner ? winner.team : null,
    teamScores: { cyan: 0, magenta: 0 },
    reason,
    modeId: room.mode.id,
    battleRoyal: true,
    rankings,
    targetScore: BATTLE_ROYALE_RULES.targetScore,
  });"""

new_post_game = """  io.to(roomId).emit('post-game-start', {
    winnerId: winnerEntry ? (winnerEntry[1].isBot ? winnerEntry[1].ownerId : winnerEntry[0]) : null,
    winnerName: winner ? winner.name : 'Draw — no survivor',
    winnerTeam: winner ? winner.team : null,
    teamScores: { cyan: 0, magenta: 0 },
    reason,
    modeId: room.mode.id,
    battleRoyal: true,
    rankings,
    targetScore: BATTLE_ROYALE_RULES.targetScore,
  });"""

content = content.replace(old_post_game, new_post_game)
open('Server/index.js', 'w', encoding='utf-8').write(content)
print("Fixed finishBattleRoyalMatch!")
