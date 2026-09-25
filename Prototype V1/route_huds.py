import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# 1. We need to get elements using a helper that sets both if they exist, or just fetch both arrays.
# It's easier to fetch both and just set innerText on whichever is not null.

helper = """
function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}
function setWidth(id: string, width: string) {
  const el = document.getElementById(id);
  if (el) el.style.width = width;
}
function setDisplay(id: string, display: 'hidden' | 'flex') {
  const el = document.getElementById(id);
  if (el) {
    if (display === 'hidden') {
      el.classList.add('hidden');
      el.classList.remove('flex');
    } else {
      el.classList.remove('hidden');
      el.classList.add('flex');
    }
  }
}
function getCanvas(id: string): HTMLCanvasElement | null {
  return document.getElementById(id) as HTMLCanvasElement | null;
}
"""
# Insert helper after the DOM elements
ts = ts.replace("const koCountP1 = document.getElementById('ko-count-p1')!;", 
                "const koCountP1 = document.getElementById('ko-count-p1')!;\n" + helper)

# P1 Stats
p1_update_old = """    if (p1) {
      scoreElementP1.innerText = `${Math.round(p1.scoreManager.score)}`;
      if (koCountP1) koCountP1.innerText = `${p1.koCount || 0}`;

      // K.O. badge + transient stamp overlay (Battle Royale only)
      const koBadge = document.getElementById('ko-count-badge-p1');
      const koCountEl = document.getElementById('ko-count-p1');
      const koDecayEl = document.getElementById('ko-decay-p1');
      const koStamp = document.getElementById('ko-stamp-overlay');
      if (koBadge && koCountEl && koDecayEl) {
        const hasKos = (p1.koCount || 0) > 0;
        koBadge.classList.toggle('hidden', !hasKos);
        if (hasKos) {
          koCountEl.innerText = `${p1.koCount}`;
          // Mirrors the server's decay formula: raw x 0.85^KOCount
          const retained = Math.round(Math.pow(0.85, p1.koCount) * 100);
          koDecayEl.innerText = `final x${(retained / 100).toFixed(2)}`;
        }
      }
      if (koStamp) {
        const stampVisible = (p1.koStampTimer || 0) > 0;
        koStamp.classList.toggle('hidden', !stampVisible);
        koStamp.classList.toggle('flex', stampVisible);
      }
      levelElementP1.innerText = `${p1.scoreManager.totalLinesCleared}`;
      comboElementP1.innerText = p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : '';
      multiplierElementP1.innerText = p1.scoreManager.scoreMultiplier > 1 ? `MULT x${p1.scoreManager.scoreMultiplier}` : '';
"""
p1_update_new = """    if (p1) {
      const scoreStr = `${Math.round(p1.scoreManager.score)}`;
      setText('score-p1', scoreStr);
      setText('score-p1-br', scoreStr);
      
      const koStr = `${p1.koCount || 0}`;
      setText('ko-count-p1', koStr);
      setText('ko-count-p1-br', koStr);

      const hasKos = (p1.koCount || 0) > 0;
      const retained = Math.round(Math.pow(0.85, p1.koCount) * 100);
      const decayStr = `final x${(retained / 100).toFixed(2)}`;
      
      ['ko-count-badge-p1', 'ko-count-badge-p1-br'].forEach(id => {
         const badge = document.getElementById(id);
         if (badge) badge.classList.toggle('hidden', !hasKos);
      });
      setText('ko-decay-p1', decayStr);
      setText('ko-decay-p1-br', decayStr);
      
      const koStamp = document.getElementById('ko-stamp-overlay');
      if (koStamp) {
        const stampVisible = (p1.koStampTimer || 0) > 0;
        koStamp.classList.toggle('hidden', !stampVisible);
        koStamp.classList.toggle('flex', stampVisible);
      }
      
      const levelStr = `${p1.scoreManager.totalLinesCleared}`;
      setText('level-p1', levelStr);
      setText('level-p1-br', levelStr);
      
      const comboStr = p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : '';
      setText('combo-p1', comboStr);
      setText('combo-p1-br', comboStr);
      
      const multStr = p1.scoreManager.scoreMultiplier > 1 ? `MULT x${p1.scoreManager.scoreMultiplier}` : '';
      setText('multiplier-p1', multStr);
      setText('multiplier-p1-br', multStr);
"""
ts = ts.replace(p1_update_old, p1_update_new)

