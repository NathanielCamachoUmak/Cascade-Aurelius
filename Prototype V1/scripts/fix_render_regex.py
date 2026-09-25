import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

match = re.search(r"function renderQueueOnMiniCanvas\(.*?\}\);\n  \}", ts, re.DOTALL)
if match:
    old_func = match.group(0)
    new_func = """function renderQueueOnMiniCanvas(canvasEl: HTMLCanvasElement, shapes: string[], color: string) {
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
    ts = ts.replace(old_func, new_func)
    print("Replaced renderQueueOnMiniCanvas!")
else:
    print("Could not match renderQueueOnMiniCanvas")

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)
