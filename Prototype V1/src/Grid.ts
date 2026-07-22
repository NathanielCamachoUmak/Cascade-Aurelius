import { Tetromino } from "./Tetromino";

export interface Cell {
  type: string | null; // "I", "J", "L", etc., or null if empty
  special?: string;    // "BOMB", "HEAVY", "MULTIPLIER"
}

export class Grid {
  public width: number = 10;
  public height: number = 20;
  public matrix: Cell[][];

  constructor() {
    this.matrix = this.createEmptyMatrix();
  }

  private createEmptyMatrix(): Cell[][] {
    const m: Cell[][] = [];
    for (let r = 0; r < this.height; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.width; c++) {
        row.push({ type: null });
      }
      m.push(row);
    }
    return m;
  }

  // AABB-style collision detection
  // Checks if the given tetromino in its current state at (tx, ty) overlaps solid grid or boundaries
  public checkCollision(tetromino: Tetromino, tx: number = tetromino.x, ty: number = tetromino.y): boolean {
    const shape = tetromino.matrix;
    const size = shape.length;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Only check solid blocks of the tetromino
        if (shape[r][c] !== 0) {
          const gridX = tx + c;
          const gridY = ty + r;

          // Check boundary limits
          if (gridX < 0 || gridX >= this.width || gridY >= this.height) {
            return true;
          }

          // We don't check gridY < 0 for top out during drop, only when locking
          if (gridY >= 0) {
            if (this.matrix[gridY][gridX].type !== null) {
              return true; // Overlaps with locked block
            }
          }
        }
      }
    }

    return false;
  }

  public lockTetromino(tetromino: Tetromino): void {
    const shape = tetromino.matrix;
    const size = shape.length;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const gridX = tetromino.x + c;
          const gridY = tetromino.y + r;

          if (gridY >= 0 && gridY < this.height) {
            this.matrix[gridY][gridX].type = tetromino.type;
            const specialKey = `${r},${c}`;
            if (tetromino.specialBlocks.has(specialKey)) {
              this.matrix[gridY][gridX].special = tetromino.specialBlocks.get(specialKey);
            }
          }
        }
      }
    }
  }

  // O(n) line-clearing logic
  // Returns array of cleared row indices and any special blocks found in them
  public clearLines(): { linesCleared: number; specialBlocksToTrigger: string[]; clearedRows: number[] } {
    let linesCleared = 0;
    const specialBlocksToTrigger: string[] = [];
    const clearedRows: number[] = [];

    // O(n) approach: sweep bottom-up
    let writeRow = this.height - 1;

    for (let readRow = this.height - 1; readRow >= 0; readRow--) {
      // Check if readRow is full
      let isFull = true;
      for (let c = 0; c < this.width; c++) {
        if (this.matrix[readRow][c].type === null) {
          isFull = false;
          break;
        }
      }

      if (isFull) {
        linesCleared++;
        clearedRows.push(readRow); // keeping track to potentially process heavy block correctly if needed
        // Collect special blocks from this line
        for (let c = 0; c < this.width; c++) {
          if (this.matrix[readRow][c].special) {
            specialBlocksToTrigger.push(this.matrix[readRow][c].special!);
          }
        }
      } else {
        // If not full, copy readRow to writeRow
        if (readRow !== writeRow) {
          for (let c = 0; c < this.width; c++) {
            this.matrix[writeRow][c] = { ...this.matrix[readRow][c] };
          }
        }
        writeRow--;
      }
    }

    // Fill the remaining top rows with empty cells
    while (writeRow >= 0) {
      for (let c = 0; c < this.width; c++) {
        this.matrix[writeRow][c] = { type: null };
      }
      writeRow--;
    }

    return { linesCleared, specialBlocksToTrigger, clearedRows };
  }

  // Effect implementations for items

  public clearBombArea(centerRow: number, centerCol: number): void {
    // Instantly clears a 3x3 grid area around itself
    for (let r = centerRow - 1; r <= centerRow + 1; r++) {
      for (let c = centerCol - 1; c <= centerCol + 1; c++) {
        if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
          this.matrix[r][c] = { type: null };
        }
      }
    }
    this.applyGravity();
  }

  public clearLineDirectlyBeneath(row: number): void {
    if (row + 1 < this.height) {
      for (let c = 0; c < this.width; c++) {
        this.matrix[row + 1][c] = { type: null };
      }
      this.applyGravity();
    }
  }

  // For when items clear cells non-linearly, we need to "drop" floating blocks
  public applyGravity(): void {
    for (let c = 0; c < this.width; c++) {
      let writeRow = this.height - 1;
      for (let readRow = this.height - 1; readRow >= 0; readRow--) {
        if (this.matrix[readRow][c].type !== null) {
          if (readRow !== writeRow) {
             this.matrix[writeRow][c] = { ...this.matrix[readRow][c] };
             this.matrix[readRow][c] = { type: null };
          }
          writeRow--;
        }
      }
    }
  }

  // Event-Driven Garbage Logic
  public addGarbageLines(count: number, senderType: 'EASY' | 'HARD' | 'HUMAN'): void {
    if (count <= 0) return;

    // Shift everything up by `count`
    for (let r = 0; r < this.height - count; r++) {
      for (let c = 0; c < this.width; c++) {
        this.matrix[r][c] = { ...this.matrix[r + count][c] };
      }
    }

    // Determine hole alignment based on difficulty/sender
    let alignedHoleX = -1;
    if (senderType === 'HARD') {
      alignedHoleX = Math.floor(Math.random() * this.width);
    }

    // Fill the bottom `count` rows with garbage
    for (let r = this.height - count; r < this.height; r++) {
      const holeX = (senderType === 'HARD') ? alignedHoleX : Math.floor(Math.random() * this.width);
      
      for (let c = 0; c < this.width; c++) {
        if (c === holeX) {
          this.matrix[r][c] = { type: null };
        } else {
          // Use a special type or just a grey solid block for garbage
          this.matrix[r][c] = { type: 'GARBAGE' }; // We'll render GARBAGE as gray
        }
      }
    }
  }
}