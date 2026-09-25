import sys
import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    main_ts = f.read()

# 1. Add DOM elements
dom_elements = """
const duoLayoutContainer = document.getElementById('duo-layout-container')!;
const globalCanvasContainer = document.getElementById('canvas-container')!;
const p1Pod = document.getElementById('p1-pod')!;
const p2Pod = document.getElementById('p2-pod')!;
const boardP1 = document.getElementById('board-p1') as HTMLCanvasElement;
const boardP2 = document.getElementById('board-p2') as HTMLCanvasElement;
const holdCanvasP2 = document.getElementById('hold-canvas-p2') as HTMLCanvasElement;
const nextCanvasP2 = document.getElementById('next-canvas-p2') as HTMLCanvasElement;
const effectsCanvas = document.getElementById('effects-canvas') as HTMLCanvasElement;
const scoreElementP2 = document.getElementById('score-p2')!;
const levelElementP2 = document.getElementById('level-p2')!;
const comboElementP2 = document.getElementById('combo-p2')!;
const multiplierElementP2 = document.getElementById('multiplier-p2')!;
const koCountP2 = document.getElementById('ko-count-p2')!;
const koCountP1 = document.getElementById('ko-count-p1')!; // updated ref
"""
main_ts = main_ts.replace("const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;", 
                          "const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;\n" + dom_elements)

# Remove the old definitions of P2 stats that might conflict
main_ts = re.sub(r"const scoreElementP2 = document\.getElementById\('score-p2'\)!;\n.*const abilityFillP2 = document\.getElementById\('ability-fill-p2'\)!;\n", "", main_ts, flags=re.DOTALL)

# 2. Update Next queue rendering to draw 4 items vertically
queue_fn = """
function renderQueueOnMiniCanvas(canvasEl: HTMLCanvasElement, shapes: string[], color: string) {
  if (!canvasEl) return;
  const tCtx = canvasEl.getContext('2d')!;
  tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  
  const MINI_BLOCK_SIZE = 20;
  
  shapes.forEach((shapeType, i) => {
    const temp = new Tetromino(shapeType as any);
    const shape = temp.matrix;
    const size = shape.length;
    
    const slotY = i * 90;
    const offsetX = (90 - size * MINI_BLOCK_SIZE) / 2;
    const offsetY = slotY + (90 - size * MINI_BLOCK_SIZE) / 2;
    
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const fx = offsetX + c * MINI_BLOCK_SIZE;
          const fy = offsetY + r * MINI_BLOCK_SIZE;
          if (shapeType && BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
            tCtx.drawImage(BLOCK_SPRITES[shapeType], fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            tCtx.strokeStyle = color;
            tCtx.lineWidth = 1;
            tCtx.strokeRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          } else {
            tCtx.fillStyle = color;
            tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
          }
        }
      }
    }
  });
}
"""
main_ts = main_ts.replace("function renderPieceOnMiniCanvas", queue_fn + "\nfunction renderPieceOnMiniCanvas")

# 3. Fix render() and UI updates
# In render loop:
render_loop_old = """
    for (let i = 0; i < gameManager.players.length; i++) {
      renderPlayer(gameManager.players[i], i);
    }
"""
render_loop_new = """
    // Layout Routing
    const activeMode = gameManager.isOnline ? activeOnlineMode : null;
    const isDuo = activeMode === 'classic-pvp' || activeMode === 'solo' || activeMode === 'bots';
    if (isDuo) {
      globalCanvasContainer.classList.add('hidden');
      globalCanvasContainer.classList.remove('flex');
      duoLayoutContainer.classList.remove('hidden');
      duoLayoutContainer.classList.add('flex');
      
      p1Pod.classList.remove('hidden');
      p1Pod.classList.add('flex');
      
      if (gameManager.players.length > 1) {
        p2Pod.classList.remove('hidden');
        p2Pod.classList.add('flex');
      } else {
        p2Pod.classList.add('hidden');
        p2Pod.classList.remove('flex');
      }
      
      // Update sizes of the effects canvas
      if (effectsCanvas.width !== window.innerWidth || effectsCanvas.height !== window.innerHeight) {
         effectsCanvas.width = window.innerWidth;
         effectsCanvas.height = window.innerHeight;
      }
      const eCtx = effectsCanvas.getContext('2d')!;
      eCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
    } else {
      duoLayoutContainer.classList.add('hidden');
      duoLayoutContainer.classList.remove('flex');
      globalCanvasContainer.classList.remove('hidden');
      globalCanvasContainer.classList.add('flex');
      
      if (effectsCanvas) {
         const eCtx = effectsCanvas.getContext('2d')!;
         eCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
      }
    }

    for (let i = 0; i < gameManager.players.length; i++) {
      renderPlayer(gameManager.players[i], i, isDuo);
    }
"""
main_ts = main_ts.replace(render_loop_old, render_loop_new)

