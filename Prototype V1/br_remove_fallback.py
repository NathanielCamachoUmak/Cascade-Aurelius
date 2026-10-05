content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_fallback = """  // BULLETPROOF FALLBACK: If the game has been running for 5+ seconds but we STILL don't have a timer, manually infer it.
  if (battleRoyalPhaseEndsAt === null && battleRoyalStartedAt && Date.now() - battleRoyalStartedAt > 5000) {
    battleRoyalPhaseEndsAt = battleRoyalStartedAt + 90000;
    battleRoyalPhaseLabel = 'Round 1 - Top 20 Qualify';
    battleRoyalCullThreshold = 10;
  }"""

new_fallback = ""

content = content.replace(old_fallback, new_fallback)
open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Removed bulletproof fallback")
