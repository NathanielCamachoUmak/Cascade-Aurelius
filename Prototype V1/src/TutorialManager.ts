import { Grid } from './Grid';
import { Tetromino, type ShapeType } from './Tetromino';
import { AudioManager } from './AudioManager';
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass';
import { SpecialBlockType, SPECIAL_BLOCK_ICONS, SPECIAL_BLOCK_COLORS } from './ItemManager';
import { GameState } from './GameManager';
import { supabase } from './supabase';
import { Stage3Tutorial } from './Stage3Tutorial';

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

type ClassCertStep =
  | 'STEP_1_PASSIVE_TETRIS'
  | 'STEP_1_PASSIVE_SPECIAL'
  | 'STEP_2_ABILITY'
  | 'STEP_3_ABILITY'
  | 'STEP_4_ULTIMATE'
  | 'STEP_4_BULLET_TIME_TETRIS'
  | 'CERT_COMPLETED';

interface DummyBoardState {
  id: string;
  label: string;
  isAlly?: boolean;
  grid: Grid;
  activePiece: Tetromino | null;
  previewQueue: ShapeType[];
  statusBadge: string | null;
  statusColor: string;
  frozenTimer: number;
  chaosTimer: number;
  abilityFreezeTimer: number;
  sprintTimer: number;
}

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PLAYER_COLOR = '#00E5FF';
const DUMMY_COLOR = '#FF1493';
const ALLY_COLOR = '#00FF66';
const TUTORIAL_STORAGE_KEY = 'cascade_completed_tutorials_v1';

const ALL_CERT_CLASSES: PlayerClass[] = ['SPEEDSTER', 'TANK', 'SABOTEUR', 'SUPPORT'];

function readCompletedTutorialsMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function syncCompletedTutorialsToCloud(map: Record<string, boolean>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    await supabase.auth.updateUser({
      data: { completed_tutorials: map },
    });

    const { data: existingRow } = await supabase
      .from('profiles')
      .select('settings_and_hotkeys')
      .eq('id', user.id)
      .single();

    const mergedJsonb = {
      ...(existingRow?.settings_and_hotkeys || {}),
      completedTutorials: map,
    };

    const { error } = await supabase
      .from('profiles')
      .update({
        completed_tutorials: map,
        settings_and_hotkeys: mergedJsonb,
      })
      .eq('id', user.id);

    if (error) {
      await supabase
        .from('profiles')
        .update({
          settings_and_hotkeys: mergedJsonb,
        })
        .eq('id', user.id);
    }
  } catch {
    // ignore offline / cloud errors
  }
}

async function hydrateTutorialsFromCloud(user: any) {
  if (!user) return;
  try {
    const metaMap =
      user.user_metadata?.completed_tutorials && typeof user.user_metadata.completed_tutorials === 'object'
        ? user.user_metadata.completed_tutorials
        : {};

    let profileMap: Record<string, boolean> = {};
    const { data, error } = await supabase
      .from('profiles')
      .select('completed_tutorials, settings_and_hotkeys')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      profileMap = {
        ...((data.settings_and_hotkeys as any)?.completedTutorials || {}),
        ...((data as any).completed_tutorials || {}),
      };
    } else {
      const { data: fallbackData } = await supabase
        .from('profiles')
        .select('settings_and_hotkeys')
        .eq('id', user.id)
        .single();
      if (fallbackData?.settings_and_hotkeys) {
        profileMap = (fallbackData.settings_and_hotkeys as any).completedTutorials || {};
      }
    }

    const merged = { ...readCompletedTutorialsMap(), ...metaMap, ...profileMap };
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('tutorialProgressUpdated'));
    void syncCompletedTutorialsToCloud(merged);
  } catch {
    // ignore offline errors
  }
}

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) void hydrateTutorialsFromCloud(session.user);
});

// Hydrate local tutorial completion map from Supabase on login
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) void hydrateTutorialsFromCloud(session.user);
});

export function isTutorialCompleted(tutorialId: string): boolean {
  const map = readCompletedTutorialsMap();
  return Boolean(map[tutorialId]);
}

export function markTutorialCompleted(tutorialId: string): void {
  const map = readCompletedTutorialsMap();
  map[tutorialId] = true;
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
  void syncCompletedTutorialsToCloud(map);
  window.dispatchEvent(new CustomEvent('tutorialProgressUpdated'));
}

export function getClassCertTutorialId(playerClass: PlayerClass): string {
  return `basics-stage-2-${playerClass}`;
}

export function isClassCertified(playerClass: PlayerClass): boolean {
  return isTutorialCompleted(getClassCertTutorialId(playerClass));
}

export function getCertifiedClasses(): PlayerClass[] {
  return ALL_CERT_CLASSES.filter(cls => isClassCertified(cls));
}