# Update renderPlayer signature and ctx logic
render_player_old = """function renderPlayer(player: Player, index: number) {
  const { blockSize, offsetX, offsetY } = boardLayout[index] ?? { blockSize: BLOCK_SIZE, offsetX: index * (COLS * BLOCK_SIZE + PADDING), offsetY: 0 };
"""
render_player_new = """function renderPlayer(player: Player, index: number, isDuo: boolean = false) {
  let targetCtx = ctx;
  let offsetX = boardLayout[index]?.offsetX ?? (index * (COLS * BLOCK_SIZE + PADDING));
  let offsetY = boardLayout[index]?.offsetY ?? 0;
  let blockSize = boardLayout[index]?.blockSize ?? BLOCK_SIZE;

  if (isDuo) {
     const domCanvas = index === 0 ? boardP1 : (index === 1 ? boardP2 : null);
     if (domCanvas) {
        targetCtx = domCanvas.getContext('2d')!;
        targetCtx.clearRect(0, 0, domCanvas.width, domCanvas.height);
        offsetX = 0;
        offsetY = 0;
     } else {
        return; // Exceeds duo layout limit
     }
  }
"""
main_ts = main_ts.replace(render_player_old, render_player_new)
main_ts = re.sub(r'ctx\.', 'targetCtx.', main_ts) # inside renderPlayer ONLY?
# Actually, global replacement of ctx. inside renderPlayer is risky if I do it via regex. Let's just do it directly.
main_ts = main_ts.replace('ctx.strokeStyle', 'targetCtx.strokeStyle')
main_ts = main_ts.replace('ctx.lineWidth', 'targetCtx.lineWidth')
main_ts = main_ts.replace('ctx.strokeRect', 'targetCtx.strokeRect')
main_ts = main_ts.replace('drawBlock(ctx, ', 'drawBlock(targetCtx, ')
main_ts = main_ts.replace('ctx.fillStyle', 'targetCtx.fillStyle')
main_ts = main_ts.replace('ctx.fillRect', 'targetCtx.fillRect')
main_ts = main_ts.replace('ctx.font', 'targetCtx.font')
main_ts = main_ts.replace('ctx.textAlign', 'targetCtx.textAlign')
main_ts = main_ts.replace('ctx.fillText', 'targetCtx.fillText')
main_ts = main_ts.replace('ctx.globalAlpha', 'targetCtx.globalAlpha')
main_ts = main_ts.replace('ctx.beginPath()', 'targetCtx.beginPath()')
main_ts = main_ts.replace('ctx.arc(', 'targetCtx.arc(')
main_ts = main_ts.replace('ctx.fill()', 'targetCtx.fill()')

# Now handle particle drawing routing in `render()`
particle_draw_old = """    // Draw line clear flashes
    for (const flash of effects.lineClearEffects) {
      const myIdx2 = gameManager.isOnline ? gameManager.myPlayerIndex : 0;
      const { blockSize, offsetX, offsetY } = boardLayout[myIdx2] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
      targetCtx.fillStyle = flash.color + Math.floor(flash.flash * 80).toString(16).padStart(2, '0');
      targetCtx.fillRect(offsetX, offsetY + flash.row * blockSize, COLS * blockSize, blockSize);
    }

    
    // Draw particles
    for (const p of effects.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      targetCtx.globalAlpha = alpha;
      targetCtx.fillStyle = p.color;
      targetCtx.beginPath();
      targetCtx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      targetCtx.fill();
    }
    targetCtx.globalAlpha = 1;
    
    // Draw combo texts
    for (const t of effects.comboTexts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      targetCtx.globalAlpha = alpha;
      targetCtx.fillStyle = t.color;
      targetCtx.font = `bold ${Math.floor(20 * (1 + (1 - alpha)))}px "Press Start 2P"`;
      targetCtx.textAlign = 'center';
      targetCtx.fillText(t.text, t.x, t.y - (1 - alpha) * 40);
    }
    targetCtx.globalAlpha = 1;"""

