import sys

with open('src/main.ts', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# 1. Insert BLOCK_SPRITES above drawBlock
for i, line in enumerate(lines):
    if line.startswith('function drawBlock('):
        block_sprites_code = [
            "const BLOCK_SPRITES: Record<string, HTMLImageElement> = {};",
            "['I', 'J', 'L', 'O', 'S', 'T', 'Z'].forEach(shape => {",
            "  const img = new Image();",
            "  img.src = `/blocks/${shape}-block.png`;",
            "  BLOCK_SPRITES[shape] = img;",
            "});",
            ""
        ]
        lines = lines[:i] + block_sprites_code + lines[i:]
        break

# Join back for string replacements
content = "\n".join(lines)

# 2. Update drawBlock signature
content = content.replace(
    "isGhost: boolean = false,\n  blockSize: number = BLOCK_SIZE\n) {",
    "isGhost: boolean = false,\n  blockSize: number = BLOCK_SIZE,\n  shapeType: string | null = null\n) {"
)

# 3. Update drawBlock body
old_body = """  targetCtx.fillStyle = '#000000';
  targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
  
  if (isSpecial === 'GARBAGE') {
    targetCtx.strokeStyle = '#555555';
    targetCtx.fillStyle = '#333333';
    targetCtx.fillRect(finalX + 2, finalY + 2, blockSize - 4, blockSize - 4);
    return;
  }

  targetCtx.strokeStyle = color;
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);

  if (isSpecial) {
    targetCtx.fillStyle = color;
    targetCtx.font = `${Math.round(blockSize * 0.67)}px "Press Start 2P"`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    const icon = getSpecialBlockLetter(isSpecial);
    targetCtx.fillText(icon, finalX + blockSize / 2, finalY + blockSize / 2 + 2);
  } else {
    targetCtx.fillStyle = color;
    targetCtx.fillRect(finalX + 6, finalY + 6, blockSize - 12, blockSize - 12);
  }"""

new_body = """  if (isSpecial === 'GARBAGE') {
    targetCtx.fillStyle = '#000000';
    targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
    targetCtx.strokeStyle = '#555555';
    targetCtx.fillStyle = '#333333';
    targetCtx.fillRect(finalX + 2, finalY + 2, blockSize - 4, blockSize - 4);
    return;
  }

  if (shapeType && BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
    targetCtx.drawImage(BLOCK_SPRITES[shapeType], finalX, finalY, blockSize, blockSize);
    
    // Colored border for player identity
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(finalX, finalY, blockSize, blockSize);
  } else {
    targetCtx.fillStyle = '#000000';
    targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
    
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);
  
    targetCtx.fillStyle = color;
    targetCtx.fillRect(finalX + 6, finalY + 6, blockSize - 12, blockSize - 12);
  }

  if (isSpecial) {
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.font = `${Math.round(blockSize * 0.67)}px "Press Start 2P"`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    const icon = getSpecialBlockLetter(isSpecial);
    targetCtx.fillText(icon, finalX + blockSize / 2, finalY + blockSize / 2 + 2);
  }"""

content = content.replace(old_body, new_body)

# 4. Update Grid draw calls
content = content.replace(
    """drawBlock(ctx, c, r, color, offsetX, offsetY, cell.type === 'GARBAGE' ? 'GARBAGE' : cell.special, false, blockSize);""",
    """drawBlock(ctx, c, r, color, offsetX, offsetY, cell.type === 'GARBAGE' ? 'GARBAGE' : cell.special, false, blockSize, cell.type);"""
)

# 5. Update Piece draw calls
content = content.replace(
    """drawBlock(ctx, player.currentPiece.x + c, ghostY + r, '#00E5FF', offsetX, offsetY, undefined, true, blockSize);""",
    """drawBlock(ctx, player.currentPiece.x + c, ghostY + r, '#00E5FF', offsetX, offsetY, undefined, true, blockSize, player.currentPiece.type);"""
)
content = content.replace(
    """drawBlock(ctx, player.currentPiece.x + c, player.currentPiece.y + r, color, offsetX, offsetY, isSpecial, false, blockSize);""",
    """drawBlock(ctx, player.currentPiece.x + c, player.currentPiece.y + r, color, offsetX, offsetY, isSpecial, false, blockSize, player.currentPiece.type);"""
)

# 6. Update renderPieceOnMiniCanvas
old_mini = """          tCtx.fillStyle = '#000000';
          tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          tCtx.strokeStyle = color;
          tCtx.lineWidth = 2;
          tCtx.strokeRect(fx+1, fy+1, MINI_BLOCK_SIZE-2, MINI_BLOCK_SIZE-2);
          
          if (specialType) {
            tCtx.fillStyle = color;
            tCtx.font = `${Math.round(MINI_BLOCK_SIZE * 0.75)}px "Press Start 2P"`;
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            const icon = getSpecialBlockLetter(specialType);
            tCtx.fillText(icon, fx + MINI_BLOCK_SIZE / 2, fy + MINI_BLOCK_SIZE / 2 + 1);
          } else {
            tCtx.fillStyle = color;
            tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
          }"""

new_mini = """          if (piece.type && BLOCK_SPRITES[piece.type] && BLOCK_SPRITES[piece.type].complete && BLOCK_SPRITES[piece.type].naturalWidth > 0) {
            tCtx.drawImage(BLOCK_SPRITES[piece.type], fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            tCtx.strokeStyle = color;
            tCtx.lineWidth = 1;
            tCtx.strokeRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          } else {
            tCtx.fillStyle = '#000000';
            tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            tCtx.strokeStyle = color;
            tCtx.lineWidth = 2;
            tCtx.strokeRect(fx+1, fy+1, MINI_BLOCK_SIZE-2, MINI_BLOCK_SIZE-2);
            
            if (!specialType) {
              tCtx.fillStyle = color;
              tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
            }
          }
          
          if (specialType) {
            tCtx.fillStyle = '#FFFFFF';
            tCtx.font = `${Math.round(MINI_BLOCK_SIZE * 0.75)}px "Press Start 2P"`;
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            const icon = getSpecialBlockLetter(specialType);
            tCtx.fillText(icon, fx + MINI_BLOCK_SIZE / 2, fy + MINI_BLOCK_SIZE / 2 + 1);
          }"""

content = content.replace(old_mini, new_mini)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("refactored properly")
