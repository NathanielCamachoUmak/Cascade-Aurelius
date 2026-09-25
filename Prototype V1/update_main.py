import sys
import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add new DOM elements
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
const effectsCtx = effectsCanvas?.getContext('2d');
"""

# Insert DOM elements after holdCanvasP1
content = content.replace("const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;", 
                          "const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;\n" + dom_elements)

# 2. Update `renderQueueOnMiniCanvas`
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
    
    // We want to center the 90x90 slot for this piece
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

content = content.replace("function renderPieceOnMiniCanvas", queue_fn + "\nfunction renderPieceOnMiniCanvas")

# 3. Update the UI update logic in the render loop to use `renderQueueOnMiniCanvas`
content = content.replace("renderPieceOnMiniCanvas(nextCanvasP1, p1.nextPiece, PLAYER_COLORS[myIdx] || '#00E5FF');",
                          "renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');")
content = content.replace("nextQueueP1.innerText = p1.bag.getPreview(5).join(' • ');", "") # Hide text

# And handle P2's UI! 
# We need to find where P1's UI is updated.
p1_ui_update = """
    if (p1) {
      scoreElementP1.innerText = p1.scoreManager.score.toString();
"""
# We'll just hook into the existing loop or `if (p1)` block?
# Let's write it out in the actual file replacing logic.
