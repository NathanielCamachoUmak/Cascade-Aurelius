import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Fix isDuo
ts = re.sub(
    r"const isDuo = activeMode === 'classic-pvp' \|\| activeMode === 'solo' \|\| activeMode === 'bots';",
    "const isDuo = !gameManager.isOnline || activeMode === 'classic-pvp' || activeMode === 'solo' || activeMode === 'bots';",
    ts
)

# Fix routing (isDuo block)
routing_match = re.search(r"if \(isDuo\) \{.*?if\s*\(duoLayoutContainer\)\s*duoLayoutContainer\.classList\.add\('flex'\);", ts, re.DOTALL)
if routing_match:
    old_r = routing_match.group(0)
    new_r = old_r + "\n      setDisplay('hud-p1-br', 'hidden'); setDisplay('hud-p2-br', 'hidden');"
    ts = ts.replace(old_r, new_r)

routing_match2 = re.search(r"\} else \{.*?if\s*\(globalCanvasContainer\)\s*globalCanvasContainer\.classList\.add\('flex'\);", ts, re.DOTALL)
if routing_match2:
    old_r = routing_match2.group(0)
    new_r = old_r + "\n      setDisplay('hud-p1-br', 'flex');\n      if (gameManager.players.length > 1 && !gameManager.isOnline) setDisplay('hud-p2-br', 'flex');"
    ts = ts.replace(old_r, new_r)


# Fix P1 stats update
# Find: if (p1) { ... scoreElementP1.innerText ... multiplierElementP1.innerText ... renderQueueOnMiniCanvas ...
# It's easier to just use regex to replace specific innerText assignments
def rep_stat(match):
    el = match.group(1)
    prop = match.group(2)
    val = match.group(3)
    if 'style.width' in match.group(0):
        return f"setWidth('{el}', {val}); setWidth('{el}-br', {val});"
    elif 'innerText' in match.group(0):
        return f"setText('{el}', {val}); setText('{el}-br', {val});"
    return match.group(0)

# Replace all occurrences in main.ts of:
# if (koCountP1) koCountP1.innerText = `${p1.koCount || 0}`; -> setText('ko-count-p1', `${p1.koCount || 0}`); setText('ko-count-p1-br', `${p1.koCount || 0}`);
# Let's just do targeted replacements.

ts = ts.replace("scoreElementP1.innerText =", "setText('score-p1', ").replace("`${Math.round(p1.scoreManager.score)}`;", "`${Math.round(p1.scoreManager.score)}`); setText('score-p1-br', `${Math.round(p1.scoreManager.score)}`);", 1)

# koCountP1
ts = ts.replace("if (koCountP1) koCountP1.innerText = `${p1.koCount || 0}`;", "setText('ko-count-p1', `${p1.koCount || 0}`); setText('ko-count-p1-br', `${p1.koCount || 0}`);")

# koBadge toggles
ts = re.sub(r"koBadge\.classList\.toggle\('hidden', !hasKos\);", r"['ko-count-badge-p1', 'ko-count-badge-p1-br'].forEach(id => { let b = document.getElementById(id); if (b) b.classList.toggle('hidden', !hasKos); });", ts)

ts = ts.replace("koCountEl.innerText = `${p1.koCount}`;", "setText('ko-count-p1', `${p1.koCount}`); setText('ko-count-p1-br', `${p1.koCount}`);")
ts = ts.replace("koDecayEl.innerText = `final x${(retained / 100).toFixed(2)}`;", "setText('ko-decay-p1', `final x${(retained / 100).toFixed(2)}`); setText('ko-decay-p1-br', `final x${(retained / 100).toFixed(2)}`);")

# P1 stats
ts = ts.replace("levelElementP1.innerText = `${p1.scoreManager.totalLinesCleared}`;", "setText('level-p1', `${p1.scoreManager.totalLinesCleared}`); setText('level-p1-br', `${p1.scoreManager.totalLinesCleared}`);")
ts = ts.replace("comboElementP1.innerText = p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : '';", "setText('combo-p1', p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : ''); setText('combo-p1-br', p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : '');")
ts = ts.replace("multiplierElementP1.innerText = p1.scoreManager.scoreMultiplier > 1 ? `MULT x${p1.scoreManager.scoreMultiplier}` : '';", "setText('multiplier-p1', p1.scoreManager.scoreMultiplier > 1 ? `MULT x${p1.scoreManager.scoreMultiplier}` : ''); setText('multiplier-p1-br', p1.scoreManager.scoreMultiplier > 1 ? `MULT x${p1.scoreManager.scoreMultiplier}` : '');")

# P1 hold canvas
ts = ts.replace("if (holdCanvasP1) renderPieceOnMiniCanvas(holdCanvasP1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');",
"""      if (holdCanvasP1) renderPieceOnMiniCanvas(holdCanvasP1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
      const holdC1BR = getCanvas('hold-canvas-p1-br');
      if (holdC1BR) renderPieceOnMiniCanvas(holdC1BR, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');""")

