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
const koCountP1 = document.getElementById('ko-count-p1')!; 
"""
main_ts = main_ts.replace("const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;", 
                          "const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;\n" + dom_elements)

# 2. Update Next queue rendering
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

# 3. Fix render loop
render_loop_old = """    for (let i = 0; i < gameManager.players.length; i++) {
      renderPlayer(gameManager.players[i], i);
    }"""
render_loop_new = """
    // Layout Routing
    const activeMode = gameManager.isOnline ? activeOnlineMode : null;
    const isDuo = activeMode === 'classic-pvp' || activeMode === 'solo' || activeMode === 'bots';
    
    if (isDuo) {
      if(globalCanvasContainer) globalCanvasContainer.classList.add('hidden');
      if(globalCanvasContainer) globalCanvasContainer.classList.remove('flex');
      if(duoLayoutContainer) duoLayoutContainer.classList.remove('hidden');
      if(duoLayoutContainer) duoLayoutContainer.classList.add('flex');
      
      if(p1Pod) p1Pod.classList.remove('hidden');
      if(p1Pod) p1Pod.classList.add('flex');
      
      if (gameManager.players.length > 1) {
        if(p2Pod) p2Pod.classList.remove('hidden');
        if(p2Pod) p2Pod.classList.add('flex');
      } else {
        if(p2Pod) p2Pod.classList.add('hidden');
        if(p2Pod) p2Pod.classList.remove('flex');
      }
      
      // Update sizes of the effects canvas
      if (effectsCanvas) {
         if (effectsCanvas.width !== window.innerWidth || effectsCanvas.height !== window.innerHeight) {
            effectsCanvas.width = window.innerWidth;
            effectsCanvas.height = window.innerHeight;
         }
         const eCtx = effectsCanvas.getContext('2d')!;
         eCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
      }
    } else {
      if(duoLayoutContainer) duoLayoutContainer.classList.add('hidden');
      if(duoLayoutContainer) duoLayoutContainer.classList.remove('flex');
      if(globalCanvasContainer) globalCanvasContainer.classList.remove('hidden');
      if(globalCanvasContainer) globalCanvasContainer.classList.add('flex');
      
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

# 4. Refactor renderPlayer safely!
# We will just rewrite the entire function body since we know exactly what it looks like.
old_render_player = """function renderPlayer(player: Player, index: number) {
  const { blockSize, offsetX, offsetY } = boardLayout[index] ?? { blockSize: BLOCK_SIZE, offsetX: index * (COLS * BLOCK_SIZE + PADDING), offsetY: 0 };
  const playerColor = PLAYER_COLORS[index] || '#00E5FF';


  // Draw Grid background (optional faint lines)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
  }

  // Draw Player Grid Border
  ctx.strokeStyle = playerColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, COLS * blockSize, ROWS * blockSize);

  // Draw Block Matrix
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = player.grid.matrix[r][c];
      if (cell.type !== null) {
        const color = cell.type === 'GARBAGE' ? '#555555' : playerColor;
        drawBlock(ctx, c, r, color, offsetX, offsetY, cell.type === 'GARBAGE' ? 'GARBAGE' : cell.special, false, blockSize, cell.type);
      }
    }
  }

  // Draw Active Piece
  if (player.currentPiece) {
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          drawBlock(ctx, player.currentPiece.x + c, player.currentPiece.y + r, playerColor, offsetX, offsetY, player.itemManager.hasItem(player.currentPiece) ? player.currentPiece.special : false, false, blockSize, player.currentPiece.type);
        }
      }
    }
  }

  // Draw Ghost Piece
  if (ghostEnabled && player.currentPiece) {
    let ghostY = player.currentPiece.y;
    while (player.grid.isValidMove(player.currentPiece, player.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          drawBlock(ctx, player.currentPiece.x + c, ghostY + r, playerColor, offsetX, offsetY, false, true, blockSize, player.currentPiece.type);
        }
      }
    }
  }

  // Draw K.O. Flash Overlay
  if (player.isToppedOut) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.fillRect(offsetX, offsetY, COLS * blockSize, ROWS * blockSize);
  }
}"""

new_render_player = """function renderPlayer(player: Player, index: number, isDuo: boolean = false) {
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
        return; 
     }
  }
  const playerColor = PLAYER_COLORS[index] || '#00E5FF';

  // Draw Grid background (optional faint lines)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
  }

  // Draw Player Grid Border
  targetCtx.strokeStyle = playerColor;
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(offsetX, offsetY, COLS * blockSize, ROWS * blockSize);

  // Draw Block Matrix
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = player.grid.matrix[r][c];
      if (cell.type !== null) {
        const color = cell.type === 'GARBAGE' ? '#555555' : playerColor;
        drawBlock(targetCtx, c, r, color, offsetX, offsetY, cell.type === 'GARBAGE' ? 'GARBAGE' : cell.special, false, blockSize, cell.type);
      }
    }
  }

  // Draw Active Piece
  if (player.currentPiece) {
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          drawBlock(targetCtx, player.currentPiece.x + c, player.currentPiece.y + r, playerColor, offsetX, offsetY, player.itemManager.hasItem(player.currentPiece) ? player.currentPiece.special : false, false, blockSize, player.currentPiece.type);
        }
      }
    }
  }

  // Draw Ghost Piece
  if (ghostEnabled && player.currentPiece) {
    let ghostY = player.currentPiece.y;
    while (player.grid.isValidMove(player.currentPiece, player.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          drawBlock(targetCtx, player.currentPiece.x + c, ghostY + r, playerColor, offsetX, offsetY, false, true, blockSize, player.currentPiece.type);
        }
      }
    }
  }

  // Draw K.O. Flash Overlay
  if (player.isToppedOut) {
    targetCtx.fillStyle = 'rgba(255, 0, 0, 0.4)';
    targetCtx.fillRect(offsetX, offsetY, COLS * blockSize, ROWS * blockSize);
  }
}"""
main_ts = main_ts.replace(old_render_player, new_render_player)

# 5. Fix UI updates and particles!
particle_draw_old = """    // Draw line clear flashes
    for (const flash of effects.lineClearEffects) {
      const myIdx2 = gameManager.isOnline ? gameManager.myPlayerIndex : 0;
      const { blockSize, offsetX, offsetY } = boardLayout[myIdx2] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
      ctx.fillStyle = flash.color + Math.floor(flash.flash * 80).toString(16).padStart(2, '0');
      ctx.fillRect(offsetX, offsetY + flash.row * blockSize, COLS * blockSize, blockSize);
    }

    
    // Draw particles
    for (const p of effects.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw combo texts
    for (const t of effects.comboTexts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${Math.floor(20 * (1 + (1 - alpha)))}px "Press Start 2P"`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y - (1 - alpha) * 40);
    }
    ctx.globalAlpha = 1;"""

particle_draw_new = """
    const activeModeForFx = gameManager.isOnline ? activeOnlineMode : null;
    const isDuoFx = activeModeForFx === 'classic-pvp' || activeModeForFx === 'solo' || activeModeForFx === 'bots';
    const eCtx = effectsCanvas ? effectsCanvas.getContext('2d')! : ctx;

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
      const { offX, offY } = getCanvasRectOffset(p.playerIndex);
      
      const target = isDuoFx ? effectsCanvas : canvas;
      if (!target) continue;
      const tCtx = target.getContext('2d')!;
      
      const globalX = isDuoFx ? offX + p.x : (boardLayout[p.playerIndex]?.offsetX || 0) + p.x;
      const globalY = isDuoFx ? offY + p.y : (boardLayout[p.playerIndex]?.offsetY || 0) + p.y;
      
      tCtx.save();
      if (isDuoFx) {
         tCtx.beginPath();
         if (p.playerIndex === 0) {
            tCtx.rect(0, 0, target.width / 2, target.height);
         } else {
            tCtx.rect(target.width / 2, 0, target.width / 2, target.height);
         }
         tCtx.clip();
      }

      tCtx.globalAlpha = alpha;
      tCtx.fillStyle = p.color;
      tCtx.beginPath();
      tCtx.arc(globalX, globalY, p.size * alpha, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.restore();
    }
    
    // Draw combo texts
    for (const t of effects.comboTexts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      const { offX, offY } = getCanvasRectOffset(t.playerIndex);

      const target = isDuoFx ? effectsCanvas : canvas;
      if (!target) continue;
      const tCtx = target.getContext('2d')!;
      
      const globalX = isDuoFx ? offX + t.x : (boardLayout[t.playerIndex]?.offsetX || 0) + t.x;
      const globalY = isDuoFx ? offY + t.y : (boardLayout[t.playerIndex]?.offsetY || 0) + t.y;
      
      tCtx.globalAlpha = alpha;
      tCtx.fillStyle = t.color;
      tCtx.font = `bold ${Math.floor(20 * (1 + (1 - alpha)))}px "Press Start 2P"`;
      tCtx.textAlign = 'center';
      tCtx.fillText(t.text, globalX, globalY - (1 - alpha) * 40);
      tCtx.globalAlpha = 1;
    }
"""
main_ts = main_ts.replace(particle_draw_old, particle_draw_new)

ui_update_p1_old = """    if (p1) {
      scoreElementP1.innerText = `${Math.round(p1.scoreManager.score)}`;"""
ui_update_p1_new = """    if (p1) {
      scoreElementP1.innerText = `${Math.round(p1.scoreManager.score)}`;
      if (koCountP1) koCountP1.innerText = `${p1.koCount || 0}`;
"""
main_ts = main_ts.replace(ui_update_p1_old, ui_update_p1_new)

main_ts = main_ts.replace("renderPieceOnMiniCanvas(nextCanvasP1, p1.nextPiece, PLAYER_COLORS[myIdx] || '#00E5FF');", 
                          "renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');")

main_ts = main_ts.replace("nextQueueP1.innerText = p1.bag.getPreview(5).join(' • ');", "")


p2_ui_update = """
    // Update UI for Player 2 (if exists)
    const p2 = gameManager.players.find((_, i) => i !== myIdx);
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
main_ts = main_ts.replace("    // Fallback: draw HUD P2 for online multiplayer mosaic if we aren't P1/P2 exclusively", p2_ui_update + "\n    // Fallback: draw HUD P2 for online multiplayer mosaic if we aren't P1/P2 exclusively")

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(main_ts)

print("Updated main.ts perfectly!")
