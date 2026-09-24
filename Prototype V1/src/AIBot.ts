import { Grid, type Cell } from "./Grid";
import { Tetromino, SHAPES, type ShapeType } from "./Tetromino";
import { InputHandler, InputAction } from "./InputHandler";
import { type PlayerClass } from "./PlayerClass";

export type Difficulty = 'EASY' | 'HARD';

/** Context passed from GameManager so the bot can evaluate ability usage. */
export interface AbilityContext {
  playerClass: PlayerClass;
  abilityCooldowns: { Q: number; E: number };
  classMeter: number;
  abilityFreezeTimer: number;
  fortifyCharges: number;
  reflectGarbage: boolean;
  gridShiftUsedLevel: number;
  currentLevel: number;           // Math.floor(totalLinesCleared / 10)
  boardHeight: number;            // max column height (0–20)
  holeCount: number;              // current holes in the grid
  selectedTargetIndex: number | null;
  hasOpponents: boolean;          // are there living opponents?
}

interface MoveSequence {
  rotations: number;
  targetX: number;
  targetY: number;
  r: number;
  score: number;
  actions: InputAction[];
}

/**
 * AIBot: An autonomous Tetris player utilizing:
 * - BFS pathfinding to find all reachable lock positions (including tucks/spins)
 * - Pierre Dellacherie's 6-feature heuristic for board evaluation
 * - 2-ply Expectimax search (current piece + next piece lookahead)
 * - Ability evaluation for class-specific Q/E/R usage (Stage 2)
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

  // Ability evaluation cooldown (prevent spamming ability checks every frame)
  private abilityEvalTimer: number = 0;
  private readonly ABILITY_EVAL_INTERVAL = 3000; // ms between ability evaluations

  // Delay settings in ms
  private readonly DELAYS = {
    EASY: { think: 1200, action: 120 },
    HARD: { think: 250, action: 50 }
  };

  // Heuristic weights (CEM-trained, 20 generations, 198.1 avg lines)
  public weights = {
    landingHeight: -12.519401097223625,
    erodedPieceCells: 10.910350475683453,
    rowTransitions: -6.706261313931364,
    columnTransitions: -29.27362362471224,
    holes: -24.777107607191077,
    boardWells: -9.187056546069137
  };

  constructor(grid: Grid, inputHandler: InputHandler, difficulty: Difficulty = 'HARD') {
    this.grid = grid;
    this.inputHandler = inputHandler;
    this.difficulty = difficulty;
  }

  /**
   * Called continuously by GameManager during ACTIVE_DROP state.
   * @param abilityCtx — optional context for ability evaluation (Stage 2).
   *   When omitted (e.g. offline 1v1) the bot simply plays pieces.
   */
  public update(currentTetromino: Tetromino | null, nextTetromino: Tetromino | null, dt: number, abilityCtx?: AbilityContext) {
    if (!currentTetromino) return;

    // Ability evaluation runs on its own timer, independent of piece placement
    if (abilityCtx) {
      this.abilityEvalTimer += dt;
      if (this.abilityEvalTimer >= this.ABILITY_EVAL_INTERVAL && this.pendingActions.length === 0) {
        this.abilityEvalTimer = 0;
        const abilityAction = this.evaluateAbilities(abilityCtx);
        if (abilityAction) {
          this.inputHandler.pushInput(abilityAction);
        }
      }
    }

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
        const bestMove = this.expectimaxSearch(currentTetromino, nextTetromino);
        if (bestMove) {
          this.pendingActions = bestMove.actions;
        }
        this.isThinking = false;
      }
    }
  }

  // ==============================
  // Ability Evaluation (Stage 2)
  // ==============================

  /**
   * Evaluates whether the bot should use an ability right now.
   * Returns the InputAction to fire, or null if no ability should be used.
   * 
   * Priority: R (ultimate) > Q > E
   * Each class has its own trigger conditions.
   */
  private evaluateAbilities(ctx: AbilityContext): InputAction | null {
    if (ctx.abilityFreezeTimer > 0) return null;
    if (!ctx.hasOpponents) return null;

    // --- Ultimate (R) evaluation ---
    const ultimateCost = ctx.playerClass === 'SPEEDSTER' ? 40
      : ctx.playerClass === 'TANK' ? 50
      : ctx.playerClass === 'SABOTEUR' ? 35
      : 45; // SUPPORT

    if (ctx.classMeter >= ultimateCost) {
      if (this.shouldUseUltimate(ctx)) {
        return InputAction.ULTIMATE;
      }
    }

    // --- Q ability evaluation ---
    if (ctx.abilityCooldowns.Q <= 0) {
      if (this.shouldUseQ(ctx)) {
        return InputAction.ABILITY_Q;
      }
    }

    // --- E ability evaluation ---
    if (ctx.abilityCooldowns.E <= 0) {
      if (this.shouldUseE(ctx)) {
        return InputAction.ABILITY_E;
      }
    }

    return null;
  }

  private shouldUseUltimate(ctx: AbilityContext): boolean {
    switch (ctx.playerClass) {
      case 'SPEEDSTER':
        // Bullet Time: freeze all opponents. Use when board is safe.
        return ctx.boardHeight <= 10 && ctx.holeCount <= 3;

      case 'TANK':
        // Earthquake: 10 garbage to all opponents. Use when own board is stable.
        return ctx.boardHeight <= 12 && ctx.holeCount <= 4;

      case 'SABOTEUR':
        // Chaos Mode: reverse all opponents' controls. Use when own board is safe.
        return ctx.boardHeight <= 10 && ctx.holeCount <= 3;

      case 'SUPPORT':
        // Guardian Angel: clear bottom 4 lines. Use when in danger.
        return ctx.boardHeight >= 14 || ctx.holeCount >= 6;

      default:
        return false;
    }
  }

  private shouldUseQ(ctx: AbilityContext): boolean {
    switch (ctx.playerClass) {
      case 'SPEEDSTER':
        // Sprint: instant hard drop. Skip — the bot already hard-drops optimally.
        // Only use if the bot is confident (low board, few holes).
        return false; // Let the normal piece placement handle this

      case 'TANK':
        // Fortify: ignore next 2 garbage. Use when board is getting tall.
        return ctx.boardHeight >= 12 && ctx.fortifyCharges === 0;

      case 'SABOTEUR':
        // Scramble: scramble opponent's next 5 pieces. Use when own board is stable.
        return ctx.boardHeight <= 14 && ctx.holeCount <= 5;

      case 'SUPPORT':
        // Recycle: convert next 4 garbage into special blocks. Use when board is tall (expecting garbage).
        return ctx.boardHeight >= 10;

      default:
        return false;
    }
  }

  private shouldUseE(ctx: AbilityContext): boolean {
    switch (ctx.playerClass) {
      case 'SPEEDSTER':
        // Time Warp: slow own drop speed. Use when board is getting tall to buy time.
        return ctx.boardHeight >= 14;

      case 'TANK':
        // Counter Strike: reflect next garbage. Use when board is moderately tall.
        return ctx.boardHeight >= 10 && !ctx.reflectGarbage;

      case 'SABOTEUR':
        // Grid Shift: shift opponent's grid. Once per level.
        return ctx.gridShiftUsedLevel < ctx.currentLevel && ctx.boardHeight <= 14;

      case 'SUPPORT':
        // Perfect Clear Bonus: 15s window for a perfect clear bonus.
        // Only use early game when board is very clean.
        return ctx.boardHeight <= 4 && ctx.holeCount === 0;

      default:
        return false;
    }
  }

  // --- Direct matrix lookup (avoids creating dummy Tetrominos) ---

  private getRotatedMatrix(type: string, rotationIndex: number): number[][] {
    const shapes = SHAPES[type as ShapeType];
    if (shapes) {
      return shapes[rotationIndex % shapes.length];
    }
    const dummy = new Tetromino(type as ShapeType);
    for (let i = 0; i < rotationIndex; i++) dummy.rotate(1);
    return dummy.matrix;
  }

  // --- Collision check against an arbitrary grid matrix ---

  private checkCollisionOnMatrix(
    gridMatrix: Cell[][],
    matrix: number[][],
    px: number,
    py: number
  ): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const gx = px + c;
          const gy = py + r;
          if (gx < 0 || gx >= this.grid.width || gy >= this.grid.height) {
            return true;
          }
          if (gy >= 0 && gridMatrix[gy][gx].type !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // --- BFS Pathfinding: finds all reachable lock positions ---

  private findAllReachableLockPositions(
    type: string,
    startX: number,
    startY: number,
    startR: number,
    gridMatrix: Cell[][]
  ): { x: number; y: number; r: number }[] {
    const visited = new Set<string>();
    const queue: { x: number; y: number; r: number }[] = [];
    const lockPositions: Map<string, { x: number; y: number; r: number }> = new Map();

    const start = { x: startX, y: startY, r: startR };
    queue.push(start);
    visited.add(`${start.x},${start.y},${start.r}`);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curMatrix = this.getRotatedMatrix(type, cur.r);

      // Check if this is a lock position (can't move down)
      if (this.checkCollisionOnMatrix(gridMatrix, curMatrix, cur.x, cur.y + 1)) {
        const lockKey = `${cur.x},${cur.y},${cur.r}`;
        if (!lockPositions.has(lockKey)) {
          lockPositions.set(lockKey, { x: cur.x, y: cur.y, r: cur.r });
        }
      }

      // Explore neighbors: Left, Right, Down, Rotate CW, Rotate CCW
      const neighbors = [
        { x: cur.x - 1, y: cur.y, r: cur.r },
        { x: cur.x + 1, y: cur.y, r: cur.r },
        { x: cur.x, y: cur.y + 1, r: cur.r },
        { x: cur.x, y: cur.y, r: (cur.r + 1) % 4 },
        { x: cur.x, y: cur.y, r: (cur.r + 3) % 4 },
      ];

      for (const next of neighbors) {
        const key = `${next.x},${next.y},${next.r}`;
        if (visited.has(key)) continue;
        
        const nextMatrix = this.getRotatedMatrix(type, next.r);
        if (!this.checkCollisionOnMatrix(gridMatrix, nextMatrix, next.x, next.y)) {
          visited.add(key);
          queue.push(next);
        }
      }
    }

    return Array.from(lockPositions.values());
  }

  // --- Action sequence generation ---

  private generateActions(
    startX: number,
    startR: number,
    targetX: number,
    targetR: number,
    type: string,
    gridMatrix: Cell[][]
  ): InputAction[] {
    // Try the simple path: rotate, then translate, then drop
    const simpleActions = this.generateSimpleActions(startX, startR, targetX, targetR);
    
    if (this.verifyActionPath(simpleActions, type, startX, 0, startR, gridMatrix, targetX, targetR)) {
      return simpleActions;
    }

    // Try alternate rotation direction
    const altRotations = ((targetR - startR) + 4) % 4;
    if (altRotations === 3) {
      const altActions: InputAction[] = [InputAction.ROTATE_CCW];
      const xDiff = targetX - startX;
      if (xDiff < 0) for (let i = 0; i < Math.abs(xDiff); i++) altActions.push(InputAction.LEFT);
      else if (xDiff > 0) for (let i = 0; i < xDiff; i++) altActions.push(InputAction.RIGHT);
      altActions.push(InputAction.HARD_DROP);
      
      if (this.verifyActionPath(altActions, type, startX, 0, startR, gridMatrix, targetX, targetR)) {
        return altActions;
      }
    } else if (altRotations === 1) {
      // Try 3 CCW instead of 1 CW
      const altActions: InputAction[] = [];
      for (let i = 0; i < 3; i++) altActions.push(InputAction.ROTATE_CCW);
      const xDiff = targetX - startX;
      if (xDiff < 0) for (let i = 0; i < Math.abs(xDiff); i++) altActions.push(InputAction.LEFT);
      else if (xDiff > 0) for (let i = 0; i < xDiff; i++) altActions.push(InputAction.RIGHT);
      altActions.push(InputAction.HARD_DROP);
      
      if (this.verifyActionPath(altActions, type, startX, 0, startR, gridMatrix, targetX, targetR)) {
        return altActions;
      }
    }

    // Try translate first, then rotate
    const moveFirstActions: InputAction[] = [];
    const xDiff = targetX - startX;
    if (xDiff < 0) for (let i = 0; i < Math.abs(xDiff); i++) moveFirstActions.push(InputAction.LEFT);
    else if (xDiff > 0) for (let i = 0; i < xDiff; i++) moveFirstActions.push(InputAction.RIGHT);
    const rd = ((targetR - startR) + 4) % 4;
    if (rd <= 2) { for (let i = 0; i < rd; i++) moveFirstActions.push(InputAction.ROTATE_CW); }
    else { moveFirstActions.push(InputAction.ROTATE_CCW); }
    moveFirstActions.push(InputAction.HARD_DROP);

    if (this.verifyActionPath(moveFirstActions, type, startX, 0, startR, gridMatrix, targetX, targetR)) {
      return moveFirstActions;
    }

    // Fallback: use simple path anyway
    return simpleActions;
  }

  private generateSimpleActions(startX: number, startR: number, targetX: number, targetR: number): InputAction[] {
    const actions: InputAction[] = [];
    
    const rotDiff = ((targetR - startR) + 4) % 4;
    if (rotDiff <= 2) {
      for (let i = 0; i < rotDiff; i++) actions.push(InputAction.ROTATE_CW);
    } else {
      actions.push(InputAction.ROTATE_CCW);
    }

    const xDiff = targetX - startX;
    if (xDiff < 0) {
      for (let i = 0; i < Math.abs(xDiff); i++) actions.push(InputAction.LEFT);
    } else if (xDiff > 0) {
      for (let i = 0; i < xDiff; i++) actions.push(InputAction.RIGHT);
    }

    actions.push(InputAction.HARD_DROP);
    return actions;
  }

  private verifyActionPath(
    actions: InputAction[],
    type: string,
    startX: number,
    startY: number,
    startR: number,
    gridMatrix: Cell[][],
    targetX: number,
    targetR: number
  ): boolean {
    let x = startX, y = startY, r = startR;

    for (const action of actions) {
      if (action === InputAction.HARD_DROP) {
        return x === targetX && r === targetR;
      }

      let nx = x, ny = y, nr = r;
      switch (action) {
        case InputAction.LEFT: nx--; break;
        case InputAction.RIGHT: nx++; break;
        case InputAction.SOFT_DROP: ny++; break;
        case InputAction.ROTATE_CW: nr = (r + 1) % 4; break;
        case InputAction.ROTATE_CCW: nr = (r + 3) % 4; break;
      }

      const nextMatrix = this.getRotatedMatrix(type, nr);
      if (this.checkCollisionOnMatrix(gridMatrix, nextMatrix, nx, ny)) {
        return false;
      }
      x = nx; y = ny; r = nr;
    }
    return true;
  }

  // --- Expectimax Search ---

  private expectimaxSearch(piece: Tetromino, nextPiece: Tetromino | null): MoveSequence | null {
    const currentMoves = this.evaluateAllMoves(piece, this.grid.matrix);
    
    if (currentMoves.length === 0) return null;
    
    if (!nextPiece) {
      return this.pickDifficultyMove(currentMoves);
    }
    
    const topCount = Math.min(8, currentMoves.length);
    const topMoves = currentMoves.slice(0, topCount);
    
    for (const move of topMoves) {
      const simulatedGrid = this.cloneGridMatrix(this.grid.matrix);
      const pieceMatrix = this.getRotatedMatrix(piece.type, move.r);
      this.lockPieceOnMatrix(simulatedGrid, pieceMatrix, piece.type, move.targetX, move.targetY);
      this.clearFullLines(simulatedGrid);

      const nextMoves = this.evaluateAllMoves(nextPiece, simulatedGrid);
      
      if (nextMoves.length > 0) {
        move.score += nextMoves[0].score;
      } else {
        move.score -= 1000000;
      }
    }
    
    topMoves.sort((a, b) => b.score - a.score);
    return this.pickDifficultyMove(topMoves);
  }

  private pickDifficultyMove(moves: MoveSequence[]): MoveSequence {
    if (this.difficulty === 'EASY' && moves.length >= 4) {
      if (Math.random() < 0.25) {
        return moves[Math.floor(Math.random() * 3) + 1];
      }
    }
    return moves[0];
  }

  // --- Core evaluation ---

  private evaluateAllMoves(piece: Tetromino, gridMatrix: Cell[][]): MoveSequence[] {
    const lockPositions = this.findAllReachableLockPositions(
      piece.type, piece.x, piece.y, piece.rotationIndex, gridMatrix
    );

    const moves: MoveSequence[] = [];

    for (const pos of lockPositions) {
      const pieceMatrix = this.getRotatedMatrix(piece.type, pos.r);

      const simGrid = this.cloneGridMatrix(gridMatrix);
      const { linesCleared, pieceCellsEliminated } = this.lockAndClearSimulatedGrid(
        simGrid, pieceMatrix, piece.type, pos.x, pos.y
      );

      const score = this.calculateHeuristics(simGrid, pieceMatrix, pos.y, linesCleared, pieceCellsEliminated);

      const actions = this.generateActions(
        piece.x, piece.rotationIndex,
        pos.x, pos.r,
        piece.type, gridMatrix
      );

      moves.push({
        rotations: ((pos.r - piece.rotationIndex) + 4) % 4,
        targetX: pos.x,
        targetY: pos.y,
        r: pos.r,
        score,
        actions
      });
    }

    moves.sort((a, b) => b.score - a.score);
    return moves;
  }

  // --- Pierre Dellacherie's 6-Feature Heuristic ---

  private calculateHeuristics(
    matrix: Cell[][],
    pieceMatrix: number[][],
    pieceY: number,
    linesCleared: number,
    pieceCellsEliminated: number
  ): number {
    const width = this.grid.width;
    const height = this.grid.height;

    // 1. Landing Height
    let pieceTopRow = pieceMatrix.length;
    let pieceBottomRow = 0;
    for (let r = 0; r < pieceMatrix.length; r++) {
      for (let c = 0; c < pieceMatrix[r].length; c++) {
        if (pieceMatrix[r][c] !== 0) {
          pieceTopRow = Math.min(pieceTopRow, r);
          pieceBottomRow = Math.max(pieceBottomRow, r);
        }
      }
    }
    const actualTop = pieceY + pieceTopRow;
    const actualBottom = pieceY + pieceBottomRow;
    const landingHeight = height - (actualTop + actualBottom) / 2;

    // 2. Eroded Piece Cells
    const erodedPieceCells = linesCleared * pieceCellsEliminated;

    // 3. Row Transitions
    let rowTransitions = 0;
    for (let r = 0; r < height; r++) {
      let prevFilled = true;
      for (let c = 0; c < width; c++) {
        const filled = matrix[r][c].type !== null;
        if (filled !== prevFilled) rowTransitions++;
        prevFilled = filled;
      }
      if (!prevFilled) rowTransitions++;
    }

    // 4. Column Transitions
    let columnTransitions = 0;
    for (let c = 0; c < width; c++) {
      let prevFilled = true;
      for (let r = 0; r < height; r++) {
        const filled = matrix[r][c].type !== null;
        if (filled !== prevFilled) columnTransitions++;
        prevFilled = filled;
      }
      if (!prevFilled) columnTransitions++;
    }

    // 5. Holes
    let holes = 0;
    for (let c = 0; c < width; c++) {
      let blockAbove = false;
      for (let r = 0; r < height; r++) {
        if (matrix[r][c].type !== null) {
          blockAbove = true;
        } else if (blockAbove) {
          holes++;
        }
      }
    }

    // 6. Board Wells
    let boardWells = 0;
    for (let c = 0; c < width; c++) {
      for (let r = 0; r < height; r++) {
        if (matrix[r][c].type === null) {
          const leftWall = c === 0 || matrix[r][c - 1].type !== null;
          const rightWall = c === width - 1 || matrix[r][c + 1].type !== null;

          if (leftWall && rightWall) {
            let depth = 0;
            let wr = r;
            while (wr < height && matrix[wr][c].type === null &&
                   (c === 0 || matrix[wr][c - 1].type !== null) &&
                   (c === width - 1 || matrix[wr][c + 1].type !== null)) {
              depth++;
              boardWells += depth;
              wr++;
            }
            r = wr - 1;
          }
        }
      }
    }

    return (
      landingHeight * this.weights.landingHeight +
      erodedPieceCells * this.weights.erodedPieceCells +
      rowTransitions * this.weights.rowTransitions +
      columnTransitions * this.weights.columnTransitions +
      holes * this.weights.holes +
      boardWells * this.weights.boardWells
    );
  }

  // --- Grid Simulation Helpers ---

  private cloneGridMatrix(original: Cell[][]): Cell[][] {
    return original.map(row => row.map(cell => ({ ...cell })));
  }

  private lockPieceOnMatrix(matrix: Cell[][], pieceMatrix: number[][], type: string, px: number, py: number) {
    for (let r = 0; r < pieceMatrix.length; r++) {
      for (let c = 0; c < pieceMatrix[r].length; c++) {
        if (pieceMatrix[r][c] !== 0) {
          const gx = px + c;
          const gy = py + r;
          if (gy >= 0 && gy < this.grid.height && gx >= 0 && gx < this.grid.width) {
            matrix[gy][gx] = { type };
          }
        }
      }
    }
  }

  private clearFullLines(matrix: Cell[][]): number {
    let linesCleared = 0;
    let writeRow = this.grid.height - 1;
    for (let readRow = this.grid.height - 1; readRow >= 0; readRow--) {
      let isFull = true;
      for (let c = 0; c < this.grid.width; c++) {
        if (matrix[readRow][c].type === null) { isFull = false; break; }
      }
      if (isFull) {
        linesCleared++;
      } else {
        if (readRow !== writeRow) {
          for (let c = 0; c < this.grid.width; c++) {
            matrix[writeRow][c] = { ...matrix[readRow][c] };
          }
        }
        writeRow--;
      }
    }
    while (writeRow >= 0) {
      for (let c = 0; c < this.grid.width; c++) { matrix[writeRow][c] = { type: null }; }
      writeRow--;
    }
    return linesCleared;
  }

  private lockAndClearSimulatedGrid(
    matrix: Cell[][],
    pieceMatrix: number[][],
    type: string,
    px: number,
    py: number
  ): { linesCleared: number; pieceCellsEliminated: number } {
    let pieceCellsEliminated = 0;
    let linesCleared = 0;

    for (let r = 0; r < pieceMatrix.length; r++) {
      for (let c = 0; c < pieceMatrix[r].length; c++) {
        if (pieceMatrix[r][c] !== 0) {
          const gx = px + c;
          const gy = py + r;
          if (gy >= 0 && gy < this.grid.height && gx >= 0 && gx < this.grid.width) {
            matrix[gy][gx] = { type, special: '__PIECE__' };
          }
        }
      }
    }

    let writeRow = this.grid.height - 1;
    for (let readRow = this.grid.height - 1; readRow >= 0; readRow--) {
      let isFull = true;
      for (let c = 0; c < this.grid.width; c++) {
        if (matrix[readRow][c].type === null) { isFull = false; break; }
      }
      if (isFull) {
        linesCleared++;
        for (let c = 0; c < this.grid.width; c++) {
          if (matrix[readRow][c].special === '__PIECE__') pieceCellsEliminated++;
        }
      } else {
        if (readRow !== writeRow) {
          for (let c = 0; c < this.grid.width; c++) {
            matrix[writeRow][c] = { ...matrix[readRow][c] };
          }
        }
        writeRow--;
      }
    }
    while (writeRow >= 0) {
      for (let c = 0; c < this.grid.width; c++) { matrix[writeRow][c] = { type: null }; }
      writeRow--;
    }

    for (let r = 0; r < this.grid.height; r++) {
      for (let c = 0; c < this.grid.width; c++) {
        if (matrix[r][c].special === '__PIECE__') delete matrix[r][c].special;
      }
    }

    return { linesCleared, pieceCellsEliminated };
  }
}