# P1 next canvas
ts = ts.replace("if (nextCanvasP1) renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');",
"""      if (nextCanvasP1) renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');
      const nextC1BR = getCanvas('next-canvas-p1-br');
      if (nextC1BR) renderQueueOnMiniCanvas(nextC1BR, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');""")

# P1 Ability Meter
ts = ts.replace("if (abilityMeterP1) abilityMeterP1.classList.remove('hidden');", 
"['ability-meter-p1', 'ability-meter-p1-br'].forEach(id => { const m = document.getElementById(id); if (m) m.classList.remove('hidden'); });")

ts = ts.replace("abilityQLabelP1.innerText = `Q: ${classInfo1.abilityName.toUpperCase()}`;", "setText('ability-q-label-p1', `Q: ${classInfo1.abilityName.toUpperCase()}`); setText('ability-q-label-p1-br', `Q: ${classInfo1.abilityName.toUpperCase()}`);")
ts = ts.replace("abilityQStatusP1.innerText = p1.cooldowns.q > 0 ? `${Math.ceil(p1.cooldowns.q)}s` : 'READY';", "setText('ability-q-status-p1', p1.cooldowns.q > 0 ? `${Math.ceil(p1.cooldowns.q)}s` : 'READY'); setText('ability-q-status-p1-br', p1.cooldowns.q > 0 ? `${Math.ceil(p1.cooldowns.q)}s` : 'READY');")

ts = ts.replace("abilityELabelP1.innerText = `E: ${classInfo1.ability2Name.toUpperCase()}`;", "setText('ability-e-label-p1', `E: ${classInfo1.ability2Name.toUpperCase()}`); setText('ability-e-label-p1-br', `E: ${classInfo1.ability2Name.toUpperCase()}`);")
ts = ts.replace("abilityEStatusP1.innerText = p1.cooldowns.e > 0 ? `${Math.ceil(p1.cooldowns.e)}s` : 'READY';", "setText('ability-e-status-p1', p1.cooldowns.e > 0 ? `${Math.ceil(p1.cooldowns.e)}s` : 'READY'); setText('ability-e-status-p1-br', p1.cooldowns.e > 0 ? `${Math.ceil(p1.cooldowns.e)}s` : 'READY');")

ts = ts.replace("abilityLabelP1.innerText = `R: ${classInfo1.ultimateName.toUpperCase()}`;", "setText('ability-label-p1', `R: ${classInfo1.ultimateName.toUpperCase()}`); setText('ability-label-p1-br', `R: ${classInfo1.ultimateName.toUpperCase()}`);")
ts = ts.replace("abilityRStatusP1.innerText = `${p1.classMeter}/${classInfo1.ultimateCost}`;", "setText('ability-r-status-p1', `${p1.classMeter}/${classInfo1.ultimateCost}`); setText('ability-r-status-p1-br', `${p1.classMeter}/${classInfo1.ultimateCost}`);")
ts = ts.replace("abilityFillP1.style.width = `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`;", "setWidth('ability-fill-p1', `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`); setWidth('ability-fill-p1-br', `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`);")
ts = ts.replace("if (abilityReadyP1) abilityReadyP1.classList.toggle('hidden', p1.classMeter < classInfo1.ultimateCost);", "['ability-ready-p1', 'ability-ready-p1-br'].forEach(id => { const rdy = document.getElementById(id); if (rdy) rdy.classList.toggle('hidden', p1.classMeter < classInfo1.ultimateCost); });")


# P2 Updates
ts = ts.replace("if (scoreElementP2) scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;", "setText('score-p2', `${Math.round(p2.scoreManager.score)}`); setText('score-p2-br', `${Math.round(p2.scoreManager.score)}`);")
ts = ts.replace("if (koCountP2) koCountP2.innerText = `${p2.koCount || 0}`;", "setText('ko-count-p2', `${p2.koCount || 0}`); setText('ko-count-p2-br', `${p2.koCount || 0}`);")
ts = ts.replace("if (levelElementP2) levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;", "setText('level-p2', `${p2.scoreManager.totalLinesCleared}`); setText('level-p2-br', `${p2.scoreManager.totalLinesCleared}`);")
ts = ts.replace("if (comboElementP2) comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';", "setText('combo-p2', p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : ''); setText('combo-p2-br', p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '');")
ts = ts.replace("if (multiplierElementP2) multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';", "setText('multiplier-p2', p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : ''); setText('multiplier-p2-br', p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '');")

ts = ts.replace("if (holdCanvasP2) renderPieceOnMiniCanvas(holdCanvasP2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');",
"""      if (holdCanvasP2) renderPieceOnMiniCanvas(holdCanvasP2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
      const holdC2BR = getCanvas('hold-canvas-p2-br');
      if (holdC2BR) renderPieceOnMiniCanvas(holdC2BR, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');""")

ts = ts.replace("if (nextCanvasP2) renderQueueOnMiniCanvas(nextCanvasP2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');",
"""      if (nextCanvasP2) renderQueueOnMiniCanvas(nextCanvasP2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');
      const nextC2BR = getCanvas('next-canvas-p2-br');
      if (nextC2BR) renderQueueOnMiniCanvas(nextC2BR, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');""")

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)

print("Targeted replacements done!")
