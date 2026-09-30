import { Grid } from './Grid';
import { Tetromino, type ShapeType } from './Tetromino';
import { AudioManager } from './AudioManager';

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

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PLAYER_COLOR = '#00E5FF';
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

export class TutorialManager {
  private grid: Grid = new Grid();
  private currentPiece: Tetromino | null = null;
  private holdPiece: Tetromino | null = null;
  private queue: ShapeType[] = [];

  private step: TutorialStep = 'PIECE_1_MOVE';
  private piece1MovedLeftRight = false;
  private piece1SoftDropped = false;
  private piece3Rotated = false;

  private dropTimer = 0;
  // Slightly relaxed gravity so the player has time to read the instruction,
  // but still drops steadily so ignoring the task causes the block to lock and restart.
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

  public startStage1() {
    this.boardCanvas = document.getElementById('board-p1') as HTMLCanvasElement | null;
    this.holdCanvas = document.getElementById('hold-canvas-p1') as HTMLCanvasElement | null;
    this.nextCanvas = document.getElementById('next-canvas-p1') as HTMLCanvasElement | null;

    this.prepareArenaDom();
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

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.keydownHandler);
    this.hudContainer?.remove();
    this.hudContainer = null;
    this.conclusionModal?.remove();
    this.conclusionModal = null;
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

    // Hide class abilities during Stage 1 Basic Movements
    abilityMeterP1?.classList.add('hidden');

    AudioManager.playMusic('game');
  }

  private mountTutorialHud() {
    this.hudContainer?.remove();
    this.conclusionModal?.remove();

    const duoLayoutContainer = document.getElementById('duo-layout-container');
    if (!duoLayoutContainer) return;

    // Create the side instruction panel inside the duo layout container
    const panel = document.createElement('div');
    panel.id = 'tutorial-stage-panel';
    panel.className = 'w-80 sm:w-96 shrink-0 bg-card-bg/90 backdrop-blur-md border-2 border-neon-cyan rounded-xl p-6 shadow-[0_0_30px_rgba(0,229,255,0.2)] flex flex-col gap-5 self-center z-30';
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
    this.isRestarting = false;

    this.spawnNextPiece();
    this.updateHudStats(0);
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

    // Reset immediately so the player starts fresh from Block 1
    setTimeout(() => {
      this.resetStageState();
      setTimeout(() => {
        const currentBanner = document.getElementById('tut-restart-banner');
        currentBanner?.classList.add('hidden');
      }, 2600);
    }, 350);
  }

  private handleKeyDown(e: KeyboardEvent) {
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
        this.updateHudStats(100);
        // Advance to Block 3 (Rotation)
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
        this.updateHudStats(150);
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
        // Spawn 5th block which must drop first before Hold can be swapped
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
        this.updateHudStats(200);
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
        this.updateHudStats(250);
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

  private onPieceLockedByGravity() {
    if (!this.currentPiece) return;

    // On Block 1, locking at the bottom is expected ONLY after completing both Move Left/Right AND Soft Drop
    if (this.step === 'PIECE_1_SOFT_DROP' && this.piece1MovedLeftRight && this.piece1SoftDropped) {
      this.grid.lockTetromino(this.currentPiece);
      this.updateHudStats(50);
      this.step = 'PIECE_2_HARD_DROP';
      this.spawnNextPiece();
      this.updateInstructionUi();
      return;
    }

    // On Block 3 (Rotation), locking at the bottom is expected ONLY after rotating the piece
    if (this.step === 'PIECE_3_ROTATE' && this.piece3Rotated) {
      this.grid.lockTetromino(this.currentPiece);
      this.updateHudStats(150);
      this.step = 'PIECE_4_HOLD';
      this.spawnNextPiece();
      this.updateInstructionUi();
      return;
    }

    // On Block 5 (Part 1), dropping the block unlocks Hold for the next block
    if (this.step === 'PIECE_5_DROP_FIRST') {
      this.grid.lockTetromino(this.currentPiece);
      this.updateHudStats(200);
      this.step = 'PIECE_5_SWAP_HOLD';
      this.spawnNextPiece();
      this.updateInstructionUi();
      return;
    }

    // On Block 5 (Part 3), when the swapped block lands on the grid, Stage 1 is complete!
    if (this.step === 'PIECE_5_DROP_SWAPPED') {
      this.grid.lockTetromino(this.currentPiece);
      this.currentPiece = null;
      this.step = 'COMPLETED';
      this.updateHudStats(250);
      this.updateInstructionUi();
      this.render();
      this.showConclusionModal();
      return;
    }

    // Otherwise, the block locked before the player completed the required instruction!
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

  private updateHudStats(score: number) {
    const scoreEl = document.getElementById('score-p1');
    if (scoreEl) scoreEl.innerText = String(score);
    const linesEl = document.getElementById('level-p1');
    if (linesEl) linesEl.innerText = '0';
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

    // Draw border
    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    // Draw locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid.matrix[r][c];
        if (cell.type !== null) {
          this.drawBlock(ctx, c, r, PLAYER_COLOR, false, BLOCK_SIZE, cell.type);
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
            this.drawBlock(ctx, this.currentPiece.x + c, this.currentPiece.y + r, PLAYER_COLOR, false, BLOCK_SIZE, this.currentPiece.type);
          }
        }
      }
    }

    // Render Hold Canvas
    if (this.holdCanvas) {
      this.renderMiniPiece(this.holdCanvas, this.holdPiece);
    }

    // Render Next Queue Canvas
    if (this.nextCanvas) {
      this.renderNextQueue(this.nextCanvas, this.queue.slice(0, 4));
    }
  }

  private drawBlock(
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    isGhost: boolean,
    blockSize: number,
    shapeType: string | null
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

    if (shapeType && BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
      targetCtx.drawImage(BLOCK_SPRITES[shapeType], finalX, finalY, blockSize, blockSize);
      targetCtx.strokeStyle = color;
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(finalX, finalY, blockSize, blockSize);
    } else {
      targetCtx.fillStyle = '#000000';
      targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
      targetCtx.strokeStyle = color;
      targetCtx.lineWidth = 2;
      targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);
      targetCtx.fillStyle = color;
      targetCtx.fillRect(finalX + 6, finalY + 6, blockSize - 12, blockSize - 12);
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
