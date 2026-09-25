import sys

with open('src/main.ts', 'r', encoding='utf-8') as f:
    main_ts = f.read()

effects_old = """    // Draw particles
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
    }"""

effects_new = """    // Draw particles
    for (const p of effects.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const { offX, offY, bSize } = getCanvasRectOffset(p.playerIndex);
      
      const target = isDuoFx ? effectsCanvas : canvas;
      if (!target) continue;
      const tCtx = target.getContext('2d')!;
      
      const globalX = isDuoFx ? offX + p.x : (boardLayout[p.playerIndex]?.offsetX || 0) + p.x;
      const globalY = isDuoFx ? offY + p.y : (boardLayout[p.playerIndex]?.offsetY || 0) + p.y;
      
      tCtx.save();
      if (isDuoFx) {
         // Clip to the player's side of the screen (left half for P1, right half for P2)
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
      const { offX, offY, bSize } = getCanvasRectOffset(t.playerIndex);

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
    }"""

main_ts = main_ts.replace(effects_old, effects_new)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(main_ts)

print("Fixed effects logic")
