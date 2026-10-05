import { Tetromino } from "./Tetromino";

export interface Cell {
  type: string | null; // "I", "J", "L", etc., or null if empty
  special?: string;    // "BOMB", "HEAVY", "MULTIPLIER"
  unClearable?: boolean; // sudden-death garbage — never counts toward a clearable full row
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

  public clearLines(): {
    linesCleared: number;
    specialBlocksToTrigger: string[];
    clearedRows: number[];
    specialBlockPositions: Array<{ type: string; row: number; col: number }>;
  } {
    let linesCleared = 0;
    const specialBlocksToTrigger: string[] = [];
    const clearedRows: number[] = [];
    const specialBlockPositions: Array<{ type: string; row: number; col: number }> = [];

    // First pass: figure out which rows are full and capture their specials
    // BEFORE any mutation happens, so nothing below gets rewritten out from
    // under us mid-calculation.
    const isRowFull: boolean[] = new Array(this.height).fill(false);
    const isRowCrushed: boolean[] = new Array(this.height).fill(false);
    const rowSpecials: string[][] = new Array(this.height);
    const rowSpecialPositions: Array<{ type: string; row: number; col: number }>[] = new Array(this.height);

    for (let r = 0; r < this.height; r++) {
      let full = true;
      const specials: string[] = [];
      const positions: Array<{ type: string; row: number; col: number }> = [];
      for (let c = 0; c < this.width; c++) {
        const cell = this.matrix[r][c];
        if (cell.type === null || cell.unClearable) full = false;
        if (cell.special) {
          specials.push(cell.special);
          positions.push({ type: cell.special, row: r, col: c });
        }
      }
      isRowFull[r] = full;
      rowSpecials[r] = specials;
      rowSpecialPositions[r] = positions;
    }

    // HEAVY block side effect: automatically clear the single row directly
    // beneath a cleared HEAVY block row (r + 1) and compact rows above it.
    for (let r = 0; r < this.height; r++) {
      if (isRowFull[r] && rowSpecials[r].includes('HEAVY') && r + 1 < this.height) {
        const hasUnClearable = this.matrix[r + 1].some(cell => cell.unClearable);
        if (!hasUnClearable) {
          isRowCrushed[r + 1] = true;
        }
      }
    }

    // O(n) approach: sweep bottom-up, removing both full rows and HEAVY-crushed rows
    // so blocks above fall cleanly into the cleared space.
    let writeRow = this.height - 1;

    for (let readRow = this.height - 1; readRow >= 0; readRow--) {
      if (isRowFull[readRow] || isRowCrushed[readRow]) {
        linesCleared++;
        clearedRows.push(readRow);
        if (isRowFull[readRow]) {
          specialBlocksToTrigger.push(...rowSpecials[readRow]);
          specialBlockPositions.push(...rowSpecialPositions[readRow]);
        }
      } else {
        if (readRow !== writeRow) {
          for (let c = 0; c < this.width; c++) {
            this.matrix[writeRow][c] = { ...this.matrix[readRow][c] };
          }
        }
        writeRow--;
      }
    }

    while (writeRow >= 0) {
      for (let c = 0; c < this.width; c++) {
        this.matrix[writeRow][c] = { type: null };
      }
      writeRow--;
    }

    return { linesCleared, specialBlocksToTrigger, clearedRows, specialBlockPositions };
  }

  // Effect implementations for items

  public clearBombArea(centerRow: number, centerCol: number): void {
    // Instantly clears a 3x3 grid area surrounding the Bomb Block's coordinates
    const effectiveRow = Math.max(1, Math.min(this.height - 2, centerRow));
    const effectiveCol = Math.max(1, Math.min(this.width - 2, centerCol));
    for (let r = effectiveRow - 1; r <= effectiveRow + 1; r++) {
      for (let c = effectiveCol - 1; c <= effectiveCol + 1; c++) {
        if (r >= 0 && r < this.height && c >= 0 && c < this.width && !this.matrix[r][c].unClearable) {
          this.matrix[r][c] = { type: null };
        }
      }
    }
    this.applyGravity();
  }

  public isEmpty(): boolean {
    return this.matrix.every(row => row.every(cell => cell.type === null));
  }

  /** Removes up to `count` lower rows and lets the rest of the board fall. */
  public clearBottomLines(count: number): number {
    const lines = Math.max(0, Math.min(count, this.height));
    let cleared = 0;
    for (let r = this.height - 1; r >= this.height - lines; r--) {
      if (this.matrix[r].some(cell => cell.type !== null)) cleared++;
      this.matrix[r] = Array.from({ length: this.width }, () => ({ type: null }));
    }
    this.applyGravity();
    return cleared;
  }

