import { Player } from "./Player";
import { Tetromino, SHAPES } from "./Tetromino";
import { InputAction } from "./InputHandler";
import { SpecialBlockType } from "./ItemManager";
import { type Difficulty } from "./AIBot";
import { NetworkManager, type ScoreData } from "./NetworkManager";
import { type Cell } from "./Grid";

// Visual Effects System
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface LineClearEffect {
  row: number;
  flash: number; // 0-1, fades out
  color: string;
}

interface ComboText {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

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

  // Online multiplayer state
  public network: NetworkManager | null = null;
  public myPlayerIndex: number = 0;
  public isOnline: boolean = false;
  public onlineWinnerName: string = "";
  public gameTime: number = 0;

  // Visual effects state
  private particles: Particle[] = [];
  private lineClearEffects: LineClearEffect[] = [];
  private comboTexts: ComboText[] = [];
  private screenShake: { intensity: number; duration: number; timer: number } = { intensity: 0, duration: 0, timer: 0 };
  private canvasElement: HTMLCanvasElement | null = null;

  // Throttle timers for network sync (ms)
  private gridSyncTimer: number = 0;
  private pieceSyncTimer: number = 0;
  private scoreSyncTimer: number = 0;
  private readonly GRID_SYNC_INTERVAL = 500;   // Send grid every 500ms
  private readonly PIECE_SYNC_INTERVAL = 100;   // Send piece every 100ms
  private readonly SCORE_SYNC_INTERVAL = 300;   // Send score every 300ms

  constructor(renderFn: () => void) {
    this.renderFn = renderFn;
  }

  public initSolo() {
    this.isOnline = false;
    this.network = null;
    this.players = [new Player("P1", false)];
    this.start();
  }

  public init1v1(difficulty: Difficulty) {
    this.isOnline = false;
    this.network = null;
    this.players = [
      new Player("P1", false),
      new Player("P2", true, difficulty)
    ];
    this.start();
  }

  /**
   * Initialize an online multiplayer game.
   * Called when the server signals game-start.
   * @param playerCount Total number of players in the room
   * @param myIndex This player's index (0-based)
   * @param net The active NetworkManager instance
   */
  public initOnline(playerCount: number, myIndex: number, net: NetworkManager, playerNames: string[] = []) {
    this.isOnline = true;
    this.network = net;
    this.myPlayerIndex = myIndex;
    this.onlineWinnerName = "";

    // Create player instances. Only our own player is human-controlled.
    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      const pName = playerNames[i] || `P${i + 1}`;
      if (i === myIndex) {
        // Our local player — listens to keyboard
        this.players.push(new Player(pName, false));
      } else {
        // Remote player — no keyboard, no bot. Grid/piece will be synced from server.
        this.players.push(new Player(pName, false, 'HARD', false));
      }
    }

    // Wire up network callbacks for receiving opponent state
    net.onOpponentGridUpdate = (playerIndex: number, grid: any[][]) => {
      if (playerIndex < this.players.length && playerIndex !== myIndex) {
        // Overwrite remote player's grid with server data
        const player = this.players[playerIndex];
        for (let r = 0; r < player.grid.height; r++) {
          for (let c = 0; c < player.grid.width; c++) {
            if (grid[r] && grid[r][c] !== undefined) {
              player.grid.matrix[r][c] = grid[r][c] as Cell;
            }
          }
        }
      }
    };

    net.onOpponentPieceUpdate = (playerIndex: number, piece: any) => {
      if (playerIndex < this.players.length && playerIndex !== myIndex) {
        const player = this.players[playerIndex];
        if (piece) {
          // Reconstruct a Tetromino-like object for rendering
          const t = new Tetromino(piece.type);
          t.x = piece.x;
          t.y = piece.y;
          t.rotationIndex = piece.rotationIndex;
          // Apply rotation to get correct matrix
          if (SHAPES[piece.type as keyof typeof SHAPES]) {
            t.matrix = SHAPES[piece.type as keyof typeof SHAPES][piece.rotationIndex];
          }
          player.currentPiece = t;
        } else {
          player.currentPiece = null;
        }
      }
    };

    net.onOpponentScoreUpdate = (playerIndex: number, data: ScoreData) => {
      if (playerIndex < this.players.length && playerIndex !== myIndex) {
        const player = this.players[playerIndex];
        player.scoreManager.score = data.score;
        player.scoreManager.totalLinesCleared = data.lines;
        player.scoreManager.combo = data.combo;
        player.scoreManager.scoreMultiplier = data.multiplier;
      }
    };

    net.onOpponentToppedOut = (playerIndex: number) => {
      if (playerIndex < this.players.length && playerIndex !== myIndex) {
        this.players[playerIndex].isToppedOut = true;
      }
    };

    net.onReceiveGarbage = (count: number) => {
      const myPlayer = this.players[myIndex];
      if (myPlayer && !myPlayer.isToppedOut) {
        myPlayer.grid.addGarbageLines(count, 'HUMAN');
      }
    };

