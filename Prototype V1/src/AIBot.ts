import { Grid, type Cell } from "./Grid";
import { Tetromino } from "./Tetromino";
import { InputHandler, InputAction } from "./InputHandler";

export type Difficulty = 'EASY' | 'HARD';

interface MoveSequence {
  rotations: number;
  targetX: number;
  score: number;
  actions: InputAction[]; // The exact simulated keystrokes
}

/**
 * AIBot: An autonomous Tetris player utilizing a Utility-Based Heuristic AI (Dellacherie model).
 * It evaluates board states mathematically to determine the optimal placement for a Tetromino.
 */
export class AIBot {
  private grid: Grid;
  private inputHandler: InputHandler;
  public difficulty: Difficulty;

  // State to manage delayed execution
  private pendingActions: InputAction[] = [];
  private isThinking: boolean = false;
  private timeSinceLastAction: number = 0;
  private thinkingTimer: number = 0;

  // Delay settings in ms
  private readonly DELAYS = {
    EASY: { think: 1400, action: 150 },
    HARD: { think: 300, action: 30 }
  };

  // Heuristic weights (Dellacherie model)
  private readonly WEIGHTS = {
    completeLines: 0.76,
    aggregateHeight: -0.51,
    holes: -0.35,
    bumpiness: -0.18
  };

  constructor(grid: Grid, inputHandler: InputHandler, difficulty: Difficulty = 'HARD') {
    this.grid = grid;
    this.inputHandler = inputHandler;
    this.difficulty = difficulty;
  }

  /**
   * Called continuously by GameManager during ACTIVE_DROP state.
   */
  public update(currentTetromino: Tetromino | null, dt: number) {
    if (!currentTetromino) return;

    // Action Execution Phase
    if (this.pendingActions.length > 0) {
      this.timeSinceLastAction += dt;
      const actionDelay = this.DELAYS[this.difficulty].action;

      if (this.timeSinceLastAction >= actionDelay) {
        this.inputHandler.pushInput(this.pendingActions.shift()!);
        this.timeSinceLastAction = 0;
      }
      return;
    }

    // Thinking Phase
    if (!this.isThinking) {
      this.isThinking = true;
      this.thinkingTimer = 0;
    } else {
      this.thinkingTimer += dt;
      const thinkDelay = this.DELAYS[this.difficulty].think;

      if (this.thinkingTimer >= thinkDelay) {
        const bestMove = this.findBestMove(currentTetromino);
        if (bestMove) {
          this.pendingActions = bestMove.actions;
        }
        this.isThinking = false;
      }
    }
  }

