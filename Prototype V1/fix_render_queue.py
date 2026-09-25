import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Make the mini canvas rendering more robust against missing sprites or undefined types
render_func_old = """function renderQueueOnMiniCanvas(canvasEl: HTMLCanvasElement, shapes: string[], color: string) {
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
            }
          }
        }
      }
    });
  }"""

render_func_new = """function renderQueueOnMiniCanvas(canvasEl: HTMLCanvasElement, shapes: string[], color: string) {
    if (!canvasEl) return;
    const tCtx = canvasEl.getContext('2d')!;
    tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    
    const MINI_BLOCK_SIZE = 20;
    
    shapes.forEach((shapeType, i) => {
      if (!shapeType) return;
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
            } else {
              // Fallback if sprite fails to load
              tCtx.fillStyle = color;
              tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            }
            tCtx.strokeStyle = color;
            tCtx.lineWidth = 1;
            tCtx.strokeRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          }
        }
      }
    });
  }"""

if render_func_old in ts:
    ts = ts.replace(render_func_old, render_func_new)
    print("Updated renderQueueOnMiniCanvas")
else:
    print("Could not find renderQueueOnMiniCanvas")

# What if p1Preview logic is STILL p1.bag.getPreview(4)? Let's force it to be 4 items!
preview_old_p1 = """const p1Preview = p1.nextPiece ? [p1.nextPiece.type, ...p1.bag.getPreview(3)] : p1.bag.getPreview(4);"""
preview_new_p1 = """const p1Preview = p1.nextPiece ? [p1.nextPiece.type, ...p1.bag.getPreview(3)] : p1.bag.getPreview(4);
    // Safety clamp to exactly 4 pieces
    while (p1Preview.length < 4) p1Preview.push(p1.bag.getPreview(1)[0]);
    p1Preview.length = 4;"""
ts = ts.replace(preview_old_p1, preview_new_p1)

preview_old_p2 = """const p2Preview = p2.nextPiece ? [p2.nextPiece.type, ...p2.bag.getPreview(3)] : p2.bag.getPreview(4);"""
preview_new_p2 = """const p2Preview = p2.nextPiece ? [p2.nextPiece.type, ...p2.bag.getPreview(3)] : p2.bag.getPreview(4);
    while (p2Preview.length < 4) p2Preview.push(p2.bag.getPreview(1)[0]);
    p2Preview.length = 4;"""
ts = ts.replace(preview_old_p2, preview_new_p2)


with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)