particle_draw_new = """
    const activeModeForFx = gameManager.isOnline ? activeOnlineMode : null;
    const isDuoFx = activeModeForFx === 'classic-pvp' || activeModeForFx === 'solo' || activeModeForFx === 'bots';
    const eCtx = effectsCanvas ? effectsCanvas.getContext('2d')! : ctx;

    // Helper to get actual screen coordinates for particles
    function getCanvasRectOffset(pIdx: number) {
      if (isDuoFx) {
         const dom = pIdx === 0 ? boardP1 : boardP2;
         if (dom) {
            const rect = dom.getBoundingClientRect();
            return { offX: rect.left, offY: rect.top, bSize: BLOCK_SIZE };
         }
      }
      const layout = boardLayout[pIdx] || { offsetX: 0, offsetY: 0, blockSize: BLOCK_SIZE };
      if (globalCanvasContainer && !isDuoFx) {
         const rect = canvas.getBoundingClientRect();
         return { offX: rect.left + layout.offsetX, offY: rect.top + layout.offsetY, bSize: layout.blockSize };
      }
      return { offX: layout.offsetX, offY: layout.offsetY, bSize: layout.blockSize };
    }

    // Draw line clear flashes
    for (const flash of effects.lineClearEffects) {
      const target = isDuoFx ? (flash.playerIndex === 0 ? boardP1 : boardP2) : canvas;
      if (!target) continue;
      const tCtx = target.getContext('2d')!;
      const lOffX = isDuoFx ? 0 : (boardLayout[flash.playerIndex]?.offsetX || 0);
      const lOffY = isDuoFx ? 0 : (boardLayout[flash.playerIndex]?.offsetY || 0);
      const bSize = isDuoFx ? BLOCK_SIZE : (boardLayout[flash.playerIndex]?.blockSize || BLOCK_SIZE);
      
      tCtx.fillStyle = flash.color + Math.floor(flash.flash * 80).toString(16).padStart(2, '0');
      tCtx.fillRect(lOffX, lOffY + flash.row * bSize, COLS * bSize, bSize);
    }

    // Draw particles
    for (const p of effects.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const { offX, offY, bSize } = getCanvasRectOffset(p.playerIndex);
      // Wait, we can draw them directly onto the player's canvas so they clip nicely and pop out into effectsCanvas!
      // Actually user said: "pop out into first layer BUT not bleed to enemy board".
      // Drawing to eCtx (global absolute canvas) WILL bleed if they travel too far.
      // If we want to strictly clip, we just draw them to the player's DOM canvas!
      // Let's draw particles on the player's canvas!
      const target = isDuoFx ? (p.playerIndex === 0 ? boardP1 : boardP2) : canvas;
      if (!target) continue;
      const tCtx = target.getContext('2d')!;
      
      const localX = isDuoFx ? p.x : (boardLayout[p.playerIndex]?.offsetX || 0) + p.x;
      const localY = isDuoFx ? p.y : (boardLayout[p.playerIndex]?.offsetY || 0) + p.y;
      
      tCtx.globalAlpha = alpha;
      tCtx.fillStyle = p.color;
      tCtx.beginPath();
      tCtx.arc(localX, localY, p.size * alpha, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.globalAlpha = 1;
    }
    
    // Draw combo texts
    for (const t of effects.comboTexts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      const target = isDuoFx ? (t.playerIndex === 0 ? boardP1 : boardP2) : canvas;
      if (!target) continue;
      const tCtx = target.getContext('2d')!;
      
      const localX = isDuoFx ? t.x : (boardLayout[t.playerIndex]?.offsetX || 0) + t.x;
      const localY = isDuoFx ? t.y : (boardLayout[t.playerIndex]?.offsetY || 0) + t.y;
      
      tCtx.globalAlpha = alpha;
      tCtx.fillStyle = t.color;
      tCtx.font = `bold ${Math.floor(20 * (1 + (1 - alpha)))}px "Press Start 2P"`;
      tCtx.textAlign = 'center';
      tCtx.fillText(t.text, localX, localY - (1 - alpha) * 40);
      tCtx.globalAlpha = 1;
    }
"""
main_ts = main_ts.replace(particle_draw_old, particle_draw_new)

# UI Updates
ui_update_p1_old = """    if (p1) {
      scoreElementP1.innerText = `${Math.round(p1.scoreManager.score)}`;"""
ui_update_p1_new = """    if (p1) {
      scoreElementP1.innerText = `${Math.round(p1.scoreManager.score)}`;
      if (koCountP1) koCountP1.innerText = `${p1.koCount || 0}`;
"""
main_ts = main_ts.replace(ui_update_p1_old, ui_update_p1_new)

main_ts = main_ts.replace("renderPieceOnMiniCanvas(nextCanvasP1, p1.nextPiece, PLAYER_COLORS[myIdx] || '#00E5FF');", 
                          "renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');")

p2_ui_update = """
    // Update UI for Player 2 (if exists)
    const p2 = gameManager.players.find((_, i) => i !== myIdx);
    if (p2 && scoreElementP2) {
      scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;
      if (koCountP2) koCountP2.innerText = `${p2.koCount || 0}`;
      levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;
      comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
      multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';
      if (holdCanvasP2) renderPieceOnMiniCanvas(holdCanvasP2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
      if (nextCanvasP2) renderQueueOnMiniCanvas(nextCanvasP2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');
    }
"""
main_ts = main_ts.replace("    // Fallback: draw HUD P2 for online multiplayer mosaic if we aren't P1/P2 exclusively", p2_ui_update + "\n    // Fallback: draw HUD P2 for online multiplayer mosaic if we aren't P1/P2 exclusively")

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(main_ts)

print("Updated main.ts")
