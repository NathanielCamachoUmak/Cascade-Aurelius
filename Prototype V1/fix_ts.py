import sys
import re

# 1. Fix GameManager.ts
with open('src/GameManager.ts', 'r', encoding='utf-8') as f:
    gm = f.read()

# Replace all this.particles.push({ x: ..., y: ... }) with this.particles.push({ playerIndex: pIdx, x: ..., y: ... })
# But wait, px is still used? Let's check px.
# Actually I'll just regex replace the exact block.
old_push = r"this\.particles\.push\(\{\s*x: px \+ \(Math\.random\(\) - 0\.5\) \* BLOCK_SIZE,\s*y: py \+ \(Math\.random\(\) - 0\.5\) \* BLOCK_SIZE,"
new_push = r"this.particles.push({\n            playerIndex: pIdx,\n            x: (c * BLOCK_SIZE + BLOCK_SIZE / 2) + (Math.random() - 0.5) * BLOCK_SIZE,\n            y: (row * BLOCK_SIZE + BLOCK_SIZE / 2) + (Math.random() - 0.5) * BLOCK_SIZE,"
gm = re.sub(old_push, new_push, gm)

with open('src/GameManager.ts', 'w', encoding='utf-8') as f:
    f.write(gm)
print("Fixed GameManager.ts")

# 2. Fix main.ts redeclarations
with open('src/main.ts', 'r', encoding='utf-8') as f:
    main_ts = f.read()

# Find the second set of declarations and remove them.
# The ones at line 107.
remove_block = r"const scoreElementP2 = document\.getElementById\('score-p2'\)!;\nconst levelElementP2 = document\.getElementById\('level-p2'\)!;\nconst comboElementP2 = document\.getElementById\('combo-p2'\)!;\nconst multiplierElementP2 = document\.getElementById\('multiplier-p2'\)!;\nconst abilityMeterP2 = document\.getElementById\('ability-meter-p2'\)!;\nconst abilityLabelP2 = document\.getElementById\('ability-label-p2'\)!;\nconst abilityFillP2 = document\.getElementById\('ability-fill-p2'\)!;"
main_ts = re.sub(remove_block, "", main_ts)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(main_ts)
print("Fixed main.ts")