  /** Clears up to `count` rows containing garbage cells, scanning from the bottom up. Used by Garbage Eater block. */
  public clearGarbageLines(count: number): number {
    let cleared = 0;
    for (let r = this.height - 1; r >= 0 && cleared < count; r--) {
      if (this.matrix[r].some(cell => cell.type === 'GARBAGE' && !cell.unClearable)) {
        for (let c = 0; c < this.width; c++) {
          if (!this.matrix[r][c].unClearable) {
            this.matrix[r][c] = { type: null };
          }
        }
        cleared++;
      }
    }
    if (cleared > 0) this.applyGravity();
    return cleared;
  }

  /** Shifts occupied cells horizontally; blocks pushed through an edge wrap around. */
  public shiftHorizontally(columns: number): void {
    const amount = ((columns % this.width) + this.width) % this.width;
    if (!amount) return;
    this.matrix = this.matrix.map(row => row.map((_, column) => ({ ...row[(column - amount + this.width) % this.width] })));
  }

  /** Converts up to `count` garbage cells, prioritising the lower board, into special blocks. */
  public convertGarbageToSpecialBlocks(count: number): number {
    const specials = ['BOMB', 'HEAVY', 'MULTIPLIER', 'SPEED', 'SHIELD', 'FREEZE', 'GARBAGE_EATER'];
    let converted = 0;
    for (let r = this.height - 1; r >= 0 && converted < count; r--) {
      for (let c = 0; c < this.width && converted < count; c++) {
        const cell = this.matrix[r][c];
        if (cell.type !== 'GARBAGE' || cell.unClearable) continue;
        cell.type = 'I';
        cell.special = specials[converted % specials.length];
        converted++;
      }
    }
    return converted;
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

  /**
   * Battle Royale stage reset: wipes the board IN PLACE (bots keep their grid
   * reference) and fills the bottom rows with garbage, one hole per row.
   */
  public resetWithGarbage(holes: number[] = []): void {
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) this.matrix[r][c] = { type: null };
    }
    const rows = Math.min(holes.length, this.height);
    for (let i = 0; i < rows; i++) {
      const r = this.height - rows + i;
      for (let c = 0; c < this.width; c++) {
        if (c !== holes[i]) this.matrix[r][c] = { type: 'GARBAGE' };
      }
    }
  }

  // Event-Driven Garbage Logic
  public addGarbageLines(
    count: number,
    senderType: 'EASY' | 'HARD' | 'HUMAN',
    options?: { solid?: boolean; unClearable?: boolean }
  ): void {
    if (count <= 0) return;

    const isUnClearable = Boolean(options?.solid || options?.unClearable);

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
      // Solid sudden-death garbage is truly inescapable — no hole at all.
      const holeX = options?.solid
        ? -1
        : (senderType === 'HARD') ? alignedHoleX : Math.floor(Math.random() * this.width);

      for (let c = 0; c < this.width; c++) {
        if (c === holeX) {
          this.matrix[r][c] = { type: null };
        } else {
          // Use a special type or just a grey solid block for garbage
          this.matrix[r][c] = isUnClearable
            ? { type: 'GARBAGE', unClearable: true }
            : { type: 'GARBAGE' };
        }
      }
    }
  }

  /**
   * K.O. recovery clear: destroys every garbage block (including solid
   * sudden-death garbage) while preserving user-placed blocks and misdrops,
   * then collapses the survivors down to the base of the grid.
   */
  public clearGarbageOnlyAndCollapse(): number {
    let removed = 0;

    // Strip garbage, keep everything the player actually placed.
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (this.matrix[r][c].type === 'GARBAGE') {
          this.matrix[r][c] = { type: null };
          removed++;
        }
      }
    }

    // Collapse per column so preserved blocks fall to the base grid.
    for (let c = 0; c < this.width; c++) {
      let writeRow = this.height - 1;
      for (let r = this.height - 1; r >= 0; r--) {
        if (this.matrix[r][c].type !== null) {
          const cell = this.matrix[r][c];
          this.matrix[r][c] = { type: null };
          this.matrix[writeRow][c] = cell;
          writeRow--;
        }
      }
    }

    return removed;
  }

  /**
   * Loads a pre-configured 2D array of cell types into the bottom (or full height) of the grid.
   * Used by Stage 2 tutorial micro-scenarios to set up wells, crises, and dummy boards.
   */
  public loadPresetMatrix(rows: (string | null)[][], specials?: Record<string, string>): void {
    this.matrix = this.createEmptyMatrix();
    const startRow = Math.max(0, this.height - rows.length);
    for (let i = 0; i < rows.length; i++) {
      const targetRow = startRow + i;
      if (targetRow >= this.height) break;
      const sourceRow = rows[i];
      for (let c = 0; c < Math.min(this.width, sourceRow.length); c++) {
        const cellType = sourceRow[c];
        const specialKey = `${targetRow},${c}`;
        this.matrix[targetRow][c] = {
          type: cellType,
          ...(specials && specials[specialKey] ? { special: specials[specialKey] } : {}),
        };
      }
    }
  }
}