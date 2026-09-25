import sys

with open('src/GameManager.ts', 'r', encoding='utf-8') as f:
    gm = f.read()

# Modify Particle interface
gm = gm.replace("interface Particle {", "export interface Particle {\n  playerIndex: number;")

# Modify triggerLineClearEffects signature
gm = gm.replace("private triggerLineClearEffects(linesCleared: number, clearedRows: number[]) {", 
                "private triggerLineClearEffects(linesCleared: number, clearedRows: number[], pIdx: number) {")
gm = gm.replace("this.triggerLineClearEffects(linesCleared, clearedRows);", 
                "this.triggerLineClearEffects(linesCleared, clearedRows, this.players.indexOf(player));")

# Modify particle push
push_old = """          // Spawn 3-6 particles per cell for big clears, 1-2 for singles
          const particleCount = linesCleared >= 3 ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 2) + 1;
          for (let i = 0; i < particleCount; i++) {
            this.particles.push({
              x: px + (Math.random() - 0.5) * BLOCK_SIZE,
              y: py + (Math.random() - 0.5) * BLOCK_SIZE,"""

push_new = """          // Spawn 3-6 particles per cell for big clears, 1-2 for singles
          const particleCount = linesCleared >= 3 ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 2) + 1;
          for (let i = 0; i < particleCount; i++) {
            this.particles.push({
              playerIndex: pIdx,
              x: (c * BLOCK_SIZE + BLOCK_SIZE / 2) + (Math.random() - 0.5) * BLOCK_SIZE,
              y: (row * BLOCK_SIZE + BLOCK_SIZE / 2) + (Math.random() - 0.5) * BLOCK_SIZE,"""

gm = gm.replace(push_old, push_new)

# Modify combo texts push
combo_old = """      this.comboTexts.push({
        x: (this.myPlayerIndex * (COLS * BLOCK_SIZE + 40)) + (COLS * BLOCK_SIZE) / 2,
        y: ROWS * BLOCK_SIZE / 2,"""
combo_new = """      this.comboTexts.push({
        playerIndex: pIdx,
        x: (COLS * BLOCK_SIZE) / 2,
        y: ROWS * BLOCK_SIZE / 2,"""
gm = gm.replace(combo_old, combo_new)

# Modify line clear flashes push
flash_old = """      this.lineClearEffects.push({
        row,
        color,"""
flash_new = """      this.lineClearEffects.push({
        playerIndex: pIdx,
        row,
        color,"""
gm = gm.replace(flash_old, flash_new)

# And fix lineClearEffects type
gm = gm.replace("lineClearEffects: { row: number, color: string, flash: number }[];",
                "lineClearEffects: { playerIndex: number, row: number, color: string, flash: number }[];")
gm = gm.replace("comboTexts: { x: number, y: number, text: string, color: string, life: number, maxLife: number }[];",
                "comboTexts: { playerIndex: number, x: number, y: number, text: string, color: string, life: number, maxLife: number }[];")


with open('src/GameManager.ts', 'w', encoding='utf-8') as f:
    f.write(gm)

print("Updated GameManager.ts")