  /**
   * Evaluates all possible rotations and translations for the current piece.
   */
  private findBestMove(piece: Tetromino): MoveSequence | null {
    const possibleMoves: MoveSequence[] = [];

    // Save the original state so we don't mutate the live piece during simulations
    const originalRotation = piece.rotationIndex;
    const originalX = piece.x;
    const originalY = piece.y;

    // We can simulate rotations 0 through 3
    for (let rotations = 0; rotations < 4; rotations++) {
      // 1. Set rotation
      piece.rotationIndex = (originalRotation + rotations) % 4;
      // We need to fetch the shape for this rotation directly since Tetromino's rotate() method uses SHAPES
      // but modifying piece.matrix directly works if we expose it, though the cleanest way is cloning shape.
      // For simplicity, let's temporarily rotate the piece using its method (and rotate back later).
      // Since `rotate` might trigger special block rotations, we just want the matrix.
      piece.matrix = this.getRotatedMatrix(piece.type, piece.rotationIndex);

      // 2. Iterate through all possible X columns
      const minX = -2; // Rough bounds, checkCollision will cull invalid ones
      const maxX = this.grid.width + 2;

      for (let testX = minX; testX <= maxX; testX++) {
        piece.x = testX;
        piece.y = 0; // Simulate drop from top

        // If the piece immediately collides at the top, this X is invalid for this rotation
        if (this.grid.checkCollision(piece)) {
          continue;
        }

        // 3. Simulate hard drop
        let dropY = piece.y;
        while (!this.grid.checkCollision(piece, piece.x, dropY + 1)) {
          dropY++;
        }
        piece.y = dropY;

        // 4. Clone grid and lock piece
        const simulatedGrid = this.cloneGridMatrix(this.grid.matrix);
        this.lockPieceInSimulatedGrid(simulatedGrid, piece);

        // 5. Calculate heuristics
        const score = this.calculateHeuristics(simulatedGrid);

        // 6. Generate action sequence to reach this state
        const actions: InputAction[] = [];
        
        // Add rotations
        for (let i = 0; i < rotations; i++) {
          actions.push(InputAction.ROTATE_CW);
        }
        
        // Add translations
        const xOffset = testX - originalX;
        if (xOffset < 0) {
          for (let i = 0; i < Math.abs(xOffset); i++) actions.push(InputAction.LEFT);
        } else if (xOffset > 0) {
          for (let i = 0; i < xOffset; i++) actions.push(InputAction.RIGHT);
        }

        // Add drop
        actions.push(InputAction.HARD_DROP);

        possibleMoves.push({
          rotations,
          targetX: testX,
          score,
          actions
        });
      }
    }

    // Restore original piece state
    piece.rotationIndex = originalRotation;
    piece.matrix = this.getRotatedMatrix(piece.type, originalRotation);
    piece.x = originalX;
    piece.y = originalY;

    if (possibleMoves.length === 0) return null;

    // Sort moves by highest score descending
    possibleMoves.sort((a, b) => b.score - a.score);

    // Difficulty scaling
    if (this.difficulty === 'EASY' && possibleMoves.length >= 4) {
      // Occasionally pick the 3rd or 4th best move to simulate human error (e.g., 20% chance)
      if (Math.random() < 0.20) {
        const index = Math.floor(Math.random() * 2) + 2; // index 2 or 3 (3rd or 4th)
        return possibleMoves[index];
      }
    }

    // HARD mode always takes the best
    return possibleMoves[0];
  }

  /**
   * Evaluates a grid matrix and returns a float score using Dellacherie metrics.
   */
  private calculateHeuristics(matrix: Cell[][]): number {
    let completeLines = 0;
    let aggregateHeight = 0;
    let holes = 0;
    let bumpiness = 0;

    const heights: number[] = new Array(this.grid.width).fill(0);

    for (let c = 0; c < this.grid.width; c++) {
      let foundBlock = false;
      for (let r = 0; r < this.grid.height; r++) {
        if (matrix[r][c].type !== null) {
          if (!foundBlock) {
            // Found the top of the column
            heights[c] = this.grid.height - r;
            aggregateHeight += heights[c];
            foundBlock = true;
          }
        } else if (foundBlock) {
          // Empty cell below a block is a hole
          holes++;
        }
      }
    }

    // Calculate complete lines
    for (let r = 0; r < this.grid.height; r++) {
      let isComplete = true;
      for (let c = 0; c < this.grid.width; c++) {
        if (matrix[r][c].type === null) {
          isComplete = false;
          break;
        }
      }
      if (isComplete) completeLines++;
    }

    // Calculate bumpiness
    for (let c = 0; c < this.grid.width - 1; c++) {
      bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    return (
      (completeLines * this.WEIGHTS.completeLines) +
      (aggregateHeight * this.WEIGHTS.aggregateHeight) +
      (holes * this.WEIGHTS.holes) +
      (bumpiness * this.WEIGHTS.bumpiness)
    );
  }

  // --- Helper Methods ---

  private cloneGridMatrix(original: Cell[][]): Cell[][] {
    return original.map(row => row.map(cell => ({ ...cell })));
  }

  private lockPieceInSimulatedGrid(matrix: Cell[][], piece: Tetromino) {
    const shape = piece.matrix;
    const size = shape.length;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const gridX = piece.x + c;
          const gridY = piece.y + r;
          if (gridY >= 0 && gridY < this.grid.height && gridX >= 0 && gridX < this.grid.width) {
            matrix[gridY][gridX].type = piece.type;
          }
        }
      }
    }
  }

  private getRotatedMatrix(type: string, rotationIndex: number): number[][] {
    // We recreate the shape fetch since Tetromino's raw shape data isn't easily exported without importing SHAPES directly.
    // Instead of importing SHAPES const from Tetromino, we can instantiate a dummy piece.
    const dummy = new Tetromino(type as any);
    for(let i=0; i<rotationIndex; i++) dummy.rotate(1);
    return dummy.matrix;
  }
}