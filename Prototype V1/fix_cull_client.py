content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_cull = """  network.onBattleRoyalCull = (data) => {
    battleRoyalRemainingPlayers = data.remainingPlayers;
    battleRoyalPhaseLabel = data.reason === 'score-cull'
      ? 'Culling lowest score — tie-break lines, kills'
      : data.reason === 'line-cull'
        ? 'Culling lowest line count — tie-break score, kills'
        : 'Culling lowest kills — tie-break lines, score';
    updateBattleRoyalHud();
    // Show the dramatic cull elimination banner
    if (data.eliminated && data.eliminated.length > 0) {
      showBrCullBanner(data.eliminated, data.remainingPlayers, data.reason);
    }
  };"""

new_cull = """  network.onBattleRoyalCull = (data: any) => {
    const toRemoveIds = data.eliminatedIds || [];
    for (const player of gameManager.players) {
      if (toRemoveIds.includes(player.id)) {
        (player as any).isCulled = true;
      }
    }
    // Recompute board layout now that players are culled
    if (gameManager.players.length > 0 && gameManager.myPlayerIndex !== undefined) {
       boardLayout = computeBoardLayout(gameManager.players.length, gameManager.myPlayerIndex, activeOnlineMode);
    }
    
    // Show dramatic banner
    if (toRemoveIds.length > 0) {
       showBrCullBanner(toRemoveIds.map((id: string) => ({ name: 'Player', score: 0 })), 0, 'cull');
    }
  };"""

content = content.replace(old_cull, new_cull)

old_compute = """  const otherIndices: number[] = [];
  for (let i = 0; i < playerCount; i++) if (i !== myIndex) otherIndices.push(i);"""

new_compute = """  const otherIndices: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    if (i !== myIndex && !(gameManager.players[i] as any).isCulled) {
      otherIndices.push(i);
    }
  }"""

content = content.replace(old_compute, new_compute)

open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Updated cull logic on client")
