import re

with open("src/lobby.ts", "r", encoding="utf-8") as f:
    content = f.read()

# 1. onRoundStart
content = content.replace("network.onMatchTimerStart = ", "network.onRoundStart = () => { gameManager.startNewRound(); };\n  network.onMatchTimerStart = ")

# 2. onBattleRoyalPhase
phase_old = """  network.onBattleRoyalPhase = (data) => {
    battleRoyalPhaseLabel = data.label;
    battleRoyalRemainingPlayers = data.remainingPlayers ?? battleRoyalRemainingPlayers;
    if (!battleRoyalStartedAt) {
      battleRoyalStartedAt = Date.now();
    }
    // data.atMs: the ms-offset of THIS phase; next phase is atMs + phase duration (server sends nextAtMs)
    battleRoyalPhaseEndsAt = data.nextAtMs ? (battleRoyalStartedAt + data.nextAtMs) : null;
    battleRoyalCullThreshold = data.cullThreshold ?? 0;
    updateBattleRoyalHud();
  };"""
phase_new = """  network.onBattleRoyalPhase = (data) => {
    battleRoyalPhaseLabel = data.label;
    battleRoyalRemainingPlayers = data.remainingPlayers ?? battleRoyalRemainingPlayers;
    battleRoyalStartedAt = Date.now();
    battleRoyalPhaseEndsAt = data.nextAtMs ? (battleRoyalStartedAt + data.nextAtMs) : null;
    battleRoyalCullThreshold = data.cullThreshold ?? 0;
    
    if (data.scoreMultiplier) {
      gameManager.players.forEach(p => p.scoreManager.globalMultiplier = data.scoreMultiplier!);
    }
    
    updateBattleRoyalHud();
  };"""
content = content.replace(phase_old, phase_new)

# 3. multTextP1
mult_p1_old = """    const multTextP1 = p1.scoreManager.scoreMultiplier > 1
      ? `MULT x${p1.scoreManager.scoreMultiplier}${p1.scoreManager.multiplierTimer > 0 ? ` (${(p1.scoreManager.multiplierTimer / 1000).toFixed(1)}s)` : ''}`
      : '';"""
mult_p1_new = """    const effectiveMultP1 = p1.scoreManager.scoreMultiplier * p1.scoreManager.globalMultiplier;
    const multTextP1 = effectiveMultP1 > 1
      ? `MULT x${effectiveMultP1}${p1.scoreManager.multiplierTimer > 0 ? ` (${(p1.scoreManager.multiplierTimer / 1000).toFixed(1)}s)` : ''}`
      : '';"""
content = content.replace(mult_p1_old, mult_p1_new)

# 4. multTextP2
mult_p2_old = """    multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1
      ? `MULT x${p2.scoreManager.scoreMultiplier}${p2.scoreManager.multiplierTimer > 0 ? ` (${(p2.scoreManager.multiplierTimer / 1000).toFixed(1)}s)` : ''}`
      : '';"""
mult_p2_new = """    const effectiveMultP2 = p2.scoreManager.scoreMultiplier * p2.scoreManager.globalMultiplier;
    multiplierElementP2.innerText = effectiveMultP2 > 1
      ? `MULT x${effectiveMultP2}${p2.scoreManager.multiplierTimer > 0 ? ` (${(p2.scoreManager.multiplierTimer / 1000).toFixed(1)}s)` : ''}`
      : '';"""
content = content.replace(mult_p2_old, mult_p2_new)

with open("src/lobby.ts", "w", encoding="utf-8") as f:
    f.write(content)