    net.onGameOver = (_winnerId: string, winnerName: string) => {
      this.onlineWinnerName = winnerName;
      this.state = GameState.GAME_OVER;
      this.renderFn(); // Final render
    };

    // Reset sync timers
    this.gridSyncTimer = 0;
    this.pieceSyncTimer = 0;
    this.scoreSyncTimer = 0;

    this.start();
  }

  public start() {
    this.state = GameState.PLAYING;
    this.canvasElement = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.lastTime = performance.now();
    this.gameTime = 0;
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

    this.gameTime += dt;

    if (this.isOnline) {
      const mpLevel = Math.floor(this.gameTime / 60000);
      for (const player of this.players) {
        if (mpLevel === 0) player.scoreManager.globalMultiplier = 1.0;
        else if (mpLevel === 1) player.scoreManager.globalMultiplier = 1.1;
        else if (mpLevel === 2) player.scoreManager.globalMultiplier = 1.2;
        else if (mpLevel === 3) player.scoreManager.globalMultiplier = 1.5;
        else if (mpLevel === 4) player.scoreManager.globalMultiplier = 2.0;
        else player.scoreManager.globalMultiplier = 3.0 + (mpLevel - 5);
      }
    }

    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (player.isToppedOut) continue;

      // In online mode, only update our own player's game logic
      if (this.isOnline && i !== this.myPlayerIndex) {
        continue; // Remote players are synced via network events
      }

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
          if (this.isOnline) {
            // Tell server we topped out
            this.network?.sendToppedOut();
          }
          this.checkGameOver();
          continue;
        }
      }

      // Active Drop & Input
      this.handleActiveDrop(player, dt);
    }

    // Update visual effects
    this.updateEffects(dt);

    // Network sync for online mode
    if (this.isOnline && this.network) {
      this.handleNetworkSync(dt);
    }
  }

  /**
   * Periodically send our own state to the server for other players to see.
   */
  private handleNetworkSync(dt: number) {
    if (!this.network) return;
    const myPlayer = this.players[this.myPlayerIndex];
    if (!myPlayer) return;

    // Grid sync
    this.gridSyncTimer += dt;
    if (this.gridSyncTimer >= this.GRID_SYNC_INTERVAL) {
      this.gridSyncTimer = 0;
      this.network.sendGridUpdate(myPlayer.grid.matrix);
    }

    // Piece sync
    this.pieceSyncTimer += dt;
    if (this.pieceSyncTimer >= this.PIECE_SYNC_INTERVAL) {
      this.pieceSyncTimer = 0;
      if (myPlayer.currentPiece) {
        this.network.sendPieceUpdate({
          type: myPlayer.currentPiece.type,
          x: myPlayer.currentPiece.x,
          y: myPlayer.currentPiece.y,
          rotationIndex: myPlayer.currentPiece.rotationIndex,
        });
      } else {
        this.network.sendPieceUpdate(null);
      }
    }

    // Score sync
    this.scoreSyncTimer += dt;
    if (this.scoreSyncTimer >= this.SCORE_SYNC_INTERVAL) {
      this.scoreSyncTimer = 0;
      this.network.sendScoreUpdate({
        score: myPlayer.scoreManager.score,
        lines: myPlayer.scoreManager.totalLinesCleared,
        combo: myPlayer.scoreManager.combo,
        multiplier: myPlayer.scoreManager.scoreMultiplier,
      });
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
    
    if (this.isOnline) {
      const mpLevel = Math.floor(this.gameTime / 60000);
      player.dropInterval = Math.max(100, baseInterval * Math.pow(0.8, mpLevel));
    } else {
      const linesFactor = player.scoreManager.totalLinesCleared * 10;
      const timeFactor = player.timeSurvived / 1000 * 2;
      player.dropInterval = Math.max(100, baseInterval - linesFactor - timeFactor);
    }
    
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

      // Trigger visual effects for the local player's clears
      if (!this.isOnline || player === this.players[this.myPlayerIndex]) {
        this.triggerLineClearEffects(linesCleared, clearedRows);
      }
      
      // Garbage mechanic
      if (linesCleared >= 2) {
        const garbageCount = linesCleared - 1;
        if (this.isOnline) {
          // In online mode, send garbage through the server
          this.network?.sendGarbage(garbageCount);
        } else {
          this.distributeGarbage(player, garbageCount);
        }
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

    // After locking, send immediate grid + score sync for responsiveness
    if (this.isOnline && this.network) {
      this.network.sendGridUpdate(player.grid.matrix);
      this.network.sendScoreUpdate({
        score: player.scoreManager.score,
        lines: player.scoreManager.totalLinesCleared,
        combo: player.scoreManager.combo,
        multiplier: player.scoreManager.scoreMultiplier,
      });
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

  // ==============================
  // Visual Effects
  // ==============================

  private triggerLineClearEffects(linesCleared: number, clearedRows: number[]) {
    const BLOCK_SIZE = 30;
    const COLS = 10;

    // Determine effect color based on clear size
    const colors: Record<number, string> = {
      1: '#00E5FF',
      2: '#00E5FF', 
      3: '#FFC107', // Triple - yellow
      4: '#FF007F', // Tetris - magenta
    };
    const color = colors[Math.min(linesCleared, 4)] || '#FF007F';

    // Spawn particles for each cleared row
    for (const row of clearedRows) {
      for (let c = 0; c < COLS; c++) {
        const px = (this.myPlayerIndex * (COLS * BLOCK_SIZE + 40)) + c * BLOCK_SIZE + BLOCK_SIZE / 2;
        const py = row * BLOCK_SIZE + BLOCK_SIZE / 2;

        // Spawn 3-6 particles per cell for big clears, 1-2 for singles
        const particleCount = linesCleared >= 3 ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < particleCount; i++) {
          this.particles.push({
            x: px + (Math.random() - 0.5) * BLOCK_SIZE,
            y: py + (Math.random() - 0.5) * BLOCK_SIZE,
            vx: (Math.random() - 0.5) * (linesCleared >= 3 ? 8 : 3),
            vy: (Math.random() - 0.5) * (linesCleared >= 3 ? 8 : 3) - 2,
            life: 600 + Math.random() * 400,
            maxLife: 600 + Math.random() * 400,
            color: color,
            size: linesCleared >= 3 ? 3 + Math.random() * 4 : 2 + Math.random() * 2,
          });
        }
      }

      // Flash effect for 3+ line clears
      if (linesCleared >= 3) {
        this.lineClearEffects.push({
          row: row,
          flash: 1.0,
          color: color,
        });
      }
    }

    // Combo text
    const comboCount = this.players[this.isOnline ? this.myPlayerIndex : 0]?.scoreManager.combo || 0;
    let text = '';
    if (linesCleared === 3) text = 'TRIPLE!';
    else if (linesCleared >= 4) text = 'TETRIS!';
    if (comboCount > 1 && text) text += ` COMBO x${comboCount}`;
    else if (comboCount > 1) text = `COMBO x${comboCount}`;

    if (text) {
      const cx = (this.myPlayerIndex * (COLS * BLOCK_SIZE + 40)) + (COLS * BLOCK_SIZE) / 2;
      this.comboTexts.push({
        text: text,
        x: cx,
        y: BLOCK_SIZE * 10,
        life: 1200,
        maxLife: 1200,
        color: color,
        size: linesCleared >= 4 ? 28 : 22,
      });
    }

    // Screen shake for Tetris (4+)
    if (linesCleared >= 4) {
      this.screenShake = {
        intensity: Math.min(linesCleared * 3, 15) * 1.5,
        duration: 400,
        timer: 400,
      };
      // Broadcast Ribbon
      if (this.isOnline && this.network) {
        // Find player name instead of ID if possible
        const pName = this.players[this.myPlayerIndex]?.id || "Someone";
        this.network.sendRibbon(`${pName} GOT A TETRIS!`);
      }
    } else if (linesCleared === 3) {
      this.screenShake = {
        intensity: 6, // Was 4
        duration: 200,
        timer: 200,
      };
    }
  }

  private updateEffects(dt: number) {
    // Update particles
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      return p.life > 0;
    });

    // Update line clear flashes
    this.lineClearEffects = this.lineClearEffects.filter(e => {
      e.flash -= dt / 300;
      return e.flash > 0;
    });

    // Update combo texts
    this.comboTexts = this.comboTexts.filter(t => {
      t.life -= dt;
      t.y -= 0.5; // float up
      return t.life > 0;
    });

    // Update screen shake
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      if (this.canvasElement) {
        const progress = this.screenShake.timer / this.screenShake.duration;
        const intensity = this.screenShake.intensity * progress;
        const shakeX = (Math.random() - 0.5) * intensity * 2;
        const shakeY = (Math.random() - 0.5) * intensity * 2;
        this.canvasElement.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
      }
      if (this.screenShake.timer <= 0) {
        this.screenShake.timer = 0;
        if (this.canvasElement) {
          this.canvasElement.style.transform = '';
        }
      }
    }
  }

  // Public method for render function to draw effects
  public getEffects() {
    return {
      particles: this.particles,
      lineClearEffects: this.lineClearEffects,
      comboTexts: this.comboTexts,
    };
  }

  private checkGameOver() {
    // Game is over if any player tops out (for now, or maybe only if all humans top out)
    // For 1v1, if one tops out, the other wins. Let's just end the game if anyone tops out.
    // In online mode, the server handles game-over detection
    if (this.isOnline) return;

    let anyToppedOut = false;
    for (const p of this.players) {
      if (p.isToppedOut) anyToppedOut = true;
    }
    
    if (anyToppedOut) {
      this.state = GameState.GAME_OVER;
    }
  }
}