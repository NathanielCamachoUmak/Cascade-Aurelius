import { Player } from "./Player";
import { Tetromino } from "./Tetromino";
import { InputAction } from "./InputHandler";
import { SpecialBlockType } from "./ItemManager";
import { type Difficulty } from "./AIBot";

export const GameState = {
  MAIN_MENU: "MAIN_MENU",
  READY: "READY",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER"
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export class GameManager {
  public state: GameState = GameState.MAIN_MENU;
  public players: Player[] = [];
  
  private lastTime: number = 0;
  private renderFn: () => void;
  private animationFrameId: number | null = null;

  constructor(renderFn: () => void) {
    this.renderFn = renderFn;
  }

  public initSolo() {
    this.players = [new Player("P1", false)];
    this.start();
  }

  public init1v1(difficulty: Difficulty) {
    this.players = [
      new Player("P1", false),
      new Player("P2", true, difficulty)
    ];
    this.start();
  }

  public start() {
    this.state = GameState.PLAYING;
    this.lastTime = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.loop(performance.now());
  }

  private loop(timestamp: number) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt);
    this.renderFn();

    if (this.state === GameState.PLAYING) {
      this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    } else if (this.state === GameState.GAME_OVER) {
      this.renderFn(); // one last render
    }
  }

  private update(dt: number) {
    if (this.state !== GameState.PLAYING) return;

    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (player.isToppedOut) continue;

      player.timeSurvived += dt;
      player.scoreManager.update(dt);

      // AI update
      if (player.bot) {
        player.bot.update(player.currentPiece, dt);
      } else {
        // Human input auto-repeat tick
        player.inputHandler.update(dt);
      }

      // Spawning
      if (!player.currentPiece) {
        this.handleSpawning(player);
        if (player.isToppedOut) {
          this.checkGameOver();
          continue;
        }
      }

      // Active Drop & Input
      this.handleActiveDrop(player, dt);
    }
  }

  private handleSpawning(player: Player) {
    if (!player.nextPiece) {
      player.nextPiece = new Tetromino(player.bag.getNext());
      player.itemManager.applyItemToTetromino(player.nextPiece);
    }
    
    player.currentPiece = player.nextPiece;
    player.nextPiece = new Tetromino(player.bag.getNext());
    player.itemManager.applyItemToTetromino(player.nextPiece);

    // Gravity calculation
    const baseInterval = 1000;
    const linesFactor = player.scoreManager.totalLinesCleared * 10;
    const timeFactor = player.timeSurvived / 1000 * 2;
    player.dropInterval = Math.max(100, baseInterval - linesFactor - timeFactor);
    player.dropTimer = 0;

    if (player.grid.checkCollision(player.currentPiece)) {
      player.isToppedOut = true;
    }
  }

  private handleActiveDrop(player: Player, dt: number) {
    while (player.inputHandler.hasInput()) {
      const action = player.inputHandler.getNextInput()!;
      this.processAction(player, action);
    }

    if (!player.currentPiece) return; // Might have locked from hard drop

    player.dropTimer += dt;
    if (player.dropTimer >= player.dropInterval) {
      player.dropTimer = 0;
      this.movePiece(player, 0, 1);
    }
  }

  private processAction(player: Player, action: InputAction) {
    if (!player.currentPiece) return;

    switch (action) {
      case InputAction.LEFT:
        this.movePiece(player, -1, 0);
        break;
      case InputAction.RIGHT:
        this.movePiece(player, 1, 0);
        break;
      case InputAction.SOFT_DROP:
        if (this.movePiece(player, 0, 1)) {
          player.scoreManager.addDropScore(1);
          player.dropTimer = 0;
        }
        break;
      case InputAction.HARD_DROP:
        let dropped = 0;
        while (this.movePiece(player, 0, 1)) {
          dropped++;
        }
        player.scoreManager.addDropScore(dropped * 2);
        this.handlePieceLock(player);
        break;
      case InputAction.ROTATE_CW:
        this.rotatePiece(player, 1);
        break;
      case InputAction.ROTATE_CCW:
        this.rotatePiece(player, -1);
        break;
      case InputAction.HOLD:
        this.performHold(player);
        break;
    }
  }

  private performHold(player: Player) {
    if (player.hasHeld || !player.currentPiece) return;

    if (player.holdPiece) {
      const temp = player.holdPiece;
      player.holdPiece = new Tetromino(player.currentPiece.type);
      player.currentPiece = new Tetromino(temp.type);
      player.itemManager.applyItemToTetromino(player.currentPiece); // re-apply special blocks if needed
    } else {
      player.holdPiece = new Tetromino(player.currentPiece.type);
      this.handleSpawning(player);
    }
    
    player.hasHeld = true;
    player.dropTimer = 0;
  }

  private movePiece(player: Player, dx: number, dy: number): boolean {
    if (!player.currentPiece) return false;

    if (!player.grid.checkCollision(player.currentPiece, player.currentPiece.x + dx, player.currentPiece.y + dy)) {
      player.currentPiece.move(dx, dy);
      return true;
    } else {
      if (dy > 0) {
        this.handlePieceLock(player);
      }
      return false;
    }
  }

  private rotatePiece(player: Player, dir: 1 | -1) {
    if (!player.currentPiece) return;
    
    player.currentPiece.rotate(dir);
    const kicks = player.currentPiece.getKickData();
    let kicked = false;

    for (const kick of kicks) {
      if (!player.grid.checkCollision(player.currentPiece, player.currentPiece.x + kick.x, player.currentPiece.y + kick.y)) {
        player.currentPiece.move(kick.x, kick.y);
        kicked = true;
        break;
      }
    }

    if (!kicked) {
      player.currentPiece.rotate(dir === 1 ? -1 : 1);
    }
  }

  private handlePieceLock(player: Player) {
    if (player.currentPiece) {
      player.grid.lockTetromino(player.currentPiece);
      player.currentPiece = null;
    }
    
    player.hasHeld = false;
    
    const { linesCleared, specialBlocksToTrigger, clearedRows } = player.grid.clearLines();

    if (linesCleared > 0) {
      player.scoreManager.addScoreForLines(linesCleared);
      
      // Garbage mechanic
      if (linesCleared >= 2) {
        const garbageCount = linesCleared - 1;
        this.distributeGarbage(player, garbageCount);
      }
    }

    // Special blocks
    for (const special of specialBlocksToTrigger) {
      if (special === SpecialBlockType.BOMB) {
        player.grid.clearBombArea(clearedRows[0], Math.floor(player.grid.width / 2));
      } else if (special === SpecialBlockType.HEAVY) {
        player.grid.clearLineDirectlyBeneath(clearedRows[0]);
      } else if (special === SpecialBlockType.MULTIPLIER) {
        player.scoreManager.activateMultiplierBlock();
      }
    }
  }

  private distributeGarbage(sender: Player, count: number) {
    let senderType: 'EASY' | 'HARD' | 'HUMAN' = 'HUMAN';
    if (sender.bot) {
      senderType = sender.bot.difficulty;
    }

    for (const target of this.players) {
      if (target.id !== sender.id && !target.isToppedOut) {
        target.grid.addGarbageLines(count, senderType);
      }
    }
  }

  private checkGameOver() {
    // Game is over if any player tops out (for now, or maybe only if all humans top out)
    // For 1v1, if one tops out, the other wins. Let's just end the game if anyone tops out.
    let anyToppedOut = false;
    for (const p of this.players) {
      if (p.isToppedOut) anyToppedOut = true;
    }
    
    if (anyToppedOut) {
      this.state = GameState.GAME_OVER;
    }
  }
}
