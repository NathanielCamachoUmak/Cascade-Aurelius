import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Remove the duplicated nextC2 lines
duplicate = """    const nextC2 = document.getElementById('next-canvas-p2') as HTMLCanvasElement;
    if (nextC2) renderQueueOnMiniCanvas(nextC2, p2.bag.getPreview(4), PLAYER_COLORS[1] || '#FF007F');"""

ts = ts.replace(duplicate, "")

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)
