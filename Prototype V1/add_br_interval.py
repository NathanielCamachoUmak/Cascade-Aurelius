content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_vars = "let battleRoyalPhaseEndsAt: number | null = null;  // when the NEXT phase break fires"
new_vars = """let battleRoyalPhaseEndsAt: number | null = null;  // when the NEXT phase break fires
let brHudUpdateInterval: number | null = null;"""

content = content.replace(old_vars, new_vars)

old_start = """  if (mode?.id === 'battle-royale') {
    ensureBattleRoyalHud();
    battleRoyalPhaseLabel = 'Opening battle';
    battleRoyalRemainingPlayers = playerCount;
    updateBattleRoyalHud();
  } else if (battleRoyalHud) {"""

new_start = """  if (mode?.id === 'battle-royale') {
    ensureBattleRoyalHud();
    battleRoyalPhaseLabel = 'Opening battle';
    battleRoyalRemainingPlayers = playerCount;
    updateBattleRoyalHud();
    if (brHudUpdateInterval) window.clearInterval(brHudUpdateInterval);
    brHudUpdateInterval = window.setInterval(updateBattleRoyalHud, 250);
  } else if (battleRoyalHud) {"""

content = content.replace(old_start, new_start)
open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Fixed HUD interval.")
