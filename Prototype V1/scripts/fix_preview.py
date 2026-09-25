with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Fix P1 Hold/Next logic
old_p1_draw = """    renderPieceOnMiniCanvas(holdCanvasP1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
    renderQueueOnMiniCanvas(nextCanvasP1, p1.bag.getPreview(4), PLAYER_COLORS[myIdx] || '#00E5FF');
    nextQueueP1.innerText = p1.bag.getPreview(5).join(' · ');"""

new_p1_draw = """    renderPieceOnMiniCanvas(holdCanvasP1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
    const holdC1BR = document.getElementById('hold-canvas-p1-br') as HTMLCanvasElement;
    if (holdC1BR) renderPieceOnMiniCanvas(holdC1BR, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
    
    const p1Preview = p1.nextPiece ? [p1.nextPiece.type, ...p1.bag.getPreview(3)] : p1.bag.getPreview(4);
    renderQueueOnMiniCanvas(nextCanvasP1, p1Preview, PLAYER_COLORS[myIdx] || '#00E5FF');
    const nextC1BR = document.getElementById('next-canvas-p1-br') as HTMLCanvasElement;
    if (nextC1BR) renderQueueOnMiniCanvas(nextC1BR, p1Preview, PLAYER_COLORS[myIdx] || '#00E5FF');
    
    const p1PreviewText = p1.nextPiece ? [p1.nextPiece.type, ...p1.bag.getPreview(4)].join(' · ') : p1.bag.getPreview(5).join(' · ');
    nextQueueP1.innerText = p1PreviewText;
    const nextQueueP1BR = document.getElementById('next-queue-p1-br');
    if (nextQueueP1BR) nextQueueP1BR.innerText = p1PreviewText;"""

ts = ts.replace(old_p1_draw, new_p1_draw)
# Also try replacing with different bullet character if needed
ts = ts.replace(old_p1_draw.replace('·', ''), new_p1_draw)


# Fix P2 Hold/Next logic
old_p2_draw = """    const holdC2 = document.getElementById('hold-canvas-p2') as HTMLCanvasElement;
    if (holdC2) renderPieceOnMiniCanvas(holdC2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    const nextC2 = document.getElementById('next-canvas-p2') as HTMLCanvasElement;
    if (nextC2) renderQueueOnMiniCanvas(nextC2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');"""

new_p2_draw = """    const holdC2 = document.getElementById('hold-canvas-p2') as HTMLCanvasElement;
    if (holdC2) renderPieceOnMiniCanvas(holdC2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    const holdC2BR = document.getElementById('hold-canvas-p2-br') as HTMLCanvasElement;
    if (holdC2BR) renderPieceOnMiniCanvas(holdC2BR, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    
    const p2Preview = p2.nextPiece ? [p2.nextPiece.type, ...p2.bag.getPreview(3)] : p2.bag.getPreview(4);
    const nextC2 = document.getElementById('next-canvas-p2') as HTMLCanvasElement;
    if (nextC2) renderQueueOnMiniCanvas(nextC2, p2Preview, PLAYER_COLORS[1] || '#FF007F');
    const nextC2BR = document.getElementById('next-canvas-p2-br') as HTMLCanvasElement;
    if (nextC2BR) renderQueueOnMiniCanvas(nextC2BR, p2Preview, PLAYER_COLORS[1] || '#FF007F');"""

ts = ts.replace(old_p2_draw, new_p2_draw)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)

print("Updated preview queue logic to include nextPiece")
