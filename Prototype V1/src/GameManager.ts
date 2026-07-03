import { Grid } from "./Grid";
import { Tetromino, TetrominoBag } from "./Tetromino";
import { InputHandler, InputAction } from "./InputHandler";
import { ItemManager, SpecialBlockType } from "./ItemManager";
import { ScoreManager } from "./ScoreManager";

export const GameState = {
  READY: "READY",
  SPAWNING: "SPAWNING",
  ACTIVE_DROP: "ACTIVE_DROP",
  PIECE_LOCK: "PIECE_LOCK",
  RESOLUTION: "RESOLUTION",
  GAME_OVER: "GAME_OVER"
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export class GameManager {
  public state: GameState = GameState.READY;
  
  public grid: Grid;
  public currentPiece: Tetromino | null = null;
  public nextPiece: Tetromino | null = null; // For rendering preview
  public bag: TetrominoBag;
  public inputHandler: InputHandler;
  public itemManager: ItemManager;
  public scoreManager: ScoreManager;

  private dropTimer: number = 0;
  private dropInterval: number = 1000; // ms
  private timeSurvived: number = 0;
  private lastTime: number = 0;

  // Render callback
  private renderFn: () => void;

  constructor(renderFn: () => void) {
    this.grid = new Grid();
    this.bag = new TetrominoBag();
    this.inputHandler = new InputHandler();
    this.itemManager = new ItemManager();
    this.scoreManager = new ScoreManager();
    this.renderFn = renderFn;
  }

  public reset() {
    this.grid = new Grid();
    this.bag = new TetrominoBag();
    this.inputHandler.clear();
    this.scoreManager = new ScoreManager();
    this.currentPiece = null;
    this.nextPiece = null;
    this.timeSurvived = 0;
    this.dropTimer = 0;
    this.state = GameState.SPAWNING;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  public start() {
    this.state = GameState.SPAWNING;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(timestamp: number) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt);
    this.renderFn();

    if (this.state !== GameState.GAME_OVER) {
      requestAnimationFrame(this.loop.bind(this));
    } else {
      // One last render for game over screen
      this.renderFn();
    }
  }

  private update(dt: number) {
    if (this.state === GameState.GAME_OVER || this.state === GameState.READY) return;

    this.timeSurvived += dt;
    this.scoreManager.update(dt);

    switch (this.state) {
      case GameState.SPAWNING:
        this.handleSpawning();
        break;
      case GameState.ACTIVE_DROP:
        this.handleActiveDrop(dt);
        break;
      case GameState.PIECE_LOCK:
        this.handlePieceLock();
        break;
      case GameState.RESOLUTION:
        this.handleResolution();
        break;
    }
  }

  private handleSpawning() {
    if (!this.nextPiece) {
       this.nextPiece = new Tetromino(this.bag.getNext());
       this.itemManager.applyItemToTetromino(this.nextPiece);
    }
    
    this.currentPiece = this.nextPiece;
    this.nextPiece = new Tetromino(this.bag.getNext());
    this.itemManager.applyItemToTetromino(this.nextPiece);

    // Dynamic Gravity based on lines cleared and time survived
    this.calculateGravity();

    this.dropTimer = 0;

    // Check top out on spawn
    if (this.grid.checkCollision(this.currentPiece!)) {
      this.state = GameState.GAME_OVER;
    } else {
      this.state = GameState.ACTIVE_DROP;
    }
  }

  private calculateGravity() {
    // Dynamic Gravity: scales based on time survived / lines cleared
    const baseInterval = 1000;
    const linesFactor = this.scoreManager.totalLinesCleared * 10;
    const timeFactor = this.timeSurvived / 1000 * 2;
    this.dropInterval = Math.max(100, baseInterval - linesFactor - timeFactor);
  }

  private handleActiveDrop(dt: number) {
    // Process Inputs
    while (this.inputHandler.hasInput()) {
      const action = this.inputHandler.getNextInput()!;
      this.processAction(action);
    }

    // Apply Gravity
    this.dropTimer += dt;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      this.movePiece(0, 1); // Soft drop applies gravity
    }
  }

  private processAction(action: InputAction) {
    if (!this.currentPiece) return;

    switch (action) {
      case InputAction.LEFT:
        this.movePiece(-1, 0);
        break;
      case InputAction.RIGHT:
        this.movePiece(1, 0);
        break;
      case InputAction.SOFT_DROP:
        if (this.movePiece(0, 1)) {
          this.scoreManager.addDropScore(1);
          this.dropTimer = 0; // reset timer to prevent immediate double drop
        }
        break;
      case InputAction.HARD_DROP:
        let dropped = 0;
        while (this.movePiece(0, 1)) {
          dropped++;
        }
        this.scoreManager.addDropScore(dropped * 2);
        this.state = GameState.PIECE_LOCK;
        break;
      case InputAction.ROTATE_CW:
        this.rotatePiece(1);
        break;
      case InputAction.ROTATE_CCW:
        this.rotatePiece(-1);
        break;
      case InputAction.HOLD:
        // Hold functionality not strictly requested in ReadMe, 
        // but InputAction has it. We'll ignore for MVP or implement simple swap.
        break;
    }
  }

  private movePiece(dx: number, dy: number): boolean {
    if (!this.currentPiece) return false;

    // Test collision
    if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x + dx, this.currentPiece.y + dy)) {
      this.currentPiece.move(dx, dy);
      return true;
    } else {
      if (dy > 0) {
        // Hit floor or locked piece
        this.state = GameState.PIECE_LOCK;
      }
      return false;
    }
  }

  private rotatePiece(dir: 1 | -1) {
    if (!this.currentPiece) return;

    this.currentPiece.rotate(dir);
    
    // Test SRS Kicks
    const kicks = this.currentPiece.getKickData();
    let kicked = false;

    for (const kick of kicks) {
      if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x + kick.x, this.currentPiece.y + kick.y)) {
        this.currentPiece.move(kick.x, kick.y);
        kicked = true;
        break;
      }
    }

    if (!kicked) {
      // Revert rotation if all kicks fail
      this.currentPiece.rotate(dir === 1 ? -1 : 1);
    }
  }

  private handlePieceLock() {
    if (this.currentPiece) {
      this.grid.lockTetromino(this.currentPiece);
      this.currentPiece = null;
    }
    this.state = GameState.RESOLUTION;
  }

  private handleResolution() {
    const { linesCleared, specialBlocksToTrigger, clearedRows } = this.grid.clearLines();

    if (linesCleared > 0) {
      this.scoreManager.addScoreForLines(linesCleared);
    }

    // Process Special Blocks
    for (const special of specialBlocksToTrigger) {
      switch (special) {
        case SpecialBlockType.BOMB:
          // In a fully flushed out system we might trigger bomb based on its position, 
          // but for now we'll pick a random cleared row/col or middle to show effect, 
          // or ideally we track the original coordinate.
          // Since it's a line clear, we can just clear a 3x3 at center width for prototype.
          this.grid.clearBombArea(clearedRows[0], Math.floor(this.grid.width / 2));
          break;
        case SpecialBlockType.HEAVY:
          this.grid.clearLineDirectlyBeneath(clearedRows[0]);
          break;
        case SpecialBlockType.MULTIPLIER:
          this.scoreManager.activateMultiplierBlock();
          break;
      }
    }

    this.state = GameState.SPAWNING;
  }
}
