import { Player } from "./Player";
import { Tetromino, SHAPES } from "./Tetromino";
import { InputAction } from "./InputHandler";
import { SpecialBlockType } from "./ItemManager";
import { type Difficulty, type AbilityContext } from "./AIBot";
import { buildWorldState } from "./BotWorldState";
import { NetworkManager, type ScoreData } from "./NetworkManager";
import { type Cell } from "./Grid";
import { type PlayerClass } from "./PlayerClass";
import { AudioManager } from "./AudioManager";
import { getUniqueBotName } from "./BotNames";

// Visual Effects System
export interface Particle {
  playerIndex: number;
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
  playerIndex?: number;
  row: number;
  flash: number; // 0-1, fades out
  color: string;
}

interface ComboText {
  playerIndex?: number;
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
  TUTORIAL: "TUTORIAL",
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
  public tutorialAbilityGuard: ((slot: 'Q' | 'E' | 'R', player: Player) => boolean) | null = null;
  
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
  public isTeamMode = false;
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
    const botClasses: PlayerClass[] = ['SPEEDSTER', 'TANK', 'SABOTEUR', 'SUPPORT'];
    const botClass = botClasses[Math.floor(Math.random() * botClasses.length)];
    this.players = [
      new Player("P1", false, 'HARD', true, humanClass),
      new Player(getUniqueBotName(["P1"]), true, difficulty, true, botClass)
    ];
    this.start(preGameDelayMs);
  }

  /**
   * Phase 1 & Phase 5: Instantiate a localized TUTORIAL session with a secondary,
   * non-playable 10x20 Dummy Grid (or 3 Dummy Grids for Phase 4 AoE sandbox).
   * Disables keyboard input on Dummy Boards and locks the player's O(1) targeting pointer to the Dummy Board.
   */
  public initTutorialWithDummy(humanClass: PlayerClass = 'TANK', dummyCount: number = 1, useRestrictedAi: boolean = false) {
    this.isOnline = false;
    this.network = null;
    const human = new Player("P1", false, 'HARD', true, humanClass);
    human.selectedTargetIndex = 1; // Task 1.3: Force targeting pointer onto the Dummy Board
    const dummies: Player[] = [];
    for (let i = 0; i < Math.max(1, dummyCount); i++) {
      const dummy = new Player(`DUMMY-${i + 1}`, useRestrictedAi, 'EASY', false, 'TANK');
      dummy.inputHandler.freeze();
      dummies.push(dummy);
    }
    this.players = [human, ...dummies];
    this.state = GameState.TUTORIAL;
  }

  /**
   * Initialize an online multiplayer game.
   * Called when the server signals game-start.
   * @param playerCount Total number of players in the room
   * @param myIndex This player's index (0-based)
   * @param net The active NetworkManager instance
   */
  public initOnline(playerCount: number, myIndex: number, net: NetworkManager, playerSpecs: any[] = [], humanClass: PlayerClass = 'TANK', modeOptions?: { isTeamMode?: boolean }) {
    this.isOnline = true;
    this.network = net;
    this.myPlayerIndex = myIndex;
    this.onlineWinnerName = "";
    this.battleRoyalMode = false;
    this.isTeamMode = modeOptions?.isTeamMode ?? false;
    this.battleRoyalPhase = '';
    this.battleRoyalRemaining = playerCount;
    this.battleRoyalKills = 0;
    this.battleRoyalRankings = [];

    // Create player instances. Only our own player is human-controlled.
    this.players = [];
    
    // We only assign 1 CHASER per game to keep things balanced. 
    // We'll pick the first bot owned by the host as the chaser.
    let chaserAssigned = false;

    for (let i = 0; i < playerCount; i++) {
      const spec = playerSpecs[i] || {};
      const pName = spec.name || `P${i + 1}`;
      const pClass: PlayerClass = (spec.classId as PlayerClass) || (i === myIndex ? humanClass : 'TANK');
      
      let createdPlayer: Player;
      if (i === myIndex) {
        // Our local player — listens to keyboard, uses our chosen class.
        createdPlayer = new Player(pName, false, 'HARD', true, pClass);
      } else if (spec.isBot && spec.ownerId === net.mySocketId) {
        // A bot owned by us! We need to simulate it locally and broadcast its state.
        const botPlayer = new Player(pName, true, 'EASY', false, pClass);
        // We'll attach the botId to the player object so we know how to broadcast for it
        (botPlayer as any).botId = spec.id;
        
        // Assign personality
        if (!chaserAssigned && !this.isTeamMode) {
          if (botPlayer.bot) {
            botPlayer.bot.personality = 'CHASER';
            chaserAssigned = true;
          }
        }

        createdPlayer = botPlayer;
      } else {
        // Remote player (or remote bot) — no keyboard, no bot. Grid/piece will be synced from server.
        createdPlayer = new Player(pName, false, 'HARD', false, pClass);
      }
      (createdPlayer as any).socketId = spec.id;
      this.players.push(createdPlayer);
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

    const prevOnPlayerStateUpdate = net.onPlayerStateUpdate;
    net.onPlayerStateUpdate = (data) => {
      prevOnPlayerStateUpdate?.(data);
      const { playerId, playerIndex: evtIndex, state } = data;
      if (state !== 'spectating') return;
      const resolvedIndex = (typeof evtIndex === 'number' && evtIndex >= 0 && evtIndex < this.players.length)
        ? evtIndex
        : this.players.findIndex(player => (player as any).socketId === playerId || player.id === playerId);
      if (resolvedIndex >= 0 && this.players[resolvedIndex]) {
        this.players[resolvedIndex].isToppedOut = true;
        this.players[resolvedIndex].battleRoyalEliminated = this.battleRoyalMode;
      }
      if (playerId === net.mySocketId) {
        const localPlayer = this.players[myIndex];
        if (localPlayer) {
          localPlayer.isToppedOut = true;
          localPlayer.battleRoyalEliminated = this.battleRoyalMode;
        }
      }
      this.renderFn();
    };

    net.onReceiveGarbage = (count: number, fromIndex?: number, options?: { solid?: boolean; unClearable?: boolean; source?: string }, targetIndex?: number) => {
      // Find the specific player this is meant for (either us or a bot we own)
      const resolvedIdx = (targetIndex !== undefined && targetIndex !== null) ? targetIndex : myIndex;
      const targetPlayer = this.players[resolvedIdx];

      if (targetPlayer && !targetPlayer.isToppedOut) {
        // If it's a remote player we don't own, ignore it (we only process our own state and our bots' state)
        if (targetPlayer !== this.players[myIndex] && !(targetPlayer as any).botId) return;

        const isSolidSuddenDeath = Boolean(options?.solid || options?.unClearable);
        if (!isSolidSuddenDeath && targetPlayer.shieldActive) {
          targetPlayer.shieldActive = false;
          targetPlayer.shieldDeflectTimer = 900;
          this.spawnBoardExplosionParticles(resolvedIdx, 150, 18 * 30, '#00FF88', '#00E5FF', 24);
          this.spawnBoardFloatingText(resolvedIdx, '🛡 ATTACK BLOCKED!', 150, 13 * 30, '#00FF88', 14);
          return;
        }
        if (!isSolidSuddenDeath && targetPlayer.fortifyCharges > 0) {
          targetPlayer.fortifyCharges--;
          this.spawnBoardFloatingText(resolvedIdx, `🛡 FORTIFY BLOCKED! (${targetPlayer.fortifyCharges} LEFT)`, 150, 13 * 30, '#00FF88', 13);
          return;
        }
        if (!isSolidSuddenDeath && targetPlayer.reflectGarbage && fromIndex !== undefined) {
          targetPlayer.reflectGarbage = false;
          this.network?.sendReflectedGarbage(fromIndex, count);
          this.spawnBoardFloatingText(resolvedIdx, `⚡ REFLECTED ${count} LINES!`, 150, 13 * 30, '#FF1493', 14);
          return;
        }
        targetPlayer.grid.addGarbageLines(count, 'HUMAN', { solid: isSolidSuddenDeath, unClearable: Boolean(options?.unClearable) });
        if (!isSolidSuddenDeath && targetPlayer.supportPassiveConversion) {
          targetPlayer.grid.convertGarbageToSpecialBlocks(count);
          targetPlayer.supportPassiveConversion = false;
          this.spawnBoardFloatingText(resolvedIdx, '♻ PASSIVE RECYCLE!', 150, 14 * 30, '#00E5FF', 13);
        } else if (!isSolidSuddenDeath && targetPlayer.recycleGarbageLines > 0) {
          const converted = targetPlayer.grid.convertGarbageToSpecialBlocks(Math.min(count, targetPlayer.recycleGarbageLines));
          targetPlayer.recycleGarbageLines = Math.max(0, targetPlayer.recycleGarbageLines - converted);
          this.spawnBoardFloatingText(resolvedIdx, '♻ GARBAGE RECYCLED!', 150, 14 * 30, '#00E5FF', 13);
        }
        // Stage 4: Reactive replanning — bot received garbage, force re-evaluation
        if (targetPlayer.bot) {
          targetPlayer.bot.replan();
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
      this.players.forEach(p => {
        if (p.bot) p.bot.replan();
      });
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
      const resolvedIdx = (effect.targetIndex !== undefined && effect.targetIndex !== null)
        ? effect.targetIndex
        : myIndex;
      const targetPlayer = this.players[resolvedIdx];

      if (!targetPlayer || targetPlayer.isToppedOut) return;
      if (targetPlayer !== this.players[myIndex] && !(targetPlayer as any).botId) return;

      if (effect.type === 'QUICKSILVER') {
        const dur = effect.durationMs ?? BULLET_TIME_DURATION_MS;
        targetPlayer.quicksilverTimer = dur;
        targetPlayer.activeEffectType = 'QUICKSILVER';
        targetPlayer.activeEffectTimer = dur;
        targetPlayer.inputHandler.freezeFor(dur);
        this.spawnBoardFloatingText(resolvedIdx, '❄ BULLET TIME FROZEN!', 150, 10 * 30, '#00E5FF', 14);
      } else if (effect.type === 'CHAOS') {
        const dur = effect.durationMs ?? CHAOS_DURATION_MS;
        targetPlayer.chaosTimer = dur;
        targetPlayer.activeEffectType = 'CHAOS';
        targetPlayer.activeEffectTimer = dur;
        targetPlayer.inputHandler.reverseFor(dur);
        this.spawnBoardFloatingText(resolvedIdx, '🌀 CHAOS! CONTROLS REVERSED', 150, 10 * 30, '#FF1493', 13);
      } else if (effect.type === 'SPRINT') {
        this.applySprintEffect(targetPlayer, effect.amount ?? 3);
        this.spawnBoardFloatingText(resolvedIdx, '⚡ SPRINT! 2x DROP SPEED', 150, 10 * 30, '#FF1493', 13);
      } else if (effect.type === 'SCRAMBLE') {
        this.scramblePreview(targetPlayer, effect.amount ?? 5);
        this.spawnBoardFloatingText(resolvedIdx, '🎲 QUEUE SCRAMBLED!', 150, 10 * 30, '#B026FF', 13);
      } else if (effect.type === 'GRID_SHIFT') {
        targetPlayer.grid.shiftHorizontally(effect.direction === -1 ? -2 : 2);
        this.spawnBoardFloatingText(resolvedIdx, '⇄ GRID SHIFTED!', 150, 10 * 30, '#FFD700', 14);
      } else if (effect.type === 'RECYCLE') {
        const totalToRecycle = effect.amount ?? 4;
        const convertedNow = targetPlayer.grid.convertGarbageToSpecialBlocks(totalToRecycle);
        targetPlayer.recycleGarbageLines = Math.max(0, totalToRecycle - convertedNow);
        this.spawnBoardFloatingText(resolvedIdx, '♻ RECYCLE! GARBAGE → ITEMS', 150, 12 * 30, '#00E5FF', 13);
      } else if (effect.type === 'GUARDIAN_ANGEL') {
        targetPlayer.grid.clearBottomLines(effect.amount ?? 4);
        this.spawnBoardFloatingText(resolvedIdx, '👼 GUARDIAN ANGEL! -4 LINES', 150, 14 * 30, '#00FF88', 13);
      } else if (effect.type === 'ABILITY_FREEZE') {
        targetPlayer.abilityFreezeTimer = effect.durationMs ?? 3000;
        this.spawnBoardFloatingText(resolvedIdx, '❄ ABILITIES LOCKED!', 150, 11 * 30, '#38BDF8', 14);
      }
      // Stage 4: Reactive replanning — bot hit by a disruptive effect, force re-evaluation
      if (targetPlayer.bot) {
        targetPlayer.bot.replan();
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

    if (this.state === GameState.PLAYING || this.state === GameState.PREGAME || this.state === GameState.TUTORIAL) {
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
    if (this.state !== GameState.PLAYING && this.state !== GameState.TUTORIAL) return;

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
      player.shieldDeflectTimer = Math.max(0, player.shieldDeflectTimer - dt);
      player.garbageEaterTimer = Math.max(0, player.garbageEaterTimer - dt);

      if (player.bombBlastVisual) {
        player.bombBlastVisual.timer = Math.max(0, player.bombBlastVisual.timer - dt);
        if (player.bombBlastVisual.timer === 0) player.bombBlastVisual = null;
      }
      if (player.heavyCrushVisual) {
        player.heavyCrushVisual.timer = Math.max(0, player.heavyCrushVisual.timer - dt);
        if (player.heavyCrushVisual.timer === 0) player.heavyCrushVisual = null;
      }
      if (player.freezeTetherVisual) {
        player.freezeTetherVisual.timer = Math.max(0, player.freezeTetherVisual.timer - dt);
        if (player.freezeTetherVisual.timer === 0) player.freezeTetherVisual = null;
      }

      if (player.speedBlockSlowTimer > 0) {
        player.speedBlockSlowTimer = Math.max(0, player.speedBlockSlowTimer - dt);
        if (player.speedBlockSlowTimer === 0) {
          player.dropInterval = Math.max(100, player.dropInterval / 2);
        }
      }

      if (player.timeWarpTimer > 0) {
        player.timeWarpTimer = Math.max(0, player.timeWarpTimer - dt);
        if (player.timeWarpTimer === 0) {
          player.dropInterval = Math.max(100, player.dropInterval / 2);
        }
      }
      if (player.quicksilverTimer > 0) {
        player.quicksilverTimer = Math.max(0, player.quicksilverTimer - dt);
      }
      if (player.chaosTimer > 0) {
        player.chaosTimer = Math.max(0, player.chaosTimer - dt);
      }

      // Synchronize activeEffectType / activeEffectTimer for HUD display
      if (player.quicksilverTimer > 0) {
        player.activeEffectType = 'QUICKSILVER';
        player.activeEffectTimer = player.quicksilverTimer;
      } else if (player.chaosTimer > 0) {
        player.activeEffectType = 'CHAOS';
        player.activeEffectTimer = player.chaosTimer;
      } else if (player.timeWarpTimer > 0) {
        player.activeEffectType = 'TIME_WARP';
        player.activeEffectTimer = player.timeWarpTimer;
      } else if (player.activeEffectTimer > 0) {
        player.activeEffectTimer = Math.max(0, player.activeEffectTimer - dt);
        if (player.activeEffectTimer === 0) {
          player.activeEffectType = null;
        }
      } else {
        player.activeEffectType = null;
      }

      // Always tick InputHandler so freezeTimer and reverseTimer count down for both humans and AI bots
      player.inputHandler.update(dt);

      // Speedster [R] Bullet Time (QUICKSILVER): completely freezes opponent boards & gravity for 5s
      if (player.quicksilverTimer > 0 || (player.activeEffectType === 'QUICKSILVER' && player.activeEffectTimer > 0)) {
        continue;
      }

      // AI update
      if (player.bot) {
        const boardHeight = this.getMaxColumnHeight(player);
        const holeCount = this.countHoles(player);

        // Build ability context for the bot's ability evaluator (Stage 2)
        const abilityCtx: AbilityContext = {
          playerClass: player.playerClass,
          abilityCooldowns: { ...player.abilityCooldowns },
          classMeter: player.classMeter,
          abilityFreezeTimer: player.abilityFreezeTimer,
          fortifyCharges: player.fortifyCharges,
          reflectGarbage: player.reflectGarbage,
          gridShiftUsed: player.gridShiftUsed,
          gridShiftUsedLevel: player.gridShiftUsedLevel,
          currentLevel: Math.floor(player.scoreManager.totalLinesCleared / 10),
          boardHeight,
          holeCount,
          selectedTargetIndex: player.selectedTargetIndex,
          hasOpponents: this.players.some(p => p !== player && !p.isToppedOut),
        };

        // Build world state for GOAP planner (Stage 3)
        const ultimateCost = player.playerClass === 'SPEEDSTER' ? 40
          : player.playerClass === 'TANK' ? 50
          : player.playerClass === 'SABOTEUR' ? 35
          : 45;

        const opponentScores = this.players
          .filter(p => p !== player && !p.isToppedOut)
          .map(p => p.scoreManager.score);

        const teamAllyInDanger = this.isTeamMode ? this.players.some(p =>
          p !== player && !p.isToppedOut && p.playerClass !== undefined &&
          this.getMaxColumnHeight(p) >= 15
        ) : false;

        const worldState = buildWorldState({
          boardHeight,
          holeCount,
          ownScore: player.scoreManager.score,
          ownLines: player.scoreManager.totalLinesCleared,
          opponentScores,
          playerClass: player.playerClass,
          abilityCooldowns: { ...player.abilityCooldowns },
          classMeter: player.classMeter,
          ultimateCost,
          isSuddenDeath: this.battleRoyalMode && (this.battleRoyalPhase?.toLowerCase().includes('sudden') ?? false),
          teamAllyInDanger,
          isTeamMode: this.isTeamMode,
          personality: player.bot.personality,
        });

        player.bot.update(player.currentPiece, player.nextPiece, dt, abilityCtx, worldState);
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

    player.dropInterval = Math.max(100, player.dropInterval * player.speedMultiplier);

    if (player.timeWarpTimer > 0 || (player.activeEffectType === 'TIME_WARP' && player.activeEffectTimer > 0)) {
      player.dropInterval *= 2;
    }

    if (player.speedBlockSlowTimer > 0) {
      player.dropInterval *= 2;
    }

    if (player.sprintBlocksRemaining > 0) {
      player.sprintBlocksRemaining--;
      player.isCurrentBlockSprinted = true;
      player.dropInterval = Math.max(50, player.dropInterval * 0.5);
    } else {
      player.isCurrentBlockSprinted = false;
    }
    
    player.dropTimer = 0;

    if (player.grid.checkCollision(player.currentPiece)) {
      player.isToppedOut = true;
    }
  }

  /** How long a piece can sit on the ground before locking (ms). */
  private readonly LOCK_DELAY = 500;
  /** Maximum number of move/rotate resets allowed per piece. */
  private readonly MAX_LOCK_RESETS = 15;

  private handleActiveDrop(player: Player, dt: number) {
    while (player.inputHandler.hasInput()) {
      const action = player.inputHandler.getNextInput()!;
      this.processAction(player, action);
    }

    if (!player.currentPiece) return; // Might have locked from hard drop

    // Check if piece is currently grounded (can't move down)
    const grounded = player.grid.checkCollision(
      player.currentPiece,
      player.currentPiece.x,
      player.currentPiece.y + 1
    );

    if (grounded) {
      if (!player.isGrounded) {
        // Just became grounded — start the lock timer
        player.isGrounded = true;
        player.lockTimer = 0;
      }

      // Tick lock timer
      player.lockTimer += dt;
      if (player.lockTimer >= this.LOCK_DELAY) {
        // Lock delay expired — lock the piece
        this.handlePieceLock(player);
        return;
      }
    } else {
      // Piece is NOT grounded (e.g. moved off a ledge) — reset lock state
      player.isGrounded = false;
      player.lockTimer = 0;
    }

    // Normal gravity drop
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
          if (!player.isCurrentBlockSprinted) {
            player.scoreManager.addDropScore(1);
          }
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
    if (!player.isCurrentBlockSprinted) {
      player.scoreManager.addDropScore(dropped * 2);
    }
    this.handlePieceLock(player);
  }

  private tryUseClassAbility(player: Player, slot: 'Q' | 'E' | 'R') {
    if (this.state === GameState.TUTORIAL && this.tutorialAbilityGuard && !this.tutorialAbilityGuard(slot, player)) {
      return;
    }
    if (player.abilityFreezeTimer > 0) return;
    if (slot !== 'R' && player.abilityCooldowns[slot] > 0) return;
    const level = Math.floor(player.scoreManager.totalLinesCleared / 10);
    const pIdx = Math.max(0, this.players.indexOf(player));

    if (slot === 'Q') {
      if (player.playerClass === 'SPEEDSTER') {
        this.sendOrApplyClassEffect(player, { type: 'SPRINT', amount: 3, targetIndex: player.selectedTargetIndex ?? undefined });
        player.abilityCooldowns.Q = 12_000;
        this.spawnBoardFloatingText(pIdx, '⚡ [Q] SPRINT LAUNCHED!', 150, 12 * 30, '#00E5FF', 12);
      } else if (player.playerClass === 'TANK') {
        player.fortifyCharges = 2;
        player.abilityCooldowns.Q = CLASS_Q_COOLDOWN_MS;
        this.spawnBoardFloatingText(pIdx, '🛡 [Q] FORTIFY (2 CHARGES)!', 150, 12 * 30, '#00FF88', 12);
      } else if (player.playerClass === 'SABOTEUR') {
        this.sendOrApplyClassEffect(player, { type: 'SCRAMBLE', amount: 5, targetIndex: player.selectedTargetIndex ?? undefined });
        player.abilityCooldowns.Q = 12_000;
        this.spawnBoardFloatingText(pIdx, '🎲 [Q] SCRAMBLE SENT!', 150, 12 * 30, '#B026FF', 12);
      } else if (player.playerClass === 'SUPPORT') {
        if (this.isOnline && this.isTeamMode && player.selectedTargetIndex !== null && player.selectedTargetIndex !== this.myPlayerIndex) {
          this.sendOrApplyClassEffect(player, { type: 'RECYCLE', amount: 4, targetIndex: player.selectedTargetIndex });
        } else {
          // Immediately convert up to 4 garbage blocks on the board into Special Blocks,
          // and arm any remaining charges for future incoming garbage lines (matches Stage 2 Support Tutorial)
          const convertedNow = player.grid.convertGarbageToSpecialBlocks(4);
          player.recycleGarbageLines = Math.max(0, 4 - convertedNow);
          this.spawnBoardFloatingText(pIdx, '♻ [Q] RECYCLE! GARBAGE → ITEMS', 150, 12 * 30, '#00E5FF', 12);
        }
        player.abilityCooldowns.Q = CLASS_Q_COOLDOWN_MS;
      }
      return;
    }

    if (slot === 'E') {
      if (player.playerClass === 'SPEEDSTER') {
        if (player.timeWarpTimer <= 0) {
          player.dropInterval *= 2;
        }
        player.timeWarpTimer = TIME_WARP_DURATION_MS;
        player.activeEffectType = 'TIME_WARP';
        player.activeEffectTimer = TIME_WARP_DURATION_MS;
        player.abilityCooldowns.E = CLASS_E_COOLDOWN_MS;
        this.spawnBoardFloatingText(pIdx, '⏳ [E] TIME WARP! -50% GRAVITY', 150, 12 * 30, '#00E5FF', 12);
      } else if (player.playerClass === 'TANK') {
        player.reflectGarbage = true;
        player.abilityCooldowns.E = 20_000;
        this.spawnBoardFloatingText(pIdx, '⚡ [E] COUNTER STRIKE ARMED!', 150, 12 * 30, '#FFD700', 12);
      } else if (player.playerClass === 'SABOTEUR') {
        if (player.gridShiftUsed) return;
        player.gridShiftUsed = true;
        player.gridShiftUsedLevel = level;
        this.sendOrApplyClassEffect(player, { type: 'GRID_SHIFT', direction: Math.random() < 0.5 ? -1 : 1, targetIndex: player.selectedTargetIndex ?? undefined });
        this.spawnBoardFloatingText(pIdx, '⇄ [E] GRID SHIFT SENT!', 150, 12 * 30, '#FFD700', 12);
      } else if (player.playerClass === 'SUPPORT') {
        if (player.nextPiece) {
          player.itemManager.applyGoldDropToTetromino(player.nextPiece);
        } else {
          player.itemManager.forceGoldDropNext();
        }
        player.abilityCooldowns.E = 25_000;
        this.spawnBoardFloatingText(pIdx, '✨ [E] GOLD DROP! 4 ITEM BLOCKS', 150, 12 * 30, '#FFD700', 12);
      }
      return;
    }

    const ultimateCost = player.playerClass === 'SPEEDSTER' ? 40 : player.playerClass === 'TANK' ? 50 : player.playerClass === 'SABOTEUR' ? 35 : 45;
    if (player.classMeter < ultimateCost) return;
    player.classMeter = 0;
    if (player.playerClass === 'SPEEDSTER') {
      this.sendOrApplyClassEffect(player, { type: 'QUICKSILVER', durationMs: BULLET_TIME_DURATION_MS });
      this.spawnBoardFloatingText(pIdx, '❄ [R] BULLET TIME UNLEASHED!', 150, 10 * 30, '#00E5FF', 14);
    } else if (player.playerClass === 'TANK') {
      this.sendOrApplyClassEffect(player, { type: 'EARTHQUAKE', amount: 4 });
      this.spawnBoardFloatingText(pIdx, '💥 [R] EARTHQUAKE! +4 GARBAGE', 150, 10 * 30, '#FFD700', 14);
    } else if (player.playerClass === 'SABOTEUR') {
      player.gridShiftUsed = false;
      player.gridShiftUsedLevel = -1;
      player.abilityCooldowns.E = 0;
      this.sendOrApplyClassEffect(player, { type: 'CHAOS', durationMs: CHAOS_DURATION_MS });
      this.spawnBoardFloatingText(pIdx, '🌀 [R] CHAOS MODE! [E] RESET', 150, 10 * 30, '#FF1493', 13);
    } else if (player.playerClass === 'SUPPORT') {
      this.sendOrApplyClassEffect(player, { type: 'GUARDIAN_ANGEL', amount: 4, targetIndex: player.selectedTargetIndex ?? undefined });
      this.spawnBoardFloatingText(pIdx, '👼 [R] GUARDIAN ANGEL!', 150, 10 * 30, '#00FF88', 14);
    }
  }

  private cycleClassTarget(player: Player) {
    if (this.state === GameState.TUTORIAL) {
      // Task 1.3: Force targeting pointer to stay locked exclusively onto the Dummy Board during tutorial
      player.selectedTargetIndex = this.players.length > 1 ? 1 : null;
      return;
    }
    const candidates = this.players
      .map((target, index) => ({ target, index }))
      .filter(({ target }) => !target.isToppedOut)
      .map(({ index }) => index);
    if (!candidates.length) {
      player.selectedTargetIndex = null;
      return;
    }
    const current = player.selectedTargetIndex === null ? -1 : candidates.indexOf(player.selectedTargetIndex);
    player.selectedTargetIndex = candidates[(current + 1) % candidates.length];
  }

  private sendOrApplyClassEffect(player: Player, effect: { type: 'QUICKSILVER' | 'CHAOS' | 'SCRAMBLE' | 'GRID_SHIFT' | 'EARTHQUAKE' | 'GUARDIAN_ANGEL' | 'ABILITY_FREEZE' | 'SPRINT' | 'RECYCLE'; durationMs?: number; amount?: number; direction?: -1 | 1; targetIndex?: number }) {
    if (this.isOnline && this.state !== GameState.TUTORIAL) {
      this.network?.sendClassAbility(effect);
      return;
    }
    const opponents = this.players.filter(target => target.id !== player.id && !target.isToppedOut);
    const selectedTarget = effect.targetIndex === undefined ? undefined : this.players[effect.targetIndex];
    const targetOpp = selectedTarget && selectedTarget !== player && !selectedTarget.isToppedOut ? selectedTarget : opponents[0];

    if (effect.type === 'QUICKSILVER') {
      const dur = effect.durationMs ?? BULLET_TIME_DURATION_MS;
      opponents.forEach(target => {
        const tIdx = this.players.indexOf(target);
        target.quicksilverTimer = dur;
        target.activeEffectType = 'QUICKSILVER';
        target.activeEffectTimer = dur;
        target.inputHandler.freezeFor(dur);
        if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '❄ BULLET TIME FROZEN!', 150, 10 * 30, '#00E5FF', 13);
      });
    } else if (effect.type === 'CHAOS') {
      const dur = effect.durationMs ?? CHAOS_DURATION_MS;
      opponents.forEach(target => {
        const tIdx = this.players.indexOf(target);
        target.chaosTimer = dur;
        target.activeEffectType = 'CHAOS';
        target.activeEffectTimer = dur;
        target.inputHandler.reverseFor(dur);
        if (target.bot) target.bot.replan();
        if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '🌀 CHAOS! CONTROLS REVERSED', 150, 10 * 30, '#FF1493', 12);
      });
    } else if (effect.type === 'SCRAMBLE') {
      if (targetOpp) {
        this.scramblePreview(targetOpp, effect.amount ?? 5);
        if (targetOpp.bot) targetOpp.bot.replan();
        const tIdx = this.players.indexOf(targetOpp);
        if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '🎲 QUEUE SCRAMBLED!', 150, 10 * 30, '#B026FF', 13);
      }
    } else if (effect.type === 'SPRINT') {
      if (targetOpp) {
        this.applySprintEffect(targetOpp, effect.amount ?? 3);
        const tIdx = this.players.indexOf(targetOpp);
        if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '⚡ SPRINT! 2x DROP SPEED', 150, 10 * 30, '#FF1493', 13);
      }
    } else if (effect.type === 'RECYCLE') {
      const allyTarget = selectedTarget && !selectedTarget.isToppedOut ? selectedTarget : player;
      const totalToRecycle = effect.amount ?? 4;
      const convertedNow = allyTarget.grid.convertGarbageToSpecialBlocks(totalToRecycle);
      allyTarget.recycleGarbageLines = Math.max(0, totalToRecycle - convertedNow);
      if (allyTarget.bot) allyTarget.bot.replan();
      const tIdx = this.players.indexOf(allyTarget);
      if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '♻ RECYCLE! GARBAGE → ITEMS', 150, 12 * 30, '#00E5FF', 13);
    } else if (effect.type === 'GRID_SHIFT') {
      if (targetOpp) {
        targetOpp.grid.shiftHorizontally((effect.direction ?? 1) * 2);
        if (targetOpp.bot) targetOpp.bot.replan();
        const tIdx = this.players.indexOf(targetOpp);
        if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '⇄ GRID SHIFTED!', 150, 10 * 30, '#FFD700', 14);
      }
    } else if (effect.type === 'EARTHQUAKE') {
      const count = effect.amount ?? 4;
      opponents.forEach(target => {
        this.applyIncomingGarbageToTarget(player, target, count);
      });
    } else if (effect.type === 'GUARDIAN_ANGEL') {
      const rescueTarget = (this.isTeamMode && selectedTarget && !selectedTarget.isToppedOut) ? selectedTarget : player;
      rescueTarget.grid.clearBottomLines(effect.amount ?? 4);
      if (rescueTarget.bot) rescueTarget.bot.replan();
      const tIdx = this.players.indexOf(rescueTarget);
      if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '👼 GUARDIAN ANGEL! -4 LINES', 150, 14 * 30, '#00FF88', 13);
    } else if (effect.type === 'ABILITY_FREEZE') {
      opponents.forEach(target => {
        target.abilityFreezeTimer = effect.durationMs ?? 3000;
        const tIdx = this.players.indexOf(target);
        if (tIdx >= 0) this.spawnBoardFloatingText(tIdx, '❄ ABILITIES LOCKED!', 150, 11 * 30, '#38BDF8', 13);
      });
    }
  }

  private applySprintEffect(player: Player | undefined, nextBlocksCount: number = 3) {
    if (!player) return;
    if (player.currentPiece) {
      player.sprintBlocksRemaining = nextBlocksCount;
      if (!player.isCurrentBlockSprinted) {
        player.isCurrentBlockSprinted = true;
        player.dropInterval = Math.max(50, player.dropInterval * 0.5);
      }
    } else {
      player.sprintBlocksRemaining = nextBlocksCount + 1;
    }
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
    const opponents = this.players
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.id !== source.id && !p.isToppedOut);
    if (opponents.length > 0) {
      const targetEntry = (source.selectedTargetIndex !== null && opponents.find(o => o.idx === source.selectedTargetIndex)) || opponents[0];
      source.freezeTetherVisual = { targetPlayerIndex: targetEntry.idx, timer: 650, maxTimer: 650 };
    }

    if (this.isOnline && this.state !== GameState.TUTORIAL) {
      this.network?.sendClassAbility({ type: 'ABILITY_FREEZE', durationMs });
      return;
    }
    for (const { p: target, idx } of opponents) {
      target.abilityFreezeTimer = durationMs;
      this.spawnBoardFloatingText(idx, '❄ ABILITIES LOCKED!', 150, 11 * 30, '#38BDF8', 13);
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
      if (player.grid.checkCollision(player.currentPiece)) {
        player.isToppedOut = true;
      }
    } else {
      player.holdPiece = new Tetromino(player.currentPiece.type);
      player.holdPiece.specialBlocks = new Map(player.currentPiece.specialBlocks);
      this.handleSpawning(player);
    }
    
    player.hasHeld = true;
    player.dropTimer = 0;
    if (player.isToppedOut) {
      this.checkGameOver();
    }
  }

  private movePiece(player: Player, dx: number, dy: number): boolean {
    if (!player.currentPiece) return false;

    if (!player.grid.checkCollision(player.currentPiece, player.currentPiece.x + dx, player.currentPiece.y + dy)) {
      player.currentPiece.move(dx, dy);
      // Reset lock timer if the player moved while grounded (gives more time to T-spin)
      if (player.isGrounded && player.lockMoveResets < this.MAX_LOCK_RESETS) {
        player.lockTimer = 0;
        player.lockMoveResets++;
      }
      return true;
    }
    // No instant lock here — the lock delay in handleActiveDrop handles it
    return false;
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
        // Reset lock timer on successful rotation (allows T-spins)
        if (player.isGrounded && player.lockMoveResets < this.MAX_LOCK_RESETS) {
          player.lockTimer = 0;
          player.lockMoveResets++;
        }
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
    
    // Reset lock delay state for next piece
    player.isGrounded = false;
    player.lockTimer = 0;
    player.lockMoveResets = 0;
    player.hasHeld = false;
    
    const { linesCleared, specialBlocksToTrigger, clearedRows, specialBlockPositions } = player.grid.clearLines();
    const uniqueSpecials = new Set(specialBlocksToTrigger);
    const pIdx = Math.max(0, this.players.indexOf(player));
    const isLocalHuman = !this.isOnline || player === this.players[this.myPlayerIndex];

    // Step 3 (Multiplier Block [X]): activate 2x multiplier (5s) BEFORE scoring the line clear
    // so the triggering line clear is also doubled, matching Stage 3 Tutorial!
    if (uniqueSpecials.has(SpecialBlockType.MULTIPLIER)) {
      player.scoreManager.activateMultiplierBlock();
    }

    if (linesCleared > 0) {
      const gainedPoints = player.scoreManager.addScoreForLines(linesCleared);

      // Server-authoritative scoring: report the EVENT, not a raw score.
      // The local score above stays as an immediate prediction for the HUD;
      // the server's authoritative value overwrites it when it echoes back.
      if (this.isOnline) {
        if (player === this.players[this.myPlayerIndex]) {
          this.network?.sendScoreEvent('lines', linesCleared, player.scoreManager.combo, undefined, player.scoreManager.scoreMultiplier);
        } else if ((player as any).botId) {
          this.network?.sendScoreEvent('lines', linesCleared, player.scoreManager.combo, (player as any).botId, player.scoreManager.scoreMultiplier);
        }
      }
      player.classMeter += linesCleared;

      // Trigger visual + audio effects for the local player's clears
      if (isLocalHuman) {
        this.triggerLineClearEffects(linesCleared, clearedRows, pIdx);
        AudioManager.playSfx('lineClear');
      }

      if (uniqueSpecials.has(SpecialBlockType.MULTIPLIER) && isLocalHuman) {
        this.spawnFloatingScoreUiPopup(`+2x Points! (+${Math.round(gainedPoints)} PTS)`);
      }

      if (linesCleared >= 4) {
        if (player.playerClass === 'SPEEDSTER') {
          if (player.nextPiece) player.itemManager.applySpecificItemToTetromino(player.nextPiece, SpecialBlockType.SPEED);
          else player.itemManager.forceNextItem(SpecialBlockType.SPEED);
          this.spawnBoardFloatingText(pIdx, '⚡ PASSIVE: SPEED BLOCK [V] NEXT!', 150, 8 * 30, '#00E5FF', 12);
        } else if (player.playerClass === 'TANK') {
          if (player.nextPiece) player.itemManager.applySpecificItemToTetromino(player.nextPiece, SpecialBlockType.SHIELD);
          else player.itemManager.forceNextItem(SpecialBlockType.SHIELD);
          this.spawnBoardFloatingText(pIdx, '🛡 PASSIVE: SHIELD BLOCK [S] NEXT!', 150, 8 * 30, '#00FF88', 12);
        } else if (player.playerClass === 'SABOTEUR') {
          if (player.nextPiece) player.itemManager.applySpecificItemToTetromino(player.nextPiece, SpecialBlockType.FREEZE);
          else player.itemManager.forceNextItem(SpecialBlockType.FREEZE);
          this.spawnBoardFloatingText(pIdx, '❄ PASSIVE: FREEZE BLOCK [F] NEXT!', 150, 8 * 30, '#38BDF8', 12);
        } else if (player.playerClass === 'SUPPORT') {
          const convertedNow = player.grid.convertGarbageToSpecialBlocks(4);
          if (convertedNow < 4) {
            player.supportPassiveConversion = true;
          }
          this.spawnBoardFloatingText(pIdx, '♻ PASSIVE: GARBAGE RECYCLED!', 150, 8 * 30, '#00E5FF', 12);
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

    // Special blocks — execute all 7 Special Block mechanics matching Stage 3 Tutorial
    for (const special of uniqueSpecials) {
      if (special === SpecialBlockType.BOMB) {
        const bombPos = specialBlockPositions.find(pos => pos.type === SpecialBlockType.BOMB);
        const rawRow = bombPos ? bombPos.row : (clearedRows[0] ?? player.grid.height - 2);
        const rawCol = bombPos ? bombPos.col : Math.floor(player.grid.width / 2);
        const effRow = Math.max(1, Math.min(player.grid.height - 2, rawRow));
        const effCol = Math.max(1, Math.min(player.grid.width - 2, rawCol));

        player.grid.clearBombArea(effRow, effCol);
        player.bombBlastVisual = { row: effRow, col: effCol, timer: 900, maxTimer: 900 };
        this.spawnBoardExplosionParticles(pIdx, (effCol + 0.5) * 30, (effRow + 0.5) * 30, '#FF5555', '#FFD700', 28);
        this.spawnBoardFloatingText(pIdx, '💥 3×3 BLAST!', (effCol + 0.5) * 30, Math.max(60, (effRow - 1) * 30), '#FFD700', 14);
      } else if (special === SpecialBlockType.HEAVY) {
        // Row crushing & compaction is handled inside Grid.clearLines()
        const heavyPos = specialBlockPositions.find(pos => pos.type === SpecialBlockType.HEAVY);
        const crushRow = Math.min(player.grid.height - 1, (heavyPos ? heavyPos.row : (clearedRows[0] ?? 18)) + 1);
        player.heavyCrushVisual = { row: crushRow, timer: 850, maxTimer: 850 };
        this.spawnBoardExplosionParticles(pIdx, 150, crushRow * 30, '#FFD700', '#00E5FF', 22);
        this.spawnBoardFloatingText(pIdx, '⬇ HEAVY CRUSH! +1 ROW', 150, Math.max(60, (crushRow - 1) * 30), '#FFD700', 13);
      } else if (special === SpecialBlockType.MULTIPLIER) {
        // Already activated above before addScoreForLines; spawn visual feedback
        const multRow = clearedRows[0] ?? 18;
        this.spawnBoardExplosionParticles(pIdx, 150, multRow * 30, '#B026FF', '#E879F9', 20);
        this.spawnBoardFloatingText(pIdx, '⚡ +2x POINTS (5s)!', 150, Math.max(60, (multRow - 1) * 30), '#E879F9', 13);
      } else if (special === SpecialBlockType.SPEED) {
        if (player.speedBlockSlowTimer <= 0) {
          player.dropInterval *= 2;
        }
        player.speedBlockSlowTimer = 5000;
        const speedRow = clearedRows[0] ?? 18;
        this.spawnBoardExplosionParticles(pIdx, 150, speedRow * 30, '#00E5FF', '#38BDF8', 20);
        this.spawnBoardFloatingText(pIdx, '⚡ SPEED BUFF! -50% DROP SPEED (5s)', 150, Math.max(60, (speedRow - 1) * 30), '#00E5FF', 12);
      } else if (special === SpecialBlockType.SHIELD) {
        player.shieldActive = true;
        const shieldRow = clearedRows[0] ?? 18;
        this.spawnBoardExplosionParticles(pIdx, 150, shieldRow * 30, '#00FF88', '#00E5FF', 20);
        this.spawnBoardFloatingText(pIdx, '🛡 SHIELD AURA RAISED!', 150, Math.max(60, (shieldRow - 1) * 30), '#00FF88', 13);
      } else if (special === SpecialBlockType.FREEZE) {
        this.applyAbilityFreeze(player, 3000);
        const freezeRow = clearedRows[0] ?? 18;
        this.spawnBoardExplosionParticles(pIdx, 150, freezeRow * 30, '#38BDF8', '#00E5FF', 20);
        this.spawnBoardFloatingText(pIdx, '❄ LAUNCHING FREEZE TETHER!', 150, Math.max(60, (freezeRow - 1) * 30), '#38BDF8', 12);
      } else if (special === SpecialBlockType.GARBAGE_EATER) {
        player.grid.clearGarbageLines(4);
        const bonusPts = player.scoreManager.addFlatBonusScore(800);
        player.garbageEaterTimer = 950;
        if (this.isOnline) {
          if (player === this.players[this.myPlayerIndex]) {
            this.network?.sendScoreEvent('garbage_eater', 0, player.scoreManager.combo, undefined, player.scoreManager.scoreMultiplier);
          } else if ((player as any).botId) {
            this.network?.sendScoreEvent('garbage_eater', 0, player.scoreManager.combo, (player as any).botId, player.scoreManager.scoreMultiplier);
          }
        }
        const geRow = clearedRows[0] ?? 18;
        this.spawnBoardExplosionParticles(pIdx, 150, geRow * 30, '#F59E0B', '#FFD700', 26);
        this.spawnBoardFloatingText(pIdx, `🍽 GARBAGE CONVERTED → +${Math.round(bonusPts)} PTS!`, 150, Math.max(60, (geRow - 1) * 30), '#FFD700', 13);
        if (isLocalHuman) {
          this.spawnFloatingScoreUiPopup(`🍽 Garbage Devoured! +${Math.round(bonusPts)} PTS`);
        }
      }
    }

    // After locking, send immediate grid + score sync for responsiveness
    if (this.isOnline && this.network && this.state !== GameState.TUTORIAL) {
      this.network.sendGridUpdate(player.grid.matrix);
      this.network.sendScoreUpdate({
        score: player.scoreManager.score,
        lines: player.scoreManager.totalLinesCleared,
        combo: player.scoreManager.combo,
        multiplier: player.scoreManager.scoreMultiplier,
      });
    }

    // Immediately spawn the next piece so top-out is detected on the locking frame
    if (this.state === GameState.PLAYING && !player.currentPiece) {
      this.handleSpawning(player);
      if (player.isToppedOut) {
        if (this.isOnline) {
          if ((player as any).botId) {
            this.network?.sendEliminated(undefined, (player as any).botId);
          } else {
            this.network?.sendToppedOut();
          }
        }
        this.checkGameOver();
      }
    }
  }

  private distributeGarbage(sender: Player, count: number) {
    const validOpponents = this.players.filter(p => p.id !== sender.id && !p.isToppedOut);
    if (validOpponents.length === 0) return;

    let target = validOpponents[Math.floor(Math.random() * validOpponents.length)];
    if (sender.selectedTargetIndex !== null && sender.selectedTargetIndex !== undefined) {
      const explicitTarget = this.players[sender.selectedTargetIndex];
      if (explicitTarget && validOpponents.includes(explicitTarget)) {
        target = explicitTarget;
      }
    }

    this.applyIncomingGarbageToTarget(sender, target, count);
  }

  private applyIncomingGarbageToTarget(sender: Player, target: Player, count: number) {
    let senderType: 'EASY' | 'HARD' | 'HUMAN' = 'HUMAN';
    if (sender.bot) {
      senderType = sender.bot.difficulty;
    }
    const targetIdx = Math.max(0, this.players.indexOf(target));
    const senderIdx = Math.max(0, this.players.indexOf(sender));

    if (target.shieldActive) {
      target.shieldActive = false;
      target.shieldDeflectTimer = 900;
      this.spawnBoardExplosionParticles(targetIdx, 150, 18 * 30, '#00FF88', '#00E5FF', 24);
      this.spawnBoardFloatingText(targetIdx, '🛡 ATTACK BLOCKED!', 150, 13 * 30, '#00FF88', 14);
      return;
    }
    if (target.fortifyCharges > 0) {
      target.fortifyCharges--;
      this.spawnBoardFloatingText(targetIdx, `🛡 FORTIFY BLOCKED! (${target.fortifyCharges} LEFT)`, 150, 13 * 30, '#00FF88', 13);
      return;
    }
    if (target.reflectGarbage) {
      target.reflectGarbage = false;
      sender.grid.addGarbageLines(count, senderType);
      if (sender.bot) sender.bot.replan();
      this.spawnBoardFloatingText(targetIdx, `⚡ REFLECTED ${count} LINES!`, 150, 13 * 30, '#FF1493', 14);
      this.spawnBoardFloatingText(senderIdx, `💥 HIT BY ${count} REFLECTED LINES!`, 150, 13 * 30, '#FF1493', 13);
      return;
    }
    target.grid.addGarbageLines(count, senderType);
    if (target.supportPassiveConversion) {
      target.grid.convertGarbageToSpecialBlocks(count);
      target.supportPassiveConversion = false;
      this.spawnBoardFloatingText(targetIdx, '♻ PASSIVE RECYCLE!', 150, 14 * 30, '#00E5FF', 13);
    } else if (target.recycleGarbageLines > 0) {
      const converted = target.grid.convertGarbageToSpecialBlocks(Math.min(count, target.recycleGarbageLines));
      target.recycleGarbageLines = Math.max(0, target.recycleGarbageLines - converted);
      this.spawnBoardFloatingText(targetIdx, '♻ GARBAGE RECYCLED!', 150, 14 * 30, '#00E5FF', 13);
    }
    // Stage 4: Reactive replanning for local bots
    if (target.bot) {
      target.bot.replan();
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

  private spawnBoardExplosionParticles(pIdx: number, cx: number, cy: number, color1: string, color2: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 2.5 + Math.random() * 5.5;
      this.particles.push({
        playerIndex: pIdx,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 700 + Math.random() * 350,
        maxLife: 1050,
        color: i % 2 === 0 ? color1 : color2,
        size: 3.5 + Math.random() * 3.5,
      });
    }
  }

  private spawnBoardFloatingText(pIdx: number, text: string, x: number, y: number, color: string, size: number = 13) {
    this.comboTexts.push({
      playerIndex: pIdx,
      text,
      x,
      y,
      life: 1400,
      maxLife: 1400,
      color,
      size,
    });
  }

  private spawnFloatingScoreUiPopup(text: string) {
    if (typeof document === 'undefined') return;
    document.getElementById('gameplay-floating-score-pop')?.remove();
    const scoreEl = document.getElementById('score-p1');
    const scoreBrEl = document.getElementById('score-p1-br');
    const activeEl = (scoreEl && scoreEl.getBoundingClientRect().width > 0) ? scoreEl : scoreBrEl;
    if (!activeEl) return;
    const rect = activeEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const pop = document.createElement('div');
    pop.id = 'gameplay-floating-score-pop';
    pop.className =
      'fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg border-2 border-neon-yellow bg-deep-purple/95 text-neon-yellow font-extrabold text-xs tracking-wider shadow-[0_0_25px_rgba(255,215,0,0.5)] animate-bounce';
    pop.style.left = `${Math.max(12, Math.round(rect.left - 10))}px`;
    pop.style.top = `${Math.max(12, Math.round(rect.top - 38))}px`;
    pop.textContent = text;
    document.body.appendChild(pop);
    window.setTimeout(() => {
      pop.remove();
    }, 2200);
  }

  private triggerLineClearEffects(linesCleared: number, clearedRows: number[], pIdx: number) {
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
        // Spawn 3-6 particles per cell for big clears, 1-2 for singles
        const particleCount = linesCleared >= 3 ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < particleCount; i++) {
          this.particles.push({
            playerIndex: pIdx,
            x: (c * BLOCK_SIZE + BLOCK_SIZE / 2) + (Math.random() - 0.5) * BLOCK_SIZE,
            y: (row * BLOCK_SIZE + BLOCK_SIZE / 2) + (Math.random() - 0.5) * BLOCK_SIZE,
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
          playerIndex: pIdx,
          row: row,
          flash: 1.0,
          color: color,
        });
      }
    }

    // Combo text
    const comboCount = this.players[pIdx]?.scoreManager.combo || 0;
    let text = '';
    if (linesCleared === 3) text = 'TRIPLE!';
    else if (linesCleared >= 4) text = 'TETRIS!';
    if (comboCount > 1 && text) text += ` COMBO x${comboCount}`;
    else if (comboCount > 1) text = `COMBO x${comboCount}`;

    if (text) {
      this.comboTexts.push({
        playerIndex: pIdx,
        text: text,
        x: (COLS * BLOCK_SIZE) / 2,
        y: BLOCK_SIZE * 10,
        life: 1200,
        maxLife: 1200,
        color: color,
        size: linesCleared >= 4 ? 24 : 18,
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
    // In online mode, the server handles game-over detection. In TUTORIAL state, game-over is disabled.
    if (this.isOnline || this.state === GameState.TUTORIAL) return;

    let anyToppedOut = false;
    for (const p of this.players) {
      if (p.isToppedOut) anyToppedOut = true;
    }
    
    if (anyToppedOut) {
      this.state = GameState.GAME_OVER;
    }
  }
}