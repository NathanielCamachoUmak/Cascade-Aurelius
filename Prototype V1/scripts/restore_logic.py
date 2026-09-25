import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# 1. Update renderPlayer to support isDuo routing
old_render_player = """function renderPlayer(player: Player, index: number) {
  const { blockSize, offsetX, offsetY } = boardLayout[index] ?? { blockSize: BLOCK_SIZE, offsetX: index * (COLS * BLOCK_SIZE + PADDING), offsetY: 0 };
  const playerColor = PLAYER_COLORS[index] || '#00E5FF';"""

new_render_player = """function renderPlayer(player: Player, index: number, isDuo: boolean) {
  let { blockSize, offsetX, offsetY } = boardLayout[index] ?? { blockSize: BLOCK_SIZE, offsetX: index * (COLS * BLOCK_SIZE + PADDING), offsetY: 0 };
  const playerColor = PLAYER_COLORS[index] || '#00E5FF';
  
  let tCtx = ctx;
  if (isDuo) {
    const target = index === 0 ? document.getElementById('board-p1') as HTMLCanvasElement : document.getElementById('board-p2') as HTMLCanvasElement;
    if (target) {
      tCtx = target.getContext('2d')!;
      offsetX = 0;
      offsetY = 0;
    }
  }"""
ts = ts.replace(old_render_player, new_render_player)

# Also need to replace all `ctx.` with `tCtx.` inside renderPlayer.
# We will do this carefully using regex for the body of renderPlayer.
render_player_body_match = re.search(r"(function renderPlayer\(.*?\).*?)\nfunction render\(\)", ts, re.DOTALL)
if render_player_body_match:
    body = render_player_body_match.group(1)
    new_body = re.sub(r"\bctx\.", "tCtx.", body)
    ts = ts.replace(body, new_body)

# 2. Update render() to compute isDuo and route containers
old_render_start = """function render() {
  if (gameManager.state === GameState.MAIN_MENU) return;

  // Clear main canvas
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const myIdxForLayout = gameManager.isOnline ? gameManager.myPlayerIndex : -1;
  boardLayout = computeBoardLayout(gameManager.players.length, myIdxForLayout, gameManager.isOnline ? activeOnlineMode : null);

  for (let i = 0; i < gameManager.players.length; i++) {
    renderPlayer(gameManager.players[i], i);
  }"""

new_render_start = """function render() {
  if (gameManager.state === GameState.MAIN_MENU) return;

  const activeMode = gameManager.isOnline ? activeOnlineMode : null;
  const isDuo = !gameManager.isOnline || activeMode === 'classic-pvp' || activeMode === 'solo' || activeMode === 'bots';
  
  if (isDuo) {
    setDisplay('canvas-container', 'hidden');
    setDisplay('duo-layout-container', 'flex');
    setDisplay('hud-p1-br', 'hidden'); 
    setDisplay('hud-p2-br', 'hidden');
    
    if (gameManager.players.length > 1) {
      setDisplay('p2-pod', 'flex');
    } else {
      setDisplay('p2-pod', 'hidden');
    }
    
    // Clear mini canvases
    const b1 = document.getElementById('board-p1') as HTMLCanvasElement;
    if (b1) b1.getContext('2d')!.clearRect(0, 0, b1.width, b1.height);
    const b2 = document.getElementById('board-p2') as HTMLCanvasElement;
    if (b2) b2.getContext('2d')!.clearRect(0, 0, b2.width, b2.height);
  } else {
    setDisplay('duo-layout-container', 'hidden');
    setDisplay('canvas-container', 'flex');
    setDisplay('hud-p1-br', 'flex');
    if (gameManager.players.length > 1 && !gameManager.isOnline) setDisplay('hud-p2-br', 'flex');
  }

  // Clear main canvas (used by BR/fallback)
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const myIdxForLayout = gameManager.isOnline ? gameManager.myPlayerIndex : -1;
  boardLayout = computeBoardLayout(gameManager.players.length, myIdxForLayout, gameManager.isOnline ? activeOnlineMode : null);

  for (let i = 0; i < gameManager.players.length; i++) {
    renderPlayer(gameManager.players[i], i, isDuo);
  }"""
ts = ts.replace(old_render_start, new_render_start)

