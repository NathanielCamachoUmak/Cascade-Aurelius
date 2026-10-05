content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_canvas_hud = """    // Phase countdown
    if (battleRoyalPhaseEndsAt && battleRoyalPhaseEndsAt > Date.now()) {
      const secLeft = Math.ceil((battleRoyalPhaseEndsAt - Date.now()) / 1000);
      const m = Math.floor(secLeft / 60);
      const s = secLeft % 60;
      const timeStr = `${m}:${String(s).padStart(2, '0')}`;
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillStyle = secLeft <= 10 ? '#FF5252' : '#FFFFFF';
      ctx.fillText(timeStr, stripW / 2 - 20, cy);
    } else if (battleRoyalPhaseEndsAt === null && battleRoyalStartedAt) {
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('—', stripW / 2 - 10, cy);
    } else if (battleRoyalPhaseEndsAt && battleRoyalPhaseEndsAt <= Date.now()) {
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('FINAL', stripW / 2 - 25, cy);
    }"""

new_canvas_hud = """    // Phase countdown
    if (battleRoyalPhaseEndsAt && battleRoyalPhaseEndsAt > Date.now()) {
      const secLeft = Math.ceil((battleRoyalPhaseEndsAt - Date.now()) / 1000);
      const m = Math.floor(secLeft / 60);
      const s = secLeft % 60;
      const timeStr = `${m}:${String(s).padStart(2, '0')}`;
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillStyle = secLeft <= 10 ? '#FF5252' : '#FFFFFF';
      ctx.fillText(timeStr, stripW / 2 - 20, cy);
    } else if (battleRoyalPhaseEndsAt === null && battleRoyalStartedAt) {
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('—', stripW / 2 - 10, cy);
    } else if (battleRoyalPhaseEndsAt && battleRoyalPhaseEndsAt <= Date.now()) {
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('FINAL', stripW / 2 - 25, cy);
    }"""

# Actually, the fallback logic I added in updateBattleRoyalHud() sets battleRoyalPhaseEndsAt
# to a non-null value globally, so the canvas code will automatically pick it up!
# No need to change the canvas code.
