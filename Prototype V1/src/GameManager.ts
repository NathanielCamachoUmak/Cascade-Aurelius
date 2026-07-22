import { Player } from "./Player";
import { Tetromino, SHAPES } from "./Tetromino";
import { InputAction } from "./InputHandler";
import { SpecialBlockType } from "./ItemManager";
import { type Difficulty } from "./AIBot";
import { NetworkManager, type ScoreData } from "./NetworkManager";
import { type Cell } from "./Grid";
import anime from 'animejs/lib/anime.es.js';

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
  public initOnline(playerCount: number, myIndex: number, net: NetworkManager) {
    this.isOnline = true;
    this.network = net;
    this.myPlayerIndex = myIndex;
    this.onlineWinnerName = "";

    // Create player instances. Only our own player is human-controlled.
    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      if (i === myIndex) {
        // Our local player — listens to keyboard
        this.players.push(new Player(`P${i + 1}`, false));
      } else {
        // Remote player — no keyboard, no bot. Grid/piece will be synced from server.
        this.players.push(new Player(`P${i + 1}`, false, 'HARD', false));
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

      // Handle Line Clear Delay
      if (player.isClearingLines) {
        player.clearTimer += dt;
        if (player.clearTimer >= player.clearDelay) {
          this.executeClearAndResume(player);
        }
        continue; // Pause piece spawning and dropping
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
    
    const { linesCleared, specialBlocksToTrigger, clearedRows } = player.grid.getLinesToClear();

    if (linesCleared > 0 || specialBlocksToTrigger.length > 0) {
      player.isClearingLines = true;
      player.clearingRows = clearedRows;
      player.clearingSpecialBlocks = specialBlocksToTrigger;
      
      if (linesCleared >= 4) player.clearDelay = 900;
      else if (linesCleared === 3) player.clearDelay = 500;
      else player.clearDelay = 300;
      
      player.clearTimer = 0;

      if (!this.isOnline || player === this.players[this.myPlayerIndex]) {
        this.triggerLineClearEffects(linesCleared, clearedRows, specialBlocksToTrigger, this.players.indexOf(player));
      }
    } else {
      // After locking (if no clear), send immediate grid + score sync for responsiveness
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
  }

  private executeClearAndResume(player: Player) {
    player.isClearingLines = false;
    const linesCleared = player.clearingRows.length;
    
    player.grid.executeLineClear(player.clearingRows);

    if (linesCleared > 0) {
      player.scoreManager.addScoreForLines(linesCleared);
      
      if (linesCleared >= 2) {
        const garbageCount = linesCleared - 1;
        if (this.isOnline) {
          this.network?.sendGarbage(garbageCount);
        } else {
          this.distributeGarbage(player, garbageCount);
        }
      }
    }

    for (const special of player.clearingSpecialBlocks) {
      if (special === SpecialBlockType.BOMB) {
        player.grid.clearBombArea(player.clearingRows[0], Math.floor(player.grid.width / 2));
      } else if (special === SpecialBlockType.HEAVY) {
        player.grid.clearLineDirectlyBeneath(player.clearingRows[0]);
      } else if (special === SpecialBlockType.MULTIPLIER) {
        player.scoreManager.activateMultiplierBlock();
      }
    }

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

<<<<<<< Updated upstream
=======
  // ==============================
  // Visual Effects
  // ==============================

  private triggerLineClearEffects(linesCleared: number, clearedRows: number[], specialBlocks: string[], playerIndex: number) {
    const BLOCK_SIZE = 30;
    const COLS = 10;
    const PADDING = 40;
    const offsetX = playerIndex * (COLS * BLOCK_SIZE + PADDING);
    const container = document.getElementById('overlays-container');
    if (!container) return;

    // Anime.js DOM Overlays for line clears
    for (const row of clearedRows) {
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.left = `${offsetX}px`;
      overlay.style.top = `${row * BLOCK_SIZE}px`;
      overlay.style.width = `${COLS * BLOCK_SIZE}px`;
      overlay.style.height = `${BLOCK_SIZE}px`;
      
      if (linesCleared >= 4) {
        // Tetris - Lingering Blinking
        overlay.style.backgroundColor = '#FF007F';
        overlay.style.boxShadow = '0 0 20px #FF007F';
        container.appendChild(overlay);
        anime({
          targets: overlay,
          opacity: [0, 1],
          direction: 'alternate',
          loop: 6, // 3 full blinks
          duration: 150,
          easing: 'linear',
          complete: () => overlay.remove()
        });
      } else if (linesCleared === 3) {
        // Triple
        overlay.style.backgroundColor = '#FFC107';
        container.appendChild(overlay);
        anime({
          targets: overlay,
          opacity: [1, 0],
          scaleX: [1, 1.2, 1],
          duration: 500,
          easing: 'easeOutElastic(1, .8)',
          complete: () => overlay.remove()
        });
      } else {
        // Single/Double
        overlay.style.backgroundColor = '#00E5FF';
        container.appendChild(overlay);
        anime({
          targets: overlay,
          opacity: [1, 0],
          duration: 300,
          easing: 'easeOutExpo',
          complete: () => overlay.remove()
        });
      }
    }

    // Special block animations
    for (const special of specialBlocks) {
      const row = clearedRows[0];
      const effectDiv = document.createElement('div');
      effectDiv.style.position = 'absolute';
      effectDiv.style.left = `${offsetX}px`;
      effectDiv.style.width = `${COLS * BLOCK_SIZE}px`;

      if (special === SpecialBlockType.MULTIPLIER) {
        // Gold Glint
        effectDiv.style.top = `${row * BLOCK_SIZE}px`;
        effectDiv.style.height = `${BLOCK_SIZE}px`;
        effectDiv.style.background = 'linear-gradient(90deg, transparent, rgba(255,215,0,0.8), transparent)';
        container.appendChild(effectDiv);
        anime({
          targets: effectDiv,
          translateX: [-200, 200],
          opacity: [1, 0],
          duration: 800,
          easing: 'easeInOutSine',
          complete: () => effectDiv.remove()
        });
      } else if (special === SpecialBlockType.BOMB) {
        // Explosion
        effectDiv.style.top = `${row * BLOCK_SIZE - BLOCK_SIZE}px`;
        effectDiv.style.height = `${BLOCK_SIZE * 3}px`; // 3x3 area height
        effectDiv.style.borderRadius = '50%';
        effectDiv.style.background = 'radial-gradient(circle, rgba(255,69,0,1) 0%, rgba(255,0,0,0) 70%)';
        effectDiv.style.left = `${offsetX - BLOCK_SIZE}px`;
        effectDiv.style.width = `${COLS * BLOCK_SIZE + BLOCK_SIZE*2}px`;
        container.appendChild(effectDiv);
        anime({
          targets: effectDiv,
          scale: [0, 2],
          opacity: [1, 0],
          duration: 600,
          easing: 'easeOutCirc',
          complete: () => effectDiv.remove()
        });
      } else if (special === SpecialBlockType.HEAVY) {
        // Silver Glint and Squish
        effectDiv.style.top = `${row * BLOCK_SIZE}px`;
        effectDiv.style.height = `${BLOCK_SIZE}px`;
        effectDiv.style.backgroundColor = '#C0C0C0';
        effectDiv.style.boxShadow = '0 0 15px #C0C0C0';
        container.appendChild(effectDiv);
        anime({
          targets: effectDiv,
          height: [BLOCK_SIZE, 0],
          top: [row * BLOCK_SIZE, row * BLOCK_SIZE + BLOCK_SIZE],
          opacity: [1, 0],
          duration: 400,
          easing: 'easeInQuad',
          complete: () => effectDiv.remove()
        });
      }
    }

    // Screen shake for Tetris (4+)
    if (linesCleared >= 4) {
      this.screenShake = {
        intensity: Math.min(linesCleared * 3, 15) * 1.5,
        duration: 400,
        timer: 400,
      };
      if (this.isOnline && this.network) {
        const pName = this.players[this.myPlayerIndex]?.id || "Someone";
        this.network.sendRibbon(`${pName} GOT A TETRIS!`);
      }
    } else if (linesCleared === 3) {
      this.screenShake = {
        intensity: 6,
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

>>>>>>> Stashed changes
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
