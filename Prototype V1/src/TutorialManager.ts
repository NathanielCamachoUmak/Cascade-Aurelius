import { Grid } from './Grid';
import { Tetromino, type ShapeType } from './Tetromino';
import { AudioManager } from './AudioManager';
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass';
import { SpecialBlockType } from './ItemManager';
import { GameState } from './GameManager';

type TutorialStep =
  | 'PIECE_1_MOVE'
  | 'PIECE_1_SOFT_DROP'
  | 'PIECE_2_HARD_DROP'
  | 'PIECE_3_ROTATE'
  | 'PIECE_4_HOLD'
  | 'PIECE_5_DROP_FIRST'
  | 'PIECE_5_SWAP_HOLD'
  | 'PIECE_5_DROP_SWAPPED'
  | 'COMPLETED';

type Stage2Drill =
  | 'PASSIVE_TETRIS_TRIGGER'
  | 'PASSIVE_SPECIAL_CLEAR'
  | 'CRISIS_SENTINEL_DEFENSE'
  | 'CRISIS_SUPPORT_RESCUE'
  | 'CRISIS_SABOTEUR_DISRUPT'
  | 'CRISIS_SPEEDSTER_CLUTCH'
  | 'SANDBOX_3_DUMMY_ULTIMATE'
  | 'STAGE2_COMPLETED';

interface DummyBoardState {
  id: string;
  label: string;
  grid: Grid;
  activePiece: Tetromino | null;
  statusBadge: string | null;
  statusColor: string;
  frozenTimer: number;
  chaosTimer: number;
}

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PLAYER_COLOR = '#00E5FF';
const DUMMY_COLOR = '#FF1493';
const TUTORIAL_STORAGE_KEY = 'cascade_completed_tutorials_v1';

export function isTutorialCompleted(tutorialId: string): boolean {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed[tutorialId]);
  } catch {
    return false;
  }
}

