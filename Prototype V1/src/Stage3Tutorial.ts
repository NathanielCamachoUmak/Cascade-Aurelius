import { Grid } from './Grid';
import { Tetromino, type ShapeType } from './Tetromino';
import { SpecialBlockType, SPECIAL_BLOCK_ICONS, SPECIAL_BLOCK_COLORS } from './ItemManager';
import { AudioManager } from './AudioManager';
import { markTutorialCompleted } from './TutorialManager';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PLAYER_COLOR = '#00E5FF';
const DUMMY_COLOR = '#FF007F';

const BLOCK_SPRITES: Record<string, HTMLImageElement> = {};
['I', 'J', 'L', 'O', 'S', 'T', 'Z'].forEach(shape => {
  const img = new Image();
  img.src = `/blocks/${shape}-block.png`;
  BLOCK_SPRITES[shape] = img;
});

const SPECIAL_BLOCK_SPRITES: Record<string, HTMLImageElement> = {};
Object.entries(SPECIAL_BLOCK_ICONS).forEach(([type, url]) => {
  if (url) {
    const img = new Image();
    img.src = url;
    SPECIAL_BLOCK_SPRITES[type] = img;
  }
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

interface Stage3Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface FloatingCanvasText {
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface StepMetadata {
  stepNumber: number;
  specialType: SpecialBlockType;
  letter: string;
  name: string;
  accentHex: string;
  badgeText: string;
  preConditionTitle: string;
  preConditionDesc: string;
  effectTitle: string;
  effectDesc: string;
}

const STAGE_3_STEPS: StepMetadata[] = [
  {
    stepNumber: 1,
    specialType: SpecialBlockType.BOMB,
    letter: 'B',
    name: 'Bomb Block',
    accentHex: '#FF5555',
    badgeText: 'STEP 1 / 7 · BOMB BLOCK [B]',
    preConditionTitle: 'Dense Stack · Bomb Block [B] Ready',
    preConditionDesc:
      'A dense 4-row stack sits at the bottom of the grid. Drop the I-piece containing the Bomb Block [B] into the gap on the top layer (or click Simulate Line Clear).',
    effectTitle: '💥 3×3 Localized Explosion Cleared!',
    effectDesc:
      'Standard line clear executed, followed by an instant 3×3 blast around the Bomb Block’s coordinates!',
  },
  {
    stepNumber: 2,
    specialType: SpecialBlockType.HEAVY,
    letter: 'W',
    name: 'Heavy Block',
    accentHex: '#FFD700',
    badgeText: 'STEP 2 / 7 · HEAVY BLOCK [W]',
    preConditionTitle: 'Two Filled Bottom Rows · Heavy Block [W] Ready',
    preConditionDesc:
      'Two rows sit at the bottom of the grid. Lock the I-piece containing the Heavy Block [W] into the top row to trigger its crush effect.',
    effectTitle: '⬇ Heavy Crush! Bottom Line Destroyed!',
    effectDesc:
      'Clears the completed top row AND automatically crushed & cleared the single row directly beneath it!',
  },
  {
    stepNumber: 3,
    specialType: SpecialBlockType.MULTIPLIER,
    letter: 'X',
    name: 'Multiplier Block',
    accentHex: '#B026FF',
    badgeText: 'STEP 3 / 7 · MULTIPLIER BLOCK [X]',
    preConditionTitle: 'Standard Line Clear · Multiplier Block [X] Ready',
    preConditionDesc:
      'Lock the I-piece containing the Multiplier Block [X] to clear the row and activate the 2x score buff.',
    effectTitle: '⚡ +2x Points Buff Active (5.0s)!',
    effectDesc:
      'Point gains are doubled for 5 seconds! Notice the floating "+2x Points" indicator over the Score UI.',
  },
  {
    stepNumber: 4,
    specialType: SpecialBlockType.SPEED,
    letter: 'V',
    name: 'Speed Block',
    accentHex: '#00E5FF',
    badgeText: 'STEP 4 / 7 · SPEED BLOCK [V]',
    preConditionTitle: 'Standard Line Clear · Speed Block [V] Ready',
    preConditionDesc:
      'Lock the I-piece containing the Speed Block [V] to clear the line and trigger the visual speed buff on the grid.',
    effectTitle: '⚡ Visual Speed Buff Active (5.0s)!',
    effectDesc:
      'Speed buff gets applied to the grid — slows your falling block drop speed by 50% for 5 seconds, giving you extra control!',
  },
  {
    stepNumber: 5,
    specialType: SpecialBlockType.SHIELD,
    letter: 'S',
    name: 'Shield Block',
    accentHex: '#00FF88',
    badgeText: 'STEP 5 / 7 · SHIELD BLOCK [S]',
    preConditionTitle: 'Defensive Setup · Shield Block [S] Ready',
    preConditionDesc:
      'Lock the I-piece containing the Shield Block [S] to raise a defensive aura before an incoming garbage attack hits.',
    effectTitle: '🛡 Shield Aura Blocked Incoming Garbage Attack!',
    effectDesc:
      'Temporary defensive aura surrounds your grid and completely blocks the incoming 4-line garbage attack!',
  },
  {
    stepNumber: 6,
    specialType: SpecialBlockType.FREEZE,
    letter: 'F',
    name: 'Freeze Block',
    accentHex: '#38BDF8',
    badgeText: 'STEP 6 / 7 · FREEZE BLOCK [F]',
    preConditionTitle: 'Split Screen Opponent · Freeze Block [F] Ready',
    preConditionDesc:
      'A Dummy Opponent grid is active on the right with Ready [Q], [E], and [R] abilities. Clear the line with the Freeze Block [F]!',
    effectTitle: '❄ Opponent Abilities [Q / E / R] Locked Out!',
    effectDesc:
      'Targeting tether strikes the opponent’s grid, applying a frost debuff and dimming their [Q], [E], and [R] ability UI!',
  },
  {
    stepNumber: 7,
    specialType: SpecialBlockType.GARBAGE_EATER,
    letter: 'G',
    name: 'Garbage Eater',
    accentHex: '#F59E0B',
    badgeText: 'STEP 7 / 7 · GARBAGE EATER [G]',
    preConditionTitle: 'Pending Garbage Threat · Garbage Eater [G] Ready',
    preConditionDesc:
      'Your incoming garbage bar on the left is loaded with a 4-line pending attack. Clear the line with the Garbage Eater [G]!',
    effectTitle: '🍽 Incoming Garbage Converted Into +800 Points!',
    effectDesc:
      'The Garbage Eater devours the pending garbage queue and converts the threat directly into bonus score!',
  },
];

export class Stage3Tutorial {
  private currentStepIndex = 0; // 0..6
  private phase: 'READY_TO_TRIGGER' | 'ANIMATING' | 'AWAITING_CONTINUE' | 'COMPLETED' = 'READY_TO_TRIGGER';

  private grid: Grid = new Grid();
  private dummyGrid: Grid = new Grid();
  private currentPiece: Tetromino | null = null;
  private holdPiece: Tetromino | null = null;
  private queue: ShapeType[] = ['I', 'T', 'O', 'L'];

  private score = 1000;
  private lines = 0;

  // Step-specific animation & effect timers (ms)
  private lineFlashRow: number | null = null;
  private lineFlashTimer = 0;

  // Step 1: Bomb explosion state
  private bombShockwaveTimer = 0;
  private bombShockwaveMax = 900;
  private bombCenterCol = 7.5;
  private bombCenterRow = 17.5;

  // Step 2: Heavy crush state
  private heavyCrushTimer = 0;
  private heavyCrushMax = 850;

  // Step 3: Multiplier 5s buff state
  private multiplierBuffTimer = 0;
  private readonly MULTIPLIER_BUFF_MAX = 5000;

  // Step 4: Speed 5s buff + 50% slower falling piece simulation
  private speedBuffTimer = 0;
  private readonly SPEED_BUFF_MAX = 5000;
  private simulatedFastPiece: Tetromino | null = null;
  private simulatedFastDropTimer = 0;
  private readonly FAST_DROP_INTERVAL = 1400; // 50% slower simulated drop

  // Step 5: Shield aura & incoming garbage block state
  private shieldAuraActive = false;
  private shieldAuraPulse = 0;
  private shieldDeflectTimer = 0;
  private incomingGarbageLines = 0;
  private incomingGarbageAnimProgress = 0; // 0..1

  // Step 6: Freeze projectile tether & opponent ability lockout state
  private freezeTetherTimer = 0;
  private readonly FREEZE_TETHER_MAX = 650;
  private dummyFreezeDebuffTimer = 0;
  private readonly DUMMY_FREEZE_MAX = 5000;

  // Step 7: Garbage Eater conversion animation state
  private garbageEaterConvertTimer = 0;
  private readonly GARBAGE_EATER_CONVERT_MAX = 950;

  private particles: Stage3Particle[] = [];
  private floatingTexts: FloatingCanvasText[] = [];

  private boardCanvas: HTMLCanvasElement | null = null;
  private holdCanvas: HTMLCanvasElement | null = null;
  private nextCanvas: HTMLCanvasElement | null = null;
  private dummyCanvas: HTMLCanvasElement | null = null;
  private tetherOverlayCanvas: HTMLCanvasElement | null = null;

  private hudContainer: HTMLElement | null = null;
  private dummyContainer: HTMLElement | null = null;
  private conclusionModal: HTMLElement | null = null;

  private isRunning = false;
  private lastTime = 0;
  private animationFrameId: number | null = null;
  private dropTimer = 0;
  private dropInterval = 950;
  private keydownHandler: (e: KeyboardEvent) => void;
  private stepTimeouts: number[] = [];

  constructor() {
    this.keydownHandler = this.handleKeyDown.bind(this);
  }

  public start() {
    this.boardCanvas = document.getElementById('board-p1') as HTMLCanvasElement | null;
    this.holdCanvas = document.getElementById('hold-canvas-p1') as HTMLCanvasElement | null;
    this.nextCanvas = document.getElementById('next-canvas-p1') as HTMLCanvasElement | null;

    this.prepareArenaDom();
    this.mountStage3Hud();
    this.setupStep(0);

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
    this.clearStepTimeouts();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.keydownHandler);
    this.hudContainer?.remove();
    this.hudContainer = null;
    this.dummyContainer?.remove();
    this.dummyContainer = null;
    this.tetherOverlayCanvas?.remove();
    this.tetherOverlayCanvas = null;
    this.conclusionModal?.remove();
    this.conclusionModal = null;
    document.getElementById('tut3-floating-score-pop')?.remove();
  }

  private clearStepTimeouts() {
    this.stepTimeouts.forEach(id => window.clearTimeout(id));
    this.stepTimeouts = [];
  }

  private scheduleTimeout(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    this.stepTimeouts.push(id);
  }

  private prepareArenaDom() {
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
    abilityMeterP1?.classList.add('hidden');

    AudioManager.playMusic('game');
  }

  private mountStage3Hud() {
    this.hudContainer?.remove();
    this.dummyContainer?.remove();
    this.tetherOverlayCanvas?.remove();
    this.conclusionModal?.remove();

    const duoLayoutContainer = document.getElementById('duo-layout-container');
    if (!duoLayoutContainer) return;

    const panel = document.createElement('div');
    panel.id = 'tutorial-stage3-panel';
    panel.className =
      'w-80 sm:w-96 shrink-0 bg-card-bg/95 backdrop-blur-md border-2 border-neon-cyan rounded-xl p-5 shadow-[0_0_30px_rgba(0,229,255,0.2)] flex flex-col gap-4 self-center z-30 pointer-events-auto';
    panel.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[10px] font-bold tracking-[0.22em] uppercase text-neon-cyan">STAGE 3 · ITEM BLOCKS</span>
          <span id="tut3-step-counter" class="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40">Step 1 / 7</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <h2 id="tut3-step-title" class="text-lg font-extrabold text-white tracking-wide">Bomb Block [B]</h2>
          <span id="tut3-item-pill" class="font-pixel text-xs font-bold px-2.5 py-1 rounded bg-neon-yellow text-deep-purple shadow-[0_0_12px_rgba(255,215,0,0.4)]">[B]</span>
        </div>
        <div id="tut3-progress-dots" class="grid grid-cols-7 gap-1.5 mt-2.5">
          ${STAGE_3_STEPS.map(() => `<div class="h-1.5 rounded-full bg-gray-700"></div>`).join('')}
        </div>
      </div>

      <!-- Active Buff / Queue Status Strip -->
      <div id="tut3-buff-strip" class="hidden items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neon-yellow bg-neon-yellow/10 text-xs font-bold text-neon-yellow">
        <span id="tut3-buff-label">⚡ BUFF ACTIVE</span>
        <span id="tut3-buff-timer" class="font-pixel text-[10px]">5.0s</span>
      </div>

      <!-- Scenario Explanation Box -->
      <div class="rounded-xl bg-deep-purple/90 border border-card-border p-4 flex flex-col gap-3">
        <div id="tut3-block-badge" class="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">STEP 1 / 7 · BOMB BLOCK [B]</div>
        <div id="tut3-instructions-body" class="flex flex-col gap-2.5"></div>
      </div>

      <!-- Primary Action Buttons: Simulate Trigger & Required Continue Button -->
      <div class="flex flex-col gap-2">
        <button id="tut3-btn-trigger" type="button" class="w-full px-4 py-3 rounded-lg bg-neon-cyan text-deep-purple font-extrabold text-xs tracking-widest uppercase hover:brightness-110 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all cursor-pointer">
          ▶ Simulate Line Clear (or Press SPACE)
        </button>
        <button id="tut3-btn-continue" type="button" disabled class="w-full px-4 py-3 rounded-lg border border-card-border bg-white/5 text-gray-500 font-extrabold text-xs tracking-widest uppercase transition-all cursor-not-allowed">
          Continue →
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1 border-t border-card-border">
        <button id="tut3-btn-replay-step" type="button" class="px-3 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-card-border bg-white/5 text-gray-300 hover:text-white hover:border-neon-cyan transition-all cursor-pointer">
          Replay Step
        </button>
        <button id="tut3-btn-exit" type="button" class="px-3 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-neon-pink/40 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink hover:text-deep-purple transition-all cursor-pointer">
          Exit to Menu
        </button>
      </div>
    `;

    duoLayoutContainer.appendChild(panel);
    this.hudContainer = panel;

    // Split-Screen Dummy Opponent Pod (shown in Step 6: Freeze Block)
    const dummyPod = document.createElement('div');
    dummyPod.id = 'tut3-dummy-pod';
    dummyPod.className = 'hidden flex-col items-center justify-center gap-2.5 self-center shrink-0 z-20 pointer-events-auto';
    dummyPod.innerHTML = `
      <div id="tut3-dummy-card" class="flex flex-col items-center gap-2.5 bg-card-bg/90 border-2 border-neon-pink rounded-xl p-3.5 shadow-[0_0_25px_rgba(255,20,147,0.25)] transition-all duration-300">
        <div class="w-full flex items-center justify-between px-1 gap-3">
          <div class="flex items-center gap-1.5">
            <span id="tut3-dummy-dot" class="w-2 h-2 rounded-full bg-neon-pink animate-pulse"></span>
            <span class="text-[10px] font-bold tracking-widest uppercase text-neon-pink">DUMMY OPPONENT</span>
          </div>
          <span id="tut3-dummy-debuff-badge" class="text-[9px] font-bold px-2 py-0.5 rounded bg-neon-pink/20 border border-neon-pink text-white uppercase tracking-wider">ABILITIES READY</span>
        </div>

        <canvas id="tut3-dummy-canvas" width="240" height="480" class="bg-black/60 rounded border border-card-border"></canvas>

        <!-- Opponent Class Abilities UI (Dimmed & Locked when Freeze Block hits!) -->
        <div id="tut3-dummy-abilities-box" class="w-full rounded-lg bg-deep-purple/90 border border-card-border p-2.5 transition-all duration-300">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400">Opponent Active Abilities</span>
            <span id="tut3-dummy-lock-timer" class="text-[9px] font-bold uppercase tracking-wider text-neon-cyan">ACTIVE</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <div id="tut3-opp-q" class="p-1.5 rounded border border-neon-cyan/40 bg-neon-cyan/10 text-center transition-all duration-300">
              <div class="text-[9px] font-black text-neon-cyan">[Q] SPRINT</div>
              <div id="tut3-opp-q-status" class="text-[8px] font-bold text-white mt-0.5">READY</div>
            </div>
            <div id="tut3-opp-e" class="p-1.5 rounded border border-neon-yellow/40 bg-neon-yellow/10 text-center transition-all duration-300">
              <div class="text-[9px] font-black text-neon-yellow">[E] TIME WARP</div>
              <div id="tut3-opp-e-status" class="text-[8px] font-bold text-white mt-0.5">READY</div>
            </div>
            <div id="tut3-opp-r" class="p-1.5 rounded border border-neon-pink/40 bg-neon-pink/10 text-center transition-all duration-300">
              <div class="text-[9px] font-black text-neon-pink">[R] ULTIMATE</div>
              <div id="tut3-opp-r-status" class="text-[8px] font-bold text-white mt-0.5">READY</div>
            </div>
          </div>
        </div>
      </div>
    `;
    duoLayoutContainer.appendChild(dummyPod);
    this.dummyContainer = dummyPod;
    this.dummyCanvas = dummyPod.querySelector('#tut3-dummy-canvas') as HTMLCanvasElement | null;

    // Full-screen overlay canvas for cross-board projectile / targeting tether in Step 6
    const tetherCanvas = document.createElement('canvas');
    tetherCanvas.id = 'tut3-tether-overlay';
    tetherCanvas.width = window.innerWidth;
    tetherCanvas.height = window.innerHeight;
    tetherCanvas.className = 'fixed inset-0 pointer-events-none z-40';
    document.body.appendChild(tetherCanvas);
    this.tetherOverlayCanvas = tetherCanvas;

    // Stage 3 Completion Modal
    const modal = document.createElement('div');
    modal.id = 'tutorial-stage3-conclusion-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto';
    modal.innerHTML = `
      <div class="bg-card-bg border-2 border-neon-cyan rounded-2xl max-w-lg w-full p-8 text-center shadow-[0_0_50px_rgba(0,229,255,0.3)] flex flex-col items-center gap-5">
        <div class="w-16 h-16 rounded-full bg-neon-green/15 border-2 border-neon-green flex items-center justify-center text-3xl text-neon-green shadow-[0_0_25px_rgba(0,255,102,0.4)]">
          ✓
        </div>
        <div>
          <p class="text-neon-cyan text-[10px] font-bold tracking-[0.3em] uppercase mb-1">STAGE 3 COMPLETED</p>
          <h2 class="text-2xl font-extrabold text-white">All 7 Item Blocks Mastered!</h2>
          <p class="text-gray-400 text-xs mt-2 leading-relaxed">
            You have experienced all 7 Special Item Blocks: <strong>Bomb [B]</strong>, <strong>Heavy [W]</strong>, <strong>Multiplier [X]</strong>, <strong>Speed [V]</strong>, <strong>Shield [S]</strong>, <strong>Freeze [F]</strong>, and <strong>Garbage Eater [G]</strong>!
          </p>
        </div>
        <div class="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <button id="tut3-modal-replay" type="button" class="flex-1 px-4 py-3 rounded-lg border border-card-border bg-white/5 text-white text-xs font-bold tracking-widest uppercase hover:border-neon-cyan transition-all cursor-pointer">
            Replay Stage 3
          </button>
          <button id="tut3-modal-done" type="button" class="flex-1 px-4 py-3 rounded-lg bg-neon-cyan text-deep-purple text-xs font-bold tracking-widest uppercase hover:brightness-110 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all cursor-pointer">
            Return to Tutorials
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.conclusionModal = modal;

    panel.querySelector('#tut3-btn-trigger')?.addEventListener('click', () => {
      if (this.phase === 'READY_TO_TRIGGER') {
        this.executeStepTrigger();
      }
    });

    panel.querySelector('#tut3-btn-continue')?.addEventListener('click', () => {
      if (this.phase === 'AWAITING_CONTINUE') {
        this.advanceToNextStep();
      }
    });

    panel.querySelector('#tut3-btn-replay-step')?.addEventListener('click', () => {
      this.setupStep(this.currentStepIndex);
    });

    panel.querySelector('#tut3-btn-exit')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });

    modal.querySelector('#tut3-modal-replay')?.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      this.setupStep(0);
    });

    modal.querySelector('#tut3-modal-done')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });
  }

  private setupStep(stepIndex: number) {
    this.clearStepTimeouts();
    this.currentStepIndex = stepIndex;
    this.phase = 'READY_TO_TRIGGER';

    // Reset all step timers & overlays
    this.lineFlashRow = null;
    this.lineFlashTimer = 0;
    this.bombShockwaveTimer = 0;
    this.heavyCrushTimer = 0;
    this.multiplierBuffTimer = 0;
    this.speedBuffTimer = 0;
    this.simulatedFastPiece = null;
    this.simulatedFastDropTimer = 0;
    this.shieldAuraActive = false;
    this.shieldDeflectTimer = 0;
    this.incomingGarbageLines = 0;
    this.incomingGarbageAnimProgress = 0;
    this.freezeTetherTimer = 0;
    this.dummyFreezeDebuffTimer = 0;
    this.garbageEaterConvertTimer = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.dropTimer = 0;
    this.dropInterval = 950;

    const multEl = document.getElementById('multiplier-p1');
    if (multEl) multEl.innerText = '';
    document.getElementById('tut3-floating-score-pop')?.remove();

    const stepMeta = STAGE_3_STEPS[stepIndex];
    this.grid = new Grid();

    // Show split-screen Dummy Opponent only on Step 6 (Freeze Block)
    if (stepMeta.specialType === SpecialBlockType.FREEZE) {
      this.dummyContainer?.classList.remove('hidden');
      this.dummyContainer?.classList.add('flex');
      this.setupDummyOpponentGrid(false);
    } else {
      this.dummyContainer?.classList.add('hidden');
      this.dummyContainer?.classList.remove('flex');
    }

    // Configure predetermined grid state & active piece for each of the 7 steps:
    if (stepMeta.specialType === SpecialBlockType.BOMB) {
      // Step 1: Bomb Block — dense 4-row stack where the top layer (row 16) is completed by an I-piece in cols 6..9
      this.grid.loadPresetMatrix([
        ['I', 'I', 'I', 'I', 'O', 'O', null, null, null, null], // row 16 (top layer target line clear! Bomb lands at col 7)
        ['S', 'S', 'T', 'T', 'T', 'Z', 'Z', 'O', 'O', null], // row 17 (dense stack below bomb)
        ['L', 'L', 'L', 'J', 'J', 'J', 'T', 'T', 'T', null], // row 18 (dense stack below bomb)
        ['Z', 'Z', 'S', 'S', 'O', 'O', 'I', 'I', 'J', null], // row 19 (bottom)
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 11;
      piece.specialBlocks.set('1,1', SpecialBlockType.BOMB); // Lands at col 7, row 16
      this.currentPiece = piece;
    } else if (stepMeta.specialType === SpecialBlockType.HEAVY) {
      // Step 2: Heavy Block — two filled rows at the bottom (row 18 has a 4-cell gap in cols 6..9; row 19 beneath is filled)
      this.grid.loadPresetMatrix([
        ['I', 'I', 'I', 'I', 'O', 'O', null, null, null, null], // row 18 (top row to clear)
        ['J', 'J', 'J', 'L', 'L', 'L', 'O', 'O', 'T', null], // row 19 (row beneath that Heavy Block crushes!)
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 13;
      piece.specialBlocks.set('1,1', SpecialBlockType.HEAVY);
      this.currentPiece = piece;
    } else if (stepMeta.specialType === SpecialBlockType.MULTIPLIER) {
      // Step 3: Multiplier Block — standard line clear
      this.grid.loadPresetMatrix([
        ['T', 'T', 'T', 'O', 'O', 'L', null, null, null, null], // row 19
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 14;
      piece.specialBlocks.set('1,1', SpecialBlockType.MULTIPLIER);
      this.currentPiece = piece;
    } else if (stepMeta.specialType === SpecialBlockType.SPEED) {
      // Step 4: Speed Block — standard line clear
      this.grid.loadPresetMatrix([
        ['J', 'J', 'J', 'O', 'O', 'S', null, null, null, null], // row 19
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 14;
      piece.specialBlocks.set('1,1', SpecialBlockType.SPEED);
      this.currentPiece = piece;
    } else if (stepMeta.specialType === SpecialBlockType.SHIELD) {
      // Step 5: Shield Block — standard line clear that activates defensive aura before incoming garbage attack
      this.grid.loadPresetMatrix([
        ['L', 'L', 'L', 'O', 'O', 'Z', null, null, null, null], // row 19
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 14;
      piece.specialBlocks.set('1,1', SpecialBlockType.SHIELD);
      this.currentPiece = piece;
    } else if (stepMeta.specialType === SpecialBlockType.FREEZE) {
      // Step 6: Freeze Block — split screen with Dummy Opponent
      this.grid.loadPresetMatrix([
        ['I', 'I', 'I', 'I', 'O', 'O', null, null, null, null], // row 19
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 14;
      piece.specialBlocks.set('1,1', SpecialBlockType.FREEZE);
      this.currentPiece = piece;
    } else if (stepMeta.specialType === SpecialBlockType.GARBAGE_EATER) {
      // Step 7: Garbage Eater — pre-populate incoming garbage bar with a pending 4-line attack!
      this.incomingGarbageLines = 4;
      this.grid.loadPresetMatrix([
        ['T', 'T', 'T', 'J', 'J', 'J', null, null, null, null], // row 19
      ]);
      const piece = new Tetromino('I');
      piece.x = 6;
      piece.y = 14;
      piece.specialBlocks.set('1,1', SpecialBlockType.GARBAGE_EATER);
      this.currentPiece = piece;
    }

    this.updateHudStats();
    this.updateStepUi();
    this.render();
  }

  private setupDummyOpponentGrid(lockedOut: boolean) {
    this.dummyGrid = new Grid();
    this.dummyGrid.loadPresetMatrix([
      ['T', 'T', 'T', null, 'O', 'O', null, 'L', 'L', 'L'],
      ['J', 'J', 'S', 'S', 'O', 'O', 'Z', 'Z', 'L', null],
      ['J', 'I', 'I', 'I', 'I', 'Z', 'Z', 'T', 'T', 'T'],
    ]);

    const card = document.getElementById('tut3-dummy-card');
    const badge = document.getElementById('tut3-dummy-debuff-badge');
    const abilitiesBox = document.getElementById('tut3-dummy-abilities-box');
    const lockTimerEl = document.getElementById('tut3-dummy-lock-timer');
    const qCard = document.getElementById('tut3-opp-q');
    const eCard = document.getElementById('tut3-opp-e');
    const rCard = document.getElementById('tut3-opp-r');
    const qStatus = document.getElementById('tut3-opp-q-status');
    const eStatus = document.getElementById('tut3-opp-e-status');
    const rStatus = document.getElementById('tut3-opp-r-status');

    if (lockedOut) {
      if (card) card.className = 'flex flex-col items-center gap-2.5 bg-card-bg/90 border-2 border-neon-cyan rounded-xl p-3.5 shadow-[0_0_30px_rgba(0,229,255,0.4)] transition-all duration-300';
      if (badge) {
        badge.textContent = '❄ ABILITIES FROZEN';
        badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-neon-cyan/25 border border-neon-cyan text-neon-cyan uppercase tracking-wider';
      }
      if (abilitiesBox) {
        abilitiesBox.className = 'w-full rounded-lg bg-black/70 border border-neon-cyan/50 p-2.5 opacity-45 grayscale transition-all duration-300';
      }
      if (lockTimerEl) {
        lockTimerEl.textContent = '🔒 LOCKED (5.0s)';
        lockTimerEl.className = 'text-[9px] font-bold uppercase tracking-wider text-neon-pink';
      }
      [qCard, eCard, rCard].forEach(el => {
        if (el) el.className = 'p-1.5 rounded border border-gray-600 bg-gray-900/80 text-center';
      });
      [qStatus, eStatus, rStatus].forEach(el => {
        if (el) {
          el.textContent = '🔒 LOCKED';
          el.className = 'text-[8px] font-bold text-neon-pink mt-0.5';
        }
      });
    } else {
      if (card) card.className = 'flex flex-col items-center gap-2.5 bg-card-bg/90 border-2 border-neon-pink rounded-xl p-3.5 shadow-[0_0_25px_rgba(255,20,147,0.25)] transition-all duration-300';
      if (badge) {
        badge.textContent = 'ABILITIES READY';
        badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded bg-neon-pink/20 border border-neon-pink text-white uppercase tracking-wider';
      }
      if (abilitiesBox) {
        abilitiesBox.className = 'w-full rounded-lg bg-deep-purple/90 border border-card-border p-2.5 transition-all duration-300';
      }
      if (lockTimerEl) {
        lockTimerEl.textContent = 'ACTIVE';
        lockTimerEl.className = 'text-[9px] font-bold uppercase tracking-wider text-neon-green';
      }
      if (qCard) qCard.className = 'p-1.5 rounded border border-neon-cyan/40 bg-neon-cyan/10 text-center';
      if (eCard) eCard.className = 'p-1.5 rounded border border-neon-yellow/40 bg-neon-yellow/10 text-center';
      if (rCard) rCard.className = 'p-1.5 rounded border border-neon-pink/40 bg-neon-pink/10 text-center';
      [qStatus, eStatus, rStatus].forEach(el => {
        if (el) {
          el.textContent = 'READY';
          el.className = 'text-[8px] font-bold text-neon-green mt-0.5';
        }
      });
    }
  }

  /**
   * Simulates locking the active piece containing the step's Special Block into the target gap,
   * triggers the line clear, and runs the step-specific visual animation & effect.
   */
  private executeStepTrigger() {
    if (this.phase !== 'READY_TO_TRIGGER') return;
    this.phase = 'ANIMATING';

    const stepMeta = STAGE_3_STEPS[this.currentStepIndex];

    // Ensure the piece is aligned horizontally in columns 6..9 so the simulated line clear always succeeds
    const piece = new Tetromino('I');
    piece.x = 6;
    piece.y = stepMeta.specialType === SpecialBlockType.BOMB ? 15 : stepMeta.specialType === SpecialBlockType.HEAVY ? 17 : 18;
    piece.specialBlocks.set('1,1', stepMeta.specialType);
    while (!this.grid.checkCollision(piece, piece.x, piece.y + 1)) {
      piece.y++;
    }
    this.grid.lockTetromino(piece);
    this.currentPiece = null;

    AudioManager.playSfx(stepMeta.specialType === SpecialBlockType.BOMB ? 'bomb' : 'lineClear');

    // ─── STEP 1: BOMB BLOCK (Line Clear -> 3x3 Area Clear + Localized Explosion) ───
    if (stepMeta.specialType === SpecialBlockType.BOMB) {
      const bombRow = 16;
      const bombCol = 7; // Col 7 (piece.x=6 + col=1)
      this.lineFlashRow = bombRow;
      this.lineFlashTimer = 450;

      // 1. Standard line clear + 2. Instant 3x3 area clear surrounding the Bomb Block's coordinates
      this.grid.clearLines();
      this.grid.clearBombArea(17, bombCol);

      this.bombCenterCol = bombCol + 0.5;
      this.bombCenterRow = 17 + 0.5;
      this.bombShockwaveTimer = this.bombShockwaveMax;

      this.spawnExplosionParticles(this.bombCenterCol * BLOCK_SIZE, this.bombCenterRow * BLOCK_SIZE, '#FF5555', '#FFD700', 34);
      this.addFloatingText('💥 3×3 BLAST!', this.bombCenterCol * BLOCK_SIZE, (bombRow - 1) * BLOCK_SIZE, '#FFD700', 14);

      this.score += 350;
      this.lines += 1;
      this.updateHudStats();

      this.scheduleTimeout(() => {
        this.enableContinueButton();
      }, 650);
      return;
    }

    // ─── STEP 2: HEAVY BLOCK (Top Row Clear + Automatic Single Row Clear Beneath) ───
    if (stepMeta.specialType === SpecialBlockType.HEAVY) {
      this.lineFlashRow = 18;
      this.lineFlashTimer = 450;
      this.heavyCrushTimer = this.heavyCrushMax;

      // Grid.clearLines() natively handles SpecialBlockType.HEAVY by destroying the row directly beneath it!
      this.grid.clearLines();
      AudioManager.playSfx('heavy');

      this.spawnRowParticles(18, '#00E5FF', 16);
      this.spawnRowParticles(19, '#FFD700', 24);
      this.addFloatingText('⬇ HEAVY CRUSH! +1 ROW BENEATH CLEARED', 150, 17 * BLOCK_SIZE, '#FFD700', 12);

      this.score += 300;
      this.lines += 2;
      this.updateHudStats();

      this.scheduleTimeout(() => {
        this.enableContinueButton();
      }, 650);
      return;
    }

    // ─── STEP 3: MULTIPLIER BLOCK (5s 2x Buff Indicator + Floating "+2x Points" Over Score UI) ───
    if (stepMeta.specialType === SpecialBlockType.MULTIPLIER) {
      this.lineFlashRow = 19;
      this.lineFlashTimer = 450;
      this.grid.clearLines();
      AudioManager.playSfx('multiplier');

      this.multiplierBuffTimer = this.MULTIPLIER_BUFF_MAX;
      const multEl = document.getElementById('multiplier-p1');
      if (multEl) multEl.innerText = 'MULT x2';

      this.spawnRowParticles(19, '#B026FF', 22);
      this.addFloatingText('⚡ +2x POINTS (100 → 200 PTS)!', 150, 17 * BLOCK_SIZE, '#E879F9', 13);
      this.spawnFloatingScoreUiPopup('+2x Points! (100 × 2 = +200)');

      this.score += 200; // Doubled from 100 to 200
      this.lines += 1;
      this.updateHudStats();

      this.scheduleTimeout(() => {
        this.enableContinueButton();
      }, 600);
      return;
    }

    // ─── STEP 4: SPEED BLOCK (Visual Speed Buff + Next Falling Piece Drops 50% Faster for 10s) ───
    if (stepMeta.specialType === SpecialBlockType.SPEED) {
      this.lineFlashRow = 19;
      this.lineFlashTimer = 400;
      this.grid.clearLines();
      AudioManager.playSfx('speed');

      this.speedBuffTimer = this.SPEED_BUFF_MAX;
      this.simulatedFastPiece = new Tetromino('T');
      this.simulatedFastPiece.x = 3;
      this.simulatedFastPiece.y = 0;
      this.simulatedFastDropTimer = 0;

      this.spawnRowParticles(19, '#00E5FF', 20);
      this.addFloatingText('⚡ SPEED BUFF! -50% DROP SPEED (5s)', 150, 16 * BLOCK_SIZE, '#00E5FF', 12);

      this.score += 150;
      this.lines += 1;
      this.updateHudStats();

      this.scheduleTimeout(() => {
        this.enableContinueButton();
      }, 650);
      return;
    }

    // ─── STEP 5: SHIELD BLOCK (Defensive Aura + Incoming Garbage Queue Attack Blocked!) ───
    if (stepMeta.specialType === SpecialBlockType.SHIELD) {
      this.lineFlashRow = 19;
      this.lineFlashTimer = 400;
      this.grid.clearLines();

      this.shieldAuraActive = true;
      this.incomingGarbageLines = 4; // Populate incoming garbage queue with an attack
      this.incomingGarbageAnimProgress = 0;

      this.spawnRowParticles(19, '#00FF88', 20);
      this.addFloatingText('🛡 DEFENSIVE SHIELD AURA RAISED!', 150, 16 * BLOCK_SIZE, '#00FF88', 12);

      this.score += 150;
      this.lines += 1;
      this.updateHudStats();

      // After a brief moment showing the queued garbage attack, animate the Shield blocking it completely!
      this.scheduleTimeout(() => {
        this.shieldDeflectTimer = 900;
        this.incomingGarbageLines = 0;
        this.shieldAuraActive = false;
        AudioManager.playSfx('shield');
        this.spawnExplosionParticles(150, 18 * BLOCK_SIZE, '#00FF88', '#00E5FF', 28);
        this.addFloatingText('🛡 ATTACK BLOCKED! (0 GARBAGE ADDED)', 150, 13 * BLOCK_SIZE, '#00FF88', 13);
        this.enableContinueButton();
      }, 950);
      return;
    }

    // ─── STEP 6: FREEZE BLOCK (Split-Screen Tether Projectile + Opponent Q/E/R Lockout & Dimming) ───
    if (stepMeta.specialType === SpecialBlockType.FREEZE) {
      this.lineFlashRow = 19;
      this.lineFlashTimer = 400;
      this.grid.clearLines();

      this.freezeTetherTimer = this.FREEZE_TETHER_MAX;
      this.spawnRowParticles(19, '#38BDF8', 20);
      this.addFloatingText('❄ LAUNCHING FREEZE TETHER!', 150, 16 * BLOCK_SIZE, '#38BDF8', 12);

      this.score += 150;
      this.lines += 1;
      this.updateHudStats();

      // When the projectile hits the opponent's grid, lock out and dim their Q, E, R abilities!
      this.scheduleTimeout(() => {
        this.dummyFreezeDebuffTimer = this.DUMMY_FREEZE_MAX;
        this.setupDummyOpponentGrid(true);
        AudioManager.playSfx('freeze');
        this.enableContinueButton();
      }, 500);
      return;
    }

    // ─── STEP 7: GARBAGE EATER (Converts Pending Incoming Garbage Into Points & Clears Queue) ───
    if (stepMeta.specialType === SpecialBlockType.GARBAGE_EATER) {
      this.lineFlashRow = 19;
      this.lineFlashTimer = 400;
      this.grid.clearLines();
      AudioManager.playSfx('garbageEater');

      this.garbageEaterConvertTimer = this.GARBAGE_EATER_CONVERT_MAX;
      this.incomingGarbageLines = 0; // Threat removed from visual queue!

      this.spawnExplosionParticles(24, 15 * BLOCK_SIZE, '#F59E0B', '#FFD700', 30);
      this.addFloatingText('🍽 GARBAGE CONVERTED → +800 PTS!', 150, 15 * BLOCK_SIZE, '#FFD700', 13);
      this.spawnFloatingScoreUiPopup('🍽 Garbage Devoured! +800 PTS');

      this.score += 800;
      this.lines += 1;
      this.updateHudStats();

      this.scheduleTimeout(() => {
        this.enableContinueButton();
      }, 650);
    }
  }

  private enableContinueButton() {
    this.phase = 'AWAITING_CONTINUE';
    this.updateStepUi();
  }

  private advanceToNextStep() {
    if (this.currentStepIndex < STAGE_3_STEPS.length - 1) {
      this.setupStep(this.currentStepIndex + 1);
    } else {
      this.phase = 'COMPLETED';
      markTutorialCompleted('basics-stage-3');
      this.conclusionModal?.classList.remove('hidden');
      this.conclusionModal?.classList.add('flex');
    }
  }

  private spawnFloatingScoreUiPopup(text: string) {
    document.getElementById('tut3-floating-score-pop')?.remove();
    const scoreEl = document.getElementById('score-p1');
    if (!scoreEl) return;
    const rect = scoreEl.getBoundingClientRect();

    const pop = document.createElement('div');
    pop.id = 'tut3-floating-score-pop';
    pop.className =
      'fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg border-2 border-neon-yellow bg-deep-purple/95 text-neon-yellow font-extrabold text-xs tracking-wider shadow-[0_0_25px_rgba(255,215,0,0.5)] animate-bounce';
    pop.style.left = `${Math.max(12, Math.round(rect.left - 10))}px`;
    pop.style.top = `${Math.max(12, Math.round(rect.top - 38))}px`;
    pop.textContent = text;
    document.body.appendChild(pop);
  }

  private spawnExplosionParticles(cx: number, cy: number, color1: string, color2: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? color1 : color2,
        size: 4 + Math.random() * 4,
        life: 750 + Math.random() * 350,
        maxLife: 1100,
      });
    }
  }

  private spawnRowParticles(row: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (COLS * BLOCK_SIZE),
        y: (row + 0.5) * BLOCK_SIZE,
        vx: (Math.random() - 0.5) * 90,
        vy: -40 - Math.random() * 90,
        color,
        size: 3 + Math.random() * 4,
        life: 650 + Math.random() * 300,
        maxLife: 950,
      });
    }
  }

  private addFloatingText(text: string, x: number, y: number, color: string, size = 12) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -28,
      color,
      life: 1600,
      maxLife: 1600,
      size,
    });
  }

  private updateHudStats() {
    const scoreEl = document.getElementById('score-p1');
    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();
    const linesEl = document.getElementById('level-p1');
    if (linesEl) linesEl.innerText = String(this.lines);
  }

  private updateStepUi() {
    const stepMeta = STAGE_3_STEPS[this.currentStepIndex];
    const stepCounter = document.getElementById('tut3-step-counter');
    const stepTitle = document.getElementById('tut3-step-title');
    const itemPill = document.getElementById('tut3-item-pill');
    const blockBadge = document.getElementById('tut3-block-badge');
    const body = document.getElementById('tut3-instructions-body');
    const dots = document.getElementById('tut3-progress-dots');
    const btnTrigger = document.getElementById('tut3-btn-trigger') as HTMLButtonElement | null;
    const btnContinue = document.getElementById('tut3-btn-continue') as HTMLButtonElement | null;

    if (stepCounter) stepCounter.textContent = `Step ${stepMeta.stepNumber} / 7`;
    if (stepTitle) {
      stepTitle.textContent = `${stepMeta.name} [${stepMeta.letter}]`;
      stepTitle.style.color = stepMeta.accentHex;
    }
    if (itemPill) {
      itemPill.textContent = `[${stepMeta.letter}]`;
    }
    if (blockBadge) {
      blockBadge.textContent = stepMeta.badgeText;
      blockBadge.style.color = stepMeta.accentHex;
    }

    if (dots) {
      Array.from(dots.children).forEach((dot, idx) => {
        dot.className =
          idx < this.currentStepIndex || (idx === this.currentStepIndex && this.phase === 'AWAITING_CONTINUE')
            ? 'h-1.5 rounded-full bg-neon-green shadow-[0_0_8px_rgba(0,255,102,0.6)]'
            : idx === this.currentStepIndex
              ? 'h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.6)]'
              : 'h-1.5 rounded-full bg-gray-700';
      });
    }

    if (body) {
      const isTriggered = this.phase === 'ANIMATING' || this.phase === 'AWAITING_CONTINUE';
      body.innerHTML = `
        <div class="p-3 rounded-lg border ${isTriggered ? 'border-card-border bg-black/30 opacity-75' : 'border-neon-cyan bg-neon-cyan/10'} flex flex-col gap-1">
          <div class="text-xs font-bold text-white">${isTriggered ? '✓ ' : ''}${stepMeta.preConditionTitle}</div>
          <div class="text-[11px] text-gray-300 leading-relaxed">${stepMeta.preConditionDesc}</div>
        </div>
        <div class="p-3 rounded-lg border ${isTriggered ? 'border-neon-green bg-neon-green/15 shadow-[0_0_15px_rgba(0,255,102,0.15)]' : 'border-card-border bg-black/20 opacity-60'} flex flex-col gap-1">
          <div class="text-xs font-bold ${isTriggered ? 'text-neon-green' : 'text-gray-400'}">${stepMeta.effectTitle}</div>
          <div class="text-[11px] text-gray-200 leading-relaxed">${stepMeta.effectDesc}</div>
        </div>
      `;
    }

    if (btnTrigger) {
      if (this.phase === 'READY_TO_TRIGGER') {
        btnTrigger.disabled = false;
        btnTrigger.classList.remove('hidden');
      } else {
        btnTrigger.disabled = true;
        btnTrigger.classList.add('hidden');
      }
    }

    if (btnContinue) {
      const isLast = this.currentStepIndex === STAGE_3_STEPS.length - 1;
      btnContinue.textContent = isLast ? 'Complete Stage 3 ✓' : `Continue to Step ${stepMeta.stepNumber + 1} →`;
      if (this.phase === 'AWAITING_CONTINUE') {
        btnContinue.disabled = false;
        btnContinue.className =
          'w-full px-4 py-3 rounded-lg bg-neon-green text-deep-purple font-extrabold text-xs tracking-widest uppercase hover:brightness-110 shadow-[0_0_22px_rgba(0,255,102,0.4)] transition-all cursor-pointer animate-pulse';
      } else {
        btnContinue.disabled = true;
        btnContinue.className =
          'w-full px-4 py-3 rounded-lg border border-card-border bg-white/5 text-gray-500 font-extrabold text-xs tracking-widest uppercase transition-all cursor-not-allowed';
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.isRunning) return;

    if (this.phase === 'READY_TO_TRIGGER') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.executeStepTrigger();
        return;
      }
      if (this.currentPiece) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x - 1, this.currentPiece.y)) {
            this.currentPiece.x--;
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x + 1, this.currentPiece.y)) {
            this.currentPiece.x++;
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
          } else {
            this.executeStepTrigger();
          }
        }
      }
    }
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;
    const dt = Math.min(100, timestamp - this.lastTime);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  private update(dt: number) {
    if (this.lineFlashTimer > 0) {
      this.lineFlashTimer = Math.max(0, this.lineFlashTimer - dt);
    }
    if (this.bombShockwaveTimer > 0) {
      this.bombShockwaveTimer = Math.max(0, this.bombShockwaveTimer - dt);
    }
    if (this.heavyCrushTimer > 0) {
      this.heavyCrushTimer = Math.max(0, this.heavyCrushTimer - dt);
    }
    if (this.shieldDeflectTimer > 0) {
      this.shieldDeflectTimer = Math.max(0, this.shieldDeflectTimer - dt);
    }
    if (this.freezeTetherTimer > 0) {
      this.freezeTetherTimer = Math.max(0, this.freezeTetherTimer - dt);
    }
    if (this.garbageEaterConvertTimer > 0) {
      this.garbageEaterConvertTimer = Math.max(0, this.garbageEaterConvertTimer - dt);
    }

    this.shieldAuraPulse += dt * 0.005;

    // Update Buff Strip UI for Step 3 (Multiplier 5s), Step 4 (Speed 5s), Step 6 (Freeze 5s)
    const buffStrip = document.getElementById('tut3-buff-strip');
    const buffLabel = document.getElementById('tut3-buff-label');
    const buffTimer = document.getElementById('tut3-buff-timer');

    if (this.multiplierBuffTimer > 0) {
      this.multiplierBuffTimer = Math.max(0, this.multiplierBuffTimer - dt);
      buffStrip?.classList.remove('hidden');
      buffStrip?.classList.add('flex');
      if (buffLabel) buffLabel.textContent = '⚡ 2X SCORE MULTIPLIER BUFF';
      if (buffTimer) buffTimer.textContent = `${(this.multiplierBuffTimer / 1000).toFixed(1)}s`;
    } else if (this.speedBuffTimer > 0) {
      this.speedBuffTimer = Math.max(0, this.speedBuffTimer - dt);
      buffStrip?.classList.remove('hidden');
      buffStrip?.classList.add('flex');
      if (buffLabel) buffLabel.textContent = '⚡ -50% DROP SPEED BUFF';
      if (buffTimer) buffTimer.textContent = `${(this.speedBuffTimer / 1000).toFixed(1)}s`;

      // Animate the next falling piece dropping 50% slower during the 5-second duration
      if (this.simulatedFastPiece) {
        this.simulatedFastDropTimer += dt;
        if (this.simulatedFastDropTimer >= this.FAST_DROP_INTERVAL) {
          this.simulatedFastDropTimer = 0;
          if (!this.grid.checkCollision(this.simulatedFastPiece, this.simulatedFastPiece.x, this.simulatedFastPiece.y + 1)) {
            this.simulatedFastPiece.y++;
          } else {
            this.simulatedFastPiece.y = 0;
          }
        }
      }
    } else if (this.dummyFreezeDebuffTimer > 0) {
      this.dummyFreezeDebuffTimer = Math.max(0, this.dummyFreezeDebuffTimer - dt);
      const lockTimerEl = document.getElementById('tut3-dummy-lock-timer');
      if (lockTimerEl) {
        lockTimerEl.textContent = `🔒 LOCKED (${(this.dummyFreezeDebuffTimer / 1000).toFixed(1)}s)`;
      }
      buffStrip?.classList.add('hidden');
      buffStrip?.classList.remove('flex');
    } else {
      buffStrip?.classList.add('hidden');
      buffStrip?.classList.remove('flex');
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += (ft.vy * dt) / 1000;
    }

    // Gently lower the active piece in READY_TO_TRIGGER and auto-trigger when it lands
    if (this.phase === 'READY_TO_TRIGGER' && this.currentPiece) {
      this.dropTimer += dt;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer = 0;
        if (!this.grid.checkCollision(this.currentPiece, this.currentPiece.x, this.currentPiece.y + 1)) {
          this.currentPiece.y++;
        } else {
          this.executeStepTrigger();
        }
      }
    }
  }

  private render() {
    if (!this.boardCanvas) return;
    const ctx = this.boardCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    // 1. Grid cells background
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }

    // 2. Step 4 Visual Speed Buff Lines on Grid
    if (this.speedBuffTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
      ctx.lineWidth = 2;
      const offset = (performance.now() * 0.45) % 60;
      for (let i = 0; i < 8; i++) {
        const lx = 20 + i * 36;
        const ly = ((i * 85 + offset) % (ROWS * BLOCK_SIZE));
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + 38);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Highlight target line-clear slot while waiting to trigger
    if (this.phase === 'READY_TO_TRIGGER') {
      const stepMeta = STAGE_3_STEPS[this.currentStepIndex];
      const targetRow =
        stepMeta.specialType === SpecialBlockType.BOMB
          ? 16
          : stepMeta.specialType === SpecialBlockType.HEAVY
            ? 18
            : 19;
      ctx.fillStyle = 'rgba(0, 255, 102, 0.16)';
      ctx.fillRect(6 * BLOCK_SIZE, targetRow * BLOCK_SIZE, 4 * BLOCK_SIZE, BLOCK_SIZE);
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.8)';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(6 * BLOCK_SIZE + 1, targetRow * BLOCK_SIZE + 1, 4 * BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.setLineDash([]);
    }

    // 4. Draw locked matrix blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid.matrix[r][c];
        if (cell.type !== null) {
          const cellColor = cell.type === 'GARBAGE' ? '#6B7280' : PLAYER_COLOR;
          this.drawBlock(ctx, c, r, cellColor, false, BLOCK_SIZE, cell.type, cell.special);
        }
      }
    }

    // 5. Draw active piece (or Step 4 fast-dropping simulated piece with motion trails)
    const pieceToDraw = this.currentPiece ?? this.simulatedFastPiece;
    if (pieceToDraw) {
      let ghostY = pieceToDraw.y;
      while (!this.grid.checkCollision(pieceToDraw, pieceToDraw.x, ghostY + 1)) {
        ghostY++;
      }

      const shape = pieceToDraw.matrix;
      const size = shape.length;

      // Motion trail afterimages for Step 4 Speed Block (50% faster drop)
      if (this.simulatedFastPiece && this.speedBuffTimer > 0) {
        for (let trail = 1; trail <= 3; trail++) {
          const ty = pieceToDraw.y - trail;
          if (ty < 0) continue;
          ctx.save();
          ctx.globalAlpha = 0.28 / trail;
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if (shape[r][c] !== 0) {
                ctx.fillStyle = '#00E5FF';
                ctx.fillRect(
                  (pieceToDraw.x + c) * BLOCK_SIZE + 3,
                  (ty + r) * BLOCK_SIZE + 3,
                  BLOCK_SIZE - 6,
                  BLOCK_SIZE - 6
                );
              }
            }
          }
          ctx.restore();
        }
      }

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c] !== 0) {
            this.drawBlock(ctx, pieceToDraw.x + c, ghostY + r, PLAYER_COLOR, true, BLOCK_SIZE, pieceToDraw.type);
          }
        }
      }

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c] !== 0) {
            const specialType = pieceToDraw.specialBlocks.get(`${r},${c}`);
            this.drawBlock(ctx, pieceToDraw.x + c, pieceToDraw.y + r, PLAYER_COLOR, false, BLOCK_SIZE, pieceToDraw.type, specialType);
          }
        }
      }
    }

    // 6. Standard Line-Clear Flash
    if (this.lineFlashTimer > 0 && this.lineFlashRow !== null) {
      const alpha = Math.min(1, this.lineFlashTimer / 450);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.75})`;
      ctx.fillRect(0, this.lineFlashRow * BLOCK_SIZE, COLS * BLOCK_SIZE, BLOCK_SIZE);
    }

    // 7. Step 1: Localized 3x3 Bomb Explosion Animation
    if (this.bombShockwaveTimer > 0) {
      const progress = 1 - this.bombShockwaveTimer / this.bombShockwaveMax;
      const cx = this.bombCenterCol * BLOCK_SIZE;
      const cy = this.bombCenterRow * BLOCK_SIZE;
      const maxRadius = 2.1 * BLOCK_SIZE;

      ctx.save();
      // Highlight the 3x3 blast zone crate
      ctx.fillStyle = `rgba(255, 85, 85, ${(1 - progress) * 0.45})`;
      ctx.fillRect((this.bombCenterCol - 1.5) * BLOCK_SIZE, (this.bombCenterRow - 1.5) * BLOCK_SIZE, 3 * BLOCK_SIZE, 3 * BLOCK_SIZE);
      ctx.strokeStyle = `rgba(255, 215, 0, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.strokeRect((this.bombCenterCol - 1.5) * BLOCK_SIZE, (this.bombCenterRow - 1.5) * BLOCK_SIZE, 3 * BLOCK_SIZE, 3 * BLOCK_SIZE);

      // Expanding shockwave ring
      ctx.beginPath();
      ctx.arc(cx, cy, progress * maxRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 140, 0, ${1 - progress})`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

    // 8. Step 2: Heavy Block Downward Crush Wave Animation
    if (this.heavyCrushTimer > 0) {
      const progress = 1 - this.heavyCrushTimer / this.heavyCrushMax;
      ctx.save();
      ctx.fillStyle = `rgba(255, 215, 0, ${(1 - progress) * 0.5})`;
      ctx.fillRect(0, (18 + progress) * BLOCK_SIZE, COLS * BLOCK_SIZE, BLOCK_SIZE);
      ctx.strokeStyle = `rgba(255, 215, 0, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 18 * BLOCK_SIZE, COLS * BLOCK_SIZE - 4, 2 * BLOCK_SIZE - 2);
      ctx.restore();
    }

    // 9. Step 5: Shield Defensive Aura & Deflection Flash
    if (this.shieldAuraActive || this.shieldDeflectTimer > 0) {
      ctx.save();
      const pulseAlpha = this.shieldDeflectTimer > 0 ? 0.85 : 0.45 + Math.sin(this.shieldAuraPulse * 3) * 0.2;
      ctx.strokeStyle = `rgba(0, 255, 136, ${pulseAlpha})`;
      ctx.lineWidth = 6;
      ctx.shadowColor = '#00FF88';
      ctx.shadowBlur = 20;
      ctx.strokeRect(3, 3, COLS * BLOCK_SIZE - 6, ROWS * BLOCK_SIZE - 6);
      ctx.restore();
    }

    // 10. Step 5 & Step 7: Incoming Garbage Queue Bar on the Left Edge of the Grid
    if (this.incomingGarbageLines > 0 || this.garbageEaterConvertTimer > 0) {
      const effectiveLines =
        this.garbageEaterConvertTimer > 0
          ? 4 * (this.garbageEaterConvertTimer / this.GARBAGE_EATER_CONVERT_MAX)
          : this.incomingGarbageLines;
      const barHeight = Math.max(0, effectiveLines * BLOCK_SIZE * 2.5);
      const barY = ROWS * BLOCK_SIZE - barHeight;

      ctx.save();
      ctx.fillStyle = this.garbageEaterConvertTimer > 0 ? '#FFD700' : '#FF1493';
      ctx.shadowColor = this.garbageEaterConvertTimer > 0 ? '#FFD700' : '#FF1493';
      ctx.shadowBlur = 14;
      ctx.fillRect(0, barY, 10, barHeight);

      // Banner callout inside top of board
      ctx.fillStyle = 'rgba(13, 11, 26, 0.92)';
      ctx.fillRect(18, 56, 264, 44);
      ctx.strokeStyle = this.garbageEaterConvertTimer > 0 ? '#FFD700' : '#FF1493';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 56, 264, 44);
      ctx.fillStyle = this.garbageEaterConvertTimer > 0 ? '#FFD700' : '#FF1493';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        this.garbageEaterConvertTimer > 0
          ? '🍽 CONVERTING GARBAGE → +800 PTS!'
          : `⚠ INCOMING GARBAGE QUEUE: ${this.incomingGarbageLines} LINES`,
        150,
        82
      );
      ctx.restore();
    }

    // 11. Board Border
    ctx.strokeStyle = this.speedBuffTimer > 0 ? '#FFD700' : PLAYER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    // 12. Particles & Floating Canvas Texts
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${ft.size}px Inter, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 13. Render Hold / Next mini canvases
    if (this.holdCanvas) {
      const hCtx = this.holdCanvas.getContext('2d')!;
      hCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    }

    // 14. Render Split-Screen Dummy Opponent Grid & Freeze Tether (Step 6)
    if (this.dummyCanvas && STAGE_3_STEPS[this.currentStepIndex]?.specialType === SpecialBlockType.FREEZE) {
      this.renderDummyOpponentCanvas(this.dummyCanvas);
    }
    this.renderFreezeTetherOverlay();
  }

  private renderDummyOpponentCanvas(canvasEl: HTMLCanvasElement) {
    const dCtx = canvasEl.getContext('2d')!;
    const cellSize = 24;
    dCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        dCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        dCtx.lineWidth = 1;
        dCtx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.dummyGrid.matrix[r][c];
        if (cell.type !== null) {
          this.drawBlock(dCtx, c, r, DUMMY_COLOR, false, cellSize, cell.type, cell.special);
        }
      }
    }

    if (this.dummyFreezeDebuffTimer > 0) {
      dCtx.fillStyle = 'rgba(56, 189, 248, 0.26)';
      dCtx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      dCtx.strokeStyle = '#38BDF8';
      dCtx.lineWidth = 4;
      dCtx.strokeRect(2, 2, canvasEl.width - 4, canvasEl.height - 4);

      dCtx.fillStyle = 'rgba(13, 11, 26, 0.92)';
      dCtx.fillRect(16, 190, canvasEl.width - 32, 64);
      dCtx.strokeStyle = '#38BDF8';
      dCtx.lineWidth = 2;
      dCtx.strokeRect(16, 190, canvasEl.width - 32, 64);

      dCtx.fillStyle = '#38BDF8';
      dCtx.font = 'bold 12px Inter, sans-serif';
      dCtx.textAlign = 'center';
      dCtx.fillText('❄ ABILITIES FROZEN!', canvasEl.width / 2, 216);
      dCtx.fillStyle = '#E5E7EB';
      dCtx.font = 'bold 10px Inter, sans-serif';
      dCtx.fillText('[Q] [E] [R] LOCKED OUT', canvasEl.width / 2, 238);
    }
  }

  private renderFreezeTetherOverlay() {
    if (!this.tetherOverlayCanvas) return;
    const tCtx = this.tetherOverlayCanvas.getContext('2d')!;
    tCtx.clearRect(0, 0, this.tetherOverlayCanvas.width, this.tetherOverlayCanvas.height);

    if (this.freezeTetherTimer <= 0 || !this.boardCanvas || !this.dummyCanvas) return;

    const progress = 1 - this.freezeTetherTimer / this.FREEZE_TETHER_MAX;
    const p1Rect = this.boardCanvas.getBoundingClientRect();
    const dummyRect = this.dummyCanvas.getBoundingClientRect();

    const startX = p1Rect.left + p1Rect.width * 0.75;
    const startY = p1Rect.top + p1Rect.height * 0.9;
    const endX = dummyRect.left + dummyRect.width * 0.5;
    const endY = dummyRect.top + dummyRect.height * 0.55;

    const headX = startX + (endX - startX) * Math.min(1, progress * 1.35);
    const headY = startY + (endY - startY) * Math.min(1, progress * 1.35);

    tCtx.save();
    tCtx.strokeStyle = '#38BDF8';
    tCtx.lineWidth = 5;
    tCtx.shadowColor = '#38BDF8';
    tCtx.shadowBlur = 20;
    tCtx.setLineDash([10, 6]);
    tCtx.beginPath();
    tCtx.moveTo(startX, startY);
    tCtx.lineTo(headX, headY);
    tCtx.stroke();
    tCtx.setLineDash([]);

    // Projectile frost orb head
    tCtx.fillStyle = '#FFFFFF';
    tCtx.beginPath();
    tCtx.arc(headX, headY, 9, 0, Math.PI * 2);
    tCtx.fill();
    tCtx.strokeStyle = '#00E5FF';
    tCtx.lineWidth = 3;
    tCtx.stroke();
    tCtx.restore();
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
      targetCtx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      targetCtx.setLineDash([4, 2]);
      targetCtx.lineWidth = 2;
      targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);
      targetCtx.setLineDash([]);
      return;
    }

    if (
      shapeType &&
      shapeType !== 'GARBAGE' &&
      BLOCK_SPRITES[shapeType] &&
      BLOCK_SPRITES[shapeType].complete &&
      BLOCK_SPRITES[shapeType].naturalWidth > 0
    ) {
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
      const specialSprite = SPECIAL_BLOCK_SPRITES[specialType];
      if (specialSprite && specialSprite.complete && specialSprite.naturalWidth > 0) {
        targetCtx.drawImage(specialSprite, finalX, finalY, blockSize, blockSize);
        const glowColor = SPECIAL_BLOCK_COLORS[specialType as SpecialBlockType] || '#FFD700';
        targetCtx.save();
        targetCtx.shadowColor = glowColor;
        targetCtx.shadowBlur = 8;
        targetCtx.strokeStyle = glowColor;
        targetCtx.lineWidth = 1.5;
        targetCtx.strokeRect(finalX + 0.5, finalY + 0.5, blockSize - 1, blockSize - 1);
        targetCtx.restore();
        return;
      }
      targetCtx.fillStyle = '#FFD700';
      targetCtx.fillRect(finalX + 3, finalY + 3, blockSize - 6, blockSize - 6);
      targetCtx.fillStyle = '#0D0B1A';
      targetCtx.font = `bold ${Math.max(9, Math.floor(blockSize * 0.45))}px "Press Start 2P", monospace`;
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      targetCtx.fillText(getSpecialLetter(specialType), finalX + blockSize / 2, finalY + blockSize / 2 + 1);
    }
  }
}
