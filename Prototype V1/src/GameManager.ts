import { Player } from "./Player";
import { Tetromino, SHAPES } from "./Tetromino";
import { InputAction } from "./InputHandler";
import { SpecialBlockType } from "./ItemManager";
import { type Difficulty, type AbilityContext } from "./AIBot";
import { NetworkManager, type ScoreData } from "./NetworkManager";
import { type Cell } from "./Grid";
import { type PlayerClass } from "./PlayerClass";
import { AudioManager } from "./AudioManager";

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
  PREGAME: "PREGAME",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER",
  POST_GAME: "POST_GAME"
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

const CLASS_Q_COOLDOWN_MS = 10_000;
const CLASS_E_COOLDOWN_MS = 15_000;
const TIME_WARP_DURATION_MS = 6_000;
const BULLET_TIME_DURATION_MS = 5_000;
const CHAOS_DURATION_MS = 8_000;
const PERFECT_CLEAR_WINDOW_MS = 15_000;

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
  public battleRoyalMode = false;
  public battleRoyalPhase = '';
  public battleRoyalRemaining = 0;
  public battleRoyalKills = 0;
  public battleRoyalTargetScore = 1_000_000;
  public battleRoyalRankings: Array<{ rank: number; name: string; score: number; lines: number; kills: number; eliminated: boolean }> = [];

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

  public initSolo(humanClass: PlayerClass = 'TANK', preGameDelayMs: number = 5000) {
    this.isOnline = false;
    this.network = null;
    this.players = [new Player("P1", false, 'HARD', true, humanClass)];
    this.start(preGameDelayMs);
  }

  public init1v1(difficulty: Difficulty, humanClass: PlayerClass = 'TANK', preGameDelayMs: number = 5000) {
    this.isOnline = false;
    this.network = null;
    const botClasses: PlayerClass[] = ['SPEEDSTER', 'TANK', 'SABOTEUR'];
    const botClass = botClasses[Math.floor(Math.random() * botClasses.length)];
    import('./BotNames').then(({ getUniqueBotName }) => {
      this.players = [
        new Player("P1", false, 'HARD', true, humanClass),
        new Player(getUniqueBotName(["P1"]), true, difficulty, true, botClass)
      ];
      this.start(preGameDelayMs);
    });
  }

  /**
   * Initialize an online multiplayer game.
   * Called when the server signals game-start.
   * @param playerCount Total number of players in the room
   * @param myIndex This player's index (0-based)
   * @param net The active NetworkManager instance
   */
  public initOnline(playerCount: number, myIndex: number, net: NetworkManager, playerSpecs: any[] = [], humanClass: PlayerClass = 'TANK') {
    this.isOnline = true;
    this.network = net;
    this.myPlayerIndex = myIndex;
    this.onlineWinnerName = "";
    this.battleRoyalMode = false;
    this.battleRoyalPhase = '';
    this.battleRoyalRemaining = playerCount;
    this.battleRoyalKills = 0;
    this.battleRoyalRankings = [];

    // Create player instances. Only our own player is human-controlled.
    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      const spec = playerSpecs[i] || {};
      const pName = spec.name || `P${i + 1}`;
      
      if (i === myIndex) {
        // Our local player — listens to keyboard, uses our chosen class.
        this.players.push(new Player(pName, false, 'HARD', true, humanClass));
      } else if (spec.isBot && spec.ownerId === net.mySocketId) {
        // A bot owned by us! We need to simulate it locally and broadcast its state.
        const botPlayer = new Player(pName, true, 'EASY', false);
        // We'll attach the botId to the player object so we know how to broadcast for it
        (botPlayer as any).botId = spec.id;
        this.players.push(botPlayer);
      } else {
        // Remote player (or remote bot) — no keyboard, no bot. Grid/piece will be synced from server.
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
        player.kills = data.kills ?? player.kills;
        player.scoreManager.combo = data.combo;
        player.scoreManager.scoreMultiplier = data.multiplier ?? 1;
      }
    };

    net.onOpponentToppedOut = (playerIndex: number) => {
      if (playerIndex < this.players.length && playerIndex !== myIndex) {
        this.players[playerIndex].isToppedOut = true;
      }
    };

    net.onPlayerStateUpdate = ({ playerId, state }) => {
      if (state !== 'spectating') return;
      const playerIndex = this.players.findIndex(player => player.id === playerId);
      if (playerIndex >= 0) {
        this.players[playerIndex].isToppedOut = true;
        this.players[playerIndex].battleRoyalEliminated = this.battleRoyalMode;
      }
      if (playerId === net.mySocketId) {
        const localPlayer = this.players[myIndex];
        if (localPlayer) {
          localPlayer.isToppedOut = true;
          localPlayer.battleRoyalEliminated = this.battleRoyalMode;
        }
        this.renderFn();
      }
    };

    net.onReceiveGarbage = (count: number, fromIndex?: number, options?: { solid?: boolean; unClearable?: boolean; source?: string }, targetIndex?: number) => {
      // Find the specific player this is meant for (either us or a bot we own)
      const targetPlayer = (targetIndex !== undefined && targetIndex !== null)
        ? this.players[targetIndex]
        : this.players[myIndex];

      if (targetPlayer && !targetPlayer.isToppedOut) {
        // If it's a remote player we don't own, ignore it (we only process our own state and our bots' state)
        if (targetPlayer !== this.players[myIndex] && !(targetPlayer as any).botId) return;

        const isSolidSuddenDeath = Boolean(options?.solid || options?.unClearable);
        if (!isSolidSuddenDeath && targetPlayer.shieldActive) {
          targetPlayer.shieldActive = false;
          return;
        }
        if (!isSolidSuddenDeath && targetPlayer.fortifyCharges > 0) {
          targetPlayer.fortifyCharges--;
          return;
        }
        if (!isSolidSuddenDeath && targetPlayer.reflectGarbage && fromIndex !== undefined) {
          targetPlayer.reflectGarbage = false;
          this.network?.sendReflectedGarbage(fromIndex, count);
          return;
        }
        targetPlayer.grid.addGarbageLines(count, 'HUMAN', { solid: isSolidSuddenDeath, unClearable: Boolean(options?.unClearable) });
        if (!isSolidSuddenDeath && targetPlayer.supportPassiveConversion) {
          targetPlayer.grid.convertGarbageToSpecialBlocks(count);
          targetPlayer.supportPassiveConversion = false;
        } else if (!isSolidSuddenDeath && targetPlayer.recycleGarbageLines > 0) {
          const converted = targetPlayer.grid.convertGarbageToSpecialBlocks(Math.min(count, targetPlayer.recycleGarbageLines));
          targetPlayer.recycleGarbageLines = Math.max(0, targetPlayer.recycleGarbageLines - converted);
        }
      }
    };

    net.onBattleRoyalPhase = data => {
      this.battleRoyalMode = true;
      this.battleRoyalPhase = data.label;
      this.battleRoyalRemaining = data.remainingPlayers;
      this.renderFn();
    };
    net.onBattleRoyalCull = data => {
      this.battleRoyalMode = true;
      this.battleRoyalRemaining = data.remainingPlayers;
      this.renderFn();
    };
    net.onBattleRoyalSuddenDeath = data => {
      this.battleRoyalMode = true;
      this.battleRoyalRemaining = data.remainingPlayers;
      this.renderFn();
    };
    net.onBattleRoyalPostGame = data => {
      this.battleRoyalMode = true;
      this.battleRoyalRankings = data.rankings.map(entry => ({ rank: entry.rank, name: entry.name, score: entry.score, lines: entry.lines, kills: entry.kills, eliminated: entry.eliminated }));
      this.battleRoyalTargetScore = data.targetScore;
      this.onlineWinnerName = data.winnerName;
      this.state = GameState.GAME_OVER;
      this.renderFn();
    };

    net.onClassEffect = effect => {
      const targetPlayer = (effect.targetIndex !== undefined && effect.targetIndex !== null)
        ? this.players[effect.targetIndex]
        : this.players[myIndex];

      if (!targetPlayer || targetPlayer.isToppedOut) return;
      if (targetPlayer !== this.players[myIndex] && !(targetPlayer as any).botId) return;

      if (effect.type === 'QUICKSILVER') {
        targetPlayer.activeEffectType = 'QUICKSILVER';
        targetPlayer.activeEffectTimer = effect.durationMs ?? BULLET_TIME_DURATION_MS;
        targetPlayer.inputHandler.freezeFor(targetPlayer.activeEffectTimer);
      } else if (effect.type === 'CHAOS') {
        targetPlayer.activeEffectType = 'CHAOS';
        targetPlayer.activeEffectTimer = effect.durationMs ?? CHAOS_DURATION_MS;
        targetPlayer.inputHandler.reverseFor(targetPlayer.activeEffectTimer);
      } else if (effect.type === 'SCRAMBLE') {
        this.scramblePreview(targetPlayer, effect.amount ?? 5);
      } else if (effect.type === 'GRID_SHIFT') {
        targetPlayer.grid.shiftHorizontally(effect.direction === -1 ? -2 : 2);
      } else if (effect.type === 'GUARDIAN_ANGEL') {
        targetPlayer.grid.clearBottomLines(effect.amount ?? 4);
      } else if (effect.type === 'ABILITY_FREEZE') {
        targetPlayer.abilityFreezeTimer = effect.durationMs ?? 3000;
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

    this.start(5000);
  }

  private preGameTimerMs: number = 0;

  public start(preGameMs: number = 0) {
    if (preGameMs > 0) {
      this.state = GameState.PREGAME;
      this.preGameTimerMs = preGameMs;
    } else {
      this.state = GameState.PLAYING;
    }
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

    if (this.state === GameState.PLAYING || this.state === GameState.PREGAME) {
      this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    } else if (this.state === GameState.GAME_OVER) {
      this.renderFn(); // one last render
    }
  }

  private update(dt: number) {
    if (this.state === GameState.PREGAME) {
      this.preGameTimerMs -= dt;
      if (this.preGameTimerMs <= 0) {
        this.state = GameState.PLAYING;
      }
      return;
    }
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

      // In online mode, only update our own player's game logic and our own bots
      if (this.isOnline && i !== this.myPlayerIndex && !(player as any).botId) {
        continue; // Remote players are synced via network events
      }

      player.timeSurvived += dt;
      player.scoreManager.update(dt);
      player.abilityCooldowns.Q = Math.max(0, player.abilityCooldowns.Q - dt);
      player.abilityCooldowns.E = Math.max(0, player.abilityCooldowns.E - dt);
      player.perfectClearWindow = Math.max(0, player.perfectClearWindow - dt);

      player.koStampTimer = Math.max(0, player.koStampTimer - dt);

      player.abilityFreezeTimer = Math.max(0, player.abilityFreezeTimer - dt);


      if (player.activeEffectTimer > 0) {
        player.activeEffectTimer = Math.max(0, player.activeEffectTimer - dt);
        if (player.activeEffectTimer === 0) {
          if (player.activeEffectType === 'TIME_WARP') {
            player.dropInterval = Math.max(100, player.dropInterval / 2);
          }
          player.activeEffectType = null;
        }
      }

      // AI update
      if (player.bot) {
        // Build ability context for the bot's ability evaluator
        const abilityCtx: AbilityContext = {
          playerClass: player.playerClass,
          abilityCooldowns: { ...player.abilityCooldowns },
          classMeter: player.classMeter,
          abilityFreezeTimer: player.abilityFreezeTimer,
          fortifyCharges: player.fortifyCharges,
          reflectGarbage: player.reflectGarbage,
          gridShiftUsedLevel: player.gridShiftUsedLevel,
          currentLevel: Math.floor(player.scoreManager.totalLinesCleared / 10),
          boardHeight: this.getMaxColumnHeight(player),
          holeCount: this.countHoles(player),
          selectedTargetIndex: player.selectedTargetIndex,
          hasOpponents: this.players.some(p => p !== player && !p.isToppedOut),
        };
        player.bot.update(player.currentPiece, player.nextPiece, dt, abilityCtx);
      } else {
        // Human input auto-repeat tick
        player.inputHandler.update(dt);
      }

      if (player.activeEffectType === 'QUICKSILVER' && player.activeEffectTimer > 0) {
        continue;
      }

      // Spawning
      if (!player.currentPiece) {
        this.handleSpawning(player);
        if (player.isToppedOut) {
          if (this.isOnline) {
            // Tell server we (or our bot) topped out
            if ((player as any).botId) {
              this.network?.sendEliminated(undefined, (player as any).botId);
            } else {
              this.network?.sendToppedOut();
            }
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

    // Get all players we need to sync (our local player + our bots)
    const playersToSync = this.players.filter((p, i) => i === this.myPlayerIndex || (p as any).botId);

    // Grid sync
    this.gridSyncTimer += dt;
    const doGridSync = this.gridSyncTimer >= this.GRID_SYNC_INTERVAL;
    if (doGridSync) this.gridSyncTimer = 0;

    // Piece sync
    this.pieceSyncTimer += dt;
    const doPieceSync = this.pieceSyncTimer >= this.PIECE_SYNC_INTERVAL;
    if (doPieceSync) this.pieceSyncTimer = 0;

    // Score sync
    this.scoreSyncTimer += dt;
    const doScoreSync = this.scoreSyncTimer >= this.SCORE_SYNC_INTERVAL;
    if (doScoreSync) this.scoreSyncTimer = 0;

    for (const p of playersToSync) {
      if (p.isToppedOut) continue;
      const botId = (p as any).botId;

      if (doGridSync) {
        this.network.sendGridUpdate(p.grid.matrix, botId);
      }
      
      if (doPieceSync) {
        if (p.currentPiece) {
          this.network.sendPieceUpdate({
            type: p.currentPiece.type,
            x: p.currentPiece.x,
            y: p.currentPiece.y,
            rotationIndex: p.currentPiece.rotationIndex,
          }, botId);
        } else {
          this.network.sendPieceUpdate(null, botId);
        }
      }

      // No need to send generic score update for bots, they just emit score-event
      if (doScoreSync && !botId) {
        this.network.sendScoreUpdate({
          score: p.scoreManager.score,
          lines: p.scoreManager.totalLinesCleared,
          combo: p.scoreManager.combo,
          multiplier: p.scoreManager.scoreMultiplier,
          kills: p.kills,
        });
      }
    }
  }

  /**
   * K.O. recovery (Battle Royale, at/below the player floor): instead of
   * being eliminated, the board keeps only user-placed blocks, garbage is
   * destroyed, survivors collapse down, and play resumes.
   */
  public applyKoRecovery(koCount: number, authoritativeScore: number) {
    const me = this.players[this.myPlayerIndex];
    if (!me) return;

    me.grid.clearGarbageOnlyAndCollapse();
    me.isToppedOut = false;
    me.koCount = koCount;
    me.koStampTimer = 2500;
    me.scoreManager.score = authoritativeScore;
    me.scoreManager.combo = 0;
    me.currentPiece = null;
    me.dropTimer = 0;
    me.inputHandler.clear();
    if (this.state === GameState.GAME_OVER) this.state = GameState.PLAYING;
  }

  private handleSpawning(player: Player) {
    if (!player.nextPiece) {
      player.nextPiece = new Tetromino(player.bag.getNext());
      player.itemManager.applyItemToTetromino(player.nextPiece);
    }

    if (player.scramblePreviewCount > 0) {
      player.nextPiece = new Tetromino(player.bag.getNext());
      player.itemManager.applyItemToTetromino(player.nextPiece);
      player.scramblePreviewCount--;
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

    if (player.activeEffectType === 'TIME_WARP' && player.activeEffectTimer > 0) {
      player.dropInterval *= 2;
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
    if (action === InputAction.ABILITY_Q) {
      this.tryUseClassAbility(player, 'Q');
      return;
    }
    if (action === InputAction.ABILITY_E) {
      this.tryUseClassAbility(player, 'E');
      return;
    }
    if (action === InputAction.ULTIMATE) {
      this.tryUseClassAbility(player, 'R');
      return;
    }
    if (action === InputAction.TARGET_NEXT) {
      this.cycleClassTarget(player);
      return;
    }

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
        this.hardDropPiece(player);
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

  private hardDropPiece(player: Player) {
    if (!player.currentPiece) return;
    let dropped = 0;
    while (this.movePiece(player, 0, 1)) dropped++;
    player.scoreManager.addDropScore(dropped * 2);
    this.handlePieceLock(player);
  }

  private tryUseClassAbility(player: Player, slot: 'Q' | 'E' | 'R') {
    if (player.abilityFreezeTimer > 0) return;
    if (slot !== 'R' && player.abilityCooldowns[slot] > 0) return;
    const level = Math.floor(player.scoreManager.totalLinesCleared / 10);

    if (slot === 'Q') {
      if (player.playerClass === 'SPEEDSTER') {
        this.hardDropPiece(player);
        player.abilityCooldowns.Q = 12_000;
      } else if (player.playerClass === 'TANK') {
        player.fortifyCharges = 2;
        player.abilityCooldowns.Q = CLASS_Q_COOLDOWN_MS;
      } else if (player.playerClass === 'SABOTEUR') {
        this.sendOrApplyClassEffect(player, { type: 'SCRAMBLE', amount: 5, targetIndex: player.selectedTargetIndex ?? undefined });
        player.abilityCooldowns.Q = 12_000;
      } else if (player.playerClass === 'SUPPORT') {
        player.recycleGarbageLines = 4;
        player.abilityCooldowns.Q = CLASS_Q_COOLDOWN_MS;
      }
      return;
    }

    if (slot === 'E') {
      if (player.playerClass === 'SPEEDSTER') {
        player.activeEffectType = 'TIME_WARP';
        player.activeEffectTimer = TIME_WARP_DURATION_MS;
        player.dropInterval *= 2;
        player.abilityCooldowns.E = CLASS_E_COOLDOWN_MS;
      } else if (player.playerClass === 'TANK') {
        player.reflectGarbage = true;
        player.abilityCooldowns.E = 20_000;
      } else if (player.playerClass === 'SABOTEUR') {
        if (player.gridShiftUsedLevel === level) return;
        player.gridShiftUsedLevel = level;
        this.sendOrApplyClassEffect(player, { type: 'GRID_SHIFT', direction: Math.random() < 0.5 ? -1 : 1, targetIndex: player.selectedTargetIndex ?? undefined });
      } else if (player.playerClass === 'SUPPORT') {
        player.perfectClearWindow = PERFECT_CLEAR_WINDOW_MS;
        player.abilityCooldowns.E = 25_000;
      }
      return;
    }

    const ultimateCost = player.playerClass === 'SPEEDSTER' ? 40 : player.playerClass === 'TANK' ? 50 : player.playerClass === 'SABOTEUR' ? 35 : 45;
    if (player.classMeter < ultimateCost) return;
    player.classMeter = 0;
    if (player.playerClass === 'SPEEDSTER') {
      this.sendOrApplyClassEffect(player, { type: 'QUICKSILVER', durationMs: BULLET_TIME_DURATION_MS });
    } else if (player.playerClass === 'TANK') {
      this.sendOrApplyClassEffect(player, { type: 'EARTHQUAKE', amount: 10 });
    } else if (player.playerClass === 'SABOTEUR') {
      this.sendOrApplyClassEffect(player, { type: 'CHAOS', durationMs: CHAOS_DURATION_MS });
    } else if (player.playerClass === 'SUPPORT') {
      this.sendOrApplyClassEffect(player, { type: 'GUARDIAN_ANGEL', amount: 4, targetIndex: player.selectedTargetIndex ?? undefined });
    }
  }

  private cycleClassTarget(player: Player) {
    const candidates = this.players
      .map((target, index) => ({ target, index }))
      .filter(({ target }) => target !== player && !target.isToppedOut)
      .map(({ index }) => index);
    if (!candidates.length) {
      player.selectedTargetIndex = null;
      return;
    }
    const current = player.selectedTargetIndex === null ? -1 : candidates.indexOf(player.selectedTargetIndex);
    player.selectedTargetIndex = candidates[(current + 1) % candidates.length];
  }

  private sendOrApplyClassEffect(player: Player, effect: { type: 'QUICKSILVER' | 'CHAOS' | 'SCRAMBLE' | 'GRID_SHIFT' | 'EARTHQUAKE' | 'GUARDIAN_ANGEL' | 'ABILITY_FREEZE'; durationMs?: number; amount?: number; direction?: -1 | 1; targetIndex?: number }) {
    if (this.isOnline) {
      this.network?.sendClassAbility(effect);
      return;
    }
    const opponents = this.players.filter(target => target.id !== player.id && !target.isToppedOut);
    const selectedTarget = effect.targetIndex === undefined ? undefined : this.players[effect.targetIndex];
    if (effect.type === 'QUICKSILVER') opponents.forEach(target => target.inputHandler.freezeFor(effect.durationMs ?? BULLET_TIME_DURATION_MS));
    else if (effect.type === 'CHAOS') opponents.forEach(target => target.inputHandler.reverseFor(effect.durationMs ?? CHAOS_DURATION_MS));
    else if (effect.type === 'SCRAMBLE') this.scramblePreview(selectedTarget && selectedTarget !== player ? selectedTarget : opponents[0], effect.amount ?? 5);
    else if (effect.type === 'GRID_SHIFT') (selectedTarget && selectedTarget !== player ? selectedTarget : opponents[0])?.grid.shiftHorizontally((effect.direction ?? 1) * 2);
    else if (effect.type === 'EARTHQUAKE') opponents.forEach(target => target.grid.addGarbageLines(effect.amount ?? 10, 'HUMAN'));
    else if (effect.type === 'GUARDIAN_ANGEL') player.grid.clearBottomLines(effect.amount ?? 4);
    else if (effect.type === 'ABILITY_FREEZE') opponents.forEach(target => { target.abilityFreezeTimer = effect.durationMs ?? 3000; });
  }

  private scramblePreview(player: Player | undefined, count: number) {
    if (!player) return;
    const total = Math.max(1, count);
    player.bag.scramblePreview(total);
    if (player.nextPiece) {
      player.nextPiece = new Tetromino(player.bag.getNext());
      player.itemManager.applyItemToTetromino(player.nextPiece);
    } else {
      player.scramblePreviewCount += total;
    }
  }

  /** Freezes all opponents' abilities (Q/E/R) for the specified duration. Triggered by the Freeze special block. */
  private applyAbilityFreeze(source: Player, durationMs: number) {
    if (this.isOnline) {
      this.network?.sendClassAbility({ type: 'ABILITY_FREEZE', durationMs });
      return;
    }
    for (const target of this.players) {
      if (target.id !== source.id && !target.isToppedOut) {
        target.abilityFreezeTimer = durationMs;
      }
    }
  }

  private performHold(player: Player) {
    if (player.hasHeld || !player.currentPiece) return;

    if (player.holdPiece) {
      const temp = player.holdPiece;
      // Store current piece WITH its specials into hold
      player.holdPiece = new Tetromino(player.currentPiece.type);
      player.holdPiece.specialBlocks = new Map(player.currentPiece.specialBlocks);
      // Restore held piece WITH its preserved specials
      player.currentPiece = new Tetromino(temp.type);
      player.currentPiece.specialBlocks = new Map(temp.specialBlocks);
    } else {
      player.holdPiece = new Tetromino(player.currentPiece.type);
      player.holdPiece.specialBlocks = new Map(player.currentPiece.specialBlocks);
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

      // Server-authoritative scoring: report the EVENT, not a raw score.
      // The local score above stays as an immediate prediction for the HUD;
      // the server's authoritative value overwrites it when it echoes back.
      if (this.isOnline) {
        if (player === this.players[this.myPlayerIndex]) {
          this.network?.sendScoreEvent('lines', linesCleared, player.scoreManager.combo);
        } else if ((player as any).botId) {
          this.network?.sendScoreEvent('lines', linesCleared, player.scoreManager.combo, (player as any).botId);
        }
      }
      player.classMeter += linesCleared;

      // Trigger visual + audio effects for the local player's clears
      if (!this.isOnline || player === this.players[this.myPlayerIndex]) {
        this.triggerLineClearEffects(linesCleared, clearedRows);
        AudioManager.playSfx('lineClear');
      }

      if (linesCleared >= 4) {
        if (player.playerClass === 'SPEEDSTER') {
          if (player.nextPiece) player.itemManager.applySpecificItemToTetromino(player.nextPiece, SpecialBlockType.SPEED);
          else player.itemManager.forceNextItem(SpecialBlockType.SPEED);
        } else if (player.playerClass === 'TANK') {
          if (player.nextPiece) player.itemManager.applySpecificItemToTetromino(player.nextPiece, SpecialBlockType.HEAVY);
          else player.itemManager.forceNextItem(SpecialBlockType.HEAVY);
        } else if (player.playerClass === 'SABOTEUR') {
          this.sendOrApplyClassEffect(player, { type: 'SCRAMBLE', amount: 1, targetIndex: player.selectedTargetIndex ?? undefined });
        } else if (player.playerClass === 'SUPPORT') {
          player.supportPassiveConversion = true;
        }
      }

      if (player.playerClass === 'SUPPORT' && player.perfectClearWindow > 0 && player.grid.isEmpty()) {
        player.scoreManager.addBonusLines(4);
        player.classMeter += 4;
        player.perfectClearWindow = 0;
      }

      if (linesCleared >= 2) {
        const garbageCount = linesCleared - 1;
        if (this.isOnline) {
          // In online mode, send garbage through the server
          this.network?.sendGarbage(garbageCount, player.selectedTargetIndex ?? undefined);
        } else {
          this.distributeGarbage(player, garbageCount);
        }
      }
    }

    // Special blocks — deduplicate so each type fires at most once (does not stack)
    const uniqueSpecials = new Set(specialBlocksToTrigger);
    for (const special of uniqueSpecials) {
      if (special === SpecialBlockType.BOMB) {
        player.grid.clearBombArea(clearedRows[0], Math.floor(player.grid.width / 2));
      } 
      else if (special === SpecialBlockType.HEAVY) {
      // Handled inside Grid.clearLines() itself now — destroying the row
      // beneath a HEAVY block has to happen before compaction, not after.
      } else if (special === SpecialBlockType.MULTIPLIER) {
        player.scoreManager.activateMultiplierBlock();
      } else if (special === SpecialBlockType.SPEED) {
        player.dropInterval = Math.max(100, player.dropInterval * 0.75);
      } else if (special === SpecialBlockType.SHIELD) {
        player.shieldActive = true;
      } else if (special === SpecialBlockType.FREEZE) {
        this.applyAbilityFreeze(player, 3000);
      } else if (special === SpecialBlockType.GARBAGE_EATER) {
        player.grid.clearGarbageLines(1);
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

    const validOpponents = this.players.filter(p => p.id !== sender.id && !p.isToppedOut);
    if (validOpponents.length === 0) return;

    let target = validOpponents[Math.floor(Math.random() * validOpponents.length)];
    if (sender.selectedTargetIndex !== null && sender.selectedTargetIndex !== undefined) {
      const explicitTarget = this.players[sender.selectedTargetIndex];
      if (explicitTarget && validOpponents.includes(explicitTarget)) {
        target = explicitTarget;
      }
    }

    // Apply to target
    if (target.shieldActive) {
      target.shieldActive = false;
      return;
    }
    if (target.fortifyCharges > 0) {
      target.fortifyCharges--;
      return;
    }
    if (target.reflectGarbage) {
      target.reflectGarbage = false;
      sender.grid.addGarbageLines(count, senderType);
      return;
    }
    target.grid.addGarbageLines(count, senderType);
    if (target.supportPassiveConversion) {
      target.grid.convertGarbageToSpecialBlocks(count);
      target.supportPassiveConversion = false;
    } else if (target.recycleGarbageLines > 0) {
      const converted = target.grid.convertGarbageToSpecialBlocks(Math.min(count, target.recycleGarbageLines));
      target.recycleGarbageLines = Math.max(0, target.recycleGarbageLines - converted);
    }
  }

  // ==============================
  // Board Analysis Helpers (for bot ability context)
  // ==============================

  private getMaxColumnHeight(player: Player): number {
    const grid = player.grid;
    let maxHeight = 0;
    for (let c = 0; c < grid.width; c++) {
      for (let r = 0; r < grid.height; r++) {
        if (grid.matrix[r][c].type !== null) {
          maxHeight = Math.max(maxHeight, grid.height - r);
          break;
        }
      }
    }
    return maxHeight;
  }

  private countHoles(player: Player): number {
    const grid = player.grid;
    let holes = 0;
    for (let c = 0; c < grid.width; c++) {
      let blockAbove = false;
      for (let r = 0; r < grid.height; r++) {
        if (grid.matrix[r][c].type !== null) {
          blockAbove = true;
        } else if (blockAbove) {
          holes++;
        }
      }
    }
    return holes;
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