content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_state = """  network.onPlayerStateUpdate = (data) => {
    if (data.playerId === network?.mySocketId && data.state === 'spectating') {
      spectatorBanner.classList.remove('hidden');
    }
  };"""

new_state = """  network.onPlayerStateUpdate = (data) => {
    if (data.playerId === network?.mySocketId && data.state === 'spectating') {
      spectatorBanner.classList.remove('hidden');
    }
    if (data.remainingPlayers !== undefined) {
      battleRoyalRemainingPlayers = data.remainingPlayers;
      if (activeOnlineMode === 'battle-royale') updateBattleRoyalHud();
    }
  };"""

if old_state in content:
    content = content.replace(old_state, new_state)
    open('src/lobby.ts', 'w', encoding='utf-8').write(content)
    print("Fixed onPlayerStateUpdate to update BR remaining players!")
else:
    print("Could not find onPlayerStateUpdate block!")