export function markTutorialCompleted(tutorialId: string): void {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[tutorialId] = true;
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

// Deterministic sequence for Stage 1 so every run is predictable:
// 1: T (Move + Soft Drop), 2: I (Hard Drop), 3: L (Rotate), 4: O (Hold), 5: J (Drop first), then S (Swap Hold)
const STAGE_1_QUEUE: ShapeType[] = ['T', 'I', 'L', 'O', 'J', 'S', 'Z', 'T', 'I'];

const BLOCK_SPRITES: Record<string, HTMLImageElement> = {};
['I', 'J', 'L', 'O', 'S', 'T', 'Z'].forEach(shape => {
  const img = new Image();
  img.src = `/blocks/${shape}-block.png`;
  BLOCK_SPRITES[shape] = img;
});

function getSpecialLetter(special: string | undefined): string {
  switch (special) {
    case 'BOMB': return 'B';
    case 'HEAVY': return 'W';
    case 'MULTIPLIER': return 'X';
    case 'SPEED': return 'V';
    case 'SHIELD': return 'S';
    case 'FREEZE': return 'F';
    case 'GARBAGE_EATER': return 'G';
    default: return '?';
  }
}

export class TutorialManager {
  private activeStage: 1 | 2 = 1;
  private eFsmState: GameState = GameState.TUTORIAL;

  private grid: Grid = new Grid();
  private currentPiece: Tetromino | null = null;
  private holdPiece: Tetromino | null = null;
  private queue: ShapeType[] = [];

  // Stage 1 state
  private step: TutorialStep = 'PIECE_1_MOVE';
  private piece1MovedLeftRight = false;
  private piece1SoftDropped = false;
  private piece3Rotated = false;

  // Stage 2 state (eFSM + Dummy Boards + CQRS Garbage Queue + Class Mechanics)
  private stage2Drill: Stage2Drill = 'PASSIVE_TETRIS_TRIGGER';
  private activeClass: PlayerClass = 'SPEEDSTER';
  private classMeter = 0;
  private ultimateCost = 40;
  private qStatusText = 'READY';
  private eStatusText = 'READY';
  private rStatusText = '0 / 40 LINES';
  private incomingGarbageQueue = 0;
  private reflectArmed = false;
  private gridShiftUsed = false;
  private timeWarpActive = false;
  private timeWarpTimer = 0;
  private stage2TransitionLocked = false;
  private stage2BannerMessage: string | null = null;
  private stage2BannerColor: 'cyan' | 'green' | 'pink' | 'yellow' = 'cyan';

  // Phase 1 & Phase 4: Dummy Board(s) & Locked O(1) Circular Linked List Target Pointer
  private selectedTargetIndex: number = 1; // Locked exclusively onto Dummy Board
  private dummyBoards: DummyBoardState[] = [];
  private dummyCanvasContainer: HTMLElement | null = null;
  private singleDummyCanvas: HTMLCanvasElement | null = null;
  private miniDummyCanvases: HTMLCanvasElement[] = [];

  private dropTimer = 0;
  private dropInterval = 1100;
  private lockTimer = 0;
  private readonly LOCK_DELAY = 500;

  private lastTime = 0;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private isRestarting = false;

  private boardCanvas: HTMLCanvasElement | null = null;
  private holdCanvas: HTMLCanvasElement | null = null;
  private nextCanvas: HTMLCanvasElement | null = null;

  private hudContainer: HTMLElement | null = null;
  private conclusionModal: HTMLElement | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.keydownHandler = this.handleKeyDown.bind(this);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1: BASIC MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  public startStage1() {
    this.activeStage = 1;
    this.eFsmState = GameState.TUTORIAL;
    this.boardCanvas = document.getElementById('board-p1') as HTMLCanvasElement | null;
    this.holdCanvas = document.getElementById('hold-canvas-p1') as HTMLCanvasElement | null;
    this.nextCanvas = document.getElementById('next-canvas-p1') as HTMLCanvasElement | null;

    this.prepareArenaDom(false);
    this.mountTutorialHud();
    this.resetStageState();

    window.removeEventListener('keydown', this.keydownHandler);
    window.addEventListener('keydown', this.keydownHandler);

    this.isRunning = true;
    this.lastTime = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.loop(performance.now());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 2: CLASSES, PASSIVES, CRISIS SCENARIOS & ULTIMATES SANDBOX
  // ═══════════════════════════════════════════════════════════════════════════

  public startStage2() {
    this.activeStage = 2;
    this.eFsmState = GameState.TUTORIAL;
    this.boardCanvas = document.getElementById('board-p1') as HTMLCanvasElement | null;
    this.holdCanvas = document.getElementById('hold-canvas-p1') as HTMLCanvasElement | null;
    this.nextCanvas = document.getElementById('next-canvas-p1') as HTMLCanvasElement | null;

    this.prepareArenaDom(true);
    this.mountStage2Hud();
    this.setupStage2Drill('PASSIVE_TETRIS_TRIGGER');

    window.removeEventListener('keydown', this.keydownHandler);
    window.addEventListener('keydown', this.keydownHandler);

    this.isRunning = true;
    this.lastTime = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.loop(performance.now());
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.keydownHandler);
    this.hudContainer?.remove();
    this.hudContainer = null;
    this.dummyCanvasContainer?.remove();
    this.dummyCanvasContainer = null;
    this.conclusionModal?.remove();
    this.conclusionModal = null;
  }

  private prepareArenaDom(showAbilityMeter: boolean) {
    const uiLayer = document.getElementById('ui-layer');
    const gameHud = document.getElementById('game-hud');
    const canvasContainer = document.getElementById('canvas-container');
    const duoLayoutContainer = document.getElementById('duo-layout-container');
    const p1Pod = document.getElementById('p1-pod');
    const p2Pod = document.getElementById('p2-pod');
    const preGameOverlay = document.getElementById('pre-game-overlay');
    const teamMatchStrip = document.getElementById('team-match-strip');
    const abilityMeterP1 = document.getElementById('ability-meter-p1');

    uiLayer?.classList.add('hidden');
    gameHud?.classList.remove('hidden');
    gameHud?.classList.add('flex');

    canvasContainer?.classList.add('hidden');
    canvasContainer?.classList.remove('flex');

    duoLayoutContainer?.classList.remove('hidden');
    duoLayoutContainer?.classList.add('flex');

    p2Pod?.classList.add('hidden');
    p2Pod?.classList.remove('flex');

    if (p1Pod) {
      p1Pod.classList.remove('justify-end');
      p1Pod.classList.add('justify-center');
    }

    preGameOverlay?.classList.add('hidden');
    preGameOverlay?.classList.remove('flex');
    teamMatchStrip?.classList.add('hidden');

    if (showAbilityMeter) {
      abilityMeterP1?.classList.remove('hidden');
    } else {
      abilityMeterP1?.classList.add('hidden');
    }

    AudioManager.playMusic('game');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2 DOM & DUMMY BOARDS (Phase 1 & Phase 4)
  // ─────────────────────────────────────────────────────────────────────────

  private mountStage2Hud() {
    this.hudContainer?.remove();
    this.dummyCanvasContainer?.remove();
    this.conclusionModal?.remove();

    const duoLayoutContainer = document.getElementById('duo-layout-container');
    if (!duoLayoutContainer) return;

    // Center Instruction Panel
    const panel = document.createElement('div');
    panel.id = 'tutorial-stage-panel';
    panel.className = 'w-80 sm:w-96 shrink-0 bg-card-bg/95 backdrop-blur-md border-2 border-neon-cyan rounded-xl p-5 shadow-[0_0_30px_rgba(0,229,255,0.2)] flex flex-col gap-4 self-center z-30 pointer-events-auto';
    panel.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-cyan">STAGE 2 · ABILITY TUTORIAL</span>
          <span id="tut-step-counter" class="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40">Drill 1 / 7</span>
        </div>
        <h2 id="tut-stage2-title" class="text-lg font-extrabold text-white tracking-wide">Passives &amp; Asymmetric Abilities</h2>
        <div id="tut-progress-dots" class="grid grid-cols-7 gap-1.5 mt-2.5">
          <div class="h-1.5 rounded-full bg-neon-cyan"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
        </div>
      </div>

      <!-- Active Class & Target Lock Strip -->
      <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-deep-purple/90 border border-card-border text-[10px]">
        <div>
          <span class="text-gray-400 uppercase tracking-wider">CLASS:</span>
          <span id="tut-active-class-badge" class="ml-1 font-bold text-neon-yellow uppercase tracking-widest">SPEEDSTER</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-neon-pink animate-pulse"></span>
          <span id="tut-target-lock-badge" class="font-bold text-neon-pink uppercase tracking-wider">TARGET: DUMMY [LOCKED]</span>
        </div>
      </div>

      <!-- Alert / Resolution Banner -->
      <div id="tut-restart-banner" class="hidden rounded-lg border border-neon-pink bg-neon-pink/15 px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]"></div>

      <!-- Current Scenario Problem-Solution Box -->
      <div class="rounded-xl bg-deep-purple/90 border border-card-border p-4 flex flex-col gap-3">
        <div id="tut-block-badge" class="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">PHASE 2 · PASSIVES DRILL</div>
        <div id="tut-instructions-list" class="flex flex-col gap-2.5"></div>
      </div>

      <div id="tut-guard-footer" class="text-[11px] text-gray-400 leading-relaxed border-t border-card-border pt-2.5">
        eFSM Guard Active: Follow the highlighted prompt to resolve each manufactured crisis.
      </div>

      <div class="flex gap-2.5 pt-1">
        <button id="tut-btn-restart" type="button" class="flex-1 px-3 py-2 text-xs font-bold tracking-wider uppercase rounded-lg border border-card-border bg-white/5 text-gray-300 hover:text-white hover:border-neon-cyan transition-all cursor-pointer">
          Reset Drill
        </button>
        <button id="tut-btn-exit" type="button" class="flex-1 px-3 py-2 text-xs font-bold tracking-wider uppercase rounded-lg border border-neon-pink/40 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink hover:text-deep-purple transition-all cursor-pointer">
          Exit Tutorial
        </button>
      </div>
    `;

    duoLayoutContainer.appendChild(panel);
    this.hudContainer = panel;

    // Right-hand Dummy Board Container (Single Dummy 10x20 Grid for Phases 1–3, and 3-Dummy Mini Lobby for Phase 4)
    const dummyPod = document.createElement('div');
    dummyPod.id = 'tutorial-dummy-pod';
    dummyPod.className = 'flex flex-col items-center justify-center gap-3 self-center shrink-0 z-20 pointer-events-auto';
    dummyPod.innerHTML = `
      <!-- Single 10x20 Dummy Board View (Phases 1-3) -->
      <div id="tut-single-dummy-view" class="flex flex-col items-center gap-2 bg-card-bg/85 border-2 border-neon-pink rounded-xl p-3 shadow-[0_0_25px_rgba(255,20,147,0.25)]">
        <div class="w-full flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-neon-pink"></span>
            <span class="text-[10px] font-bold tracking-widest uppercase text-neon-pink">DUMMY BOARD</span>
          </div>
          <span id="tut-dummy-target-tag" class="text-[9px] font-bold px-2 py-0.5 rounded bg-neon-pink/20 border border-neon-pink text-white uppercase tracking-wider">◎ TARGET LOCKED</span>
        </div>
        <canvas id="tut-dummy-canvas-main" width="240" height="480" class="bg-black/60 rounded border border-card-border"></canvas>
        <div id="tut-dummy-status-line" class="text-[10px] font-bold tracking-wider uppercase text-gray-300 min-h-[16px]">INPUT: NULL · SCRIPTED STATE</div>
      </div>

      <!-- 3-Dummy Lobby View (Phase 4: Ultimates Sandbox) -->
      <div id="tut-multi-dummy-view" class="hidden flex-col items-center gap-3 bg-card-bg/85 border-2 border-neon-pink rounded-xl p-4 shadow-[0_0_25px_rgba(255,20,147,0.25)]">
        <div class="w-full flex items-center justify-between">
          <span class="text-[10px] font-bold tracking-widest uppercase text-neon-pink">3-DUMMY AoE SANDBOX LOBBY</span>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-neon-yellow/20 border border-neon-yellow text-neon-yellow uppercase">ALL OPPONENTS</span>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="flex flex-col items-center gap-1.5 bg-deep-purple/80 border border-card-border rounded-lg p-2">
            <span class="text-[9px] font-bold text-neon-cyan tracking-wider">DUMMY ALPHA</span>
            <canvas id="tut-dummy-mini-0" width="120" height="240" class="bg-black/60 rounded"></canvas>
            <span id="tut-dummy-mini-status-0" class="text-[8px] font-bold text-gray-400 uppercase">ACTIVE</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 bg-deep-purple/80 border border-card-border rounded-lg p-2">
            <span class="text-[9px] font-bold text-neon-yellow tracking-wider">DUMMY BETA</span>
            <canvas id="tut-dummy-mini-1" width="120" height="240" class="bg-black/60 rounded"></canvas>
            <span id="tut-dummy-mini-status-1" class="text-[8px] font-bold text-gray-400 uppercase">ACTIVE</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 bg-deep-purple/80 border border-card-border rounded-lg p-2">
            <span class="text-[9px] font-bold text-neon-pink tracking-wider">DUMMY GAMMA</span>
            <canvas id="tut-dummy-mini-2" width="120" height="240" class="bg-black/60 rounded"></canvas>
            <span id="tut-dummy-mini-status-2" class="text-[8px] font-bold text-gray-400 uppercase">ACTIVE</span>
          </div>
        </div>
      </div>
    `;

    duoLayoutContainer.appendChild(dummyPod);
    this.dummyCanvasContainer = dummyPod;
    this.singleDummyCanvas = dummyPod.querySelector('#tut-dummy-canvas-main') as HTMLCanvasElement | null;
    this.miniDummyCanvases = [
      dummyPod.querySelector('#tut-dummy-mini-0') as HTMLCanvasElement,
      dummyPod.querySelector('#tut-dummy-mini-1') as HTMLCanvasElement,
      dummyPod.querySelector('#tut-dummy-mini-2') as HTMLCanvasElement,
    ];

    panel.querySelector('#tut-btn-restart')?.addEventListener('click', () => {
      if (this.stage2Drill === 'STAGE2_COMPLETED') {
        this.setupStage2Drill('PASSIVE_TETRIS_TRIGGER');
      } else {
        this.setupStage2Drill(this.stage2Drill);
      }
    });

    panel.querySelector('#tut-btn-exit')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });

    // Stage 2 Conclusion Modal
    const modal = document.createElement('div');
    modal.id = 'tutorial-conclusion-modal';
    modal.className = 'hidden fixed inset-0 z-[120] bg-black/80 backdrop-blur-md items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-card-bg border-2 border-neon-cyan rounded-2xl max-w-lg w-full p-8 text-center shadow-[0_0_50px_rgba(0,229,255,0.3)] flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-neon-cyan/15 border-2 border-neon-cyan flex items-center justify-center text-neon-cyan text-2xl font-bold shadow-[0_0_20px_rgba(0,229,255,0.4)]">
          ✓
        </div>
        <div>
          <p class="text-neon-cyan text-[10px] font-bold tracking-[0.3em] uppercase mb-2">STAGE 2 COMPLETE</p>
          <h2 class="text-2xl font-extrabold text-white">Classes &amp; Abilities Mastered!</h2>
          <p class="text-gray-400 text-xs mt-2 leading-relaxed">
            You completed the Passives Drill, resolved all 4 Class Micro-Scenarios, and unleashed Area-of-Effect Ultimates across the 3-Dummy Lobby!
          </p>
        </div>

        <div class="w-full rounded-xl bg-deep-purple/80 border border-card-border p-4 text-left text-xs flex flex-col gap-2">
          <div class="flex justify-between items-center text-gray-300">
            <span>Phase 2 · Tetris Trigger &amp; Special Block</span>
            <span class="text-neon-green font-bold">4-Line Clear → Special Block</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>Sentinel · Defense Scenario</span>
            <span class="text-neon-green font-bold">[E] Counter Strike (Reflect 10)</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>Support · Rescue Scenario</span>
            <span class="text-neon-green font-bold">[R] Guardian Angel (-4 Bottom)</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>Saboteur · Disruption Scenario</span>
            <span class="text-neon-green font-bold">[E] Grid Shift (Break Tetris Well)</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>Speedster · Clutch Scenario</span>
            <span class="text-neon-green font-bold">[E] Time Warp (-50% Gravity)</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>Phase 4 · 3-Dummy AoE Sandbox</span>
            <span class="text-neon-green font-bold">[R] Lobby-Wide Ultimate</span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <button id="tut-modal-replay" type="button" class="flex-1 px-4 py-3 rounded-lg border border-card-border bg-white/5 text-white text-xs font-bold tracking-widest uppercase hover:border-neon-cyan transition-all cursor-pointer">
            Replay Stage 2
          </button>
          <button id="tut-modal-done" type="button" class="flex-1 px-4 py-3 rounded-lg bg-neon-cyan text-deep-purple text-xs font-bold tracking-widest uppercase hover:brightness-110 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all cursor-pointer">
            Back to Tutorials
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.conclusionModal = modal;

    modal.querySelector('#tut-modal-replay')?.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      this.setupStage2Drill('PASSIVE_TETRIS_TRIGGER');
    });
    modal.querySelector('#tut-modal-done')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2 SCENARIO SETUPS (Phases 1, 2, 3, 4)
  // ─────────────────────────────────────────────────────────────────────────

  private createSingleDummyBoard(presetRows?: (string | null)[][], activePiece?: Tetromino | null, statusBadge: string | null = null): DummyBoardState {
    const g = new Grid();
    if (presetRows) {
      g.loadPresetMatrix(presetRows);
    } else {
      // Restricted AI / baseline stack for dummy board
      g.loadPresetMatrix([
        ['T', 'T', 'T', null, 'L', 'L', 'L', null, 'O', 'O'],
        ['J', 'J', 'S', 'S', 'L', 'Z', 'Z', null, 'O', 'O'],
        ['J', 'I', 'I', 'I', 'I', 'Z', 'Z', 'T', 'T', 'T'],
      ]);
    }
    return {
      id: 'DUMMY-1',
      label: 'DUMMY BOARD',
      grid: g,
      activePiece: activePiece ?? null,
      statusBadge,
      statusColor: '#00FFFF',
      frozenTimer: 0,
      chaosTimer: 0,
    };
  }

  private setupStage2Drill(drill: Stage2Drill) {
    this.stage2Drill = drill;
    this.stage2TransitionLocked = false;
    this.isRestarting = false;
    this.selectedTargetIndex = 1; // Task 1.3: Force targeting pointer onto Dummy Board
    this.incomingGarbageQueue = 0;
    this.reflectArmed = false;
    this.gridShiftUsed = false;
    this.timeWarpActive = false;
    this.timeWarpTimer = 0;
    this.holdPiece = null;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.dropInterval = 1000;
    this.hideStage2Banner();

    const singleView = document.getElementById('tut-single-dummy-view');
    const multiView = document.getElementById('tut-multi-dummy-view');
    if (drill === 'SANDBOX_3_DUMMY_ULTIMATE') {
      singleView?.classList.add('hidden');
      singleView?.classList.remove('flex');
      multiView?.classList.remove('hidden');
      multiView?.classList.add('flex');
    } else {
      singleView?.classList.remove('hidden');
      singleView?.classList.add('flex');
      multiView?.classList.add('hidden');
      multiView?.classList.remove('flex');
    }

    // ─── TASK 2.1: The Tetris Trigger (Well pre-stacked, I-piece provided) ───
    if (drill === 'PASSIVE_TETRIS_TRIGGER') {
      this.activeClass = 'SPEEDSTER';
      this.classMeter = 12;
      this.ultimateCost = 40;
      this.qStatusText = 'LOCKED';
      this.eStatusText = 'LOCKED';
      this.rStatusText = '12 / 40 LINES';

      // Pre-stack a 4-row well with column 9 open
      this.grid = new Grid();
      this.grid.loadPresetMatrix([
        ['J', 'J', 'L', 'L', 'O', 'O', 'T', 'T', 'S', null],
        ['J', 'Z', 'Z', 'L', 'O', 'O', 'T', 'S', 'S', null],
        ['I', 'I', 'I', 'I', 'J', 'J', 'J', 'L', 'L', null],
        ['O', 'O', 'T', 'T', 'T', 'S', 'S', 'Z', 'Z', null],
      ]);

      // Provide the I-piece
      this.currentPiece = new Tetromino('I');
      this.queue = ['I', 'T', 'O', 'L'];
      this.dummyBoards = [this.createSingleDummyBoard()];
    }

    // ─── TASK 2.2: Forced Special Block Resolution ───
    else if (drill === 'PASSIVE_SPECIAL_CLEAR') {
      this.activeClass = 'SPEEDSTER';
      this.classMeter = 16;
      this.ultimateCost = 40;
      this.qStatusText = 'LOCKED';
      this.eStatusText = 'LOCKED';
      this.rStatusText = '16 / 40 LINES';

      // Pre-stack bottom row with columns 0..5 filled and 6..9 open for horizontal I-piece with Special Block
      this.grid = new Grid();
      this.grid.loadPresetMatrix([
        ['T', 'T', 'T', 'O', 'O', 'J', null, null, null, null],
      ]);

      // Intercept RNG and force the class Special Block (Speed Block 'V') onto the spawned piece
      const specialPiece = new Tetromino('I');
      specialPiece.specialBlocks.set('1,1', SpecialBlockType.SPEED);
      this.currentPiece = specialPiece;
      this.queue = ['T', 'L', 'O', 'J'];
      this.dummyBoards = [this.createSingleDummyBoard()];
    }

    // ─── TASK 3.1: Sentinel Scenario (The Defense — [E] Counter Strike) ───
    else if (drill === 'CRISIS_SENTINEL_DEFENSE') {
      this.activeClass = 'TANK'; // Sentinel
      this.classMeter = 20;
      this.ultimateCost = 50;
      this.qStatusText = 'LOCKED';
      this.eStatusText = 'READY';
      this.rStatusText = '20 / 50 LINES';

      // Freeze player's grid and queue an unavoidable 10-line garbage attack via CQRS queue
      this.grid = new Grid();
      this.grid.loadPresetMatrix([
        ['O', 'O', null, 'T', 'T', 'T', null, 'L', 'L', 'L'],
        ['O', 'O', 'J', 'J', 'J', 'S', 'S', 'L', 'Z', 'Z'],
      ]);
      this.currentPiece = null; // Grid frozen awaiting [E] Counter Strike
      this.incomingGarbageQueue = 10;
      this.queue = ['I', 'T', 'O', 'L'];
      this.dummyBoards = [this.createSingleDummyBoard(undefined, null, 'ATTACKING: 10 LINES')];
    }

    // ─── TASK 3.2: Support Scenario (The Rescue — [R] Guardian Angel) ───
    else if (drill === 'CRISIS_SUPPORT_RESCUE') {
      this.activeClass = 'SUPPORT';
      this.classMeter = 45; // Pre-filled Ultimate Meter!
      this.ultimateCost = 45;
      this.qStatusText = 'LOCKED';
      this.eStatusText = 'LOCKED';
      this.rStatusText = 'READY (45/45)';

      // Pre-fill player board with 18 lines of garbage (critical danger state!)
      this.grid = new Grid();
      this.grid.addGarbageLines(18, 'HARD');
      this.currentPiece = null; // Paused in crisis state until [R] Guardian Angel is pressed
      this.queue = ['I', 'O', 'T', 'S'];
      this.dummyBoards = [this.createSingleDummyBoard(undefined, null, 'PRESSURING')];
    }

    // ─── TASK 3.3: Saboteur Scenario (The Disruption — [E] Grid Shift) ───
    else if (drill === 'CRISIS_SABOTEUR_DISRUPT') {
      this.activeClass = 'SABOTEUR';
      this.classMeter = 15;
      this.ultimateCost = 35;
      this.qStatusText = 'LOCKED';
      this.eStatusText = 'READY (1/MATCH)';
      this.rStatusText = '15 / 35 LINES';

      this.grid = new Grid();
      this.grid.loadPresetMatrix([
        ['J', 'J', 'J', null, 'O', 'O', 'T', 'T', 'T', null],
        ['L', 'L', 'L', 'S', 'O', 'O', 'Z', 'Z', 'T', null],
      ]);
      this.currentPiece = null;

      // Static 2D array for Dummy Board showing a perfect 4-line Tetris setup with column 9 open
      const dummyTetrisSetup: (string | null)[][] = [
        ['I', 'I', 'I', 'I', 'O', 'O', 'T', 'T', 'T', null],
        ['J', 'J', 'J', 'L', 'O', 'O', 'S', 'S', 'T', null],
        ['J', 'Z', 'Z', 'L', 'L', 'L', 'S', 'S', 'O', null],
        ['Z', 'Z', 'T', 'T', 'T', 'I', 'I', 'I', 'I', null],
      ];
      // Dummy is about to drop the final vertical I-piece into column 9!
      const dummyFinalIPiece = new Tetromino('I');
      dummyFinalIPiece.rotate(1); // vertical orientation (solid column at c=2)
      dummyFinalIPiece.x = 7;     // x + 2 = column 9 (aligned right above the open well!)
      dummyFinalIPiece.y = 2;

      this.dummyBoards = [
        this.createSingleDummyBoard(dummyTetrisSetup, dummyFinalIPiece, '⚠ TETRIS IMMINENT!'),
      ];
    }

    // ─── TASK 3.4: Speedster Scenario (The Clutch — [E] Time Warp) ───
    else if (drill === 'CRISIS_SPEEDSTER_CLUTCH') {
      this.activeClass = 'SPEEDSTER';
      this.classMeter = 25;
      this.ultimateCost = 40;
      this.qStatusText = 'LOCKED';
      this.eStatusText = 'READY';
      this.rStatusText = '25 / 40 LINES';

      // Alter player's Dynamic Gravity System to maximum speed (55ms drop interval)
      this.dropInterval = 55;
      this.timeWarpActive = false;

      // Single-line setup at row 19 with columns 6..9 open for horizontal I-piece
      this.grid = new Grid();
      this.grid.loadPresetMatrix([
        ['J', 'J', 'J', 'O', 'O', 'L', null, null, null, null],
      ]);
      this.currentPiece = new Tetromino('I');
      this.queue = ['I', 'I', 'I', 'I'];
      this.dummyBoards = [this.createSingleDummyBoard(undefined, null, 'MAX GRAVITY HAZARD')];
    }

    // ─── TASK 4.1 & 4.2: Ultimates Sandbox (3-Dummy Lobby AoE Execution) ───
    else if (drill === 'SANDBOX_3_DUMMY_ULTIMATE') {
      this.configureSandboxClass('TANK'); // Default to Sentinel (Earthquake), switchable with 1/2/3
      this.grid = new Grid();
      this.grid.loadPresetMatrix([
        ['I', 'I', 'I', 'I', null, null, 'O', 'O', 'L', 'L'],
        ['T', 'T', 'T', 'S', 'S', null, 'O', 'O', 'L', 'L'],
      ]);
      this.currentPiece = null;
      this.initThreeDummyLobby();
    }

    this.updateClassAbilityHud();
    this.updateStage2InstructionUi();
    this.render();
  }

  private configureSandboxClass(playerClass: PlayerClass) {
    this.activeClass = playerClass;
    this.ultimateCost = playerClass === 'SPEEDSTER' ? 40 : playerClass === 'TANK' ? 50 : 35;
    this.classMeter = this.ultimateCost; // Pre-filled Ultimate meter!
    this.qStatusText = 'READY';
    this.eStatusText = this.gridShiftUsed && playerClass === 'SABOTEUR' ? 'USED (RESET W/ R)' : 'READY';
    this.rStatusText = `READY (${this.classMeter}/${this.ultimateCost})`;
    this.updateClassAbilityHud();
  }

  private initThreeDummyLobby() {
    const presetA: (string | null)[][] = [
      ['T', 'T', 'T', null, 'O', 'O', null, 'L', 'L', 'L'],
      ['J', 'J', 'S', 'S', 'O', 'O', 'Z', 'Z', 'L', null],
      ['J', 'I', 'I', 'I', 'I', 'Z', 'Z', 'T', 'T', 'T'],
    ];
    const presetB: (string | null)[][] = [
      ['O', 'O', null, 'I', 'I', 'I', 'I', null, 'J', 'J'],
      ['O', 'O', 'L', 'L', 'L', 'S', 'S', null, 'J', 'Z'],
      ['T', 'T', 'T', 'L', 'S', 'S', 'Z', 'Z', 'J', 'Z'],
    ];
    const presetC: (string | null)[][] = [
      [null, 'S', 'S', 'T', 'T', 'T', null, 'O', 'O', null],
      ['L', 'L', 'S', 'S', 'T', 'J', 'J', 'O', 'O', 'I'],
      ['L', 'Z', 'Z', 'I', 'I', 'I', 'I', 'J', 'J', 'I'],
    ];

    const createMini = (id: string, label: string, rows: (string | null)[][]): DummyBoardState => {
      const g = new Grid();
      g.loadPresetMatrix(rows);
      const piece = new Tetromino('T');
      piece.x = 3;
      piece.y = 4;
      return {
        id,
        label,
        grid: g,
        activePiece: piece,
        statusBadge: 'ACTIVE',
        statusColor: '#9CA3AF',
        frozenTimer: 0,
        chaosTimer: 0,
      };
    };

    this.dummyBoards = [
      createMini('DUMMY-ALPHA', 'DUMMY ALPHA', presetA),
      createMini('DUMMY-BETA', 'DUMMY BETA', presetB),
      createMini('DUMMY-GAMMA', 'DUMMY GAMMA', presetC),
    ];
  }

  private updateClassAbilityHud() {
    const info = PLAYER_CLASSES.find(c => c.id === this.activeClass) ?? PLAYER_CLASSES[0];

    const qLabel = document.getElementById('ability-q-label-p1');
    const qStatus = document.getElementById('ability-q-status-p1');
    const eLabel = document.getElementById('ability-e-label-p1');
    const eStatus = document.getElementById('ability-e-status-p1');
    const rLabel = document.getElementById('ability-label-p1');
    const rReady = document.getElementById('ability-ready-p1');
    const rFill = document.getElementById('ability-fill-p1');
    const rStatus = document.getElementById('ability-r-status-p1');

    if (qLabel) qLabel.textContent = info.abilityQName;
    if (qStatus) qStatus.textContent = this.qStatusText;
    if (eLabel) eLabel.textContent = info.abilityEName;
    if (eStatus) eStatus.textContent = this.eStatusText;
    if (rLabel) rLabel.textContent = info.ultimateName;

    const pct = Math.min(100, Math.round((this.classMeter / Math.max(1, this.ultimateCost)) * 100));
    if (rFill) rFill.style.width = `${pct}%`;
    if (rStatus) rStatus.textContent = this.rStatusText;
    if (rReady) {
      if (this.classMeter >= this.ultimateCost) {
        rReady.classList.remove('hidden');
      } else {
        rReady.classList.add('hidden');
      }
    }

    const activeClassBadge = document.getElementById('tut-active-class-badge');
    if (activeClassBadge) {
      activeClassBadge.textContent = `${info.name.toUpperCase()}`;
    }

    const targetLockBadge = document.getElementById('tut-target-lock-badge');
    if (targetLockBadge) {
      targetLockBadge.textContent =
        this.stage2Drill === 'SANDBOX_3_DUMMY_ULTIMATE'
          ? 'TARGET: ALL 3 DUMMIES [AoE]'
          : `TARGET: DUMMY #${this.selectedTargetIndex} [LOCKED]`;
    }
  }

  private showStage2Banner(message: string, color: 'cyan' | 'green' | 'pink' | 'yellow' = 'cyan') {
    this.stage2BannerMessage = message;
    this.stage2BannerColor = color;
    const banner = document.getElementById('tut-restart-banner');
    if (!banner) return;

    const palette: Record<typeof color, string> = {
      cyan: 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.25)]',
      green: 'border-neon-green bg-neon-green/15 text-neon-green shadow-[0_0_15px_rgba(0,255,102,0.25)]',
      pink: 'border-neon-pink bg-neon-pink/15 text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]',
      yellow: 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow shadow-[0_0_15px_rgba(255,215,0,0.25)]',
    };

    banner.className = `rounded-lg border px-3.5 py-2.5 text-xs font-bold ${palette[color]}`;
    banner.textContent = message;
  }

  private hideStage2Banner() {
    this.stage2BannerMessage = null;
    const banner = document.getElementById('tut-restart-banner');
    banner?.classList.add('hidden');
  }

  private updateStage2InstructionUi() {
    const stepCounter = document.getElementById('tut-step-counter');
    const blockBadge = document.getElementById('tut-block-badge');
    const list = document.getElementById('tut-instructions-list');
    const dots = document.getElementById('tut-progress-dots');
    const dummyStatusLine = document.getElementById('tut-dummy-status-line');
    if (!stepCounter || !blockBadge || !list || !dots) return;

    const drillOrder: Stage2Drill[] = [
      'PASSIVE_TETRIS_TRIGGER',
      'PASSIVE_SPECIAL_CLEAR',
      'CRISIS_SENTINEL_DEFENSE',
      'CRISIS_SUPPORT_RESCUE',
      'CRISIS_SABOTEUR_DISRUPT',
      'CRISIS_SPEEDSTER_CLUTCH',
      'SANDBOX_3_DUMMY_ULTIMATE',
    ];
    const activeIdx = Math.max(1, drillOrder.indexOf(this.stage2Drill) + 1);
    stepCounter.textContent = `Drill ${activeIdx} / 7`;

    Array.from(dots.children).forEach((dot, idx) => {
      const num = idx + 1;
      dot.className =
        num < activeIdx || this.stage2Drill === 'STAGE2_COMPLETED'
          ? 'h-1.5 rounded-full bg-neon-green shadow-[0_0_8px_rgba(0,255,102,0.6)]'
          : num === activeIdx
            ? 'h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.6)]'
            : 'h-1.5 rounded-full bg-gray-700';
    });

    if (dummyStatusLine && this.dummyBoards[0]) {
      dummyStatusLine.textContent = this.dummyBoards[0].statusBadge ?? 'INPUT: NULL · TARGET LOCKED';
    }

    if (this.stage2Drill === 'PASSIVE_TETRIS_TRIGGER') {
      blockBadge.textContent = 'PHASE 2 (TASK 2.1) · THE TETRIS TRIGGER';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-white">1. Clear a 4-Line Tetris in the Right Well</div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            Your board is pre-stacked with a single open well on the far right (Column 10). Rotate the <strong class="text-neon-cyan">I-Piece</strong> with <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↑</kbd> / <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">X</kbd>, move it all the way right with <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">→</kbd>, and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd>.
          </div>
          <div class="text-[10px] text-neon-yellow font-semibold mt-1">
            Passive Rule: Every class guarantees its signature Special Block on your next piece after a Tetris!
          </div>
        </div>
      `;
    } else if (this.stage2Drill === 'PASSIVE_SPECIAL_CLEAR') {
      blockBadge.textContent = 'PHASE 2 (TASK 2.2) · FORCED SPECIAL BLOCK';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-green bg-neon-green/10 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-white">2. Clear the Line Containing Your Special Block [V]</div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            Your Tetris triggered the <strong class="text-neon-yellow">Speedster Passive</strong>, spawning an I-piece carrying a <strong class="text-neon-cyan">Speed Block (V)</strong>! Move it right into the open 4-cell gap and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd> to clear the line and trigger its effect.
          </div>
        </div>
      `;
    } else if (this.stage2Drill === 'CRISIS_SENTINEL_DEFENSE') {
      blockBadge.textContent = 'PHASE 3 (TASK 3.1) · SENTINEL DEFENSE CRISIS';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-neon-pink uppercase">⚠ Crisis: Unavoidable 10-Line Garbage Queued!</div>
          <div class="text-[11px] text-gray-200 leading-relaxed">
            Your grid is frozen and 10 lines of garbage are about to slam into your board from the CQRS queue.
          </div>
        </div>
        <div class="p-3 rounded-lg border border-neon-yellow bg-neon-yellow/10 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-white">Solution: Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Counter Strike)</div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            Intercepts the incoming 10-line garbage attack and bounces it directly onto the <strong class="text-neon-pink">Dummy Board</strong>!
          </div>
        </div>
      `;
    } else if (this.stage2Drill === 'CRISIS_SUPPORT_RESCUE') {
      blockBadge.textContent = 'PHASE 3 (TASK 3.2) · SUPPORT RESCUE CRISIS';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-neon-pink uppercase">⚠ Crisis: 18 Lines of Garbage (Critical Danger!)</div>
          <div class="text-[11px] text-gray-200 leading-relaxed">
            Your board is buried under 18 rows of garbage at the top-out line, but your Ultimate meter is pre-filled (<strong class="text-neon-green">45 / 45</strong>).
          </div>
        </div>
        <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-white">Solution: Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[10px]">R</kbd> (Guardian Angel)</div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            Instantly erases the bottom 4 lines of your board, dropping your stack out of danger!
          </div>
        </div>
      `;
    } else if (this.stage2Drill === 'CRISIS_SABOTEUR_DISRUPT') {
      blockBadge.textContent = 'PHASE 3 (TASK 3.3) · SABOTEUR DISRUPTION CRISIS';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-neon-pink uppercase">⚠ Crisis: Dummy Board Has a Perfect Tetris Setup!</div>
          <div class="text-[11px] text-gray-200 leading-relaxed">
            Look at the <strong class="text-neon-pink">Dummy Board</strong> on the right: they have a 4-row well in Column 10 and their vertical I-piece is about to drop!
          </div>
        </div>
        <div class="p-3 rounded-lg border border-neon-yellow bg-neon-yellow/10 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-white">Solution: Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Grid Shift)</div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            Shifts the Dummy's entire grid by 2 columns, misaligning their well so their I-piece misdrops!
          </div>
        </div>
      `;
    } else if (this.stage2Drill === 'CRISIS_SPEEDSTER_CLUTCH') {
      blockBadge.textContent = 'PHASE 3 (TASK 3.4) · SPEEDSTER CLUTCH CRISIS';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-neon-pink uppercase">⚠ Crisis: Maximum Gravity Speed!</div>
          <div class="text-[11px] text-gray-200 leading-relaxed">
            Dynamic Gravity is cranked to extreme speed — pieces slam down before you can slide them into the right-hand gap!
          </div>
        </div>
        <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
          <div class="text-xs font-bold text-white">
            ${this.timeWarpActive ? '✓ Step 1 Done! Now Place I-Piece in Right Gap' : 'Step 1: Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Time Warp)'}
          </div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            ${this.timeWarpActive
              ? 'Time Warp is active (-50% drop speed for 6s)! Move the horizontal I-piece right into columns 7–10 and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd> to clear the line!'
              : 'Press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[9px]">E</kbd> to cut drop speed by 50%, then slide the I-piece into the open right-side slot to clear the line.'}
          </div>
        </div>
      `;
    } else if (this.stage2Drill === 'SANDBOX_3_DUMMY_ULTIMATE' || this.stage2Drill === 'STAGE2_COMPLETED') {
      blockBadge.textContent = 'PHASE 4 (TASK 4.1 & 4.2) · 3-DUMMY AoE SANDBOX';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-2">
          <div class="text-xs font-bold text-white">Switch Class (<kbd class="px-1 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[9px]">1</kbd> <kbd class="px-1 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[9px]">2</kbd> <kbd class="px-1 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[9px]">3</kbd>) &amp; Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-pink rounded text-neon-pink font-pixel text-[10px]">R</kbd></div>
          <div class="text-[11px] text-gray-300 leading-relaxed">
            Your Ultimate meter is pre-filled. Unleash an Area-of-Effect Ultimate across all <strong class="text-neon-pink">3 Dummy Boards</strong> simultaneously:
          </div>
          <div class="grid grid-cols-3 gap-1.5 pt-1">
            <button type="button" data-sandbox-class="TANK" class="px-2 py-1.5 rounded border text-[9px] font-bold uppercase cursor-pointer ${this.activeClass === 'TANK' ? 'border-neon-yellow bg-neon-yellow/20 text-neon-yellow' : 'border-card-border bg-black/40 text-gray-400'}">
              [1] Sentinel<br/><span class="text-[8px] opacity-80">Earthquake</span>
            </button>
            <button type="button" data-sandbox-class="SPEEDSTER" class="px-2 py-1.5 rounded border text-[9px] font-bold uppercase cursor-pointer ${this.activeClass === 'SPEEDSTER' ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan' : 'border-card-border bg-black/40 text-gray-400'}">
              [2] Speedster<br/><span class="text-[8px] opacity-80">Bullet Time</span>
            </button>
            <button type="button" data-sandbox-class="SABOTEUR" class="px-2 py-1.5 rounded border text-[9px] font-bold uppercase cursor-pointer ${this.activeClass === 'SABOTEUR' ? 'border-neon-pink bg-neon-pink/20 text-neon-pink' : 'border-card-border bg-black/40 text-gray-400'}">
              [3] Saboteur<br/><span class="text-[8px] opacity-80">Chaos Mode</span>
            </button>
          </div>
        </div>
      `;

      list.querySelectorAll('[data-sandbox-class]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cls = (btn as HTMLElement).getAttribute('data-sandbox-class') as PlayerClass;
          if (cls) {
            this.configureSandboxClass(cls);
            this.updateStage2InstructionUi();
          }
        });
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2 INPUT & eFSM GUARD ENGINE (Phase 5)
  // ─────────────────────────────────────────────────────────────────────────

  private handleStage2KeyDown(e: KeyboardEvent) {
    if (!this.isRunning || this.stage2TransitionLocked || this.eFsmState !== GameState.TUTORIAL) return;

    const key = e.key;

    //Task 1.3: Tab key attempts to cycle target, but targeting is locked onto Dummy Board during TUTORIAL
    if (key === 'Tab') {
      e.preventDefault();
      this.selectedTargetIndex = 1;
      this.showStage2Banner('◎ Targeting Pointer is locked onto the Dummy Board during Stage 2.', 'cyan');
      return;
    }

    // ─── DRILL 3: Sentinel Defense ([E] Counter Strike Guard) ───
    if (this.stage2Drill === 'CRISIS_SENTINEL_DEFENSE') {
      e.preventDefault();
      if (key === 'e' || key === 'E') {
        this.reflectArmed = true;
        const reflectedAmount = this.incomingGarbageQueue;
        this.incomingGarbageQueue = 0;
        this.eStatusText = 'REFLECTED!';
        if (this.dummyBoards[0]) {
          this.dummyBoards[0].grid.addGarbageLines(reflectedAmount, 'HUMAN');
          this.dummyBoards[0].statusBadge = `HIT BY ${reflectedAmount} REFLECTED LINES!`;
          this.dummyBoards[0].statusColor = '#FF1493';
        }
        AudioManager.playSfx('lineClear');
        this.updateClassAbilityHud();
        this.render();
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ COUNTER STRIKE! Intercepted & bounced 10 garbage lines to the Dummy Board!', 'green');
        setTimeout(() => {
          this.setupStage2Drill('CRISIS_SUPPORT_RESCUE');
        }, 2100);
      } else {
        this.showStage2Banner('eFSM Guard: Press [E] to activate Counter Strike and reflect the 10-line attack!', 'pink');
      }
      return;
    }

    // ─── DRILL 4: Support Rescue ([R] Guardian Angel Guard) ───
    if (this.stage2Drill === 'CRISIS_SUPPORT_RESCUE') {
      e.preventDefault();
      if (key === 'r' || key === 'R' || key === 'Shift') {
        this.grid.clearBottomLines(4);
        this.classMeter = 0;
        this.rStatusText = '0 / 45 LINES';
        if (this.dummyBoards[0]) {
          this.dummyBoards[0].statusBadge = 'PRESSURE NULLIFIED';
        }
        AudioManager.playSfx('lineClear');
        this.updateClassAbilityHud();
        this.render();
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ GUARDIAN ANGEL! Cleared the bottom 4 garbage lines — crisis averted!', 'green');
        setTimeout(() => {
          this.setupStage2Drill('CRISIS_SABOTEUR_DISRUPT');
        }, 2100);
      } else {
        this.showStage2Banner('eFSM Guard: Press [R] to activate Guardian Angel and clear the bottom 4 lines!', 'pink');
      }
      return;
    }

    // ─── DRILL 5: Saboteur Disruption ([E] Grid Shift Guard) ───
    if (this.stage2Drill === 'CRISIS_SABOTEUR_DISRUPT') {
      e.preventDefault();
      if (key === 'e' || key === 'E') {
        this.gridShiftUsed = true;
        this.eStatusText = 'USED (1/MATCH)';
        const dummy = this.dummyBoards[0];
        if (dummy) {
          // Shift the Dummy's grid by 2 columns, misaligning their column 9 well!
          dummy.grid.shiftHorizontally(2);
          // Drop the Dummy's hovering I-piece onto the now-shifted stack so the player sees the ruined Tetris
          if (dummy.activePiece) {
            while (!dummy.grid.checkCollision(dummy.activePiece, dummy.activePiece.x, dummy.activePiece.y + 1)) {
              dummy.activePiece.y++;
            }
            dummy.grid.lockTetromino(dummy.activePiece);
            dummy.activePiece = null;
          }
          dummy.statusBadge = 'WELL SHIFTED +2 COLS · TETRIS DENIED!';
          dummy.statusColor = '#00FF66';
        }
        AudioManager.playSfx('lineClear');
        this.updateClassAbilityHud();
        this.render();
        this.stage2TransitionLocked = true;
        this.showStage2Banner("✓ GRID SHIFT! Dummy's Tetris well shifted by 2 columns — threat nullified!", 'green');
        setTimeout(() => {
          this.setupStage2Drill('CRISIS_SPEEDSTER_CLUTCH');
        }, 2200);
      } else {
        this.showStage2Banner("eFSM Guard: Press [E] to activate Grid Shift and ruin the Dummy's Tetris setup!", 'pink');
      }
      return;
    }

    // ─── DRILL 6: Speedster Clutch ([E] Time Warp + Piece Placement) ───
    if (this.stage2Drill === 'CRISIS_SPEEDSTER_CLUTCH') {
      if (key === 'e' || key === 'E') {
        e.preventDefault();
        if (!this.timeWarpActive) {
          this.timeWarpActive = true;
          this.timeWarpTimer = 6000;
          // Cut drop speed by 50% (slow down to a comfortable controllable interval)
          this.dropInterval = 750;
          this.eStatusText = 'ACTIVE (6.0s)';
          // Reset piece to top so player has full runway to place it cleanly
          this.currentPiece = new Tetromino('I');
          this.dropTimer = 0;
          this.lockTimer = 0;
          this.showStage2Banner('✓ TIME WARP ACTIVE! Gravity slowed by 50% — now drop the I-piece into the right gap!', 'cyan');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
        }
        return;
      }

      if (!this.timeWarpActive) {
        e.preventDefault();
        this.showStage2Banner('eFSM Guard: Gravity is at MAX SPEED! Press [E] Time Warp first to slow it down!', 'pink');
        return;
      }
      // Once Time Warp is active, fall through to piece movement controls below!
    }

    // ─── DRILL 7: Phase 4 Ultimates Sandbox (3-Dummy Lobby AoE Execution) ───
    if (this.stage2Drill === 'SANDBOX_3_DUMMY_ULTIMATE') {
      e.preventDefault();
      if (key === '1') {
        this.configureSandboxClass('TANK');
        this.updateStage2InstructionUi();
        return;
      }
      if (key === '2') {
        this.configureSandboxClass('SPEEDSTER');
        this.updateStage2InstructionUi();
        return;
      }
      if (key === '3') {
        this.configureSandboxClass('SABOTEUR');
        this.updateStage2InstructionUi();
        return;
      }
      if (key === 'r' || key === 'R' || key === 'Shift') {
        this.executeThreeDummyUltimate();
        return;
      }
      this.showStage2Banner('Press [1], [2], or [3] to pick a class, then press [R] to unleash its AoE Ultimate!', 'cyan');
      return;
    }

    // ─── PIECE MOVEMENT CONTROLS FOR DRILLS 1, 2, AND 6 (AFTER TIME WARP) ───
    if (!this.currentPiece) return;

    const isMoveKey =
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowDown' ||
      key === 'ArrowUp' ||
      key === 'x' ||
      key === 'X' ||
      key === 'z' ||
      key === 'Z' ||
      key === ' ';

    if (!isMoveKey) {
      if (key === 'q' || key === 'Q' || key === 'e' || key === 'E' || key === 'r' || key === 'R') {
        e.preventDefault();
        this.showStage2Banner('Complete the current line-clear task first before using abilities!', 'yellow');
      }
      return;
    }

    e.preventDefault();
    if (key === 'ArrowLeft') {
      this.tryMove(-1, 0);
    } else if (key === 'ArrowRight') {
      this.tryMove(1, 0);
    } else if (key === 'ArrowDown') {
      if (this.tryMove(0, 1)) this.dropTimer = 0;
    } else if (key === 'ArrowUp' || key === 'x' || key === 'X') {
      this.tryRotate(1);
    } else if (key === 'z' || key === 'Z') {
      this.tryRotate(-1);
    } else if (key === ' ') {
      while (this.tryMove(0, 1)) {
        // hard drop
      }
      this.lockStage2Piece();
    }
    this.render();
  }

  private lockStage2Piece() {
    if (!this.currentPiece) return;
    this.grid.lockTetromino(this.currentPiece);
    this.currentPiece = null;

    const { linesCleared, specialBlocksToTrigger } = this.grid.clearLines();

    // Task 2.1 Resolution: Check if the player cleared the 4-line Tetris!
    if (this.stage2Drill === 'PASSIVE_TETRIS_TRIGGER') {
      if (linesCleared >= 4) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(800, 4);
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ TETRIS CLEARED! Passive triggered — Special Block [V] forced onto your next piece!', 'green');
        setTimeout(() => {
          this.setupStage2Drill('PASSIVE_SPECIAL_CLEAR');
        }, 1800);
      } else {
        this.showStage2Banner('Missed the 4-line Tetris well! Resetting the well — rotate the I-piece and drop it in Column 10.', 'pink');
        setTimeout(() => {
          this.setupStage2Drill('PASSIVE_TETRIS_TRIGGER');
        }, 1200);
      }
      return;
    }

    // Task 2.2 Resolution: Check if the player cleared the line containing the forced Special Block!
    if (this.stage2Drill === 'PASSIVE_SPECIAL_CLEAR') {
      if (linesCleared >= 1 && specialBlocksToTrigger.length > 0) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(1200, 5);
        if (this.dummyBoards[0]) {
          this.dummyBoards[0].statusBadge = 'PASSIVE VERIFIED · READY FOR CRISIS DRILLS';
          this.dummyBoards[0].statusColor = '#00FF66';
        }
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ SPECIAL BLOCK [V] TRIGGERED! Drop speed slowed by 25%! Advancing to Phase 3 Crises...', 'green');
        setTimeout(() => {
          this.setupStage2Drill('CRISIS_SENTINEL_DEFENSE');
        }, 2000);
      } else {
        this.showStage2Banner('Move the Special Block I-piece into the open right-hand gap to clear the bottom row!', 'pink');
        setTimeout(() => {
          this.setupStage2Drill('PASSIVE_SPECIAL_CLEAR');
        }, 1200);
      }
      return;
    }

    // Task 3.4 Resolution: Speedster Time Warp Clutch line clear
    if (this.stage2Drill === 'CRISIS_SPEEDSTER_CLUTCH') {
      if (this.timeWarpActive && linesCleared >= 1) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(2000, 6);
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ CLUTCH CLEAR! Time Warp tamed maximum gravity! Entering 3-Dummy Ultimate Sandbox...', 'green');
        setTimeout(() => {
          this.setupStage2Drill('SANDBOX_3_DUMMY_ULTIMATE');
        }, 2000);
      } else if (!this.timeWarpActive) {
        // Piece slammed down due to max gravity before [E] was pressed — respawn piece at top to keep crisis going
        this.setupStage2Drill('CRISIS_SPEEDSTER_CLUTCH');
        this.showStage2Banner('⚠ Too fast! Press [E] Time Warp first to cut gravity by 50%!', 'pink');
      } else {
        this.setupStage2Drill('CRISIS_SPEEDSTER_CLUTCH');
        this.timeWarpActive = true;
        this.timeWarpTimer = 6000;
        this.dropInterval = 750;
        this.showStage2Banner('Slide the horizontal I-piece into the right-hand gap (Columns 7–10) to clear the row!', 'yellow');
      }
    }
  }

  private executeThreeDummyUltimate() {
    AudioManager.playSfx('lineClear');
    this.classMeter = 0;

    if (this.activeClass === 'TANK') {
      // Sentinel — Earthquake: +4 garbage lines on ALL 3 Dummy Boards simultaneously
      this.dummyBoards.forEach((d, idx) => {
        d.grid.addGarbageLines(4, 'HUMAN');
        d.statusBadge = '+4 GARBAGE (EARTHQUAKE)';
        d.statusColor = '#FFD700';
        const el = document.getElementById(`tut-dummy-mini-status-${idx}`);
        if (el) {
          el.textContent = '💥 +4 GARBAGE LINES!';
          el.className = 'text-[8px] font-bold text-neon-yellow uppercase';
        }
      });
      this.showStage2Banner('✓ EARTHQUAKE UNLEASHED! Sent +4 Garbage Lines to all 3 Dummy Boards simultaneously!', 'green');
    } else if (this.activeClass === 'SPEEDSTER') {
      // Speedster — Bullet Time: Freeze ALL 3 Dummy Boards for 5 seconds
      this.dummyBoards.forEach((d, idx) => {
        d.frozenTimer = 5000;
        d.statusBadge = '❄ FROZEN (5.0s)';
        d.statusColor = '#00E5FF';
        const el = document.getElementById(`tut-dummy-mini-status-${idx}`);
        if (el) {
          el.textContent = '❄ FROZEN 5.0s!';
          el.className = 'text-[8px] font-bold text-neon-cyan uppercase';
        }
      });
      this.showStage2Banner('✓ BULLET TIME UNLEASHED! All 3 Dummy Boards frozen in place for 5 seconds!', 'green');
    } else {
      // Saboteur — Chaos Mode: Reverse controls on ALL 3 Dummy Boards for 8s + Reset Grid Shift
      this.gridShiftUsed = false;
      this.eStatusText = 'RESET & READY!';
      this.dummyBoards.forEach((d, idx) => {
        d.chaosTimer = 8000;
        d.grid.shiftHorizontally(idx % 2 === 0 ? 1 : -1);
        d.statusBadge = '🌀 CHAOS REVERSED (8.0s)';
        d.statusColor = '#FF1493';
        const el = document.getElementById(`tut-dummy-mini-status-${idx}`);
        if (el) {
          el.textContent = '🌀 CONTROLS REVERSED!';
          el.className = 'text-[8px] font-bold text-neon-pink uppercase';
        }
      });
      this.showStage2Banner('✓ CHAOS MODE UNLEASHED! Reversed all 3 Dummy Boards for 8s & reset [E] Grid Shift!', 'green');
    }

    this.rStatusText = 'UNLEASHED!';
    this.updateClassAbilityHud();
    this.render();

    this.stage2TransitionLocked = true;
    markTutorialCompleted('basics-stage-2');
    setTimeout(() => {
      this.stage2Drill = 'STAGE2_COMPLETED';
      this.stage2TransitionLocked = false;
      this.configureSandboxClass(this.activeClass);
      this.updateStage2InstructionUi();
      this.showConclusionModal();
    }, 2200);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1 HUD & LOGIC (UNCHANGED BEHAVIOR)
  // ═══════════════════════════════════════════════════════════════════════════

  private mountTutorialHud() {
    this.hudContainer?.remove();
    this.dummyCanvasContainer?.remove();
    this.conclusionModal?.remove();

    const duoLayoutContainer = document.getElementById('duo-layout-container');
    if (!duoLayoutContainer) return;

    // Create the side instruction panel inside the duo layout container
    const panel = document.createElement('div');
    panel.id = 'tutorial-stage-panel';
    panel.className = 'w-80 sm:w-96 shrink-0 bg-card-bg/90 backdrop-blur-md border-2 border-neon-cyan rounded-xl p-6 shadow-[0_0_30px_rgba(0,229,255,0.2)] flex flex-col gap-5 self-center z-30 pointer-events-auto';
    panel.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[10px] font-bold tracking-[0.25em] uppercase text-neon-cyan">STAGE 1 TUTORIAL</span>
          <span id="tut-step-counter" class="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40">Block 1 / 5</span>
        </div>
        <h2 class="text-xl font-extrabold text-white tracking-wide">Basic Movements</h2>
        <div id="tut-progress-dots" class="grid grid-cols-5 gap-1.5 mt-3">
          <div class="h-1.5 rounded-full bg-neon-cyan"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
        </div>
      </div>

      <!-- Alert banner when restarting stage -->
      <div id="tut-restart-banner" class="hidden rounded-lg border border-neon-pink bg-neon-pink/15 px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]"></div>

      <!-- Current Block Task Box -->
      <div class="rounded-xl bg-deep-purple/90 border border-card-border p-4 flex flex-col gap-3">
        <div id="tut-block-badge" class="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">FIRST BLOCK</div>
        <div id="tut-instructions-list" class="flex flex-col gap-3"></div>
      </div>

      <div class="text-[11px] text-gray-400 leading-relaxed border-t border-card-border pt-3">
        Complete each block's task before it locks. If you perform the wrong action, <span class="text-neon-pink font-semibold">Stage 1 will restart</span>.
      </div>

      <div class="flex gap-3 pt-1">
        <button id="tut-btn-restart" type="button" class="flex-1 px-3 py-2 text-xs font-bold tracking-wider uppercase rounded-lg border border-card-border bg-white/5 text-gray-300 hover:text-white hover:border-neon-cyan transition-all cursor-pointer">
          Restart Stage
        </button>
        <button id="tut-btn-exit" type="button" class="flex-1 px-3 py-2 text-xs font-bold tracking-wider uppercase rounded-lg border border-neon-pink/40 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink hover:text-deep-purple transition-all cursor-pointer">
          Exit Tutorial
        </button>
      </div>
    `;

    duoLayoutContainer.appendChild(panel);
    this.hudContainer = panel;

    panel.querySelector('#tut-btn-restart')?.addEventListener('click', () => {
      this.restartStage('Stage 1 manually restarted.');
    });
    panel.querySelector('#tut-btn-exit')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });

    // Conclusion Modal
    const modal = document.createElement('div');
    modal.id = 'tutorial-conclusion-modal';
    modal.className = 'hidden fixed inset-0 z-[120] bg-black/80 backdrop-blur-md items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-card-bg border-2 border-neon-cyan rounded-2xl max-w-md w-full p-8 text-center shadow-[0_0_50px_rgba(0,229,255,0.3)] flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-neon-cyan/15 border-2 border-neon-cyan flex items-center justify-center text-neon-cyan text-2xl font-bold shadow-[0_0_20px_rgba(0,229,255,0.4)]">
          ✓
        </div>
        <div>
          <p class="text-neon-cyan text-[10px] font-bold tracking-[0.3em] uppercase mb-2">STAGE 1 COMPLETE</p>
          <h2 class="text-2xl font-extrabold text-white">Basic Movements Mastered!</h2>
          <p class="text-gray-400 text-xs mt-2 leading-relaxed">
            You have completed all 5 steps of the Basic Movements stage: moving left &amp; right, soft dropping, hard dropping, rotating, and holding &amp; swapping blocks.
          </p>
        </div>

        <div class="w-full rounded-xl bg-deep-purple/80 border border-card-border p-4 text-left text-xs flex flex-col gap-2">
          <div class="flex justify-between items-center text-gray-300">
            <span>1st Block · Move &amp; Soft Drop</span>
            <span class="text-neon-green font-bold">← / → then ↓</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>2nd Block · Hard Drop</span>
            <span class="text-neon-green font-bold">SPACEBAR</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>3rd Block · Rotate Block</span>
            <span class="text-neon-green font-bold">↑ / X / Z</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>4th Block · Hold Block</span>
            <span class="text-neon-green font-bold">C</span>
          </div>
          <div class="flex justify-between items-center text-gray-300">
            <span>5th Block · Drop then Swap Held</span>
            <span class="text-neon-green font-bold">DROP then C</span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <button id="tut-modal-replay" type="button" class="flex-1 px-4 py-3 rounded-lg border border-card-border bg-white/5 text-white text-xs font-bold tracking-widest uppercase hover:border-neon-cyan transition-all cursor-pointer">
            Replay Stage 1
          </button>
          <button id="tut-modal-done" type="button" class="flex-1 px-4 py-3 rounded-lg bg-neon-cyan text-deep-purple text-xs font-bold tracking-widest uppercase hover:brightness-110 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all cursor-pointer">
            Back to Tutorials
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.conclusionModal = modal;

    modal.querySelector('#tut-modal-replay')?.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      this.resetStageState();
    });
    modal.querySelector('#tut-modal-done')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });
  }

  private resetStageState() {
    this.grid = new Grid();
    this.holdPiece = null;
    this.queue = [...STAGE_1_QUEUE];
    this.step = 'PIECE_1_MOVE';
    this.piece1MovedLeftRight = false;
    this.piece1SoftDropped = false;
    this.piece3Rotated = false;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.dropInterval = 1100;
    this.isRestarting = false;

    this.spawnNextPiece();
    this.updateHudStats(0, 0);
    this.updateInstructionUi();
    this.render();
  }

  private spawnNextPiece() {
    const nextShape = this.queue.shift() ?? 'T';
    this.currentPiece = new Tetromino(nextShape);
    this.dropTimer = 0;
    this.lockTimer = 0;
  }

  private restartStage(reason: string) {
    if (this.isRestarting) return;
    this.isRestarting = true;

    const banner = document.getElementById('tut-restart-banner');
    if (banner) {
      banner.textContent = `⚠ ${reason} Restarting Stage 1...`;
      banner.classList.remove('hidden');
    }

    setTimeout(() => {
      this.resetStageState();
      setTimeout(() => {
        const currentBanner = document.getElementById('tut-restart-banner');
        currentBanner?.classList.add('hidden');
      }, 2600);
    }, 350);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.activeStage === 2) {
      this.handleStage2KeyDown(e);
      return;
    }

    if (!this.isRunning || this.isRestarting || this.step === 'COMPLETED') return;
    if (!this.currentPiece) return;

    const key = e.key;
    const isHandledKey =
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowDown' ||
      key === 'ArrowUp' ||
      key === 'x' ||
      key === 'X' ||
      key === 'z' ||
      key === 'Z' ||
      key === ' ' ||
      key === 'c' ||
      key === 'C';

    if (!isHandledKey) return;
    e.preventDefault();

    // ─── BLOCK 1: Move Left/Right, then Soft Drop (Down Arrow) ───
    if (this.step === 'PIECE_1_MOVE') {
      if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.piece1MovedLeftRight = true;
        this.step = 'PIECE_1_SOFT_DROP';
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.piece1MovedLeftRight = true;
        this.step = 'PIECE_1_SOFT_DROP';
        this.updateInstructionUi();
        this.render();
      } else {
        this.restartStage('Instruction 1 requires pressing Left (←) or Right (→) Arrow first!');
      }
      return;
    }

    if (this.step === 'PIECE_1_SOFT_DROP') {
      if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else if (key === 'ArrowDown') {
        this.piece1SoftDropped = true;
        if (this.tryMove(0, 1)) {
          this.dropTimer = 0;
        }
        this.updateInstructionUi();
        this.render();
      } else {
        this.restartStage('Instruction 2 requires pressing the Down (↓) Arrow key!');
      }
      return;
    }

    // ─── BLOCK 2: Press Spacebar to Hard Drop ───
    if (this.step === 'PIECE_2_HARD_DROP') {
      if (key === ' ') {
        while (this.tryMove(0, 1)) {
          // drop to bottom
        }
        this.grid.lockTetromino(this.currentPiece);
        this.updateHudStats(100, 0);
        this.step = 'PIECE_3_ROTATE';
        this.piece3Rotated = false;
        this.spawnNextPiece();
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else {
        this.restartStage('For the 2nd block, press SPACEBAR to hard drop!');
      }
      return;
    }

    // ─── BLOCK 3: Rotate the Block (Up Arrow / X / Z), then Drop to Lock ───
    if (this.step === 'PIECE_3_ROTATE') {
      if (key === 'ArrowUp' || key === 'x' || key === 'X') {
        this.tryRotate(1);
        this.piece3Rotated = true;
        this.updateInstructionUi();
        this.render();
      } else if (key === 'z' || key === 'Z') {
        this.tryRotate(-1);
        this.piece3Rotated = true;
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else if (key === ' ' && this.piece3Rotated) {
        while (this.tryMove(0, 1)) {
          // drop to bottom
        }
        this.grid.lockTetromino(this.currentPiece);
        this.updateHudStats(150, 0);
        this.step = 'PIECE_4_HOLD';
        this.spawnNextPiece();
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowDown' && this.piece3Rotated) {
        if (this.tryMove(0, 1)) {
          this.dropTimer = 0;
        }
        this.render();
      } else if (!this.piece3Rotated) {
        this.restartStage('Rotate the 3rd block first using Up Arrow (↑), X, or Z!');
      } else {
        this.restartStage('Drop the rotated 3rd block instead of holding it!');
      }
      return;
    }

    // ─── BLOCK 4: Press C to Hold the Current Block ───
    if (this.step === 'PIECE_4_HOLD') {
      if (key === 'c' || key === 'C') {
        this.holdPiece = new Tetromino(this.currentPiece.type);
        this.step = 'PIECE_5_DROP_FIRST';
        this.spawnNextPiece();
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else {
        this.restartStage('For the 4th block, press C to hold the current block!');
      }
      return;
    }

    // ─── BLOCK 5 (Part 1): Drop the 5th Block First ───
    if (this.step === 'PIECE_5_DROP_FIRST') {
      if (key === 'c' || key === 'C') {
        this.restartStage('This block must drop first before you can swap your held block!');
        return;
      }
      if (key === ' ') {
        while (this.tryMove(0, 1)) {
          // drop to bottom
        }
        this.grid.lockTetromino(this.currentPiece);
        this.updateHudStats(200, 0);
        this.step = 'PIECE_5_SWAP_HOLD';
        this.spawnNextPiece();
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowDown') {
        if (this.tryMove(0, 1)) {
          this.dropTimer = 0;
        }
        this.render();
      } else if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else if (key === 'ArrowUp' || key === 'x' || key === 'X') {
        this.tryRotate(1);
        this.render();
      } else if (key === 'z' || key === 'Z') {
        this.tryRotate(-1);
        this.render();
      }
      return;
    }

    // ─── BLOCK 5 (Part 2): Press C Again to Replace Current Block with Held Block ───
    if (this.step === 'PIECE_5_SWAP_HOLD') {
      if (key === 'c' || key === 'C') {
        if (this.holdPiece) {
          const prevHeldType = this.holdPiece.type;
          this.holdPiece = new Tetromino(this.currentPiece.type);
          this.currentPiece = new Tetromino(prevHeldType);
        }
        this.dropTimer = 0;
        this.lockTimer = 0;
        this.step = 'PIECE_5_DROP_SWAPPED';
        this.updateInstructionUi();
        this.render();
      } else if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else {
        this.restartStage('Now press C to replace the current block with your held block!');
      }
      return;
    }

    // ─── BLOCK 5 (Part 3): Land the Swapped Held Block to Complete Stage 1 ───
    if (this.step === 'PIECE_5_DROP_SWAPPED') {
      if (key === 'c' || key === 'C') {
        this.restartStage('You already swapped your held block! Land this block on the grid to finish Stage 1.');
        return;
      }
      if (key === ' ') {
        while (this.tryMove(0, 1)) {
          // drop to bottom
        }
        this.grid.lockTetromino(this.currentPiece);
        this.currentPiece = null;
        this.step = 'COMPLETED';
        this.updateHudStats(250, 0);
        this.updateInstructionUi();
        this.render();
        this.showConclusionModal();
      } else if (key === 'ArrowDown') {
        if (this.tryMove(0, 1)) {
          this.dropTimer = 0;
        }
        this.render();
      } else if (key === 'ArrowLeft') {
        this.tryMove(-1, 0);
        this.render();
      } else if (key === 'ArrowRight') {
        this.tryMove(1, 0);
        this.render();
      } else if (key === 'ArrowUp' || key === 'x' || key === 'X') {
        this.tryRotate(1);
        this.render();
      } else if (key === 'z' || key === 'Z') {
        this.tryRotate(-1);
        this.render();
      }
      return;
    }
  }

  private tryMove(dx: number, dy: number): boolean {
    if (!this.currentPiece) return false;
    if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x + dx, this.currentPiece.y + dy)) {
      this.currentPiece.move(dx, dy);
      return true;
    }
    return false;
  }

  private tryRotate(dir: 1 | -1): boolean {
    if (!this.currentPiece) return false;
    this.currentPiece.rotate(dir);
    for (const kick of this.currentPiece.getKickData()) {
      if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x + kick.x, this.currentPiece.y + kick.y)) {
        this.currentPiece.move(kick.x, kick.y);
        return true;
      }
    }
    this.currentPiece.rotate((dir * -1) as 1 | -1);
    return false;
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  private update(dt: number) {
    if (this.activeStage === 2) {
      this.updateStage2(dt);
      return;
    }

    if (this.isRestarting || this.step === 'COMPLETED' || !this.currentPiece) return;

    const grounded = this.grid.checkCollision(
      this.currentPiece,
      this.currentPiece.x,
      this.currentPiece.y + 1
    );

    if (grounded) {
      this.lockTimer += dt;
      if (this.lockTimer >= this.LOCK_DELAY) {
        this.onPieceLockedByGravity();
        return;
      }
    } else {
      this.lockTimer = 0;
    }

    this.dropTimer += dt;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      this.tryMove(0, 1);
    }
  }

  private updateStage2(dt: number) {
    if (this.stage2TransitionLocked || this.stage2Drill === 'STAGE2_COMPLETED') return;

    if (this.timeWarpActive && this.timeWarpTimer > 0) {
      this.timeWarpTimer = Math.max(0, this.timeWarpTimer - dt);
      this.eStatusText = `ACTIVE (${(this.timeWarpTimer / 1000).toFixed(1)}s)`;
      this.updateClassAbilityHud();
    }

    if (!this.currentPiece) return;

    const grounded = this.grid.checkCollision(
      this.currentPiece,
      this.currentPiece.x,
      this.currentPiece.y + 1
    );

    if (grounded) {
      this.lockTimer += dt;
      const effectiveLockDelay = this.stage2Drill === 'CRISIS_SPEEDSTER_CLUTCH' && !this.timeWarpActive ? 120 : this.LOCK_DELAY;
      if (this.lockTimer >= effectiveLockDelay) {
        this.lockStage2Piece();
        return;
      }
    } else {
      this.lockTimer = 0;
    }

    this.dropTimer += dt;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      this.tryMove(0, 1);
    }
  }

  private onPieceLockedByGravity() {
    if (!this.currentPiece) return;

    if (this.step === 'PIECE_1_SOFT_DROP' && this.piece1MovedLeftRight && this.piece1SoftDropped) {
      this.grid.lockTetromino(this.currentPiece);
      this.updateHudStats(50, 0);
      this.step = 'PIECE_2_HARD_DROP';
      this.spawnNextPiece();
      this.updateInstructionUi();
      return;
    }

    if (this.step === 'PIECE_3_ROTATE' && this.piece3Rotated) {
      this.grid.lockTetromino(this.currentPiece);
      this.updateHudStats(150, 0);
      this.step = 'PIECE_4_HOLD';
      this.spawnNextPiece();
      this.updateInstructionUi();
      return;
    }

    if (this.step === 'PIECE_5_DROP_FIRST') {
      this.grid.lockTetromino(this.currentPiece);
      this.updateHudStats(200, 0);
      this.step = 'PIECE_5_SWAP_HOLD';
      this.spawnNextPiece();
      this.updateInstructionUi();
      return;
    }

    if (this.step === 'PIECE_5_DROP_SWAPPED') {
      this.grid.lockTetromino(this.currentPiece);
      this.currentPiece = null;
      this.step = 'COMPLETED';
      this.updateHudStats(250, 0);
      this.updateInstructionUi();
      this.render();
      this.showConclusionModal();
      return;
    }

    if (this.step === 'PIECE_1_MOVE') {
      this.restartStage('The 1st block locked before you moved it left or right!');
    } else if (this.step === 'PIECE_1_SOFT_DROP') {
      this.restartStage('The 1st block locked before you pressed the Down (↓) Arrow key!');
    } else if (this.step === 'PIECE_2_HARD_DROP') {
      this.restartStage('The 2nd block locked before you pressed SPACEBAR to hard drop!');
    } else if (this.step === 'PIECE_3_ROTATE') {
      this.restartStage('The 3rd block locked before you rotated it!');
    } else if (this.step === 'PIECE_4_HOLD') {
      this.restartStage('The 4th block locked before you pressed C to hold it!');
    } else if (this.step === 'PIECE_5_SWAP_HOLD') {
      this.restartStage('The block locked before you pressed C to swap with the held block!');
    }
  }

  private updateHudStats(score: number, lines: number = 0) {
    const scoreEl = document.getElementById('score-p1');
    if (scoreEl) scoreEl.innerText = String(score);
    const linesEl = document.getElementById('level-p1');
    if (linesEl) linesEl.innerText = String(lines);
  }

  private updateInstructionUi() {
    const stepCounter = document.getElementById('tut-step-counter');
    const blockBadge = document.getElementById('tut-block-badge');
    const list = document.getElementById('tut-instructions-list');
    const dots = document.getElementById('tut-progress-dots');
    if (!stepCounter || !blockBadge || !list || !dots) return;

    const activeBlockIndex =
      this.step === 'PIECE_1_MOVE' || this.step === 'PIECE_1_SOFT_DROP'
        ? 1
        : this.step === 'PIECE_2_HARD_DROP'
          ? 2
          : this.step === 'PIECE_3_ROTATE'
            ? 3
            : this.step === 'PIECE_4_HOLD'
              ? 4
              : 5;

    stepCounter.textContent = `Block ${activeBlockIndex} / 5`;

    Array.from(dots.children).forEach((dot, idx) => {
      const blockNum = idx + 1;
      dot.className =
        blockNum < activeBlockIndex || this.step === 'COMPLETED'
          ? 'h-1.5 rounded-full bg-neon-green shadow-[0_0_8px_rgba(0,255,102,0.6)]'
          : blockNum === activeBlockIndex
            ? 'h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.6)]'
            : 'h-1.5 rounded-full bg-gray-700';
    });

    if (this.step === 'PIECE_1_MOVE' || this.step === 'PIECE_1_SOFT_DROP') {
      blockBadge.textContent = 'FIRST BLOCK · MOVEMENT & SOFT DROP';
      const moveDone = this.piece1MovedLeftRight;
      const softDone = this.piece1SoftDropped;

      list.innerHTML = `
        <div class="p-3 rounded-lg border ${moveDone ? 'border-neon-green/50 bg-neon-green/10' : 'border-neon-cyan bg-neon-cyan/10'} flex items-start gap-3">
          <span class="text-sm font-bold ${moveDone ? 'text-neon-green' : 'text-neon-cyan'}">${moveDone ? '✓' : '1.'}</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Move the block left or right</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">←</kbd> or <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">→</kbd> Arrow keys</div>
          </div>
        </div>
        <div class="p-3 rounded-lg border ${softDone ? 'border-neon-green/50 bg-neon-green/10' : moveDone ? 'border-neon-cyan bg-neon-cyan/10' : 'border-card-border bg-black/20 opacity-60'} flex items-start gap-3">
          <span class="text-sm font-bold ${softDone ? 'text-neon-green' : moveDone ? 'text-neon-cyan' : 'text-gray-500'}">${softDone ? '✓' : '2.'}</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Soft drop the block to the bottom</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↓</kbd> Down Arrow key and let it lock</div>
          </div>
        </div>
      `;
    } else if (this.step === 'PIECE_2_HARD_DROP') {
      blockBadge.textContent = 'SECOND BLOCK · HARD DROP';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex items-start gap-3">
          <span class="text-sm font-bold text-neon-cyan">1.</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Hard drop the block instantly</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACEBAR</kbd> to drop &amp; lock immediately</div>
          </div>
        </div>
      `;
    } else if (this.step === 'PIECE_3_ROTATE') {
      blockBadge.textContent = 'THIRD BLOCK · ROTATION';
      const rotDone = this.piece3Rotated;
      list.innerHTML = `
        <div class="p-3 rounded-lg border ${rotDone ? 'border-neon-green/50 bg-neon-green/10' : 'border-neon-cyan bg-neon-cyan/10'} flex items-start gap-3">
          <span class="text-sm font-bold ${rotDone ? 'text-neon-green' : 'text-neon-cyan'}">${rotDone ? '✓' : '1.'}</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Rotate the block</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↑</kbd>, <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">X</kbd>, or <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">Z</kbd> to rotate</div>
          </div>
        </div>
        <div class="p-3 rounded-lg border ${rotDone ? 'border-neon-cyan bg-neon-cyan/10' : 'border-card-border bg-black/20 opacity-60'} flex items-start gap-3">
          <span class="text-sm font-bold ${rotDone ? 'text-neon-cyan' : 'text-gray-500'}">2.</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Drop the rotated block</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACEBAR</kbd> or <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↓</kbd> to lock it on the grid</div>
          </div>
        </div>
      `;
    } else if (this.step === 'PIECE_4_HOLD') {
      blockBadge.textContent = 'FOURTH BLOCK · HOLD PIECE';
      list.innerHTML = `
        <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex items-start gap-3">
          <span class="text-sm font-bold text-neon-cyan">1.</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Hold the current block</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">C</kbd> to store this block in the HOLD box</div>
          </div>
        </div>
      `;
    } else if (this.step === 'PIECE_5_DROP_FIRST' || this.step === 'PIECE_5_SWAP_HOLD' || this.step === 'PIECE_5_DROP_SWAPPED' || this.step === 'COMPLETED') {
      blockBadge.textContent = 'FIFTH BLOCK · DROP, SWAP & LAND';
      const dropDone = this.step === 'PIECE_5_SWAP_HOLD' || this.step === 'PIECE_5_DROP_SWAPPED' || this.step === 'COMPLETED';
      const swapDone = this.step === 'PIECE_5_DROP_SWAPPED' || this.step === 'COMPLETED';
      const landDone = this.step === 'COMPLETED';
      list.innerHTML = `
        <div class="p-3 rounded-lg border ${dropDone ? 'border-neon-green/50 bg-neon-green/10' : 'border-neon-cyan bg-neon-cyan/10'} flex items-start gap-3">
          <span class="text-sm font-bold ${dropDone ? 'text-neon-green' : 'text-neon-cyan'}">${dropDone ? '✓' : '1.'}</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Drop this block first</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACEBAR</kbd> or <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↓</kbd> to lock it (Hold resets after a block locks)</div>
          </div>
        </div>
        <div class="p-3 rounded-lg border ${swapDone ? 'border-neon-green/50 bg-neon-green/10' : dropDone ? 'border-neon-cyan bg-neon-cyan/10' : 'border-card-border bg-black/20 opacity-60'} flex items-start gap-3">
          <span class="text-sm font-bold ${swapDone ? 'text-neon-green' : dropDone ? 'text-neon-cyan' : 'text-gray-500'}">${swapDone ? '✓' : '2.'}</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Replace current block with held block</div>
            <div class="text-[11px] text-gray-300 mt-1">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">C</kbd> again to swap the new block with your held block</div>
          </div>
        </div>
        <div class="p-3 rounded-lg border ${landDone ? 'border-neon-green/50 bg-neon-green/10' : swapDone ? 'border-neon-cyan bg-neon-cyan/10' : 'border-card-border bg-black/20 opacity-60'} flex items-start gap-3">
          <span class="text-sm font-bold ${landDone ? 'text-neon-green' : swapDone ? 'text-neon-cyan' : 'text-gray-500'}">${landDone ? '✓' : '3.'}</span>
          <div class="flex-1">
            <div class="text-xs font-bold text-white">Land the swapped block</div>
            <div class="text-[11px] text-gray-300 mt-1">Drop and lock your swapped block onto the grid to complete Stage 1</div>
          </div>
        </div>
      `;
    }
  }

  private showConclusionModal() {
    if (this.activeStage === 1) {
      markTutorialCompleted('basics-stage-1');
    } else {
      markTutorialCompleted('basics-stage-2');
    }
    if (!this.conclusionModal) return;
    this.conclusionModal.classList.remove('hidden');
    this.conclusionModal.classList.add('flex');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING (PLAYER BOARD + DUMMY BOARD(S) + CQRS QUEUE & SPECIAL BADGES)
  // ═══════════════════════════════════════════════════════════════════════════

  private render() {
    if (!this.boardCanvas) return;
    const ctx = this.boardCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    // Draw subtle grid lines
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }

    // Highlight target well / slot in Stage 2 drills for visual clarity
    if (this.activeStage === 2) {
      if (this.stage2Drill === 'PASSIVE_TETRIS_TRIGGER') {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.fillRect(9 * BLOCK_SIZE, 16 * BLOCK_SIZE, BLOCK_SIZE, 4 * BLOCK_SIZE);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(9 * BLOCK_SIZE + 1, 16 * BLOCK_SIZE + 1, BLOCK_SIZE - 2, 4 * BLOCK_SIZE - 2);
        ctx.setLineDash([]);
      } else if (this.stage2Drill === 'PASSIVE_SPECIAL_CLEAR' || this.stage2Drill === 'CRISIS_SPEEDSTER_CLUTCH') {
        ctx.fillStyle = 'rgba(0, 255, 102, 0.14)';
        ctx.fillRect(6 * BLOCK_SIZE, 19 * BLOCK_SIZE, 4 * BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.75)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(6 * BLOCK_SIZE + 1, 19 * BLOCK_SIZE + 1, 4 * BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.setLineDash([]);
      }
    }

    // Draw border
    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    // Draw locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid.matrix[r][c];
        if (cell.type !== null) {
          const cellColor = cell.type === 'GARBAGE' ? '#6B7280' : PLAYER_COLOR;
          this.drawBlock(ctx, c, r, cellColor, false, BLOCK_SIZE, cell.type, cell.special);
        }
      }
    }

    // Draw Ghost piece & Current piece
    if (this.currentPiece) {
      let ghostY = this.currentPiece.y;
      while (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x, ghostY + 1)) {
        ghostY++;
      }

      const shape = this.currentPiece.matrix;
      const size = shape.length;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c] !== 0) {
            this.drawBlock(ctx, this.currentPiece.x + c, ghostY + r, PLAYER_COLOR, true, BLOCK_SIZE, this.currentPiece.type);
          }
        }
      }

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c] !== 0) {
            const specialType = this.currentPiece.specialBlocks.get(`${r},${c}`);
            this.drawBlock(ctx, this.currentPiece.x + c, this.currentPiece.y + r, PLAYER_COLOR, false, BLOCK_SIZE, this.currentPiece.type, specialType);
          }
        }
      }
    }

    // Draw CQRS Incoming Garbage Warning Overlay (Task 3.1: Sentinel Scenario)
    if (this.activeStage === 2 && this.incomingGarbageQueue > 0) {
      const barHeight = Math.min(ROWS, this.incomingGarbageQueue) * BLOCK_SIZE;
      ctx.fillStyle = 'rgba(255, 20, 147, 0.22)';
      ctx.fillRect(0, (ROWS * BLOCK_SIZE) - barHeight, COLS * BLOCK_SIZE, barHeight);
      ctx.fillStyle = '#FF1493';
      ctx.fillRect(0, (ROWS * BLOCK_SIZE) - barHeight, 6, barHeight);

      ctx.fillStyle = 'rgba(13, 11, 26, 0.88)';
      ctx.fillRect(20, 220, 260, 72);
      ctx.strokeStyle = '#FF1493';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 220, 260, 72);
      ctx.fillStyle = '#FF1493';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ INCOMING: 10 GARBAGE LINES', 150, 248);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('PRESS [E] COUNTER STRIKE', 150, 274);
    }

    // Draw Support Rescue Overlay Prompt (Task 3.2)
    if (this.activeStage === 2 && this.stage2Drill === 'CRISIS_SUPPORT_RESCUE' && this.classMeter >= this.ultimateCost) {
      ctx.fillStyle = 'rgba(13, 11, 26, 0.88)';
      ctx.fillRect(20, 220, 260, 72);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 220, 260, 72);
      ctx.fillStyle = '#FF1493';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ CRITICAL: 18 GARBAGE LINES', 150, 248);
      ctx.fillStyle = '#00E5FF';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('PRESS [R] GUARDIAN ANGEL', 150, 274);
    }

    // Render Hold & Next Queue Canvases
    if (this.holdCanvas) {
      this.renderMiniPiece(this.holdCanvas, this.holdPiece);
    }
    if (this.nextCanvas) {
      this.renderNextQueue(this.nextCanvas, this.queue.slice(0, 4));
    }

    // Render Stage 2 Dummy Board(s)
    if (this.activeStage === 2) {
      if (this.stage2Drill === 'SANDBOX_3_DUMMY_ULTIMATE' || this.stage2Drill === 'STAGE2_COMPLETED') {
        this.dummyBoards.forEach((dummy, idx) => {
          const canvasEl = this.miniDummyCanvases[idx];
          if (canvasEl) {
            this.renderDummyGrid(canvasEl, dummy, 12);
          }
        });
      } else if (this.singleDummyCanvas && this.dummyBoards[0]) {
        this.renderDummyGrid(this.singleDummyCanvas, this.dummyBoards[0], 24);
      }
    }
  }

  private renderDummyGrid(canvasEl: HTMLCanvasElement, dummy: DummyBoardState, cellSize: number) {
    const dCtx = canvasEl.getContext('2d')!;
    dCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        dCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        dCtx.lineWidth = 1;
        dCtx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    // Draw locked cells on Dummy Board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = dummy.grid.matrix[r][c];
        if (cell.type !== null) {
          const blockColor = cell.type === 'GARBAGE' ? '#6B7280' : DUMMY_COLOR;
          this.drawBlock(dCtx, c, r, blockColor, false, cellSize, cell.type, cell.special);
        }
      }
    }

    // Draw Dummy's active piece (e.g. Saboteur scenario where Dummy is about to score a Tetris)
    if (dummy.activePiece) {
      let ghostY = dummy.activePiece.y;
      while (!dummy.grid.checkCollision(dummy.activePiece, dummy.activePiece.x, ghostY + 1)) {
        ghostY++;
      }
      const shape = dummy.activePiece.matrix;
      const size = shape.length;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c] !== 0) {
            this.drawBlock(dCtx, dummy.activePiece.x + c, ghostY + r, DUMMY_COLOR, true, cellSize, dummy.activePiece.type);
            this.drawBlock(dCtx, dummy.activePiece.x + c, dummy.activePiece.y + r, DUMMY_COLOR, false, cellSize, dummy.activePiece.type);
          }
        }
      }
    }

    // Visual overlays for Bullet Time Freeze / Chaos Mode on Dummy Boards
    if (dummy.frozenTimer > 0) {
      dCtx.fillStyle = 'rgba(0, 229, 255, 0.25)';
      dCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      dCtx.strokeStyle = '#00E5FF';
      dCtx.lineWidth = 3;
      dCtx.strokeRect(1, 1, canvasEl.width - 2, canvasEl.height - 2);
    } else if (dummy.chaosTimer > 0) {
      dCtx.fillStyle = 'rgba(255, 20, 147, 0.22)';
      dCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      dCtx.strokeStyle = '#FF1493';
      dCtx.lineWidth = 3;
      dCtx.strokeRect(1, 1, canvasEl.width - 2, canvasEl.height - 2);
    }
  }

  private drawBlock(
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    isGhost: boolean,
    blockSize: number,
    shapeType: string | null,
    specialType?: string
  ) {
    const finalX = x * blockSize;
    const finalY = y * blockSize;

    if (isGhost) {
      targetCtx.strokeStyle = color === DUMMY_COLOR ? 'rgba(255, 20, 147, 0.45)' : 'rgba(0, 229, 255, 0.4)';
      targetCtx.setLineDash([4, 2]);
      targetCtx.lineWidth = 2;
      targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);
      targetCtx.setLineDash([]);
      return;
    }

    if (shapeType && shapeType !== 'GARBAGE' && BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
      targetCtx.drawImage(BLOCK_SPRITES[shapeType], finalX, finalY, blockSize, blockSize);
      targetCtx.strokeStyle = color;
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(finalX, finalY, blockSize, blockSize);
    } else {
      targetCtx.fillStyle = shapeType === 'GARBAGE' ? '#27272A' : '#000000';
      targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
      targetCtx.strokeStyle = color;
      targetCtx.lineWidth = 2;
      targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);
      targetCtx.fillStyle = color;
      targetCtx.fillRect(finalX + 4, finalY + 4, Math.max(4, blockSize - 8), Math.max(4, blockSize - 8));
    }

    if (specialType) {
      targetCtx.fillStyle = '#FFD700';
      targetCtx.fillRect(finalX + 3, finalY + 3, blockSize - 6, blockSize - 6);
      targetCtx.fillStyle = '#0D0B1A';
      targetCtx.font = `bold ${Math.max(9, Math.floor(blockSize * 0.45))}px "Press Start 2P", monospace`;
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      targetCtx.fillText(getSpecialLetter(specialType), finalX + blockSize / 2, finalY + blockSize / 2 + 1);
    }
  }

  private renderMiniPiece(canvasEl: HTMLCanvasElement, piece: Tetromino | null) {
    const tCtx = canvasEl.getContext('2d')!;
    tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (!piece) return;

    const shape = piece.matrix;
    const size = shape.length;
    const MINI_BLOCK_SIZE = 20;
    const offsetX = (90 - size * MINI_BLOCK_SIZE) / 2;
    const offsetY = (90 - size * MINI_BLOCK_SIZE) / 2;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const fx = offsetX + c * MINI_BLOCK_SIZE;
          const fy = offsetY + r * MINI_BLOCK_SIZE;
          tCtx.fillStyle = '#000000';
          tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          tCtx.strokeStyle = PLAYER_COLOR;
          tCtx.lineWidth = 2;
          tCtx.strokeRect(fx + 1, fy + 1, MINI_BLOCK_SIZE - 2, MINI_BLOCK_SIZE - 2);
          tCtx.fillStyle = PLAYER_COLOR;
          tCtx.fillRect(fx + 4, fy + 4, MINI_BLOCK_SIZE - 8, MINI_BLOCK_SIZE - 8);
        }
      }
    }
  }

  private renderNextQueue(canvasEl: HTMLCanvasElement, shapes: ShapeType[]) {
    const tCtx = canvasEl.getContext('2d')!;
    tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    const MINI_BLOCK_SIZE = 20;

    shapes.forEach((shapeType, i) => {
      const temp = new Tetromino(shapeType);
      const shape = temp.matrix;
      const size = shape.length;
      const slotY = i * 90;
      const offsetX = (90 - size * MINI_BLOCK_SIZE) / 2;
      const offsetY = slotY + (90 - size * MINI_BLOCK_SIZE) / 2;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c] !== 0) {
            const fx = offsetX + c * MINI_BLOCK_SIZE;
            const fy = offsetY + r * MINI_BLOCK_SIZE;
            if (BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
              tCtx.drawImage(BLOCK_SPRITES[shapeType], fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
              tCtx.strokeStyle = PLAYER_COLOR;
              tCtx.lineWidth = 1;
              tCtx.strokeRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            } else {
              tCtx.fillStyle = PLAYER_COLOR;
              tCtx.fillRect(fx + 4, fy + 4, MINI_BLOCK_SIZE - 8, MINI_BLOCK_SIZE - 8);
            }
          }
        }
      }
    });
  }
}
