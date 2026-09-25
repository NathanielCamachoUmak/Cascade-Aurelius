import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Remove declaration
ts = re.sub(r"const hudP2 = document\.getElementById\('hud-p2'\)!;\s*", "", ts)

# Remove usages in startOnlineGame
start_online = """  function startOnlineGame(playerCount: number, myIndex: number, onlinePlayerSpecs: any[]) {
    AudioManager.playMusic('game');
    const mode = getSelectedOnlineMode();
    
    updateNavHighlight('nav-game');
    uiLayer.classList.add('hidden');
    gameHud.classList.remove('hidden');
    gameHud.classList.add('flex');
    spectatorBanner.classList.add('hidden');
    if (mode?.isTeamMode) {
      teamMatchStrip.classList.remove('hidden');
      updateTeamScoreHud();
    } else {
      teamMatchStrip.classList.add('hidden');
    }

    // Show P2 HUD if there are 2+ players
    if (playerCount >= 2) {
      hudP2.classList.remove('hidden');
      hudP2.classList.add('flex');
    } else {
      hudP2.classList.add('hidden');
      hudP2.classList.remove('flex');
    }"""
start_online_new = """  function startOnlineGame(playerCount: number, myIndex: number, onlinePlayerSpecs: any[]) {
    AudioManager.playMusic('game');
    const mode = getSelectedOnlineMode();
    
    updateNavHighlight('nav-game');
    uiLayer.classList.add('hidden');
    gameHud.classList.remove('hidden');
    gameHud.classList.add('flex');
    spectatorBanner.classList.add('hidden');
    if (mode?.isTeamMode) {
      teamMatchStrip.classList.remove('hidden');
      updateTeamScoreHud();
    } else {
      teamMatchStrip.classList.add('hidden');
    }"""
ts = ts.replace(start_online, start_online_new)


# Remove usages in startGame
start_game = """  function startGame(mode: 'SOLO' | 'EASY' | 'HARD') {
    AudioManager.playMusic('game');
    updateNavHighlight('nav-game');
    uiLayer.classList.add('hidden');
    gameHud.classList.remove('hidden');
    gameHud.classList.add('flex');
    teamMatchStrip.classList.add('hidden');
    
    const playerCount = mode === 'SOLO' ? 1 : 2;
    canvas.width = (COLS * BLOCK_SIZE * playerCount) + (PADDING * (playerCount - 1));
    canvas.height = ROWS * BLOCK_SIZE;
  
    if (mode === 'SOLO') {
      hudP2.classList.add('hidden');
      hudP2.classList.remove('flex');
      gameManager.initSolo(selectedClass, 5000);
    } else {
      hudP2.classList.remove('hidden');
      hudP2.classList.add('flex');
      gameManager.init1v1(mode, selectedClass, 5000);
    }"""
start_game_new = """  function startGame(mode: 'SOLO' | 'EASY' | 'HARD') {
    AudioManager.playMusic('game');
    updateNavHighlight('nav-game');
    uiLayer.classList.add('hidden');
    gameHud.classList.remove('hidden');
    gameHud.classList.add('flex');
    teamMatchStrip.classList.add('hidden');
    
    const playerCount = mode === 'SOLO' ? 1 : 2;
    canvas.width = (COLS * BLOCK_SIZE * playerCount) + (PADDING * (playerCount - 1));
    canvas.height = ROWS * BLOCK_SIZE;
  
    if (mode === 'SOLO') {
      gameManager.initSolo(selectedClass, 5000);
    } else {
      gameManager.init1v1(mode, selectedClass, 5000);
    }"""
ts = ts.replace(start_game, start_game_new)


with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)

print("Removed hudP2 references")