export function markClassCertified(playerClass: PlayerClass): void {
  const map = readCompletedTutorialsMap();
  map[getClassCertTutorialId(playerClass)] = true;
  if (ALL_CERT_CLASSES.every(cls => Boolean(map[getClassCertTutorialId(cls)]))) {
    map['basics-stage-2'] = true;
  }
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
  void syncCompletedTutorialsToCloud(map);
  window.dispatchEvent(new CustomEvent('tutorialProgressUpdated'));
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

export class TutorialManager {
  private activeStage: 1 | 2 | 3 = 1;
  private eFsmState: GameState = GameState.TUTORIAL;
  private stage3Tutorial: Stage3Tutorial | null = null;

  private grid: Grid = new Grid();
  private currentPiece: Tetromino | null = null;
  private holdPiece: Tetromino | null = null;
  private queue: ShapeType[] = [];

  // Stage 1 state
  private step: TutorialStep = 'PIECE_1_MOVE';
  private piece1MovedLeftRight = false;
  private piece1SoftDropped = false;
  private piece3Rotated = false;

  // Stage 2 Class Certification state
  private activeClass: PlayerClass = 'SPEEDSTER';
  private certStep: ClassCertStep = 'STEP_1_PASSIVE_TETRIS';
  private onOpenClassSelector: (() => void) | null = null;

  private classMeter = 0;
  private ultimateCost = 40;
  private qStatusText = 'READY';
  private eStatusText = 'READY';
  private rStatusText = '0 / 40 LINES';
  private incomingGarbageQueue = 0;
  private fortifyCharges = 0;
  private reflectArmed = false;
  private gridShiftUsed = false;
  private timeWarpActive = false;
  private timeWarpTimer = 0;
  private goldDropActive = false;
  private recycleConvertedReady = false;
  private stage2TransitionLocked = false;

  // Phase 1 & Phase 3: Dummy Board(s) & Locked O(1) Circular Linked List Target Pointer
  private selectedTargetIndex: number = 1;
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
    AudioManager.playMusic('game');
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
  // STAGE 2: CLASS-SPECIFIC CERTIFICATIONS (SPEEDSTER / SENTINEL / SABOTEUR / SUPPORT)
  // ═══════════════════════════════════════════════════════════════════════════

  public startStage2(playerClass: PlayerClass = 'SPEEDSTER', onOpenClassSelector?: () => void) {
    AudioManager.playMusic('game');
    this.activeStage = 2;
    this.activeClass = playerClass;
    if (onOpenClassSelector) {
      this.onOpenClassSelector = onOpenClassSelector;
    }
    this.eFsmState = GameState.TUTORIAL;
    this.boardCanvas = document.getElementById('board-p1') as HTMLCanvasElement | null;
    this.holdCanvas = document.getElementById('hold-canvas-p1') as HTMLCanvasElement | null;
    this.nextCanvas = document.getElementById('next-canvas-p1') as HTMLCanvasElement | null;

    this.prepareArenaDom(true);
    this.mountStage2Hud();
    this.setupCertStep('STEP_1_PASSIVE_TETRIS');

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
  // STAGE 3: ITEM BLOCKS (7 SPECIAL BLOCK SCENARIOS)
  // ═══════════════════════════════════════════════════════════════════════════

  public startStage3() {
    this.stop();
    AudioManager.playMusic('game');
    this.activeStage = 3;
    this.stage3Tutorial = new Stage3Tutorial();
    this.stage3Tutorial.start();
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
    this.stage3Tutorial?.stop();
    this.stage3Tutorial = null;
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
  // STAGE 2 DOM & DUMMY BOARDS (Phase 1 & Phase 3)
  // ─────────────────────────────────────────────────────────────────────────

  private getActiveClassInfo() {
    return PLAYER_CLASSES.find(c => c.id === this.activeClass) ?? PLAYER_CLASSES[0];
  }

  private getActiveClassAccent(): string {
    switch (this.activeClass) {
      case 'SPEEDSTER': return '#00FFFF';
      case 'TANK': return '#FFD700';
      case 'SABOTEUR': return '#FF1493';
      case 'SUPPORT': return '#00FF00';
    }
  }

  private mountStage2Hud() {
    this.hudContainer?.remove();
    this.dummyCanvasContainer?.remove();
    this.conclusionModal?.remove();

    const duoLayoutContainer = document.getElementById('duo-layout-container');
    if (!duoLayoutContainer) return;

    const info = this.getActiveClassInfo();
    const certifiedCount = getCertifiedClasses().length;

    // Center Instruction Panel
    const panel = document.createElement('div');
    panel.id = 'tutorial-stage-panel';
    panel.className = 'w-80 sm:w-96 shrink-0 bg-card-bg/95 backdrop-blur-md border-2 border-neon-cyan rounded-xl p-5 shadow-[0_0_30px_rgba(0,229,255,0.2)] flex flex-col gap-4 self-center z-30 pointer-events-auto';
    panel.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[10px] font-bold tracking-[0.22em] uppercase text-neon-cyan">STAGE 2 · CLASS CERTIFICATION</span>
          <span id="tut-step-counter" class="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40">Step 1 / 4</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <h2 id="tut-stage2-title" class="text-lg font-extrabold text-white tracking-wide">${info.name} Certification</h2>
          <span id="tut-cert-progress-pill" class="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-neon-yellow">${certifiedCount} / 4 CERTIFIED</span>
        </div>
        <div id="tut-progress-dots" class="grid grid-cols-4 gap-1.5 mt-2.5">
          <div class="h-1.5 rounded-full bg-neon-cyan"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
          <div class="h-1.5 rounded-full bg-gray-700"></div>
        </div>
      </div>

      <!-- Active Class & Target Lock Strip -->
      <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-deep-purple/90 border border-card-border text-[10px]">
        <div>
          <span class="text-gray-400 uppercase tracking-wider">CLASS:</span>
          <span id="tut-active-class-badge" class="ml-1 font-bold text-neon-yellow uppercase tracking-widest">${info.name.toUpperCase()}</span>
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
        <div id="tut-block-badge" class="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">STEP 1 · PASSIVES DRILL</div>
        <div id="tut-instructions-list" class="flex flex-col gap-2.5"></div>
      </div>

      <div id="tut-guard-footer" class="text-[11px] text-gray-400 leading-relaxed border-t border-card-border pt-2.5">
        eFSM Guard Active: Complete each scenario's prompted ability or line clear to earn your <span class="text-neon-yellow font-bold">★ ${info.name} Certification</span>.
      </div>

      <div class="grid grid-cols-3 gap-2 pt-1">
        <button id="tut-btn-restart" type="button" class="px-2.5 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-card-border bg-white/5 text-gray-300 hover:text-white hover:border-neon-cyan transition-all cursor-pointer">
          Reset Step
        </button>
        <button id="tut-btn-switch-class" type="button" class="px-2.5 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan hover:text-deep-purple transition-all cursor-pointer">
          Switch Class
        </button>
        <button id="tut-btn-exit" type="button" class="px-2.5 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-neon-pink/40 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink hover:text-deep-purple transition-all cursor-pointer">
          Exit
        </button>
      </div>
    `;

    duoLayoutContainer.appendChild(panel);
    this.hudContainer = panel;

    // Right-hand Dummy Board Container (Single Dummy 10x20 Grid for Steps 1–3 & Support Step 4, and 3-Dummy Mini Lobby for AoE Step 4)
    const dummyPod = document.createElement('div');
    dummyPod.id = 'tutorial-dummy-pod';
    dummyPod.className = 'flex flex-col items-center justify-center gap-3 self-center shrink-0 z-20 pointer-events-auto';
    dummyPod.innerHTML = `
      <!-- Single 10x20 Dummy Board View -->
      <div id="tut-single-dummy-view" class="flex flex-col items-center gap-2 bg-card-bg/85 border-2 border-neon-pink rounded-xl p-3 shadow-[0_0_25px_rgba(255,20,147,0.25)]">
        <div class="w-full flex items-center justify-between px-1 gap-2">
          <div class="flex items-center gap-1.5">
            <span id="tut-dummy-dot" class="w-2 h-2 rounded-full bg-neon-pink"></span>
            <span id="tut-dummy-header-label" class="text-[10px] font-bold tracking-widest uppercase text-neon-pink">DUMMY OPPONENT</span>
          </div>
          <span id="tut-dummy-target-tag" class="text-[9px] font-bold px-2 py-0.5 rounded bg-neon-pink/20 border border-neon-pink text-white uppercase tracking-wider">◎ TARGET LOCKED</span>
        </div>
        <div id="tut-dummy-preview-strip" class="w-full flex items-center justify-between px-2 py-1 rounded bg-deep-purple/80 border border-card-border text-[9px] font-pixel text-gray-300">
          <span class="text-gray-400">QUEUE:</span>
          <span id="tut-dummy-preview-items" class="text-neon-cyan tracking-widest">I · T · O · L · J</span>
        </div>
        <canvas id="tut-dummy-canvas-main" width="240" height="480" class="bg-black/60 rounded border border-card-border"></canvas>
        <div id="tut-dummy-status-line" class="text-[10px] font-bold tracking-wider uppercase text-gray-300 min-h-[16px] text-center">INPUT: NULL · SCRIPTED STATE</div>
      </div>

      <!-- 3-Dummy Lobby View (Step 4 AoE Ultimates) -->
      <div id="tut-multi-dummy-view" class="hidden flex-col items-center gap-3 bg-card-bg/85 border-2 border-neon-pink rounded-xl p-4 shadow-[0_0_25px_rgba(255,20,147,0.25)]">
        <div class="w-full flex items-center justify-between">
          <span class="text-[10px] font-bold tracking-widest uppercase text-neon-pink">3-DUMMY AoE LOBBY</span>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-neon-yellow/20 border border-neon-yellow text-neon-yellow uppercase">ALL 3 OPPONENTS</span>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="flex flex-col items-center gap-1.5 bg-deep-purple/80 border border-card-border rounded-lg p-2">
            <span class="text-[9px] font-bold text-neon-cyan tracking-wider">DUMMY ALPHA</span>
            <canvas id="tut-dummy-mini-0" width="120" height="240" class="bg-black/60 rounded"></canvas>
            <span id="tut-dummy-mini-status-0" class="text-[8px] font-bold text-gray-400 uppercase text-center">ACTIVE</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 bg-deep-purple/80 border border-card-border rounded-lg p-2">
            <span class="text-[9px] font-bold text-neon-yellow tracking-wider">DUMMY BETA</span>
            <canvas id="tut-dummy-mini-1" width="120" height="240" class="bg-black/60 rounded"></canvas>
            <span id="tut-dummy-mini-status-1" class="text-[8px] font-bold text-gray-400 uppercase text-center">ACTIVE</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 bg-deep-purple/80 border border-card-border rounded-lg p-2">
            <span class="text-[9px] font-bold text-neon-pink tracking-wider">DUMMY GAMMA</span>
            <canvas id="tut-dummy-mini-2" width="120" height="240" class="bg-black/60 rounded"></canvas>
            <span id="tut-dummy-mini-status-2" class="text-[8px] font-bold text-gray-400 uppercase text-center">ACTIVE</span>
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
      if (this.certStep === 'CERT_COMPLETED') {
        this.setupCertStep('STEP_1_PASSIVE_TETRIS');
      } else {
        this.setupCertStep(this.certStep);
      }
    });

    panel.querySelector('#tut-btn-switch-class')?.addEventListener('click', () => {
      if (this.onOpenClassSelector) {
        this.onOpenClassSelector();
      }
    });

    panel.querySelector('#tut-btn-exit')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });

    // Stage 2 Certification Conclusion Modal
    const modal = document.createElement('div');
    modal.id = 'tutorial-conclusion-modal';
    modal.className = 'hidden fixed inset-0 z-[120] bg-black/80 backdrop-blur-md items-center justify-center p-4';
    document.body.appendChild(modal);
    this.conclusionModal = modal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2 STEP SETUPS PER CLASS (SPEEDSTER / SENTINEL / SABOTEUR / SUPPORT)
  // ─────────────────────────────────────────────────────────────────────────

  private createSingleDummyBoard(options?: {
    presetRows?: (string | null)[][];
    activePiece?: Tetromino | null;
    statusBadge?: string | null;
    previewQueue?: ShapeType[];
    isAlly?: boolean;
  }): DummyBoardState {
    const g = new Grid();
    if (options?.presetRows) {
      g.loadPresetMatrix(options.presetRows);
    } else {
      g.loadPresetMatrix([
        ['T', 'T', 'T', null, 'L', 'L', 'L', null, 'O', 'O'],
        ['J', 'J', 'S', 'S', 'L', 'Z', 'Z', null, 'O', 'O'],
        ['J', 'I', 'I', 'I', 'I', 'Z', 'Z', 'T', 'T', 'T'],
      ]);
    }
    return {
      id: options?.isAlly ? 'ALLY-1' : 'DUMMY-1',
      label: options?.isAlly ? 'ALLY BOARD (CRITICAL)' : 'DUMMY OPPONENT',
      isAlly: Boolean(options?.isAlly),
      grid: g,
      activePiece: options?.activePiece ?? null,
      previewQueue: options?.previewQueue ?? ['I', 'T', 'O', 'L', 'J'],
      statusBadge: options?.statusBadge ?? null,
      statusColor: options?.isAlly ? ALLY_COLOR : '#00FFFF',
      frozenTimer: 0,
      chaosTimer: 0,
      abilityFreezeTimer: 0,
      sprintTimer: 0,
    };
  }

  private loadStandardTetrisWellOnPlayerBoard() {
    this.grid = new Grid();
    this.grid.loadPresetMatrix([
      ['J', 'J', 'L', 'L', 'O', 'O', 'T', 'T', 'S', null],
      ['J', 'Z', 'Z', 'L', 'O', 'O', 'T', 'S', 'S', null],
      ['I', 'I', 'I', 'I', 'J', 'J', 'J', 'L', 'L', null],
      ['O', 'O', 'T', 'T', 'T', 'S', 'S', 'Z', 'Z', null],
    ]);
  }

  private setupCertStep(step: ClassCertStep) {
    this.certStep = step;
    this.stage2TransitionLocked = false;
    this.isRestarting = false;
    this.selectedTargetIndex = 1;
    this.incomingGarbageQueue = 0;
    this.fortifyCharges = 0;
    this.reflectArmed = false;
    this.timeWarpActive = false;
    this.timeWarpTimer = 0;
    this.goldDropActive = false;
    this.recycleConvertedReady = false;
    this.holdPiece = null;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.dropInterval = 1000;
    this.hideStage2Banner();

    const info = this.getActiveClassInfo();
    this.ultimateCost = info.ultimateCost;

    // Determine whether this step uses the Single Dummy Board or the 3-Dummy AoE Lobby
    const isMultiDummyAoE =
      (step === 'STEP_4_ULTIMATE' || step === 'STEP_4_BULLET_TIME_TETRIS') &&
      this.activeClass !== 'SUPPORT';

    const singleView = document.getElementById('tut-single-dummy-view');
    const multiView = document.getElementById('tut-multi-dummy-view');
    if (isMultiDummyAoE) {
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

    // ═══════════════════════════════════════════════════════════════════════
    // 1. SPEEDSTER CERTIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    if (this.activeClass === 'SPEEDSTER') {
      if (step === 'STEP_1_PASSIVE_TETRIS') {
        this.classMeter = 10;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '10 / 40 LINES';
        this.loadStandardTetrisWellOnPlayerBoard();
        this.currentPiece = new Tetromino('I');
        this.queue = ['I', 'T', 'O', 'L'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'PASSIVES DRILL · TETRIS TRIGGER' })];
      } else if (step === 'STEP_1_PASSIVE_SPECIAL') {
        this.classMeter = 14;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '14 / 40 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['T', 'T', 'T', 'O', 'O', 'J', null, null, null, null],
        ]);
        const specialPiece = new Tetromino('I');
        specialPiece.specialBlocks.set('1,1', SpecialBlockType.SPEED);
        this.currentPiece = specialPiece;
        this.queue = ['T', 'L', 'O', 'J'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'SPEED BLOCK [V] SPAWNED' })];
      } else if (step === 'STEP_2_ABILITY') {
        // Step 2 (Survival / The Clutch): Max gravity -> [E] Time Warp -> place piece
        this.classMeter = 20;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'READY';
        this.rStatusText = '20 / 40 LINES';
        this.dropInterval = 55; // Extreme unmanageable gravity until [E] Time Warp is pressed
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['J', 'J', 'J', 'O', 'O', 'L', null, null, null, null],
        ]);
        this.currentPiece = new Tetromino('I');
        this.queue = ['I', 'I', 'I', 'I'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: '⚠ MAX GRAVITY OVERRIDE' })];
      } else if (step === 'STEP_3_ABILITY') {
        // Step 3 (Offense): [Q] Sprint -> Dummy's current + next 3 pieces drop 50% faster
        this.classMeter = 30;
        this.qStatusText = 'READY';
        this.eStatusText = 'COOLDOWN';
        this.rStatusText = '30 / 40 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['O', 'O', null, 'T', 'T', 'T', null, 'L', 'L', 'L'],
          ['O', 'O', 'J', 'J', 'J', 'S', 'S', 'L', 'Z', 'Z'],
        ]);
        this.currentPiece = null;
        const dummyPiece = new Tetromino('T');
        dummyPiece.x = 4;
        dummyPiece.y = 2;
        this.dummyBoards = [
          this.createSingleDummyBoard({
            activePiece: dummyPiece,
            previewQueue: ['I', 'O', 'L', 'Z', 'S'],
            statusBadge: 'NORMAL DROP SPEED (1.0x)',
          }),
        ];
      } else if (step === 'STEP_4_ULTIMATE') {
        // Step 4 (Ultimate / AoE): 3-Dummy Lobby + [R] Bullet Time -> Freeze all 3 + score free Tetris
        this.classMeter = 40;
        this.qStatusText = 'READY';
        this.eStatusText = 'READY';
        this.rStatusText = 'READY (40/40)';
        this.loadStandardTetrisWellOnPlayerBoard();
        this.currentPiece = null; // Spawns I-piece once [R] Bullet Time freezes all 3 dummies!
        this.queue = ['I', 'T', 'O', 'L'];
        this.initThreeDummyLobby();
      } else if (step === 'STEP_4_BULLET_TIME_TETRIS') {
        // All 3 dummies are frozen — player now drops the I-piece to score the free Tetris!
        this.classMeter = 0;
        this.rStatusText = 'BULLET TIME (5.0s)';
        this.currentPiece = new Tetromino('I');
        this.dropInterval = 900;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. SENTINEL (TANK) CERTIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    else if (this.activeClass === 'TANK') {
      if (step === 'STEP_1_PASSIVE_TETRIS') {
        this.classMeter = 12;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '12 / 50 LINES';
        this.loadStandardTetrisWellOnPlayerBoard();
        this.currentPiece = new Tetromino('I');
        this.queue = ['I', 'O', 'T', 'L'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'PASSIVES DRILL · TETRIS TRIGGER' })];
      } else if (step === 'STEP_1_PASSIVE_SPECIAL') {
        this.classMeter = 16;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '16 / 50 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['T', 'T', 'T', 'O', 'O', 'J', null, null, null, null],
        ]);
        const specialPiece = new Tetromino('I');
        specialPiece.specialBlocks.set('1,1', SpecialBlockType.SHIELD);
        this.currentPiece = specialPiece;
        this.queue = ['T', 'L', 'O', 'J'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'SHIELD BLOCK [S] SPAWNED' })];
      } else if (step === 'STEP_2_ABILITY') {
        // Step 2 (Survival / The Defense): Grid frozen + 10-line CQRS garbage queued -> [Q] Fortify (2 charges)
        this.classMeter = 25;
        this.qStatusText = 'READY';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '25 / 50 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['O', 'O', null, 'T', 'T', 'T', null, 'L', 'L', 'L'],
          ['O', 'O', 'J', 'J', 'J', 'S', 'S', 'L', 'Z', 'Z'],
        ]);
        this.currentPiece = null;
        this.incomingGarbageQueue = 10;
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: '⚠ SENDING LETHAL 10-LINE ATTACK!' })];
      } else if (step === 'STEP_3_ABILITY') {
        // Step 3 (Offense): Subsequent 10-line attack queued -> [E] Counter Strike reflects it to Dummy
        this.classMeter = 38;
        this.qStatusText = 'COOLDOWN';
        this.eStatusText = 'READY';
        this.rStatusText = '38 / 50 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['O', 'O', null, 'T', 'T', 'T', null, 'L', 'L', 'L'],
          ['O', 'O', 'J', 'J', 'J', 'S', 'S', 'L', 'Z', 'Z'],
        ]);
        this.currentPiece = null;
        this.incomingGarbageQueue = 10;
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: '⚠ SECOND 10-LINE SALVO INCOMING!' })];
      } else if (step === 'STEP_4_ULTIMATE') {
        // Step 4 (Ultimate / AoE): 3-Dummy Lobby + [R] Earthquake (+4 lines to all 3 dummies)
        this.classMeter = 50;
        this.qStatusText = 'READY';
        this.eStatusText = 'READY';
        this.rStatusText = 'READY (50/50)';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['O', 'O', null, 'T', 'T', 'T', null, 'L', 'L', 'L'],
          ['O', 'O', 'J', 'J', 'J', 'S', 'S', 'L', 'Z', 'Z'],
        ]);
        this.currentPiece = null;
        this.initThreeDummyLobby();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. SABOTEUR CERTIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    else if (this.activeClass === 'SABOTEUR') {
      if (step === 'STEP_1_PASSIVE_TETRIS') {
        this.classMeter = 10;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '10 / 35 LINES';
        this.loadStandardTetrisWellOnPlayerBoard();
        this.currentPiece = new Tetromino('I');
        this.queue = ['I', 'T', 'O', 'L'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'ABILITIES ACTIVE [Q/E/R]' })];
      } else if (step === 'STEP_1_PASSIVE_SPECIAL') {
        this.classMeter = 14;
        this.qStatusText = 'LOCKED';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '14 / 35 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['T', 'T', 'T', 'O', 'O', 'J', null, null, null, null],
        ]);
        const specialPiece = new Tetromino('I');
        specialPiece.specialBlocks.set('1,1', SpecialBlockType.FREEZE);
        this.currentPiece = specialPiece;
        this.queue = ['T', 'L', 'O', 'J'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'FREEZE BLOCK [F] SPAWNED' })];
      } else if (step === 'STEP_2_ABILITY') {
        // Step 2 (Interception): Dummy has a 4-line well + 'I' blocks queued -> [Q] Scramble ruins queue
        this.classMeter = 22;
        this.qStatusText = 'READY';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '22 / 35 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['J', 'J', 'J', null, 'O', 'O', 'T', 'T', 'T', null],
          ['L', 'L', 'L', 'S', 'O', 'O', 'Z', 'Z', 'T', null],
        ]);
        this.currentPiece = null;
        const dummyWell: (string | null)[][] = [
          ['I', 'I', 'I', 'I', 'O', 'O', 'T', 'T', 'T', null],
          ['J', 'J', 'J', 'L', 'O', 'O', 'S', 'S', 'T', null],
          ['J', 'Z', 'Z', 'L', 'L', 'L', 'S', 'S', 'O', null],
          ['Z', 'Z', 'T', 'T', 'T', 'I', 'I', 'I', 'I', null],
        ];
        this.dummyBoards = [
          this.createSingleDummyBoard({
            presetRows: dummyWell,
            previewQueue: ['I', 'I', 'I', 'I', 'I'],
            statusBadge: '⚠ I-PIECE QUEUED FOR TETRIS!',
          }),
        ];
      } else if (step === 'STEP_3_ABILITY') {
        // Step 3 (Offense / The Disruption): Dummy has active I-piece over well -> [E] Grid Shift shifts 2 cols
        this.classMeter = 30;
        this.qStatusText = 'COOLDOWN';
        this.eStatusText = 'READY (1/MATCH)';
        this.rStatusText = '30 / 35 LINES';
        this.gridShiftUsed = false;
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['J', 'J', 'J', null, 'O', 'O', 'T', 'T', 'T', null],
          ['L', 'L', 'L', 'S', 'O', 'O', 'Z', 'Z', 'T', null],
        ]);
        this.currentPiece = null;
        const dummyWell: (string | null)[][] = [
          ['I', 'I', 'I', 'I', 'O', 'O', 'T', 'T', 'T', null],
          ['J', 'J', 'J', 'L', 'O', 'O', 'S', 'S', 'T', null],
          ['J', 'Z', 'Z', 'L', 'L', 'L', 'S', 'S', 'O', null],
          ['Z', 'Z', 'T', 'T', 'T', 'I', 'I', 'I', 'I', null],
        ];
        const dummyIPiece = new Tetromino('I');
        dummyIPiece.rotate(1);
        dummyIPiece.x = 7; // column 9 well
        dummyIPiece.y = 2;
        this.dummyBoards = [
          this.createSingleDummyBoard({
            presetRows: dummyWell,
            activePiece: dummyIPiece,
            previewQueue: ['T', 'L', 'O', 'J', 'S'],
            statusBadge: '⚠ DROPPING FINAL I-PIECE!',
          }),
        ];
      } else if (step === 'STEP_4_ULTIMATE') {
        // Step 4 (Ultimate / AoE): 3-Dummy Lobby + [R] Chaos Mode reverses controls for 8s & resets Grid Shift
        this.classMeter = 35;
        this.gridShiftUsed = true;
        this.qStatusText = 'READY';
        this.eStatusText = 'USED (1/MATCH)';
        this.rStatusText = 'READY (35/35)';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['J', 'J', 'J', null, 'O', 'O', 'T', 'T', 'T', null],
          ['L', 'L', 'L', 'S', 'O', 'O', 'Z', 'Z', 'T', null],
        ]);
        this.currentPiece = null;
        this.initThreeDummyLobby();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. SUPPORT CERTIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    else if (this.activeClass === 'SUPPORT') {
      if (step === 'STEP_1_PASSIVE_TETRIS') {
        // Support Step 1 & 2: Spawn onto 18 lines of raw garbage -> Press [Q] Recycle -> Convert top 4 garbage into Special Blocks & clear!
        this.classMeter = 15;
        this.qStatusText = 'READY';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '15 / 45 LINES';
        this.grid = new Grid();
        this.grid.addGarbageLines(14, 'HARD');
        // Top row of stack has 6 garbage blocks + 4 empty cells on the right so once converted, an I-piece clears it!
        const topGarbageRow = ROWS - 14;
        for (let c = 0; c < COLS; c++) {
          this.grid.matrix[topGarbageRow][c] = c < 6 ? { type: 'GARBAGE' } : { type: null };
        }
        this.currentPiece = null; // Unlocks after [Q] Recycle converts the garbage into Special Blocks
        this.queue = ['I', 'O', 'T', 'L'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'CRITICAL GARBAGE PRESSURE' })];
      } else if (step === 'STEP_1_PASSIVE_SPECIAL') {
        // Support Passive Drill: Clear a 4-line Tetris -> arms supportPassiveConversion -> incoming garbage becomes Special Blocks
        this.classMeter = 25;
        this.qStatusText = 'COOLDOWN';
        this.eStatusText = 'LOCKED';
        this.rStatusText = '25 / 45 LINES';
        this.loadStandardTetrisWellOnPlayerBoard();
        this.currentPiece = new Tetromino('I');
        this.queue = ['I', 'T', 'O', 'L'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'PASSIVE DRILL · TETRIS CONVERSION' })];
      } else if (step === 'STEP_3_ABILITY') {
        // Support Step 3 (Item Generation): [E] Gold Drop -> Next Tetromino made of 4 unique Special Item Blocks
        this.classMeter = 35;
        this.qStatusText = 'COOLDOWN';
        this.eStatusText = 'READY';
        this.rStatusText = '35 / 45 LINES';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['I', 'I', 'I', 'I', 'O', 'O', null, null, null, null],
          ['J', 'J', 'J', 'L', 'L', 'L', 'O', 'O', 'T', null],
        ]);
        this.currentPiece = null; // Spawns 4-item Gold Drop I-piece once [E] Gold Drop is activated
        this.queue = ['I', 'O', 'T', 'L'];
        this.dummyBoards = [this.createSingleDummyBoard({ statusBadge: 'GOLD DROP DRILL · 4 UNIQUE ITEMS' })];
      } else if (step === 'STEP_4_ULTIMATE') {
        // Support Step 4 (Ultimate / The Rescue): Ally Dummy Board spawns 18 lines high -> Target Ally & press [R] Guardian Angel!
        this.classMeter = 45;
        this.qStatusText = 'READY';
        this.eStatusText = 'COOLDOWN';
        this.rStatusText = 'READY (45/45)';
        this.grid = new Grid();
        this.grid.loadPresetMatrix([
          ['O', 'O', null, 'T', 'T', 'T', null, 'L', 'L', 'L'],
          ['O', 'O', 'J', 'J', 'J', 'S', 'S', 'L', 'Z', 'Z'],
        ]);
        this.currentPiece = null;

        const allyBoard = this.createSingleDummyBoard({
          isAlly: true,
          statusBadge: '⚠ ALLY TOPPING OUT (18 LINES)!',
        });
        allyBoard.grid = new Grid();
        allyBoard.grid.addGarbageLines(18, 'HARD');
        this.dummyBoards = [allyBoard];
      }
    }

    this.updateClassAbilityHud();
    this.updateStage2InstructionUi();
    this.render();
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
        previewQueue: ['I', 'O', 'L', 'Z', 'S'],
        statusBadge: 'ACTIVE',
        statusColor: '#9CA3AF',
        frozenTimer: 0,
        chaosTimer: 0,
        abilityFreezeTimer: 0,
        sprintTimer: 0,
      };
    };

    this.dummyBoards = [
      createMini('DUMMY-ALPHA', 'DUMMY ALPHA', presetA),
      createMini('DUMMY-BETA', 'DUMMY BETA', presetB),
      createMini('DUMMY-GAMMA', 'DUMMY GAMMA', presetC),
    ];
  }

  private updateClassAbilityHud() {
    const info = this.getActiveClassInfo();

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

    const titleEl = document.getElementById('tut-stage2-title');
    if (titleEl) titleEl.textContent = `${info.name} Certification`;

    const activeClassBadge = document.getElementById('tut-active-class-badge');
    if (activeClassBadge) {
      activeClassBadge.textContent = info.name.toUpperCase();
      activeClassBadge.style.color = this.getActiveClassAccent();
    }

    const certPill = document.getElementById('tut-cert-progress-pill');
    if (certPill) {
      certPill.textContent = `${getCertifiedClasses().length} / 4 CERTIFIED`;
    }

    const isAllyStep = this.activeClass === 'SUPPORT' && this.certStep === 'STEP_4_ULTIMATE';
    const isMultiDummy =
      (this.certStep === 'STEP_4_ULTIMATE' || this.certStep === 'STEP_4_BULLET_TIME_TETRIS') &&
      this.activeClass !== 'SUPPORT';

    const targetLockBadge = document.getElementById('tut-target-lock-badge');
    if (targetLockBadge) {
      targetLockBadge.textContent = isMultiDummy
        ? 'TARGET: ALL 3 DUMMIES [AoE]'
        : isAllyStep
          ? 'TARGET: ALLY BOARD [LOCKED]'
          : 'TARGET: DUMMY [LOCKED]';
      targetLockBadge.className = isAllyStep
        ? 'font-bold text-neon-green uppercase tracking-wider'
        : 'font-bold text-neon-pink uppercase tracking-wider';
    }

    // Update Single Dummy Card styling (Opponent vs Ally)
    const dummyHeaderLabel = document.getElementById('tut-dummy-header-label');
    const dummyTargetTag = document.getElementById('tut-dummy-target-tag');
    const dummyPreviewItems = document.getElementById('tut-dummy-preview-items');
    if (this.dummyBoards[0]) {
      if (dummyHeaderLabel) {
        dummyHeaderLabel.textContent = this.dummyBoards[0].label;
        dummyHeaderLabel.className = this.dummyBoards[0].isAlly
          ? 'text-[10px] font-bold tracking-widest uppercase text-neon-green'
          : 'text-[10px] font-bold tracking-widest uppercase text-neon-pink';
      }
      if (dummyTargetTag) {
        dummyTargetTag.textContent = this.dummyBoards[0].isAlly ? '◎ ALLY LOCKED' : '◎ TARGET LOCKED';
      }
      if (dummyPreviewItems) {
        dummyPreviewItems.textContent = this.dummyBoards[0].previewQueue.join(' · ');
      }
    }
  }

  private showStage2Banner(message: string, color: 'cyan' | 'green' | 'pink' | 'yellow' = 'cyan') {
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
    const banner = document.getElementById('tut-restart-banner');
    banner?.classList.add('hidden');
  }

  private getStepNumber(): number {
    if (this.certStep === 'STEP_1_PASSIVE_TETRIS' || this.certStep === 'STEP_1_PASSIVE_SPECIAL') return 1;
    if (this.certStep === 'STEP_2_ABILITY') return 2;
    if (this.certStep === 'STEP_3_ABILITY') return 3;
    return 4;
  }

  private updateStage2InstructionUi() {
    const stepCounter = document.getElementById('tut-step-counter');
    const blockBadge = document.getElementById('tut-block-badge');
    const list = document.getElementById('tut-instructions-list');
    const dots = document.getElementById('tut-progress-dots');
    const dummyStatusLine = document.getElementById('tut-dummy-status-line');
    if (!stepCounter || !blockBadge || !list || !dots) return;

    const activeStepNum = this.getStepNumber();
    stepCounter.textContent = `Step ${activeStepNum} / 4`;

    Array.from(dots.children).forEach((dot, idx) => {
      const num = idx + 1;
      dot.className =
        num < activeStepNum || this.certStep === 'CERT_COMPLETED'
          ? 'h-1.5 rounded-full bg-neon-green shadow-[0_0_8px_rgba(0,255,102,0.6)]'
          : num === activeStepNum
            ? 'h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.6)]'
            : 'h-1.5 rounded-full bg-gray-700';
    });

    if (dummyStatusLine && this.dummyBoards[0]) {
      dummyStatusLine.textContent = this.dummyBoards[0].statusBadge ?? 'INPUT: NULL · TARGET LOCKED';
      dummyStatusLine.style.color = this.dummyBoards[0].statusColor;
    }

    // ─── SPEEDSTER INSTRUCTIONS ───
    if (this.activeClass === 'SPEEDSTER') {
      if (this.certStep === 'STEP_1_PASSIVE_TETRIS') {
        blockBadge.textContent = 'STEP 1A · PASSIVES DRILL (TETRIS TRIGGER)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear a 4-Line Tetris in Column 10</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Rotate the <strong class="text-neon-cyan">I-Piece</strong> with <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↑</kbd>, move it into the open right-hand well (<kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">→</kbd>), and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd>.
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_1_PASSIVE_SPECIAL') {
        blockBadge.textContent = 'STEP 1B · FORCED SPEED BLOCK [V]';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-green bg-neon-green/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear the Line Containing Your Speed Block [V]</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Your Tetris guaranteed a <strong class="text-neon-yellow">Speed Block (V)</strong> on this piece! Slide it right into Columns 7–10 and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd> to slow your block drop speed by 50% for 5 seconds.
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_2_ABILITY') {
        blockBadge.textContent = 'STEP 2 · SURVIVAL / THE CLUTCH ([E] TIME WARP)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Crisis: Unmanageable Gravity Speed!</div>
            <div class="text-[11px] text-gray-200">Dynamic Gravity is accelerated to instant-drop speed.</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-yellow bg-neon-yellow/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">
              ${this.timeWarpActive ? '✓ Time Warp Active! Now Clear the Bottom Line' : 'Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Time Warp)'}
            </div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              ${this.timeWarpActive
                ? 'Drop speed is cut by 50% for 6 seconds! Slide the horizontal I-piece into the right-hand gap and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd>.'
                : 'Cuts drop speed by 50% for 6 seconds so you can safely place the I-piece.'}
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_3_ABILITY') {
        blockBadge.textContent = 'STEP 3 · OFFENSE ([Q] SPRINT)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[10px]">Q</kbd> (Sprint)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Weaponize tempo! Forces the <strong class="text-neon-pink">Dummy Opponent's</strong> current piece and next 3 pieces to slam down <strong>50% faster</strong>.
            </div>
          </div>
        `;
      } else {
        blockBadge.textContent = 'STEP 4 · ULTIMATE / AoE ([R] BULLET TIME)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">
              ${this.certStep === 'STEP_4_BULLET_TIME_TETRIS' ? '✓ Dummies Frozen! Score Your Free Tetris!' : '1. Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-pink rounded text-neon-pink font-pixel text-[10px]">R</kbd> (Bullet Time)'}
            </div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              ${this.certStep === 'STEP_4_BULLET_TIME_TETRIS'
                ? 'All 3 Dummy Boards are frozen solid for 5 seconds! Rotate your I-piece and drop it into Column 10 to score a free Tetris!'
                : 'Freezes all 3 Dummy Boards completely for 5 seconds while you score a free Tetris.'}
            </div>
          </div>
        `;
      }
    }

    // ─── SENTINEL (TANK) INSTRUCTIONS ───
    else if (this.activeClass === 'TANK') {
      if (this.certStep === 'STEP_1_PASSIVE_TETRIS') {
        blockBadge.textContent = 'STEP 1A · PASSIVES DRILL (TETRIS TRIGGER)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear a 4-Line Tetris in Column 10</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Rotate the <strong class="text-neon-cyan">I-Piece</strong> (<kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↑</kbd>), move it right into Column 10, and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd>.
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_1_PASSIVE_SPECIAL') {
        blockBadge.textContent = 'STEP 1B · FORCED SHIELD BLOCK [S]';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-green bg-neon-green/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear the Line Containing Your Shield Block [S]</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Your Tetris guaranteed a <strong class="text-neon-yellow">Shield Block (S)</strong>! Slide the I-piece into the right-hand gap and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd> to absorb an incoming garbage attack.
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_2_ABILITY') {
        blockBadge.textContent = 'STEP 2 · SURVIVAL / THE DEFENSE ([Q] FORTIFY)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Crisis: 10-Line Lethal Garbage Attack Queued!</div>
            <div class="text-[11px] text-gray-200">Your grid is frozen and 2 garbage salvos (10 lines) are queued via CQRS.</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[10px]">Q</kbd> (Fortify)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Grants <strong>2 FSM immunity charges</strong>, completely blocking the lethal incoming garbage!
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_3_ABILITY') {
        blockBadge.textContent = 'STEP 3 · OFFENSE ([E] COUNTER STRIKE)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Subsequent 10-Line Attack Incoming!</div>
            <div class="text-[11px] text-gray-200">Fortify is on cooldown — turn defense into offense!</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-yellow bg-neon-yellow/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Counter Strike)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Intercepts the garbage, arms your reflector, and bounces all 10 lines directly back onto the <strong class="text-neon-pink">Dummy Opponent</strong>!
            </div>
          </div>
        `;
      } else {
        blockBadge.textContent = 'STEP 4 · ULTIMATE / AoE ([R] EARTHQUAKE)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-pink rounded text-neon-pink font-pixel text-[10px]">R</kbd> (Earthquake)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Drops <strong>4 raw lines of garbage</strong> onto all 3 miniature Dummy Boards simultaneously!
            </div>
          </div>
        `;
      }
    }

    // ─── SABOTEUR INSTRUCTIONS ───
    else if (this.activeClass === 'SABOTEUR') {
      if (this.certStep === 'STEP_1_PASSIVE_TETRIS') {
        blockBadge.textContent = 'STEP 1A · PASSIVES DRILL (TETRIS TRIGGER)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear a 4-Line Tetris in Column 10</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Rotate the <strong class="text-neon-cyan">I-Piece</strong> (<kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↑</kbd>), move it right into Column 10, and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd>.
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_1_PASSIVE_SPECIAL') {
        blockBadge.textContent = 'STEP 1B · FORCED FREEZE BLOCK [F]';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-green bg-neon-green/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear the Line Containing Your Freeze Block [F]</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Your Tetris guaranteed a <strong class="text-neon-yellow">Freeze Block (F)</strong>! Clear the bottom row to lock the Dummy's UI abilities for 3 seconds.
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_2_ABILITY') {
        blockBadge.textContent = 'STEP 2 · INTERCEPTION ([Q] SCRAMBLE)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Dummy Has "I" Pieces Queued for a Tetris!</div>
            <div class="text-[11px] text-gray-200">Check the Dummy's QUEUE strip above their board: <code>I · I · I · I · I</code>.</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[10px]">Q</kbd> (Scramble)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Shuffles the Dummy's next 5 upcoming pieces into awkward shapes, ruining their planned Tetris!
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_3_ABILITY') {
        blockBadge.textContent = 'STEP 3 · OFFENSE / DISRUPTION ([E] GRID SHIFT)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Dummy Is Dropping Their Final I-Piece!</div>
            <div class="text-[11px] text-gray-200">The Dummy set up a new 4-line well in Column 10 and is about to score.</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-yellow bg-neon-yellow/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Grid Shift)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Physically shifts the Dummy's 2D grid <strong>2 columns over</strong>, misaligning their stack!
            </div>
          </div>
        `;
      } else {
        blockBadge.textContent = 'STEP 4 · ULTIMATE / AoE ([R] CHAOS MODE)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-pink rounded text-neon-pink font-pixel text-[10px]">R</kbd> (Chaos Mode)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Reverses all 3 Dummy Boards' piece rotations &amp; movements for <strong>8 seconds</strong> AND resets your once-per-match <strong class="text-neon-yellow">[E] Grid Shift</strong>!
            </div>
          </div>
        `;
      }
    }

    // ─── SUPPORT INSTRUCTIONS ───
    else if (this.activeClass === 'SUPPORT') {
      if (this.certStep === 'STEP_1_PASSIVE_TETRIS') {
        blockBadge.textContent = 'STEP 1 · SURVIVAL & CONVERSION ([Q] RECYCLE)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Critical Danger: Raw Garbage Stack!</div>
            <div class="text-[11px] text-gray-200">Your board is buried under raw grey garbage lines.</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">
              ${this.recycleConvertedReady ? '✓ Converted! Drop I-Piece into Right Gap' : '1. Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-cyan rounded text-neon-cyan font-pixel text-[10px]">Q</kbd> (Recycle)'}
            </div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              ${this.recycleConvertedReady
                ? 'The top garbage blocks transformed into usable Special Blocks (B, W, X, G)! Slide the I-piece right and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd> to detonate them!'
                : 'Instantly converts 4 garbage blocks into usable Special Blocks (Bombs, Multipliers, Heavy, Garbage Eater).'}
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_1_PASSIVE_SPECIAL') {
        blockBadge.textContent = 'STEP 2 · PASSIVE DRILL (TETRIS CONVERSION)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-green bg-neon-green/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Clear a 4-Line Tetris in Column 10</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Rotate the <strong class="text-neon-cyan">I-Piece</strong> (<kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">↑</kbd>) and drop it in Column 10. Clearing a Tetris arms Support's Passive to automatically convert the next incoming garbage attack into Special Blocks!
            </div>
          </div>
        `;
      } else if (this.certStep === 'STEP_3_ABILITY') {
        blockBadge.textContent = 'STEP 3 · ITEM GENERATION ([E] GOLD DROP)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-yellow bg-neon-yellow/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">
              ${this.goldDropActive ? '✓ Gold Drop Piece Spawned! Clear the Line!' : '1. Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-yellow rounded text-neon-yellow font-pixel text-[10px]">E</kbd> (Gold Drop)'}
            </div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              ${this.goldDropActive
                ? 'Every block of your I-piece is a different Special Item (<strong class="text-neon-yellow">B, W, X, S</strong>)! Slide it into Columns 7–10 and press <kbd class="px-1.5 py-0.5 bg-black/60 border border-neon-cyan/50 rounded text-neon-cyan font-pixel text-[9px]">SPACE</kbd> to trigger all 4 effects at once!'
                : 'Makes your next Tetromino entirely comprised of <strong>4 different Special Item Blocks</strong> (25s cooldown).'}
            </div>
          </div>
        `;
      } else {
        blockBadge.textContent = 'STEP 4 · ULTIMATE / THE RESCUE ([R] GUARDIAN ANGEL)';
        list.innerHTML = `
          <div class="p-3 rounded-lg border border-neon-pink bg-neon-pink/15 flex flex-col gap-1">
            <div class="text-xs font-bold text-neon-pink uppercase">⚠ Ally Board Is 1 Block From Topping Out!</div>
            <div class="text-[11px] text-gray-200">Your Ally Dummy Board on the right is buried at 18 lines.</div>
          </div>
          <div class="p-3 rounded-lg border border-neon-green bg-neon-green/10 flex flex-col gap-1.5">
            <div class="text-xs font-bold text-white">Press <kbd class="px-2 py-0.5 bg-black/60 border border-neon-green rounded text-neon-green font-pixel text-[10px]">R</kbd> (Guardian Angel)</div>
            <div class="text-[11px] text-gray-300 leading-relaxed">
              Instantly clears the <strong class="text-neon-green">Ally Board's bottom 4 lines</strong>, saving your teammate from elimination!
            </div>
          </div>
        `;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2 INPUT & eFSM GUARD ENGINE
  // ─────────────────────────────────────────────────────────────────────────

  private handleStage2KeyDown(e: KeyboardEvent) {
    if (!this.isRunning || this.stage2TransitionLocked || this.eFsmState !== GameState.TUTORIAL) return;

    const key = e.key;

    if (key === 'Tab') {
      e.preventDefault();
      this.selectedTargetIndex = 1;
      this.showStage2Banner('◎ Targeting pointer is locked onto the active Dummy Board during Certification.', 'cyan');
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. SPEEDSTER ABILITY GUARDS
    // ═══════════════════════════════════════════════════════════════════════
    if (this.activeClass === 'SPEEDSTER') {
      if (this.certStep === 'STEP_2_ABILITY' && !this.timeWarpActive) {
        e.preventDefault();
        if (key === 'e' || key === 'E') {
          this.timeWarpActive = true;
          this.timeWarpTimer = 6000;
          this.dropInterval = 750;
          this.eStatusText = 'ACTIVE (6.0s)';
          this.currentPiece = new Tetromino('I');
          this.dropTimer = 0;
          this.lockTimer = 0;
          this.showStage2Banner('✓ TIME WARP ACTIVE! Drop speed cut by 50% — now slide the I-piece right and clear the line!', 'cyan');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
        } else {
          this.showStage2Banner('eFSM Guard: Gravity is unmanageable! Press [E] Time Warp first to slow drop speed by 50%!', 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_3_ABILITY') {
        e.preventDefault();
        if (key === 'q' || key === 'Q') {
          this.qStatusText = 'ACTIVE!';
          const dummy = this.dummyBoards[0];
          if (dummy) {
            dummy.sprintTimer = 4000;
            dummy.statusBadge = '⚡ SPRINTED! 4 PIECES SLAMMING +50% FASTER!';
            dummy.statusColor = '#FFD700';
            // Visually slam 3 pieces rapidly onto the dummy board
            if (dummy.activePiece) {
              while (!dummy.grid.checkCollision(dummy.activePiece, dummy.activePiece.x, dummy.activePiece.y + 1)) {
                dummy.activePiece.y++;
              }
              dummy.grid.lockTetromino(dummy.activePiece);
              dummy.activePiece = new Tetromino('O');
              dummy.activePiece.x = 1;
              dummy.activePiece.y = 14;
            }
          }
          AudioManager.playSfx('lineClear');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner("✓ SPRINT ACTIVATED! Dummy's current & next 3 pieces forced to drop 50% faster!", 'green');
          setTimeout(() => {
            this.setupCertStep('STEP_4_ULTIMATE');
          }, 2100);
        } else {
          this.showStage2Banner('eFSM Guard: Press [Q] to activate Sprint on the Dummy Opponent!', 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_4_ULTIMATE') {
        e.preventDefault();
        if (key === 'r' || key === 'R' || key === 'Shift') {
          AudioManager.playSfx('freeze');
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
          this.setupCertStep('STEP_4_BULLET_TIME_TETRIS');
          this.showStage2Banner('✓ BULLET TIME! All 3 Dummies are frozen for 5s — now drop your I-piece in Column 10 for a free Tetris!', 'cyan');
        } else {
          this.showStage2Banner('eFSM Guard: Press [R] to activate Bullet Time and freeze all 3 Dummy Boards!', 'pink');
        }
        return;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. SENTINEL (TANK) ABILITY GUARDS
    // ═══════════════════════════════════════════════════════════════════════
    if (this.activeClass === 'TANK') {
      if (this.certStep === 'STEP_2_ABILITY') {
        e.preventDefault();
        if (key === 'q' || key === 'Q') {
          this.fortifyCharges = 2;
          this.incomingGarbageQueue = 0;
          this.qStatusText = '2 CHARGES USED';
          if (this.dummyBoards[0]) {
            this.dummyBoards[0].statusBadge = '10-LINE ATTACK BLOCKED BY FORTIFY!';
            this.dummyBoards[0].statusColor = '#00FF66';
          }
          AudioManager.playSfx('lineClear');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner('✓ FORTIFY! Gained 2 FSM immunity charges and blocked all 10 incoming garbage lines!', 'green');
          setTimeout(() => {
            this.setupCertStep('STEP_3_ABILITY');
          }, 2100);
        } else {
          this.showStage2Banner('eFSM Guard: Press [Q] Fortify to gain 2 immunity charges and block the 10-line attack!', 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_3_ABILITY') {
        e.preventDefault();
        if (key === 'e' || key === 'E') {
          this.reflectArmed = true;
          const bounced = this.incomingGarbageQueue;
          this.incomingGarbageQueue = 0;
          this.eStatusText = 'REFLECTED!';
          if (this.dummyBoards[0]) {
            this.dummyBoards[0].grid.addGarbageLines(bounced, 'HUMAN');
            this.dummyBoards[0].statusBadge = `💥 HIT BY ${bounced} REFLECTED LINES!`;
            this.dummyBoards[0].statusColor = '#FF1493';
          }
          AudioManager.playSfx('lineClear');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner('✓ COUNTER STRIKE! Intercepted and bounced all 10 garbage lines back onto the Dummy!', 'green');
          setTimeout(() => {
            this.setupCertStep('STEP_4_ULTIMATE');
          }, 2100);
        } else {
          this.showStage2Banner('eFSM Guard: Press [E] Counter Strike to reflect the incoming garbage attack!', 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_4_ULTIMATE') {
        e.preventDefault();
        if (key === 'r' || key === 'R' || key === 'Shift') {
          AudioManager.playSfx('ultimate');
          this.classMeter = 0;
          this.rStatusText = 'UNLEASHED!';
          this.dummyBoards.forEach((d, idx) => {
            d.grid.addGarbageLines(4, 'HUMAN');
            d.statusBadge = '💥 +4 GARBAGE LINES';
            d.statusColor = '#FFD700';
            const el = document.getElementById(`tut-dummy-mini-status-${idx}`);
            if (el) {
              el.textContent = '💥 +4 GARBAGE LINES!';
              el.className = 'text-[8px] font-bold text-neon-yellow uppercase';
            }
          });
          this.updateClassAbilityHud();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner('✓ EARTHQUAKE! Dropped +4 raw garbage lines onto all 3 Dummy Boards simultaneously!', 'green');
          this.completeCurrentClassCertification();
        } else {
          this.showStage2Banner('eFSM Guard: Press [R] to trigger Earthquake across all 3 Dummy Boards!', 'pink');
        }
        return;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. SABOTEUR ABILITY GUARDS
    // ═══════════════════════════════════════════════════════════════════════
    if (this.activeClass === 'SABOTEUR') {
      if (this.certStep === 'STEP_2_ABILITY') {
        e.preventDefault();
        if (key === 'q' || key === 'Q') {
          this.qStatusText = 'SCRAMBLED!';
          const dummy = this.dummyBoards[0];
          if (dummy) {
            dummy.previewQueue = ['Z', 'S', 'J', 'Z', 'S'];
            dummy.statusBadge = '🌀 QUEUE SCRAMBLED: Z · S · J · Z · S!';
            dummy.statusColor = '#00FF66';
          }
          AudioManager.playSfx('lineClear');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner("✓ SCRAMBLE! Shuffled the Dummy's next 5 pieces — their I-piece clear is ruined!", 'green');
          setTimeout(() => {
            this.setupCertStep('STEP_3_ABILITY');
          }, 2100);
        } else {
          this.showStage2Banner("eFSM Guard: Press [Q] Scramble to shuffle the Dummy's upcoming I-piece queue!", 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_3_ABILITY') {
        e.preventDefault();
        if (key === 'e' || key === 'E') {
          this.gridShiftUsed = true;
          this.eStatusText = 'USED (1/MATCH)';
          const dummy = this.dummyBoards[0];
          if (dummy) {
            dummy.grid.shiftHorizontally(2);
            if (dummy.activePiece) {
              while (!dummy.grid.checkCollision(dummy.activePiece, dummy.activePiece.x, dummy.activePiece.y + 1)) {
                dummy.activePiece.y++;
              }
              dummy.grid.lockTetromino(dummy.activePiece);
              dummy.activePiece = null;
            }
            dummy.statusBadge = '⇄ SHIFTED +2 COLS · STACK MISALIGNED!';
            dummy.statusColor = '#00FF66';
          }
          AudioManager.playSfx('lineClear');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner("✓ GRID SHIFT! Shifted the Dummy's 2D array by 2 columns and forced a misdrop!", 'green');
          setTimeout(() => {
            this.setupCertStep('STEP_4_ULTIMATE');
          }, 2100);
        } else {
          this.showStage2Banner("eFSM Guard: Press [E] Grid Shift to misalign the Dummy's Tetris well!", 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_4_ULTIMATE') {
        e.preventDefault();
        if (key === 'r' || key === 'R' || key === 'Shift') {
          AudioManager.playSfx('ultimate');
          this.classMeter = 0;
          this.gridShiftUsed = false;
          this.eStatusText = 'RESET & READY!';
          this.rStatusText = 'CHAOS (8.0s)';
          this.dummyBoards.forEach((d, idx) => {
            d.chaosTimer = 8000;
            d.grid.shiftHorizontally(idx % 2 === 0 ? 1 : -1);
            if (d.activePiece) {
              d.activePiece.rotate(-1);
              d.activePiece.x = Math.max(0, Math.min(6, d.activePiece.x + (idx % 2 === 0 ? -2 : 2)));
            }
            d.statusBadge = '🌀 CONTROLS REVERSED (8.0s)';
            d.statusColor = '#FF1493';
            const el = document.getElementById(`tut-dummy-mini-status-${idx}`);
            if (el) {
              el.textContent = '🌀 REVERSED 8.0s!';
              el.className = 'text-[8px] font-bold text-neon-pink uppercase';
            }
          });
          this.updateClassAbilityHud();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner('✓ CHAOS MODE! All 3 Dummies reversed for 8s & [E] Grid Shift reset!', 'green');
          this.completeCurrentClassCertification();
        } else {
          this.showStage2Banner('eFSM Guard: Press [R] to unleash Chaos Mode across all 3 Dummy Boards!', 'pink');
        }
        return;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. SUPPORT ABILITY GUARDS
    // ═══════════════════════════════════════════════════════════════════════
    if (this.activeClass === 'SUPPORT') {
      if (this.certStep === 'STEP_1_PASSIVE_TETRIS' && !this.recycleConvertedReady) {
        e.preventDefault();
        if (key === 'q' || key === 'Q') {
          this.recycleConvertedReady = true;
          this.qStatusText = 'CONVERTED!';
          // Convert the top garbage row's cells into Bomb / Heavy / Garbage Eater / Multiplier Special Blocks!
          const topGarbageRow = ROWS - 14;
          const specials = [SpecialBlockType.BOMB, SpecialBlockType.HEAVY, SpecialBlockType.MULTIPLIER, SpecialBlockType.GARBAGE_EATER];
          for (let c = 0; c < 6; c++) {
            this.grid.matrix[topGarbageRow][c] = {
              type: 'I',
              special: specials[c % specials.length],
            };
          }
          this.currentPiece = new Tetromino('I');
          this.dropTimer = 0;
          this.lockTimer = 0;
          AudioManager.playSfx('lineClear');
          this.showStage2Banner('✓ RECYCLE! Top garbage converted into Special Blocks — now drop the I-piece in Columns 7–10!', 'cyan');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
        } else {
          this.showStage2Banner('eFSM Guard: Press [Q] Recycle first to convert the top garbage row into Special Blocks!', 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_3_ABILITY' && !this.goldDropActive) {
        e.preventDefault();
        if (key === 'e' || key === 'E') {
          this.goldDropActive = true;
          this.eStatusText = 'GOLD DROP!';
          const goldPiece = new Tetromino('I');
          // Assign 4 unique Special Item Blocks to all 4 cells of the I-piece (row 1, cols 0..3)
          goldPiece.specialBlocks.set('1,0', SpecialBlockType.BOMB);
          goldPiece.specialBlocks.set('1,1', SpecialBlockType.HEAVY);
          goldPiece.specialBlocks.set('1,2', SpecialBlockType.MULTIPLIER);
          goldPiece.specialBlocks.set('1,3', SpecialBlockType.SHIELD);
          this.currentPiece = goldPiece;
          this.dropTimer = 0;
          this.lockTimer = 0;
          AudioManager.playSfx('lineClear');
          this.showStage2Banner('✓ GOLD DROP! All 4 blocks of your I-piece are unique Special Items (B, W, X, S)! Drop it into Columns 7–10!', 'cyan');
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
        } else {
          this.showStage2Banner('eFSM Guard: Press [E] Gold Drop first to infuse your next Tetromino with 4 unique Special Item Blocks!', 'pink');
        }
        return;
      }

      if (this.certStep === 'STEP_4_ULTIMATE') {
        e.preventDefault();
        if (key === 'r' || key === 'R' || key === 'Shift') {
          AudioManager.playSfx('ultimate');
          this.classMeter = 0;
          this.rStatusText = 'ALLY SAVED!';
          const ally = this.dummyBoards[0];
          if (ally) {
            ally.grid.clearBottomLines(4);
            ally.statusBadge = '✓ RESCUED! -4 BOTTOM LINES CLEARED!';
            ally.statusColor = '#00FF66';
          }
          this.updateClassAbilityHud();
          this.updateStage2InstructionUi();
          this.render();
          this.stage2TransitionLocked = true;
          this.showStage2Banner("✓ GUARDIAN ANGEL! Instantly cleared your Ally's bottom 4 lines to save them from top-out!", 'green');
          this.completeCurrentClassCertification();
        } else {
          this.showStage2Banner('eFSM Guard: Press [R] Guardian Angel to clear the endangered Ally Board!', 'pink');
        }
        return;
      }
    }

    // ─── PIECE MOVEMENT CONTROLS FOR ACTIVE PIECE STEPS ───
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
        this.showStage2Banner('Complete the current block placement task first!', 'yellow');
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

    // ─── SUPPORT STEP 1 (RECYCLE LINE CLEAR) ───
    if (this.activeClass === 'SUPPORT' && this.certStep === 'STEP_1_PASSIVE_TETRIS') {
      if (linesCleared >= 1) {
        // Trigger Garbage Eater / Heavy / Bomb cleanup so the player sees the stack drop!
        this.grid.clearBottomLines(3);
        AudioManager.playSfx('lineClear');
        this.updateHudStats(600, 4);
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ CONVERTED SPECIAL BLOCKS TRIGGERED! Garbage crushed & board stabilized!', 'green');
        setTimeout(() => {
          this.setupCertStep('STEP_1_PASSIVE_SPECIAL');
        }, 1900);
      } else {
        this.setupCertStep('STEP_1_PASSIVE_TETRIS');
        this.showStage2Banner('Press [Q] Recycle and drop the horizontal I-piece into Columns 7–10!', 'pink');
      }
      return;
    }

    // ─── SUPPORT STEP 2 (TETRIS PASSIVE CONVERSION) ───
    if (this.activeClass === 'SUPPORT' && this.certStep === 'STEP_1_PASSIVE_SPECIAL') {
      if (linesCleared >= 4) {
        AudioManager.playSfx('lineClear');
        // Demonstrate incoming 3-line garbage attack automatically converting into Special Blocks!
        this.grid.addGarbageLines(3, 'HUMAN');
        this.grid.convertGarbageToSpecialBlocks(12);
        this.updateHudStats(1400, 8);
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ TETRIS PASSIVE! Incoming garbage lines automatically converted into Special Blocks!', 'green');
        setTimeout(() => {
          this.setupCertStep('STEP_3_ABILITY');
        }, 2100);
      } else {
        this.setupCertStep('STEP_1_PASSIVE_SPECIAL');
        this.showStage2Banner('Rotate the I-piece and drop it into Column 10 to clear the 4-line Tetris!', 'pink');
      }
      return;
    }

    // ─── SUPPORT STEP 3 (GOLD DROP) ───
    if (this.activeClass === 'SUPPORT' && this.certStep === 'STEP_3_ABILITY') {
      if (this.goldDropActive && linesCleared >= 1) {
        this.grid.clearBottomLines(1);
        AudioManager.playSfx('lineClear');
        this.classMeter = 45;
        this.rStatusText = 'READY (45/45)';
        this.updateHudStats(2600, 12);
        this.updateClassAbilityHud();
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ GOLD DROP CLEARED! Triggered all 4 unique Special Item Blocks (Bomb, Heavy, Multiplier, Shield) at once!', 'green');
        setTimeout(() => {
          this.setupCertStep('STEP_4_ULTIMATE');
        }, 2100);
      } else {
        this.setupCertStep('STEP_3_ABILITY');
        this.showStage2Banner('Press [E] Gold Drop first, then slide the 4-item I-piece into Columns 7–10!', 'pink');
      }
      return;
    }

    // ─── STEP 1A: PASSIVES DRILL (TETRIS TRIGGER FOR SPEEDSTER, SENTINEL, SABOTEUR) ───
    if (this.certStep === 'STEP_1_PASSIVE_TETRIS') {
      if (linesCleared >= 4) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(800, 4);
        this.stage2TransitionLocked = true;
        const blockLabel =
          this.activeClass === 'SPEEDSTER'
            ? 'Speed Block [V]'
            : this.activeClass === 'TANK'
              ? 'Shield Block [S]'
              : 'Freeze Block [F]';
        this.showStage2Banner(`✓ TETRIS CLEARED! Passive triggered — ${blockLabel} forced onto your next piece!`, 'green');
        setTimeout(() => {
          this.setupCertStep('STEP_1_PASSIVE_SPECIAL');
        }, 1700);
      } else {
        this.showStage2Banner('Missed the Column 10 well! Rotate the I-piece and drop it in the open right column.', 'pink');
        setTimeout(() => {
          this.setupCertStep('STEP_1_PASSIVE_TETRIS');
        }, 1100);
      }
      return;
    }

    // ─── STEP 1B: FORCED SPECIAL BLOCK CLEAR (SPEEDSTER, SENTINEL, SABOTEUR) ───
    if (this.certStep === 'STEP_1_PASSIVE_SPECIAL') {
      if (linesCleared >= 1 && specialBlocksToTrigger.length > 0) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(1200, 5);
        this.stage2TransitionLocked = true;

        if (this.activeClass === 'SPEEDSTER') {
          this.showStage2Banner('✓ SPEED BLOCK [V] TRIGGERED! Block drop speed slowed by 50% for 5 seconds!', 'green');
        } else if (this.activeClass === 'TANK') {
          AudioManager.playSfx('shield');
          if (this.dummyBoards[0]) {
            this.dummyBoards[0].statusBadge = '🛡 ATTACK ABSORBED BY SHIELD BLOCK!';
            this.dummyBoards[0].statusColor = '#00FF66';
          }
          this.showStage2Banner('✓ SHIELD BLOCK [S] TRIGGERED! Absorbed the Dummy’s incoming garbage attack!', 'green');
        } else if (this.activeClass === 'SABOTEUR') {
          AudioManager.playSfx('freeze');
          if (this.dummyBoards[0]) {
            this.dummyBoards[0].abilityFreezeTimer = 3000;
            this.dummyBoards[0].statusBadge = '❄ ABILITIES LOCKED FOR 3.0s!';
            this.dummyBoards[0].statusColor = '#00E5FF';
          }
          this.showStage2Banner("✓ FREEZE BLOCK [F] TRIGGERED! Locked the Dummy's UI abilities for 3 seconds!", 'green');
        }

        setTimeout(() => {
          this.setupCertStep('STEP_2_ABILITY');
        }, 2000);
      } else {
        this.showStage2Banner('Slide the horizontal I-piece into Columns 7–10 to clear the Special Block line!', 'pink');
        setTimeout(() => {
          this.setupCertStep('STEP_1_PASSIVE_SPECIAL');
        }, 1100);
      }
      return;
    }

    // ─── SPEEDSTER STEP 2 (TIME WARP CLUTCH CLEAR) ───
    if (this.activeClass === 'SPEEDSTER' && this.certStep === 'STEP_2_ABILITY') {
      if (this.timeWarpActive && linesCleared >= 1) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(1800, 6);
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ CLUTCH CLEAR! Time Warp cut gravity by 50% so you could land the piece safely!', 'green');
        setTimeout(() => {
          this.setupCertStep('STEP_3_ABILITY');
        }, 1900);
      } else {
        this.setupCertStep('STEP_2_ABILITY');
        this.showStage2Banner('Press [E] Time Warp first, then slide the I-piece into Columns 7–10!', 'pink');
      }
      return;
    }

    // ─── SPEEDSTER STEP 4B (BULLET TIME FREE TETRIS) ───
    if (this.activeClass === 'SPEEDSTER' && this.certStep === 'STEP_4_BULLET_TIME_TETRIS') {
      if (linesCleared >= 4) {
        AudioManager.playSfx('lineClear');
        this.updateHudStats(3000, 10);
        this.stage2TransitionLocked = true;
        this.showStage2Banner('✓ FREE TETRIS SCORED WHILE ALL 3 DUMMIES WERE FROZEN!', 'green');
        this.completeCurrentClassCertification();
      } else {
        this.loadStandardTetrisWellOnPlayerBoard();
        this.currentPiece = new Tetromino('I');
        this.showStage2Banner('Rotate the I-piece and drop it into Column 10 while the 3 Dummies are frozen!', 'yellow');
      }
    }
  }

  private completeCurrentClassCertification() {
    markClassCertified(this.activeClass);
    this.updateClassAbilityHud();

    setTimeout(() => {
      this.certStep = 'CERT_COMPLETED';
      this.stage2TransitionLocked = false;
      this.showStage2ConclusionModal();
    }, 2000);
  }

  private showStage2ConclusionModal() {
    if (!this.conclusionModal) return;

    const info = this.getActiveClassInfo();
    const certified = getCertifiedClasses();
    const uncertified = ALL_CERT_CLASSES.filter(cls => !certified.includes(cls));
    const nextClass = uncertified[0] ?? null;
    const nextClassInfo = nextClass ? PLAYER_CLASSES.find(c => c.id === nextClass) : null;

    const classBadgesHtml = PLAYER_CLASSES.map(cls => {
      const done = certified.includes(cls.id);
      return `
        <div class="flex items-center justify-between px-3 py-2 rounded-lg border ${done ? 'border-neon-green/50 bg-neon-green/10 text-neon-green' : 'border-card-border bg-black/30 text-gray-400'}">
          <div class="flex items-center gap-2">
            <img src="${cls.iconUrl}" alt="${cls.name}" class="w-5 h-5 object-contain p-0.5 rounded bg-white/5 border border-white/10 shrink-0" />
            <span class="font-bold uppercase tracking-wider text-xs">${cls.name}</span>
          </div>
          <span class="text-[10px] font-bold tracking-widest uppercase">${done ? '★ CERTIFIED' : 'PENDING'}</span>
        </div>
      `;
    }).join('');

    this.conclusionModal.innerHTML = `
      <div class="bg-card-bg border-2 border-neon-cyan rounded-2xl max-w-lg w-full p-8 text-center shadow-[0_0_50px_rgba(0,229,255,0.3)] flex flex-col items-center gap-5">
        <div class="flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-yellow/15 border border-neon-yellow text-neon-yellow text-xs font-extrabold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          <img src="${info.iconUrl}" alt="${info.name}" class="w-5 h-5 object-contain" />
          <span>★ ${info.name.toUpperCase()} CERTIFIED</span>
        </div>
        <div>
          <p class="text-neon-cyan text-[10px] font-bold tracking-[0.3em] uppercase mb-1">STAGE 2 PROGRESS: ${certified.length} / 4 CLASSES</p>
          <h2 class="text-2xl font-extrabold text-white">${info.name} Kit Mastered!</h2>
          <p class="text-gray-400 text-xs mt-2 leading-relaxed">
            You have unlocked the <strong class="text-neon-yellow">★ CERTIFIED</strong> badge for <strong>${info.name}</strong>! Your progress is saved to your profile.
          </p>
        </div>

        <div class="w-full grid grid-cols-2 gap-2 text-left">
          ${classBadgesHtml}
        </div>

        <div class="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <button id="tut-modal-replay" type="button" class="flex-1 px-4 py-3 rounded-lg border border-card-border bg-white/5 text-white text-xs font-bold tracking-widest uppercase hover:border-neon-cyan transition-all cursor-pointer">
            Replay ${info.name}
          </button>
          ${nextClassInfo ? `
            <button id="tut-modal-next-class" type="button" class="flex-1 px-4 py-3 rounded-lg bg-neon-yellow text-deep-purple text-xs font-bold tracking-widest uppercase hover:brightness-110 shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all cursor-pointer">
              Certify ${nextClassInfo.name} →
            </button>
          ` : `
            <button id="tut-modal-choose-class" type="button" class="flex-1 px-4 py-3 rounded-lg border border-neon-cyan bg-neon-cyan/15 text-neon-cyan text-xs font-bold tracking-widest uppercase hover:bg-neon-cyan hover:text-deep-purple transition-all cursor-pointer">
              Switch Class
            </button>
          `}
          <button id="tut-modal-done" type="button" class="flex-1 px-4 py-3 rounded-lg bg-neon-cyan text-deep-purple text-xs font-bold tracking-widest uppercase hover:brightness-110 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all cursor-pointer">
            Tutorials Menu
          </button>
        </div>
      </div>
    `;

    this.conclusionModal.classList.remove('hidden');
    this.conclusionModal.classList.add('flex');

    this.conclusionModal.querySelector('#tut-modal-replay')?.addEventListener('click', () => {
      this.conclusionModal?.classList.add('hidden');
      this.conclusionModal?.classList.remove('flex');
      this.setupCertStep('STEP_1_PASSIVE_TETRIS');
    });

    this.conclusionModal.querySelector('#tut-modal-next-class')?.addEventListener('click', () => {
      if (nextClass) {
        this.conclusionModal?.classList.add('hidden');
        this.conclusionModal?.classList.remove('flex');
        this.startStage2(nextClass, this.onOpenClassSelector ?? undefined);
      }
    });

    this.conclusionModal.querySelector('#tut-modal-choose-class')?.addEventListener('click', () => {
      this.conclusionModal?.classList.add('hidden');
      this.conclusionModal?.classList.remove('flex');
      if (this.onOpenClassSelector) {
        this.onOpenClassSelector();
      }
    });

    this.conclusionModal.querySelector('#tut-modal-done')?.addEventListener('click', () => {
      this.stop();
      window.location.href = 'modeselect.html?screen=tutorial';
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1 HUD & LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  private mountTutorialHud() {
    this.hudContainer?.remove();
    this.dummyCanvasContainer?.remove();
    this.conclusionModal?.remove();

    const duoLayoutContainer = document.getElementById('duo-layout-container');
    if (!duoLayoutContainer) return;

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

      <div id="tut-restart-banner" class="hidden rounded-lg border border-neon-pink bg-neon-pink/15 px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]"></div>

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
    if (this.stage2TransitionLocked || this.certStep === 'CERT_COMPLETED') return;

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
      const effectiveLockDelay =
        this.activeClass === 'SPEEDSTER' && this.certStep === 'STEP_2_ABILITY' && !this.timeWarpActive
          ? 120
          : this.LOCK_DELAY;
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
    markTutorialCompleted('basics-stage-1');
    if (!this.conclusionModal) return;
    this.conclusionModal.classList.remove('hidden');
    this.conclusionModal.classList.add('flex');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  private render() {
    if (!this.boardCanvas) return;
    const ctx = this.boardCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }

    // Highlight target well / slot in Stage 2 drills
    if (this.activeStage === 2) {
      const isTetrisWellStep =
        (this.certStep === 'STEP_1_PASSIVE_TETRIS' && this.activeClass !== 'SUPPORT') ||
        (this.certStep === 'STEP_1_PASSIVE_SPECIAL' && this.activeClass === 'SUPPORT') ||
        this.certStep === 'STEP_4_BULLET_TIME_TETRIS';

      const isRightFourCellGapStep =
        (this.certStep === 'STEP_1_PASSIVE_SPECIAL' && this.activeClass !== 'SUPPORT') ||
        (this.certStep === 'STEP_2_ABILITY' && this.activeClass === 'SPEEDSTER') ||
        (this.certStep === 'STEP_3_ABILITY' && this.activeClass === 'SUPPORT');

      if (isTetrisWellStep) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.fillRect(9 * BLOCK_SIZE, 16 * BLOCK_SIZE, BLOCK_SIZE, 4 * BLOCK_SIZE);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(9 * BLOCK_SIZE + 1, 16 * BLOCK_SIZE + 1, BLOCK_SIZE - 2, 4 * BLOCK_SIZE - 2);
        ctx.setLineDash([]);
      } else if (isRightFourCellGapStep) {
        ctx.fillStyle = 'rgba(0, 255, 102, 0.14)';
        ctx.fillRect(6 * BLOCK_SIZE, 19 * BLOCK_SIZE, 4 * BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.75)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(6 * BLOCK_SIZE + 1, 19 * BLOCK_SIZE + 1, 4 * BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.setLineDash([]);
      }
    }

    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid.matrix[r][c];
        if (cell.type !== null) {
          const cellColor = cell.type === 'GARBAGE' ? '#6B7280' : PLAYER_COLOR;
          this.drawBlock(ctx, c, r, cellColor, false, BLOCK_SIZE, cell.type, cell.special);
        }
      }
    }

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

    // CQRS Incoming Garbage Warning Overlay (Sentinel Step 2 & Step 3)
    if (this.activeStage === 2 && this.incomingGarbageQueue > 0) {
      const barHeight = Math.min(ROWS, this.incomingGarbageQueue) * BLOCK_SIZE;
      ctx.fillStyle = 'rgba(255, 20, 147, 0.22)';
      ctx.fillRect(0, (ROWS * BLOCK_SIZE) - barHeight, COLS * BLOCK_SIZE, barHeight);
      ctx.fillStyle = '#FF1493';
      ctx.fillRect(0, (ROWS * BLOCK_SIZE) - barHeight, 6, barHeight);

      const promptAction = this.certStep === 'STEP_2_ABILITY' ? 'PRESS [Q] FORTIFY' : 'PRESS [E] COUNTER STRIKE';
      ctx.fillStyle = 'rgba(13, 11, 26, 0.9)';
      ctx.fillRect(20, 220, 260, 72);
      ctx.strokeStyle = '#FF1493';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 220, 260, 72);
      ctx.fillStyle = '#FF1493';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ CQRS QUEUE: 10 GARBAGE LINES', 150, 248);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(promptAction, 150, 274);
    }

    if (this.holdCanvas) {
      this.renderMiniPiece(this.holdCanvas, this.holdPiece);
    }
    if (this.nextCanvas) {
      this.renderNextQueue(this.nextCanvas, this.queue.slice(0, 4));
    }

    if (this.activeStage === 2) {
      const isMultiDummy =
        (this.certStep === 'STEP_4_ULTIMATE' || this.certStep === 'STEP_4_BULLET_TIME_TETRIS' || this.certStep === 'CERT_COMPLETED') &&
        this.activeClass !== 'SUPPORT';

      if (isMultiDummy) {
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

    const baseColor = dummy.isAlly ? ALLY_COLOR : DUMMY_COLOR;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = dummy.grid.matrix[r][c];
        if (cell.type !== null) {
          const blockColor = cell.type === 'GARBAGE' ? '#6B7280' : baseColor;
          this.drawBlock(dCtx, c, r, blockColor, false, cellSize, cell.type, cell.special);
        }
      }
    }

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
            this.drawBlock(dCtx, dummy.activePiece.x + c, ghostY + r, baseColor, true, cellSize, dummy.activePiece.type);
            this.drawBlock(dCtx, dummy.activePiece.x + c, dummy.activePiece.y + r, baseColor, false, cellSize, dummy.activePiece.type);
          }
        }
      }
    }

    if (dummy.frozenTimer > 0 || dummy.abilityFreezeTimer > 0) {
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
