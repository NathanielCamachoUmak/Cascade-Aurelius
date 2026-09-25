import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Replace P1 block using regex
match = re.search(r"    renderPieceOnMiniCanvas\(holdCanvasP1.*?nextQueueP1\.innerText = .*?;\n", ts, re.DOTALL)
if match:
    old_p1_draw = match.group(0)
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
    if (nextQueueP1BR) nextQueueP1BR.innerText = p1PreviewText;
"""
    ts = ts.replace(old_p1_draw, new_p1_draw)
    print("Replaced P1 preview block!")
else:
    print("Could not match P1 preview block!")

# Replace P2 block using regex
match_p2 = re.search(r"    const holdC2 = document\.getElementById\('hold-canvas-p2'\) as HTMLCanvasElement;.*?PLAYER_COLORS\[1\] \|\| '#FF007F'\);\n", ts, re.DOTALL)
if match_p2:
    old_p2_draw = match_p2.group(0)
    new_p2_draw = """    const holdC2 = document.getElementById('hold-canvas-p2') as HTMLCanvasElement;
    if (holdC2) renderPieceOnMiniCanvas(holdC2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    const holdC2BR = document.getElementById('hold-canvas-p2-br') as HTMLCanvasElement;
    if (holdC2BR) renderPieceOnMiniCanvas(holdC2BR, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    
    const p2Preview = p2.nextPiece ? [p2.nextPiece.type, ...p2.bag.getPreview(3)] : p2.bag.getPreview(4);
    const nextC2 = document.getElementById('next-canvas-p2') as HTMLCanvasElement;
    if (nextC2) renderQueueOnMiniCanvas(nextC2, p2Preview, PLAYER_COLORS[1] || '#FF007F');
    const nextC2BR = document.getElementById('next-canvas-p2-br') as HTMLCanvasElement;
    if (nextC2BR) renderQueueOnMiniCanvas(nextC2BR, p2Preview, PLAYER_COLORS[1] || '#FF007F');
"""
    ts = ts.replace(old_p2_draw, new_p2_draw)
    print("Replaced P2 preview block!")
else:
    print("Could not match P2 preview block!")

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)