# Now, wait! I also need to render effects onto `effectsCanvas` if we are in Duo mode!
# I previously did that in `update_main.py`!
# Let's see if the user also deleted my `effectsCanvas` logic!
# I can just re-apply the effectsCanvas logic to `render()`.
effects_old = """  // Render visual effects
  const effects = gameManager.getEffects();

  // Draw line clear flashes
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
    ctx.font = `bold ${t.size}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Glow effect
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 20;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur = 0;
  }"""

effects_new = """  // Render visual effects
  const effects = gameManager.getEffects();
  const eCanvas = document.getElementById('effects-canvas') as HTMLCanvasElement;
  let eCtx = ctx;
  if (isDuo && eCanvas) {
      eCtx = eCanvas.getContext('2d')!;
      eCtx.clearRect(0, 0, eCanvas.width, eCanvas.height);
  }

  function getCanvasRectOffset(pIdx: number) {
      if (!isDuo) return { x: 0, y: 0 };
      const targetId = pIdx === 0 ? 'board-p1' : 'board-p2';
      const el = document.getElementById(targetId);
      const container = document.getElementById('effects-canvas');
      if (el && container) {
          const rect = el.getBoundingClientRect();
          const contRect = container.getBoundingClientRect();
          return { x: rect.left - contRect.left, y: rect.top - contRect.top };
      }
      return { x: 0, y: 0 };
  }

  // Draw line clear flashes
  for (const flash of effects.lineClearEffects) {
    const pIdx = (flash as any).playerIndex ?? 0;
    const { blockSize, offsetX, offsetY } = boardLayout[pIdx] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
    const rectOffset = getCanvasRectOffset(pIdx);
    
    const targetCtx = isDuo ? eCtx : ctx;
    const finalX = isDuo ? rectOffset.x : offsetX;
    const finalY = isDuo ? rectOffset.y : offsetY;
    
    targetCtx.fillStyle = flash.color + Math.floor(flash.flash * 80).toString(16).padStart(2, '0');
    targetCtx.fillRect(finalX, finalY + flash.row * blockSize, COLS * blockSize, blockSize);
  }

  // Draw particles
  for (const p of effects.particles) {
    const pIdx = (p as any).playerIndex ?? 0;
    const rectOffset = getCanvasRectOffset(pIdx);
    const { offsetX, offsetY } = boardLayout[pIdx] ?? { offsetX: 0, offsetY: 0 };
    
    const targetCtx = isDuo ? eCtx : ctx;
    const finalX = isDuo ? (p.x - offsetX + rectOffset.x) : p.x;
    const finalY = isDuo ? (p.y - offsetY + rectOffset.y) : p.y;

    const alpha = Math.max(0, p.life / p.maxLife);
    targetCtx.globalAlpha = alpha;
    targetCtx.fillStyle = p.color;
    targetCtx.beginPath();
    targetCtx.arc(finalX, finalY, p.size * alpha, 0, Math.PI * 2);
    targetCtx.fill();
  }
  if(isDuo) eCtx.globalAlpha = 1;
  ctx.globalAlpha = 1;
  
  // Draw combo texts
  for (const t of effects.comboTexts) {
    const pIdx = (t as any).playerIndex ?? 0;
    const rectOffset = getCanvasRectOffset(pIdx);
    const { offsetX, offsetY } = boardLayout[pIdx] ?? { offsetX: 0, offsetY: 0 };
    
    const targetCtx = isDuo ? eCtx : ctx;
    const finalX = isDuo ? (t.x - offsetX + rectOffset.x) : t.x;
    const finalY = isDuo ? (t.y - offsetY + rectOffset.y) : t.y;

    const alpha = Math.max(0, t.life / t.maxLife);
    targetCtx.globalAlpha = alpha;
    targetCtx.fillStyle = t.color;
    targetCtx.font = `bold ${t.size}px "Press Start 2P"`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    
    targetCtx.shadowColor = t.color;
    targetCtx.shadowBlur = 20;
    targetCtx.fillText(t.text, finalX, finalY);
    targetCtx.shadowBlur = 0;
  }"""
ts = ts.replace(effects_old, effects_new)


with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)

print("Restored missing logic in main.ts!")