p1_canvas_old = """      renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');
      
  
      const classInfo1 = PLAYER_CLASSES.find((c) => c.id === p1.playerClass);
      if (abilityMeterP1) abilityMeterP1.classList.remove('hidden');
      if (classInfo1) {
        abilityQLabelP1.innerText = `Q: ${classInfo1.abilityName.toUpperCase()}`;
        abilityQStatusP1.innerText = p1.cooldowns.q > 0 ? `${Math.ceil(p1.cooldowns.q)}s` : 'READY';
        abilityELabelP1.innerText = `E: ${classInfo1.ability2Name.toUpperCase()}`;
        abilityEStatusP1.innerText = p1.cooldowns.e > 0 ? `${Math.ceil(p1.cooldowns.e)}s` : 'READY';
        abilityLabelP1.innerText = `R: ${classInfo1.ultimateName.toUpperCase()}`;
        abilityRStatusP1.innerText = `${p1.classMeter}/${classInfo1.ultimateCost}`;
        abilityFillP1.style.width = `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`;
        abilityReadyP1.classList.toggle('hidden', p1.classMeter < classInfo1.ultimateCost);
      }
    }"""
p1_canvas_new = """      const holdC1 = getCanvas('hold-canvas-p1');
      if (holdC1) renderPieceOnMiniCanvas(holdC1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
      const holdC1BR = getCanvas('hold-canvas-p1-br');
      if (holdC1BR) renderPieceOnMiniCanvas(holdC1BR, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
      
      const nextC1 = getCanvas('next-canvas-p1');
      if (nextC1) renderQueueOnMiniCanvas(nextC1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');
      const nextC1BR = getCanvas('next-canvas-p1-br');
      if (nextC1BR) renderQueueOnMiniCanvas(nextC1BR, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');
      
      const classInfo1 = PLAYER_CLASSES.find((c) => c.id === p1.playerClass);
      ['ability-meter-p1', 'ability-meter-p1-br'].forEach(id => {
         const m = document.getElementById(id);
         if (m) m.classList.remove('hidden');
      });
      
      if (classInfo1) {
        const qLab = `Q: ${classInfo1.abilityName.toUpperCase()}`;
        setText('ability-q-label-p1', qLab); setText('ability-q-label-p1-br', qLab);
        
        const qStat = p1.cooldowns.q > 0 ? `${Math.ceil(p1.cooldowns.q)}s` : 'READY';
        setText('ability-q-status-p1', qStat); setText('ability-q-status-p1-br', qStat);
        
        const eLab = `E: ${classInfo1.ability2Name.toUpperCase()}`;
        setText('ability-e-label-p1', eLab); setText('ability-e-label-p1-br', eLab);
        
        const eStat = p1.cooldowns.e > 0 ? `${Math.ceil(p1.cooldowns.e)}s` : 'READY';
        setText('ability-e-status-p1', eStat); setText('ability-e-status-p1-br', eStat);
        
        const rLab = `R: ${classInfo1.ultimateName.toUpperCase()}`;
        setText('ability-label-p1', rLab); setText('ability-label-p1-br', rLab);
        
        const rStat = `${p1.classMeter}/${classInfo1.ultimateCost}`;
        setText('ability-r-status-p1', rStat); setText('ability-r-status-p1-br', rStat);
        
        const width = `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`;
        setWidth('ability-fill-p1', width); setWidth('ability-fill-p1-br', width);
        
        ['ability-ready-p1', 'ability-ready-p1-br'].forEach(id => {
           const rdy = document.getElementById(id);
           if (rdy) rdy.classList.toggle('hidden', p1.classMeter < classInfo1.ultimateCost);
        });
      }
    }"""
ts = ts.replace(p1_canvas_old, p1_canvas_new)

