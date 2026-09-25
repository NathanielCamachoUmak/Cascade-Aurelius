import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

old_p2_block = """    const p2 = opIdx >= 0 ? gameManager.players[opIdx] : undefined;
    if (p2) {
      scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;
      levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;
      comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
      multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';
  
      const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
      setDisplay('ability-meter-p2', 'flex');
      setDisplay('ability-meter-p2-br', 'flex');
      if (classInfo2) {
        const lbl = `R: ${classInfo2.ultimateName.toUpperCase()} ${p2.classMeter}/${classInfo2.ultimateCost}`;
        setText('ability-label-p2', lbl); setText('ability-label-p2-br', lbl);
        const wid = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
        setWidth('ability-fill-p2', wid); setWidth('ability-fill-p2-br', wid);
      }
    }"""

new_p2_block = """    const p2 = opIdx >= 0 ? gameManager.players[opIdx] : undefined;
    if (p2) {
      scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;
      levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;
      comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
      multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';
      
      renderPieceOnMiniCanvas(holdCanvasP2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
      renderQueueOnMiniCanvas(nextCanvasP2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');
  
      const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
      setDisplay('ability-meter-p2', 'flex');
      setDisplay('ability-meter-p2-br', 'flex');
      if (classInfo2) {
        const qCooldown = Math.max(0, p2.abilityCooldowns.Q);
        const eCooldown = Math.max(0, p2.abilityCooldowns.E);
        const qStatus = qCooldown > 0 ? `${(qCooldown / 1000).toFixed(1)}s` : 'READY';
        const eStatus = eCooldown > 0 ? `${(eCooldown / 1000).toFixed(1)}s` : 'READY';
        const activeSuffix = p2.activeEffectTimer > 0 ? ` · ${p2.activeEffectType} ${Math.ceil(p2.activeEffectTimer / 1000)}s` : '';
        const targetName = p2.selectedTargetIndex === null ? 'default target' : ((onlinePlayerSpecs[p2.selectedTargetIndex]?.name) ?? `P${p2.selectedTargetIndex + 1}`);
        
        setText('ability-q-label-p2', classInfo2.abilityQName.toUpperCase());
        setText('ability-q-status-p2', qStatus);
        const qEl = document.getElementById('ability-q-status-p2');
        if (qEl) qEl.className = `text-[9px] font-bold ${qCooldown > 0 ? 'text-gray-500' : 'text-neon-cyan'}`;
        
        setText('ability-e-label-p2', classInfo2.abilityEName.toUpperCase());
        setText('ability-e-status-p2', eStatus);
        const eEl = document.getElementById('ability-e-status-p2');
        if (eEl) eEl.className = `text-[9px] font-bold ${eCooldown > 0 ? 'text-gray-500' : 'text-neon-yellow'}`;

        setText('ability-label-p2', classInfo2.ultimateName.toUpperCase());
        setText('ability-r-status-p2', `${Math.round(p2.classMeter)}/${classInfo2.ultimateCost} LINES · TAB: ${targetName}${activeSuffix}`);
        const wid = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
        setWidth('ability-fill-p2', wid); setWidth('ability-fill-p2-br', wid);
        
        const rdy = document.getElementById('ability-ready-p2');
        if (rdy) rdy.classList.toggle('hidden', p2.classMeter < classInfo2.ultimateCost);
      }
    }"""

if old_p2_block in ts:
    ts = ts.replace(old_p2_block, new_p2_block)
    with open('src/main.ts', 'w', encoding='utf-8') as f:
        f.write(ts)
    print("Updated P2 block!")
else:
    print("Could not find P2 block")