p2_old = """    const p2 = gameManager.players.find((_, i) => i !== myIdx);
    if (p2) {
      if (scoreElementP2) scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;
      if (koCountP2) koCountP2.innerText = `${p2.koCount || 0}`;
      if (levelElementP2) levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;
      if (comboElementP2) comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
      if (multiplierElementP2) multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';
      if (holdCanvasP2) renderPieceOnMiniCanvas(holdCanvasP2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
      if (nextCanvasP2) renderQueueOnMiniCanvas(nextCanvasP2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');
    }
"""
p2_new = """    const p2 = gameManager.players.find((_, i) => i !== myIdx);
    if (p2) {
      const scoreStr = `${Math.round(p2.scoreManager.score)}`;
      setText('score-p2', scoreStr); setText('score-p2-br', scoreStr);
      
      const koStr = `${p2.koCount || 0}`;
      setText('ko-count-p2', koStr); setText('ko-count-p2-br', koStr);
      
      const lvlStr = `${p2.scoreManager.totalLinesCleared}`;
      setText('level-p2', lvlStr); setText('level-p2-br', lvlStr);
      
      const cbStr = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
      setText('combo-p2', cbStr); setText('combo-p2-br', cbStr);
      
      const mlStr = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';
      setText('multiplier-p2', mlStr); setText('multiplier-p2-br', mlStr);
      
      const holdC2 = getCanvas('hold-canvas-p2');
      if (holdC2) renderPieceOnMiniCanvas(holdC2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
      const nextC2 = getCanvas('next-canvas-p2');
      if (nextC2) renderQueueOnMiniCanvas(nextC2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');
    }
"""
ts = ts.replace(p2_old, p2_new)

# Also fix the P2 class info that was further down
p2_class_old = """    const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
    if (abilityMeterP2) {
      abilityMeterP2.classList.remove('hidden');
      abilityMeterP2.classList.add('flex');
      if (classInfo2 && abilityLabelP2 && abilityFillP2) {
        abilityLabelP2.innerText = `R: ${classInfo2.ultimateName.toUpperCase()} ${p2.classMeter}/${classInfo2.ultimateCost}`;
        abilityFillP2.style.width = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
      }
    }
  }"""
p2_class_new = """    const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
    setDisplay('ability-meter-p2', 'flex');
    setDisplay('ability-meter-p2-br', 'flex');
    if (classInfo2) {
      const lbl = `R: ${classInfo2.ultimateName.toUpperCase()} ${p2.classMeter}/${classInfo2.ultimateCost}`;
      setText('ability-label-p2', lbl); setText('ability-label-p2-br', lbl);
      const wid = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
      setWidth('ability-fill-p2', wid); setWidth('ability-fill-p2-br', wid);
    }
  }"""
ts = ts.replace(p2_class_old, p2_class_new)

# Also in layout routing, when isDuo is false, make sure hud-p1-br is visible
routing_old = """    if (isDuo) {
      if(globalCanvasContainer) globalCanvasContainer.classList.add('hidden');
      if(globalCanvasContainer) globalCanvasContainer.classList.remove('flex');
      if(duoLayoutContainer) duoLayoutContainer.classList.remove('hidden');
      if(duoLayoutContainer) duoLayoutContainer.classList.add('flex');"""
routing_new = """    if (isDuo) {
      if(globalCanvasContainer) globalCanvasContainer.classList.add('hidden');
      if(globalCanvasContainer) globalCanvasContainer.classList.remove('flex');
      if(duoLayoutContainer) duoLayoutContainer.classList.remove('hidden');
      if(duoLayoutContainer) duoLayoutContainer.classList.add('flex');
      setDisplay('hud-p1-br', 'hidden'); setDisplay('hud-p2-br', 'hidden');"""
ts = ts.replace(routing_old, routing_new)

routing_old2 = """    } else {
      if(duoLayoutContainer) duoLayoutContainer.classList.add('hidden');
      if(duoLayoutContainer) duoLayoutContainer.classList.remove('flex');
      if(globalCanvasContainer) globalCanvasContainer.classList.remove('hidden');
      if(globalCanvasContainer) globalCanvasContainer.classList.add('flex');"""
routing_new2 = """    } else {
      if(duoLayoutContainer) duoLayoutContainer.classList.add('hidden');
      if(duoLayoutContainer) duoLayoutContainer.classList.remove('flex');
      if(globalCanvasContainer) globalCanvasContainer.classList.remove('hidden');
      if(globalCanvasContainer) globalCanvasContainer.classList.add('flex');
      setDisplay('hud-p1-br', 'flex');
      if (gameManager.players.length > 1 && !gameManager.isOnline) setDisplay('hud-p2-br', 'flex');"""
ts = ts.replace(routing_old2, routing_new2)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)

print("Updated main.ts routing")
