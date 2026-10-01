import './style.css'
import { GameManager, GameState } from './GameManager'
import { Player } from './Player'
import { Tetromino } from './Tetromino'
import { NetworkManager, type RoomState, type GameStartData, type RoomMode } from './NetworkManager'
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass'
import { mountOnlineModeSelect, ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect'
import { mountLobbyScreen, type LobbyScreenController } from './LobbyScreen'
import { AudioManager } from './AudioManager'
import { mountInteractiveTutorial } from './InteractiveTutorial'
import { mountProgression, type ProgressionController, type ProgressionMode } from './Progression'
import { mountStatistics } from './Statistics'
import { mountSettings } from './Settings'
import { mountAuth } from './Auth'
import { showClassSelectModal } from './ClassSelectModal'
import { TutorialManager } from './TutorialManager'
import { recordModeScore } from './HighScores'
import { SPECIAL_BLOCK_ICONS, SPECIAL_BLOCK_COLORS, SpecialBlockType } from './ItemManager'

// HELPER FOR MISSING ELEMENTS IN LOBBY
function safeGet(id: string, tag: string = 'div'): any {
  const el = document.getElementById(id);
  if (el) return el;
  const dummy = document.createElement(tag);
  dummy.id = id;
  if (tag === 'canvas') {
    (dummy as any).getContext = () => ({
      clearRect: () => {}, fillRect: () => {}, drawImage: () => {},
      beginPath: () => {}, arc: () => {}, fill: () => {}, 
      stroke: () => {}, setLineDash: () => {}, moveTo: () => {}, 
      lineTo: () => {}, measureText: () => ({width:0}), fillText: () => {},
      save: () => {}, restore: () => {}, translate: () => {},
      scale: () => {}, rotate: () => {}, strokeRect: () => {},
      createLinearGradient: () => ({addColorStop:()=>{}}),
      createRadialGradient: () => ({addColorStop:()=>{}})
    });
  }
  return dummy;
}

const canvas = safeGet('gameCanvas', 'canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;
const PADDING = 40; // Space between boards in 1v1

// UI Elements
const uiLayer = safeGet('ui-layer')!;
const screenMain = safeGet('screen-main')!;
const screenDifficulty = safeGet('screen-difficulty')!;
const gameHud = safeGet('game-hud')!;
function getOrCreateOnlineModeSelectScreen() {
  const existing = safeGet('screen-online-mode-select');
  if (existing) return existing;

  // This fallback keeps the game playable when main.ts is updated before
  // modeselect.html. The intended HTML mount still takes precedence.
  const created = document.createElement('div');
  created.id = 'screen-online-mode-select';
  created.className = 'hidden relative z-10 w-full max-w-6xl px-4';
  created.setAttribute('aria-live', 'polite');
  uiLayer.appendChild(created);
  return created;
}
const screenOnlineModeSelect = getOrCreateOnlineModeSelectScreen();

const btnSolo = safeGet('btn-solo')!;
const btnVsBot = safeGet('btn-vs-bot')!;
const btnEasyBot = safeGet('btn-easy-bot')!;
const btnHardBot = safeGet('btn-hard-bot')!;
const btnBack = safeGet('btn-back')!;
const btnToggleGhost = safeGet('btn-toggle-ghost')!;

// Tutorial elements
const btnHowToPlay = safeGet('btn-how-to-play')!;
const btnTutorialClose = safeGet('btn-tutorial-close')!;
const tutorialModal = safeGet('tutorial-modal')!;
const tutorialClassList = safeGet('tutorial-class-list')!;
const tutorialBlockList = safeGet('tutorial-block-list')!;
const tutorialTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-tab'));
const tutorialPanels = Array.from(document.querySelectorAll<HTMLElement>('.tutorial-panel'));

// Class select elements
const screenClassSelect = safeGet('screen-class-select')!;
const classCardList = safeGet('class-card-list')!;
const btnClassContinue = safeGet('btn-class-continue')!;
const btnClassBack = safeGet('btn-class-back')!;

// Online Lobby elements
const btnPlayOnline = safeGet('btn-play-online')!;

// NEW: Lobby & Post-Game Elements
const navLobby = safeGet('nav-lobby')!;
const screenPostGame = safeGet('screen-post-game')!;
const postGameWinner = safeGet('post-game-winner')!;
const postGameVotes = safeGet('post-game-votes')!;
const btnPostRematch = safeGet('btn-post-rematch')!;
const btnPostLeave = safeGet('btn-post-leave')!;
const preGameOverlay = safeGet('pre-game-overlay')!;
const preGameText = safeGet('pre-game-text')!;
const spectatorBanner = safeGet('spectator-banner')!;
const teamMatchStrip = safeGet('team-match-strip')!;
const teamScoreCyan = safeGet('team-score-cyan')!;
const teamScoreMagenta = safeGet('team-score-magenta')!;
const teamMatchTimer = safeGet('team-match-timer')!;
const postGameTeamScores = safeGet('post-game-team-scores')!;

const scoreElementP1 = safeGet('score-p1')!;
const levelElementP1 = safeGet('level-p1')!;
const comboElementP1 = safeGet('combo-p1')!;
const multiplierElementP1 = safeGet('multiplier-p1')!;
const holdCanvasP1 = safeGet('hold-canvas-p1', 'canvas') as HTMLCanvasElement;

const duoLayoutContainer = safeGet('duo-layout-container')!;
const globalCanvasContainer = safeGet('canvas-container')!;
const p1Pod = safeGet('p1-pod')!;
const p2Pod = safeGet('p2-pod')!;
const boardP1 = safeGet('board-p1', 'canvas') as HTMLCanvasElement;
const boardP2 = safeGet('board-p2', 'canvas') as HTMLCanvasElement;
const holdCanvasP2 = safeGet('hold-canvas-p2', 'canvas') as HTMLCanvasElement;
const nextCanvasP2 = safeGet('next-canvas-p2', 'canvas') as HTMLCanvasElement;
const effectsCanvas = safeGet('effects-canvas', 'canvas') as HTMLCanvasElement;
const scoreElementP2 = safeGet('score-p2')!;
const levelElementP2 = safeGet('level-p2')!;
const comboElementP2 = safeGet('combo-p2')!;
const multiplierElementP2 = safeGet('multiplier-p2')!;
const koCountP2 = safeGet('ko-count-p2')!;
const koCountP1 = safeGet('ko-count-p1')!;

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}
function setWidth(id: string, width: string) {
  const el = document.getElementById(id);
  if (el) el.style.width = width;
}
function setDisplay(id: string, display: 'hidden' | 'flex') {
  const el = document.getElementById(id);
  if (el) {
    if (display === 'hidden') {
      el.classList.add('hidden');
      el.classList.remove('flex');
    } else {
      el.classList.remove('hidden');
      el.classList.add('flex');
    }
  }
}
function getCanvas(id: string): HTMLCanvasElement | null {
  return document.getElementById(id) as HTMLCanvasElement | null;
}

const abilityMeterP2 = safeGet('ability-meter-p2');
const abilityLabelP2 = safeGet('ability-label-p2');
const abilityFillP2 = safeGet('ability-fill-p2'); 

const nextCanvasP1 = safeGet('next-canvas-p1', 'canvas') as HTMLCanvasElement;
const nextQueueP1 = safeGet('next-queue-p1')!;
const abilityMeterP1 = safeGet('ability-meter-p1')!;
const abilityQLabelP1 = safeGet('ability-q-label-p1')!;
const abilityQStatusP1 = safeGet('ability-q-status-p1')!;
const abilityELabelP1 = safeGet('ability-e-label-p1')!;
const abilityEStatusP1 = safeGet('ability-e-status-p1')!;
const abilityLabelP1 = safeGet('ability-label-p1')!;
const abilityFillP1 = safeGet('ability-fill-p1')!;
const abilityReadyP1 = safeGet('ability-ready-p1')!;
const abilityRStatusP1 = safeGet('ability-r-status-p1')!;



const gameManager = new GameManager(render);

function updateNavHighlight(activeId: string) {
  const ids = ['nav-menu', 'nav-lobby', 'nav-loadout', 'nav-game', 'nav-statistics', 'nav-settings', 'nav-profile'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === activeId) {
      el.classList.add('nav-active', 'text-white');
      el.classList.remove('text-gray-400', 'hover:text-gray-200');
    } else {
      el.classList.remove('nav-active', 'text-white');
      el.classList.add('text-gray-400', 'hover:text-gray-200');
    }
  }
}

let showGhostPiece = true;

import './globalAudio';

// --- Class Select ---
let selectedClass: PlayerClass = 'TANK';
let pendingMode: 'SOLO' | 'VS_BOT' | 'ONLINE' | null = null;
let selectedOnlineMode: OnlineModeId = 'classic-pvp';

function getSelectedOnlineMode() {
  return ONLINE_GAME_MODES.find(mode => mode.id === selectedOnlineMode) ?? ONLINE_GAME_MODES[0];
}

function showOnlineModeSelect() { window.location.href = 'modeselect.html'; }

mountOnlineModeSelect({
  container: screenOnlineModeSelect,
  initialMode: selectedOnlineMode,
  onConfirm: mode => {
    updateNavHighlight('nav-loadout');
    selectedOnlineMode = mode.id;
    pendingMode = 'ONLINE';
    screenOnlineModeSelect.classList.add('hidden');
    screenClassSelect.classList.remove('hidden');
    screenClassSelect.classList.add('flex');
  },
  onBack: () => {
    updateNavHighlight('nav-lobby');
    screenOnlineModeSelect.classList.add('hidden');
    screenMain.classList.remove('hidden');
  },
});

function renderClassCards() {
  classCardList.innerHTML = '';
  const roleMap: Record<string, string> = {
    'Speedster': 'AGILITY FIGHTER',
    'Sentinel': 'HEAVY DEFENDER',
    'Saboteur': 'GRID DISRUPTOR',
    'Support': 'TACTICAL UTILITY'
  };

  for (const info of PLAYER_CLASSES) {
    const isSelected = info.id === selectedClass;
    const card = document.createElement('button');
    const roleText = roleMap[info.name] || 'CLASS ROLE';
    
    let selectedClasses = '';
    let hoverClasses = '';
    let accentColorClass = 'text-neon-cyan';

    if (info.name === 'Speedster') {
      selectedClasses = 'border-neon-yellow shadow-[inset_0_0_0_1px_rgba(255,215,0,1),_0_0_26px_rgba(255,215,0,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-yellow hover:shadow-[0_0_0_3px_rgba(255,215,0,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-yellow';
    } else if (info.name === 'Sentinel') {
      selectedClasses = 'border-neon-cyan shadow-[inset_0_0_0_1px_rgba(0,255,255,1),_0_0_26px_rgba(0,255,255,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-cyan hover:shadow-[0_0_0_3px_rgba(0,255,255,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-cyan';
    } else if (info.name === 'Saboteur') {
      selectedClasses = 'border-neon-pink shadow-[inset_0_0_0_1px_rgba(255,20,147,1),_0_0_26px_rgba(255,20,147,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-pink hover:shadow-[0_0_0_3px_rgba(255,20,147,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-pink';
    } else if (info.name === 'Support') {
      selectedClasses = 'border-neon-green shadow-[inset_0_0_0_1px_rgba(0,255,0,1),_0_0_26px_rgba(0,255,0,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-green hover:shadow-[0_0_0_3px_rgba(0,255,0,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-green';
    } else {
      selectedClasses = 'border-neon-cyan shadow-[inset_0_0_0_1px_rgba(0,255,255,1),_0_0_26px_rgba(0,255,255,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-cyan hover:shadow-[0_0_0_3px_rgba(0,255,255,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-cyan';
    }

    const unselectedClasses = `border-card-border hover:-translate-y-1 ${hoverClasses}`;
    const baseClasses = "flex-1 flex flex-col items-start bg-card-bg/80 rounded-[12px] border text-left p-6 transition-all duration-150 cursor-pointer min-h-[380px] w-full";
    
    card.className = `${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
    
    const qDesc = info.abilityQDescription.replace(/^Q [·\-] (.*?s cooldown:?)\s*/i, '($1) ');
    const eDesc = info.abilityEDescription.replace(/^E [·\-] (.*?cooldown:?|once per (?:level|match):?)\s*/i, '($1) ');
    const rDesc = info.ultimateDescription.replace(/^R [·\-] (.*?(?:lines|cost):?)\s*/i, '');
    const passDesc = info.passiveDescription.replace(/^Passive:\s*/i, '');

    card.innerHTML = `
      <div class="flex items-center justify-between w-full mb-2">
        <span class="${accentColorClass} text-[0.72rem] font-black uppercase tracking-[0.16em]">${roleText}</span>
        <img src="${info.iconUrl}" alt="${info.name}" class="w-10 h-10 object-contain p-1 rounded-lg bg-white/5 border border-white/10" />
      </div>
      <h3 class="text-[clamp(1.4rem,2.5vw,1.75rem)] font-extrabold leading-tight mb-2 text-white">${info.name}</h3>
      <p class="text-gray-400 text-[0.92rem] leading-relaxed mb-4">${info.tagline}</p>
      
      <div class="mt-auto w-full pt-4 border-t border-card-border flex flex-col gap-3">
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-gray-300 font-bold block mb-0.5">Passive</span>
          <span class="text-gray-400">${passDesc}</span>
        </div>
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-neon-cyan font-bold block mb-0.5">${info.abilityQName} [Q]</span>
          <span class="text-neon-cyan/80">${qDesc}</span>
        </div>
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-neon-yellow font-bold block mb-0.5">${info.abilityEName} [E]</span>
          <span class="text-neon-yellow/80">${eDesc}</span>
        </div>
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-neon-pink font-bold block mb-0.5">${info.ultimateName} [R] <span class="text-neon-pink/60 ml-1">(${info.ultimateCost} lines)</span></span>
          <span class="text-neon-pink/80">${rDesc}</span>
        </div>
      </div>
    `;
        card.addEventListener('click', () => {
      selectedClass = info.id;
      renderClassCards();
    });
    classCardList.appendChild(card);
  }
}
renderClassCards();

// --- Tutorial ---
const TUTORIAL_CLASS_ACCENTS: Record<string, { text: string; border: string }> = {
  Speedster: { text: 'text-neon-yellow', border: 'border-neon-yellow/40' },
  Sentinel: { text: 'text-neon-cyan', border: 'border-neon-cyan/40' },
  Saboteur: { text: 'text-neon-pink', border: 'border-neon-pink/40' },
  Support: { text: 'text-neon-green', border: 'border-neon-green/40' },
};

const SPECIAL_BLOCK_INFO: { letter: string; name: string; iconUrl: string; description: string }[] = [
  { letter: 'B', name: 'Bomb', iconUrl: SPECIAL_BLOCK_ICONS.BOMB, description: 'When its line clears, blasts a 3×3 area surrounding the block, clearing nearby blocks too.' },
  { letter: 'W', name: 'Heavy', iconUrl: SPECIAL_BLOCK_ICONS.HEAVY, description: 'When its line clears, automatically clears and crushes the single row directly beneath it.' },
  { letter: 'X', name: 'Multiplier', iconUrl: SPECIAL_BLOCK_ICONS.MULTIPLIER, description: 'When its line clears, doubles your point gains (2x) for 5 seconds.' },
  { letter: 'V', name: 'Speed', iconUrl: SPECIAL_BLOCK_ICONS.SPEED, description: 'When its line clears, slows your own piece drop speed by 50% for 5 seconds — giving you extra control.' },
  { letter: 'S', name: 'Shield', iconUrl: SPECIAL_BLOCK_ICONS.SHIELD, description: 'When its line clears, raises a defensive aura that completely blocks the next incoming garbage attack.' },
  { letter: 'F', name: 'Freeze', iconUrl: SPECIAL_BLOCK_ICONS.FREEZE, description: "When its line clears, launches a frost tether that locks out opponents' active Q/E/R class abilities for 3 seconds." },
  { letter: 'G', name: 'Garbage Eater', iconUrl: SPECIAL_BLOCK_ICONS.GARBAGE_EATER, description: 'When its line clears, devours garbage lines on your board and converts the threat into +800 bonus points.' },
];

function renderTutorialClasses() {
  if (tutorialClassList.childElementCount > 0) return; // static content, only needs building once
  for (const info of PLAYER_CLASSES) {
    const accent = TUTORIAL_CLASS_ACCENTS[info.name] ?? { text: 'text-neon-cyan', border: 'border-card-border' };
    const card = document.createElement('div');
    card.className = `bg-deep-purple/40 border ${accent.border} rounded-lg p-4`;
    card.innerHTML = `
      <div class="flex items-center gap-3 mb-2">
        <img src="${info.iconUrl}" alt="${info.name}" class="w-8 h-8 object-contain p-1 rounded bg-white/5 border border-white/10 shrink-0" />
        <div>
          <h4 class="${accent.text} font-extrabold text-sm leading-tight">${info.name}</h4>
          <p class="text-gray-500 text-[10px]">${info.tagline}</p>
        </div>
      </div>
      <ul class="space-y-1.5 text-xs text-gray-300">
        <li><span class="text-gray-400 font-bold">Passive —</span> ${info.passiveDescription.replace(/^Passive:\s*/i, '')}</li>
        <li><span class="${accent.text} font-bold">[Q] ${info.abilityQName} —</span> ${info.abilityQDescription.replace(/^Q [·\-] .*?cooldown:?\s*/i, '')}</li>
        <li><span class="${accent.text} font-bold">[E] ${info.abilityEName} —</span> ${info.abilityEDescription.replace(/^E [·\-] .*?(?:cooldown|level|match):?\s*/i, '')}</li>
        <li><span class="${accent.text} font-bold">[R] ${info.ultimateName} (${info.ultimateCost} lines) —</span> ${info.ultimateDescription.replace(/^R [·\-] .*?lines:?\s*/i, '')}</li>
      </ul>
    `;
    tutorialClassList.appendChild(card);
  }
}

function renderTutorialBlocks() {
  if (tutorialBlockList.childElementCount > 0) return; // static content, only needs building once
  for (const block of SPECIAL_BLOCK_INFO) {
    const row = document.createElement('div');
    row.className = 'flex items-start gap-3 bg-deep-purple/40 border border-card-border rounded-lg p-3';
    row.innerHTML = `
      <img src="${block.iconUrl}" alt="${block.name}" class="shrink-0 w-9 h-9 object-contain rounded bg-black/40 border border-white/20 p-0.5 shadow-md" />
      <div>
        <h4 class="text-white font-bold text-xs mb-0.5">${block.name}</h4>
        <p class="text-gray-500 text-xs leading-relaxed">${block.description}</p>
      </div>
    `;
    tutorialBlockList.appendChild(row);
  }
}

function openTutorial() {
  renderTutorialClasses();
  renderTutorialBlocks();
  tutorialModal.classList.remove('hidden');
}

function closeTutorial() {
  tutorialModal.classList.add('hidden');
}

btnHowToPlay.addEventListener('click', openTutorial);
btnTutorialClose.addEventListener('click', closeTutorial);
tutorialModal.addEventListener('click', (e: any) => {
  if (e.target === tutorialModal) closeTutorial();
});
window.addEventListener('keydown', (e: any) => {
  if (e.key === 'Escape' && !tutorialModal.classList.contains('hidden')) closeTutorial();
});

tutorialTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tutorialTabs.forEach(t => t.classList.remove('tutorial-tab-active'));
    tab.classList.add('tutorial-tab-active');
    const target = tab.dataset.tab;
    tutorialPanels.forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.panel !== target);
    });
  });
});

mountInteractiveTutorial(tutorialModal);

// The "Profile" nav link had no click handler at all — mountProgression()
// is what wires it up to actually open the rewards/achievements overlay.
const navProfile = safeGet('nav-profile');
let progression: ProgressionController | null = null;
if (navProfile) {
  progression = mountProgression(navProfile);
}

const navStatistics = safeGet('nav-statistics');
if (navStatistics && progression) {
  mountStatistics(navStatistics, progression.store);
}

const navSettings = safeGet('nav-settings');
if (navSettings) {
  mountSettings(navSettings);
}

mountAuth();

// Menu Event Listeners
btnSolo.addEventListener('click', () => {
  updateNavHighlight('nav-loadout');
  pendingMode = 'SOLO';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
});

btnVsBot.addEventListener('click', () => {
  updateNavHighlight('nav-loadout');
  pendingMode = 'VS_BOT';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
});

btnClassBack.addEventListener('click', () => {
  screenClassSelect.classList.remove('flex');
  screenClassSelect.classList.add('hidden');
  if (pendingMode === 'ONLINE') {
    showOnlineModeSelect();
  } else {
    updateNavHighlight('nav-lobby');
    screenMain.classList.remove('hidden');
  }
});

btnClassContinue.addEventListener('click', () => {
  screenClassSelect.classList.remove('flex');
  screenClassSelect.classList.add('hidden');

  if (pendingMode === 'SOLO') {
    startGame('SOLO');
  } else if (pendingMode === 'VS_BOT') {
    updateNavHighlight('nav-lobby');
    screenDifficulty.classList.remove('hidden');
    screenDifficulty.classList.add('flex');
  } else if (pendingMode === 'ONLINE') {
    updateNavHighlight('nav-lobby');
    lobby.show();
  }
});

btnBack.addEventListener('click', () => {
  updateNavHighlight('nav-lobby');
  screenDifficulty.classList.remove('flex');
  screenDifficulty.classList.add('hidden');
  screenMain.classList.remove('hidden');
});

btnEasyBot.addEventListener('click', () => {
  startGame('EASY');
});

btnHardBot.addEventListener('click', () => {
  startGame('HARD');
});

btnToggleGhost.addEventListener('click', () => {
  showGhostPiece = !showGhostPiece;
  btnToggleGhost.innerText = `GHOST: ${showGhostPiece ? 'ON' : 'OFF'}`;
  btnToggleGhost.className = showGhostPiece 
    ? "bg-bgPanel border border-neonCyan text-neonCyan px-4 py-2 text-xs font-bold hover:bg-neonCyan hover:text-black transition-colors rounded"
    : "bg-bgPanel border border-gray-500 text-gray-500 px-4 py-2 text-xs font-bold hover:bg-gray-500 hover:text-white transition-colors rounded";
  // Force a render so it disappears instantly
  if (gameManager.state === GameState.PLAYING) {
    render();
  }
});

navLobby.addEventListener('click', (e: any) => {
  e.preventDefault();
  if (lobby.network && lobby.network.currentRoomId) {
    updateNavHighlight('nav-lobby');
    screenMain.classList.add('hidden');
    screenClassSelect.classList.remove('flex');
    screenClassSelect.classList.add('hidden');
    screenDifficulty.classList.remove('flex');
    screenDifficulty.classList.add('hidden');
    screenPostGame.classList.remove('flex');
    screenPostGame.classList.add('hidden');
    
    lobby.show();
    uiLayer.classList.remove('hidden');
  }
});

// --- Online Lobby ---
let onlinePlayerTeams: Array<'cyan' | 'magenta' | null> = [];
let onlineTeamScores = { cyan: 0, magenta: 0 };
let teamMatchEndsAt: number | null = null;
let teamTimerInterval: number | null = null;
let activeOnlineMode: OnlineModeId = selectedOnlineMode;
let battleRoyalRemainingPlayers = 0;
let battleRoyalPhaseLabel = '';
let battleRoyalStartedAt: number | null = null;
let battleRoyalHud: HTMLElement | null = null;

function ensureBattleRoyalHud() {
  if (battleRoyalHud) return battleRoyalHud;
  const hud = document.createElement('section');
  hud.id = 'battle-royale-hud';
  hud.className = 'hidden fixed top-28 left-1/2 -translate-x-1/2 z-40 min-w-[280px] max-w-[calc(100vw-1.5rem)] bg-black/85 border border-neon-yellow/60 px-4 py-3 text-white shadow-[0_0_24px_rgba(255,193,7,.18)] backdrop-blur';
  hud.innerHTML = '<div class="flex items-center justify-between gap-4"><strong class="text-neon-yellow text-xs font-pixel tracking-widest">BATTLE ROYALE</strong><span id="br-remaining" class="font-pixel text-sm">0 LEFT</span></div><div id="br-phase" class="mt-1 text-[10px] uppercase tracking-widest text-gray-300">Opening battle</div><div class="mt-2 h-1 bg-gray-800"><div id="br-progress" class="h-full bg-neon-yellow transition-all" style="width:0%"></div></div><div id="br-kills" class="mt-2 text-[10px] uppercase tracking-widest text-neon-cyan">0 ELIMINATIONS · TARGET 1,000,000</div>';
  document.body.appendChild(hud);
  battleRoyalHud = hud;
  return hud;
}

function updateBattleRoyalHud() {
  const hud = ensureBattleRoyalHud();
  const remaining = hud.querySelector('#br-remaining');
  const phase = hud.querySelector('#br-phase');
  const progress = hud.querySelector('#br-progress') as HTMLElement | null;
  const kills = hud.querySelector('#br-kills');
  if (remaining) remaining.textContent = `${battleRoyalRemainingPlayers} LEFT`;
  if (phase) phase.textContent = battleRoyalPhaseLabel || 'Opening battle';
  if (progress) progress.style.width = `${Math.min(100, Math.max(0, ((Date.now() - (battleRoyalStartedAt || Date.now())) / (5 * 60 * 1000)) * 100))}%`;
  const localKills = gameManager.players[gameManager.myPlayerIndex]?.kills || gameManager.battleRoyalKills;
  if (kills) kills.textContent = `${localKills} ELIMINATIONS · TARGET 1,000,000`;
  hud.classList.toggle('hidden', activeOnlineMode !== 'battle-royale' || gameManager.state !== GameState.PLAYING);
}

function formatTeamTimer() {
  if (!teamMatchEndsAt) return '4:00';
  const seconds = Math.max(0, Math.ceil((teamMatchEndsAt - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function updateTeamScoreHud() {
  const cyanScore = Math.round(onlineTeamScores.cyan || 0);
  const magentaScore = Math.round(onlineTeamScores.magenta || 0);
  if (teamScoreCyan) teamScoreCyan.innerText = cyanScore.toLocaleString();
  if (teamScoreMagenta) teamScoreMagenta.innerText = magentaScore.toLocaleString();

  const total = cyanScore + magentaScore;
  const cyanPct = total > 0 ? Math.min(90, Math.max(10, Math.round((cyanScore / total) * 100))) : 50;
  const magentaPct = 100 - cyanPct;

  const barCyan = document.getElementById('team-bar-cyan');
  const barMagenta = document.getElementById('team-bar-magenta');
  if (barCyan) barCyan.style.width = `${cyanPct}%`;
  if (barMagenta) barMagenta.style.width = `${magentaPct}%`;

  const leadPill = document.getElementById('team-lead-pill');
  if (leadPill) {
    const diff = cyanScore - magentaScore;
    if (diff > 0) {
      leadPill.innerText = `CYAN +${diff.toLocaleString()}`;
      leadPill.className = 'text-[8px] font-pixel text-cyan-400 uppercase tracking-widest';
    } else if (diff < 0) {
      leadPill.innerText = `MAGENTA +${(-diff).toLocaleString()}`;
      leadPill.className = 'text-[8px] font-pixel text-neon-pink uppercase tracking-widest';
    } else {
      leadPill.innerText = 'TIED MATCH';
      leadPill.className = 'text-[8px] font-pixel text-gray-400 uppercase tracking-widest';
    }
  }

  if (teamMatchTimer) {
    const timerStr = formatTeamTimer();
    teamMatchTimer.innerText = timerStr;
    if (teamMatchEndsAt) {
      const secRemaining = Math.max(0, Math.ceil((teamMatchEndsAt - Date.now()) / 1000));
      if (secRemaining <= 30 && secRemaining > 0) {
        teamMatchTimer.classList.add('text-red-500', 'border-red-500', 'animate-pulse');
        teamMatchTimer.classList.remove('text-neon-yellow');
      } else {
        teamMatchTimer.classList.remove('text-red-500', 'border-red-500', 'animate-pulse');
        teamMatchTimer.classList.add('text-neon-yellow');
      }
    }
  }
}

const lobby = mountLobbyScreen({
  onBack: () => showOnlineModeSelect(),
  onLeaveToMenu: () => returnToMenu(),
  getSelectedMode: () => selectedOnlineMode,
  getGameState: () => gameManager.state,
  externalScreens: {
    screenPostGame,
  },
  onNetworkReady: (network) => wireGameCallbacks(network),
  onClassChange: (classId) => {
    selectedClass = classId as PlayerClass;
  },
});

function wireGameCallbacks(network: NetworkManager) {
  network.onPreGameCountdown = (seconds: number) => {
    preGameOverlay.classList.remove('hidden');
    gameManager.players[gameManager.myPlayerIndex].inputHandler.freeze();
    let s = seconds;
    preGameText.innerText = s.toString();
    const interval = setInterval(() => {
      s--;
      if (s > 0) {
        preGameText.innerText = s.toString();
      } else if (s === 0) {
        preGameText.innerText = "GO!";
        gameManager.players[gameManager.myPlayerIndex].inputHandler.unfreeze();
      } else {
        clearInterval(interval);
        preGameOverlay.classList.add('hidden');
      }
    }, 1000);
  };

  network.onPlayerStateUpdate = (data) => {
    if (data.playerId === network?.mySocketId && data.state === 'spectating') {
      spectatorBanner.classList.remove('hidden');
    }
  };

  network.onPostGameStart = (data) => {
    gameManager.state = GameState.POST_GAME;
    updateNavHighlight('nav-lobby');
    uiLayer.classList.remove('hidden');
    lobby.hide();
    screenPostGame.classList.remove('hidden');
    screenPostGame.classList.add('flex');
    gameHud.classList.add('hidden');
    
    if (data.winnerTeam) {
      postGameWinner.innerText = `${data.winnerName} WINS`;
      postGameTeamScores.innerHTML = `<span class="text-neon-cyan">CYAN ${Math.round(data.teamScores.cyan)}</span> <span class="text-gray-500">—</span> <span class="text-neon-pink">MAGENTA ${Math.round(data.teamScores.magenta)}</span>`;
    } else {
      const isDraw = data.winnerName.startsWith('Draw');
      postGameWinner.innerText = isDraw ? 'MATCH DRAW' : `${data.winnerName} WINS`;
      postGameTeamScores.innerText = `${getSelectedOnlineMode().title} · ${getSelectedOnlineMode().winCondition}`;
    }
    postGameVotes.innerText = `0 voted for rematch`;
    setPostGameButtonLabels('VOTE REMATCH', 'LEAVE LOBBY');
    btnPostRematch.classList.remove('hidden');

    const me = gameManager.players[gameManager.myPlayerIndex];
    if (me) {
      recordModeScore(activeOnlineMode, me.scoreManager.score ?? 0, me.scoreManager.totalLinesCleared ?? 0);
    }

    // Record this match's result toward profile progression (points,
    // achievements, unlockables). Only meaningful for online matches, which
    // is the only place onPostGameStart ever fires.
    if (progression) {
      const myTeam = onlinePlayerTeams[gameManager.myPlayerIndex] ?? null;
      const won = data.winnerTeam
        ? data.winnerTeam === myTeam
        : data.winnerId === network?.mySocketId;
      progression.recordMatch({
        mode: activeOnlineMode as ProgressionMode,
        won,
        score: me?.scoreManager.score ?? 0,
        lines: me?.scoreManager.totalLinesCleared ?? 0,
        kills: me?.kills ?? 0,
      });
    }
  };

  network.onRematchUpdate = (data) => {
    postGameVotes.innerText = `${data.votes}/${data.required} voted for rematch`;
  };

  network.onPlayerDisconnected = () => {
    gameManager.network?.sendRibbon('A PLAYER DISCONNECTED');
  };

  network.onGameStart = (data: GameStartData) => {
    activeOnlineMode = data.modeId;
    battleRoyalRemainingPlayers = data.modeId === 'battle-royale' ? data.players.length : 0;
    battleRoyalPhaseLabel = data.modeId === 'battle-royale' ? 'Opening battle' : '';
    battleRoyalStartedAt = null;
    updateBattleRoyalHud();
    selectedOnlineMode = data.modeId;
    lobby.selectedMode = data.modeId;
    onlinePlayerTeams = data.players.map(player => player.team);
    onlineTeamScores = data.teamScores;
    startOnlineGame(data.players.length, data.myIndex, data.players, data.mode);
  };

  network.onBattleRoyalPhase = (data) => {
    battleRoyalPhaseLabel = data.label;
    battleRoyalRemainingPlayers = data.remainingPlayers;
    if (!battleRoyalStartedAt) battleRoyalStartedAt = Date.now();
    updateBattleRoyalHud();
  };
  network.onBattleRoyalCull = (data) => {
    battleRoyalRemainingPlayers = data.remainingPlayers;
    battleRoyalPhaseLabel = data.reason === 'score-cull'
      ? 'Culling lowest score · tie-break lines, kills'
      : data.reason === 'line-cull'
        ? 'Culling lowest line count · tie-break score, kills'
        : 'Culling lowest kills · tie-break lines, score';
    updateBattleRoyalHud();
  };
  network.onBattleRoyalSuddenDeath = (data) => {
    battleRoyalRemainingPlayers = data.remainingPlayers;
    battleRoyalPhaseLabel = 'Sudden death · solid garbage incoming';
    updateBattleRoyalHud();
  };
  const showGlobalRibbon = (message: string) => {
    const ribbon = safeGet('global-ribbon');
    if (!ribbon) return;
    ribbon.innerText = message;
    ribbon.classList.remove('hidden');
    ribbon.classList.add('opacity-100');
    setTimeout(() => ribbon.classList.add('hidden'), 2000);
  };

  network.onKoRecover = (data) => {
    gameManager.applyKoRecovery(data.koCount, data.score);
    battleRoyalPhaseLabel = `K.O. #${data.koCount} · garbage cleared, -20% score`;
    updateBattleRoyalHud();
  };
  network.onPlayerKnockedOut = (data) => {
    AudioManager.playSfx('death');
    if (data.playerId !== network?.mySocketId) {
      showGlobalRibbon(`${data.playerIndex >= 0 ? `P${data.playerIndex + 1}` : 'A player'} took a K.O. (x${data.koCount})`);
    }
  };
  network.onBattleRoyalEvent = (data) => {
    const label = data.label || data.rule;
    battleRoyalPhaseLabel = data.densityLabel ? `${label} · ${data.densityLabel}` : label;
    showGlobalRibbon(String(label).toUpperCase());
    updateBattleRoyalHud();
  };
  network.onBattleRoyalPostGame = (data) => {
    const rankingText = data.rankings.slice(0, 10).map((entry: any) => `${entry.rank}. ${entry.name} · ${Math.round(entry.finalScore ?? entry.score).toLocaleString()} pts · ${entry.lines} lines · ${entry.kills} kills · ${entry.koCount ?? 0} K.O.`).join('<br>');
    postGameTeamScores.innerHTML = `<div class="text-neon-yellow mb-2">TARGET ${data.targetScore.toLocaleString()} · ${data.reason}</div><div class="text-left text-xs leading-5">${rankingText}</div>`;
  };
  network.onTeamScoreUpdate = (data) => {
    onlineTeamScores = data.teamScores;
    updateTeamScoreHud();
  };

  network.onTdmPlayerRebooting = (data) => {
    gameManager.applyTdmReboot(data.playerIndex, data.durationMs, data.score, data.koCount);
    onlineTeamScores = data.teamScores;
    updateTeamScoreHud();
    AudioManager.playSfx('death');

    const victimName = onlinePlayerSpecs[data.playerIndex]?.name || `P${data.playerIndex + 1}`;
    const killerName = data.killerIndex !== null && data.killerIndex !== undefined && onlinePlayerSpecs[data.killerIndex]
      ? onlinePlayerSpecs[data.killerIndex].name
      : null;

    if (killerName) {
      showGlobalRibbon(`${killerName.toUpperCase()} K.O.'D ${victimName.toUpperCase()}! (+2,500 BOUNTY)`);
    } else {
      showGlobalRibbon(`${victimName.toUpperCase()} TOPPED OUT! (-20% PTS)`);
    }
  };

  network.onTdmPlayerRespawned = (data) => {
    gameManager.applyTdmRespawn(data.playerIndex);
    if (data.playerIndex === gameManager.myPlayerIndex) {
      showGlobalRibbon('SYSTEM REBOOT COMPLETE · RE-ENTERING MATCH');
    }
  };

  network.onTeamAceWipeout = (data) => {
    onlineTeamScores = data.teamScores;
    updateTeamScoreHud();
    AudioManager.playSfx('ultimate');
    const squadName = data.scoringTeam === 'cyan' ? 'CYAN CIRCUIT' : 'MAGENTA VOLTAGE';
    showGlobalRibbon(`💥 SQUAD ACE! ${squadName} +${data.bonusPoints.toLocaleString()} PTS!`);
  };

  network.onMatchTimerStart = (data) => {
    teamMatchEndsAt = data.endsAt;
    if (teamTimerInterval) clearInterval(teamTimerInterval);
    teamTimerInterval = window.setInterval(updateTeamScoreHud, 250);
    updateTeamScoreHud();
  };

  network.onShowRibbon = (message: string) => {
    const ribbon = safeGet('global-ribbon');
    if (ribbon) {
      ribbon.innerText = message;
      ribbon.classList.remove('hidden');
      ribbon.classList.add('opacity-100');
      setTimeout(() => {
        ribbon.classList.add('hidden');
        ribbon.classList.remove('opacity-100');
      }, 2000);
    }
  };
}

let currentOfflineMode: 'SOLO' | 'EASY' | 'HARD' | null = null;
let offlineCountdownInterval: number | null = null;

function setPostGameButtonLabels(rematchText: string, leaveText: string) {
  const rematchSpan = btnPostRematch.querySelector('span:last-child');
  if (rematchSpan) {
    rematchSpan.textContent = rematchText;
  } else {
    btnPostRematch.textContent = rematchText;
  }
  btnPostLeave.textContent = leaveText;
}

// --- Button Listeners ---

btnPlayOnline.addEventListener('click', () => {
  if (selectedClass !== 'TANK' && selectedClass !== 'SPEEDSTER' && selectedClass !== 'SABOTEUR' && selectedClass !== 'SUPPORT') {
    alert("Please select a class first!");
    return;
  }
  pendingMode = 'ONLINE';
  showOnlineModeSelect();
});

btnPostRematch.addEventListener('click', () => {
  if (!gameManager.isOnline && currentOfflineMode) {
    startGame(currentOfflineMode);
    return;
  }
  btnPostRematch.classList.add('hidden');
  lobby.network?.voteRematch();
});

btnPostLeave.addEventListener('click', () => {
  if (!gameManager.isOnline) {
    window.location.href = 'modeselect.html?screen=solo';
    return;
  }
  if (activeOnlineMode) {
    returnToLobbyAuth();
  } else {
    returnToMenu();
  }
});

/**
 * Start an online multiplayer game.
 * Called when the server emits 'game-start'.
 */
let onlinePlayerSpecs: any[] = [];

function startOnlineGame(playerCount: number, myIndex: number, players?: any[], mode?: RoomMode) {
  if (players) {
    const lobbyPlayers = lobby.players;
    onlinePlayerSpecs = players.map(spec => {
      if (spec.classId) return spec;
      const match = lobbyPlayers.find(lp => lp.id === spec.id);
      return match?.classId ? { ...spec, classId: match.classId } : spec;
    });
    const myClassId = onlinePlayerSpecs[myIndex]?.classId as PlayerClass | undefined;
    if (myClassId) {
      selectedClass = myClassId;
    }
  }
  // Hide lobby, show game
  AudioManager.playMusic('game');
  updateNavHighlight('nav-game');
  uiLayer.classList.add('hidden');
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  gameHud.classList.remove('hidden');
  gameHud.classList.add('flex');
  spectatorBanner.classList.add('hidden');
  if (mode?.isTeamMode) {
    teamMatchStrip.classList.remove('hidden');
    updateTeamScoreHud();
  } else {
    teamMatchStrip.classList.add('hidden');
  }
  if (mode?.id === 'battle-royale') {
    ensureBattleRoyalHud();
    battleRoyalPhaseLabel = 'Opening battle';
    battleRoyalRemainingPlayers = playerCount;
    updateBattleRoyalHud();
  } else if (battleRoyalHud) {
    battleRoyalHud.classList.add('hidden');
  }

  // Size the canvas for the number of players — in 3v3/Battle Royale this
  // puts our own board at full size top-left and tiles everyone else into a
  // mosaic grid beside it, so canvas.width/height must span every board's
  // actual bounding box rather than assuming one straight line of boards.
  const layout = computeBoardLayout(playerCount, myIndex, mode?.id ?? null);
  canvas.width = Math.max(...layout.map(l => l.offsetX + COLS * l.blockSize)) + 24;
  canvas.height = Math.max(...layout.map(l => l.offsetY + ROWS * l.blockSize + (l.cardHeight ? l.cardHeight + 16 : 0)));

  // Our own board is always pinned at (0,0) when emphasized, so make sure the
  // container starts scrolled there instead of wherever it was left before.
  const canvasContainer = safeGet('canvas-container');
  if (canvasContainer) {
    canvasContainer.scrollLeft = 0;
    canvasContainer.scrollTop = 0;
  }

  // Show P2 HUD if there are 2+ players
  if (playerCount >= 2) {
  } else {
  }

  // Initialize the online game
  gameManager.initOnline(playerCount, myIndex, lobby.network!, onlinePlayerSpecs, selectedClass, { isTeamMode: mode?.isTeamMode ?? false });
}

function startGame(mode: 'SOLO' | 'EASY' | 'HARD') {
  currentOfflineMode = mode;
  if (offlineCountdownInterval !== null) {
    clearInterval(offlineCountdownInterval);
    offlineCountdownInterval = null;
  }
  AudioManager.playMusic('game');
  updateNavHighlight('nav-game');
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  uiLayer.classList.add('hidden');
  gameHud.classList.remove('hidden');
  gameHud.classList.add('flex');
  teamMatchStrip.classList.add('hidden');
  
  const playerCount = mode === 'SOLO' ? 1 : 2;
  canvas.width = (COLS * BLOCK_SIZE * playerCount) + (PADDING * (playerCount - 1));
  canvas.height = ROWS * BLOCK_SIZE;

  if (mode === 'SOLO') {
    gameManager.initSolo(selectedClass, 5000);
  } else {
    gameManager.init1v1(mode, selectedClass, 5000);
  }

  // Show the 5 second countdown offline
  preGameOverlay.classList.remove('hidden');
  preGameOverlay.classList.add('flex');
  gameManager.players[0].inputHandler.freeze();
  let seconds = 5;
  preGameText.innerText = seconds.toString();
  
  offlineCountdownInterval = window.setInterval(() => {
    seconds--;
    if (seconds > 0) {
      preGameText.innerText = seconds.toString();
    } else if (seconds === 0) {
      preGameText.innerText = "GO!";
      gameManager.players[0]?.inputHandler.unfreeze();
    } else {
      if (offlineCountdownInterval !== null) {
        clearInterval(offlineCountdownInterval);
        offlineCountdownInterval = null;
      }
      preGameOverlay.classList.add('hidden');
    }
  }, 1000);
}

function getSpecialBlockLetter(special: string): string {
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

function drawBlock(
  targetCtx: CanvasRenderingContext2D,
  x: number, 
  y: number, 
  color: string, 
  offsetX: number, 
  offsetY: number = 0,
  isSpecial: string | undefined = undefined, 
  isGhost: boolean = false,
  blockSize: number = BLOCK_SIZE,
  shapeType: string | null = null
) {
  const finalX = offsetX + x * blockSize;
  const finalY = offsetY + y * blockSize;

  if (isGhost) {
    targetCtx.fillStyle = 'transparent';
    targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
    targetCtx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    targetCtx.setLineDash([4, 2]);
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(finalX + 1, finalY + 1, blockSize - 2, blockSize - 2);
    targetCtx.setLineDash([]);
    return;
  }

  if (isSpecial === 'GARBAGE') {
    targetCtx.fillStyle = '#000000';
    targetCtx.fillRect(finalX, finalY, blockSize, blockSize);
    targetCtx.strokeStyle = '#555555';
    targetCtx.fillStyle = '#333333';
    targetCtx.fillRect(finalX + 2, finalY + 2, blockSize - 4, blockSize - 4);
    return;
  }

  // Draw custom special item block sprite if available
  if (isSpecial && SPECIAL_BLOCK_SPRITES[isSpecial] && SPECIAL_BLOCK_SPRITES[isSpecial].complete && SPECIAL_BLOCK_SPRITES[isSpecial].naturalWidth > 0) {
    targetCtx.drawImage(SPECIAL_BLOCK_SPRITES[isSpecial], finalX, finalY, blockSize, blockSize);
    const glowColor = SPECIAL_BLOCK_COLORS[isSpecial as SpecialBlockType] || '#FFD700';
    targetCtx.save();
    targetCtx.shadowColor = glowColor;
    targetCtx.shadowBlur = 8;
    targetCtx.strokeStyle = glowColor;
    targetCtx.lineWidth = 1.5;
    targetCtx.strokeRect(finalX + 0.5, finalY + 0.5, blockSize - 1, blockSize - 1);
    targetCtx.restore();
    return;
  }


  if (shapeType && BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
    targetCtx.drawImage(BLOCK_SPRITES[shapeType], finalX, finalY, blockSize, blockSize);
    
    // Colored border for player identity
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

  if (isSpecial) {
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.font = `${Math.round(blockSize * 0.67)}px "Press Start 2P"`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    const icon = getSpecialBlockLetter(isSpecial);
    targetCtx.fillText(icon, finalX + blockSize / 2, finalY + blockSize / 2 + 2);
  }
}


function renderQueueOnMiniCanvas(canvasEl: HTMLCanvasElement, shapes: string[], color: string, nextPiece?: Tetromino | null) {
  if (!canvasEl) return;
  const tCtx = canvasEl.getContext('2d')!;
  tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  
  const MINI_BLOCK_SIZE = 20;
  
  shapes.forEach((shapeType, i) => {
    const temp = (i === 0 && nextPiece) ? nextPiece : new Tetromino(shapeType as any);
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
          const specialType = (i === 0 && nextPiece) ? nextPiece.specialBlocks.get(`${r},${c}`) : undefined;
          if (specialType && SPECIAL_BLOCK_SPRITES[specialType] && SPECIAL_BLOCK_SPRITES[specialType].complete && SPECIAL_BLOCK_SPRITES[specialType].naturalWidth > 0) {
            tCtx.drawImage(SPECIAL_BLOCK_SPRITES[specialType], fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            const glowColor = SPECIAL_BLOCK_COLORS[specialType as SpecialBlockType] || '#FFD700';
            tCtx.save();
            tCtx.shadowColor = glowColor;
            tCtx.shadowBlur = 4;
            tCtx.strokeStyle = glowColor;
            tCtx.lineWidth = 1;
            tCtx.strokeRect(fx + 0.5, fy + 0.5, MINI_BLOCK_SIZE - 1, MINI_BLOCK_SIZE - 1);
            tCtx.restore();
          } else {
            if (shapeType && BLOCK_SPRITES[shapeType] && BLOCK_SPRITES[shapeType].complete && BLOCK_SPRITES[shapeType].naturalWidth > 0) {
              tCtx.drawImage(BLOCK_SPRITES[shapeType], fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
              tCtx.strokeStyle = color;
              tCtx.lineWidth = 1;
              tCtx.strokeRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
            } else {
              tCtx.fillStyle = color;
              tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
            }
            if (specialType) {
              tCtx.fillStyle = '#000000B3';
              tCtx.fillRect(fx + 2, fy + 2, MINI_BLOCK_SIZE - 4, MINI_BLOCK_SIZE - 4);
              tCtx.fillStyle = '#FFFFFF';
              tCtx.font = 'bold 11px "Press Start 2P"';
              tCtx.textAlign = 'center';
              tCtx.textBaseline = 'middle';
              tCtx.fillText(getSpecialBlockLetter(specialType), fx + MINI_BLOCK_SIZE / 2, fy + MINI_BLOCK_SIZE / 2 + 1);
            }
          }
        }
      }
    }
  });
}

function renderPieceOnMiniCanvas(canvasEl: HTMLCanvasElement, piece: Tetromino | null, color: string) {
  const tCtx = canvasEl.getContext('2d')!;
  tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (!piece) return;

  const shape = piece.matrix;
  const size = shape.length;
  // Center it roughly in the 90x90 canvas (assuming max 4x4 piece blocks of 20px each)
  const MINI_BLOCK_SIZE = 20;
  const offsetX = (90 - size * MINI_BLOCK_SIZE) / 2;
  const offsetY = (90 - size * MINI_BLOCK_SIZE) / 2;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (shape[r][c] !== 0) {
        // Draw mini block
        const fx = offsetX + c * MINI_BLOCK_SIZE;
        const fy = offsetY + r * MINI_BLOCK_SIZE;
        const specialKey = `${r},${c}`;
        const specialType = piece.specialBlocks.get(specialKey);

        if (specialType && SPECIAL_BLOCK_SPRITES[specialType] && SPECIAL_BLOCK_SPRITES[specialType].complete && SPECIAL_BLOCK_SPRITES[specialType].naturalWidth > 0) {
          tCtx.drawImage(SPECIAL_BLOCK_SPRITES[specialType], fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          const glowColor = SPECIAL_BLOCK_COLORS[specialType as SpecialBlockType] || '#FFD700';
          tCtx.save();
          tCtx.shadowColor = glowColor;
          tCtx.shadowBlur = 4;
          tCtx.strokeStyle = glowColor;
          tCtx.lineWidth = 1;
          tCtx.strokeRect(fx + 0.5, fy + 0.5, MINI_BLOCK_SIZE - 1, MINI_BLOCK_SIZE - 1);
          tCtx.restore();
        } else {
          tCtx.fillStyle = '#000000';
          tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
          tCtx.strokeStyle = color;
          tCtx.lineWidth = 2;
          tCtx.strokeRect(fx+1, fy+1, MINI_BLOCK_SIZE-2, MINI_BLOCK_SIZE-2);

          if (specialType) {
            // Draw the special block letter indicator
            tCtx.fillStyle = color;
            tCtx.font = 'bold 12px "Press Start 2P"';
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            tCtx.fillText(getSpecialBlockLetter(specialType), fx + MINI_BLOCK_SIZE / 2, fy + MINI_BLOCK_SIZE / 2);
          } else {
            tCtx.fillStyle = color;
            tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
          }
        }
      }
    }
  }
}

// Assign colors per player index for multiplayer
const PLAYER_COLORS = ['#00E5FF', '#40C4FF', '#80DEEA', '#FF007F', '#FF4081', '#FF80AB'];

// Cache class icons for on-canvas HUD badges
const classIconCache: Record<string, HTMLImageElement> = {};
PLAYER_CLASSES.forEach((cls) => {
  if (cls.iconUrl) {
    const img = new Image();
    img.src = cls.iconUrl;
    classIconCache[cls.id] = img;
  }
});

function drawRoundedCard(
  tCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number = 6
) {
  tCtx.beginPath();
  if (typeof (tCtx as any).roundRect === 'function') {
    (tCtx as any).roundRect(x, y, w, h, radius);
  } else {
    tCtx.moveTo(x + radius, y);
    tCtx.lineTo(x + w - radius, y);
    tCtx.quadraticCurveTo(x + w, y, x + w, y + radius);
    tCtx.lineTo(x + w, y + h - radius);
    tCtx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    tCtx.lineTo(x + radius, y + h);
    tCtx.quadraticCurveTo(x, y + h, x, y + h - radius);
    tCtx.lineTo(x, y + radius);
    tCtx.quadraticCurveTo(x, y, x + radius, y);
    tCtx.closePath();
  }
}

// In 3v3 Deathmatch and Battle Royale, your own board renders large and fixed
// at top-left, and everyone else is tiled into a compact mosaic grid beside
// you (Tetris 99 style) instead of one long horizontal strip.
const OWN_BOARD_SCALE = 1.3;
const OTHER_BOARD_SCALE_TEAM = 0.6;  // 3v3: only 5 opponents, keep them legible
const OTHER_BOARD_SCALE_BR = 0.22;   // Battle Royale: up to 29 opponents, go small
const MOSAIC_GAP = 6;

interface BoardLayoutEntry {
  blockSize: number;
  offsetX: number;
  offsetY: number;
  headerHeight?: number;
  cardHeight?: number;
}

function computeBoardLayout(playerCount: number, myIndex: number, modeId: string | null): BoardLayoutEntry[] {
  const layout: BoardLayoutEntry[] = new Array(playerCount);

  if (modeId === 'team-deathmatch' && myIndex >= 0) {
    // 3v3 Squad Pod Layout
    // Friendly Pod (Left): [YOU] [ALLY 1] [ALLY 2]
    // VS Divider
    // Enemy Pod (Right): [ENEMY 1] [ENEMY 2] [ENEMY 3]
    const headerHeight = 36;
    const cardHeight = 54;
    const myTeam = onlinePlayerTeams[myIndex] || (gameManager.players[myIndex]?.team) || (myIndex < 3 ? 'cyan' : 'magenta');

    const allyIndices: number[] = [];
    const enemyIndices: number[] = [];
    for (let i = 0; i < playerCount; i++) {
      if (i === myIndex) continue;
      const pTeam = onlinePlayerTeams[i] || (gameManager.players[i]?.team) || (i < 3 ? 'cyan' : 'magenta');
      if (pTeam === myTeam) allyIndices.push(i);
      else enemyIndices.push(i);
    }

    let cursorX = 16;
    // 1. Local Player ("YOU") - Prominent board
    const ownBlockSize = 25; // 250px x 500px
    layout[myIndex] = {
      blockSize: ownBlockSize,
      offsetX: cursorX,
      offsetY: headerHeight + 8,
      headerHeight,
      cardHeight,
    };
    cursorX += COLS * ownBlockSize + 18;

    // 2. Allies (Teammates)
    const allyBlockSize = 20; // 200px x 400px
    for (const allyIdx of allyIndices) {
      layout[allyIdx] = {
        blockSize: allyBlockSize,
        offsetX: cursorX,
        offsetY: headerHeight + 8,
        headerHeight,
        cardHeight,
      };
      cursorX += COLS * allyBlockSize + 16;
    }

    // 3. Gap / Divider between Friendly and Enemy squads
    cursorX += 28;

    // 4. Enemies (Opponents)
    const enemyBlockSize = 20; // 200px x 400px
    for (const enemyIdx of enemyIndices) {
      layout[enemyIdx] = {
        blockSize: enemyBlockSize,
        offsetX: cursorX,
        offsetY: headerHeight + 8,
        headerHeight,
        cardHeight,
      };
      cursorX += COLS * enemyBlockSize + 16;
    }

    return layout;
  }

  const emphasizeOwnBoard = modeId === 'battle-royale';
  if (!emphasizeOwnBoard || myIndex < 0) {
    // Classic side-by-side layout for 1v1 / FFA / local play
    let cursorX = 14;
    const headerHeight = 36;
    const cardHeight = 54;
    for (let i = 0; i < playerCount; i++) {
      layout[i] = { blockSize: BLOCK_SIZE, offsetX: cursorX, offsetY: headerHeight + 6, headerHeight, cardHeight };
      cursorX += COLS * BLOCK_SIZE + PADDING;
    }
    return layout;
  }

  const ownBlockSize = BLOCK_SIZE * OWN_BOARD_SCALE;
  const ownWidth = COLS * ownBlockSize;
  const ownHeight = ROWS * ownBlockSize;
  layout[myIndex] = { blockSize: ownBlockSize, offsetX: 0, offsetY: 0 };

  const otherIndices: number[] = [];
  for (let i = 0; i < playerCount; i++) if (i !== myIndex) otherIndices.push(i);

  const otherScale = OTHER_BOARD_SCALE_BR;
  const otherBlockSize = BLOCK_SIZE * otherScale;
  const otherWidth = COLS * otherBlockSize;
  const otherHeight = ROWS * otherBlockSize;

  // Tile opponents into a grid matching our board's height, wrapping into a
  // new column once a column fills up rather than stretching sideways forever.
  const rowsPerColumn = Math.max(1, Math.floor((ownHeight + MOSAIC_GAP) / (otherHeight + MOSAIC_GAP)));
  const mosaicStartX = ownWidth + PADDING;

  otherIndices.forEach((playerIdx, i) => {
    const col = Math.floor(i / rowsPerColumn);
    const row = i % rowsPerColumn;
    layout[playerIdx] = {
      blockSize: otherBlockSize,
      offsetX: mosaicStartX + col * (otherWidth + MOSAIC_GAP),
      offsetY: row * (otherHeight + MOSAIC_GAP),
    };
  });

  return layout;
}

// Recomputed once per render() call; renderPlayer() and the effects layer
// both read from this instead of assuming a uniform board size.
let boardLayout: BoardLayoutEntry[] = [];

function renderPlayer(player: Player, index: number, isDuo: boolean) {
  let { blockSize, offsetX, offsetY } = boardLayout[index] ?? { blockSize: BLOCK_SIZE, offsetX: index * (COLS * BLOCK_SIZE + PADDING), offsetY: 0 };
  const isMyPlayer = !gameManager.isOnline || index === gameManager.myPlayerIndex;
  const playerColor = isDuo ? (isMyPlayer ? PLAYER_COLORS[0] : PLAYER_COLORS[3]) : (PLAYER_COLORS[index] || '#00E5FF');
  
  let tCtx = ctx;
  if (isDuo) {
    const target = isMyPlayer ? safeGet('board-p1', 'canvas') as HTMLCanvasElement : safeGet('board-p2', 'canvas') as HTMLCanvasElement;
    if (target) {
      tCtx = target.getContext('2d')!;
      offsetX = 0;
      offsetY = 0;
    }
  }


  // Draw Grid background (optional faint lines)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      tCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      tCtx.lineWidth = 1;
      tCtx.strokeRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
  }

  // Draw Player Grid Border
  tCtx.strokeStyle = playerColor;
  tCtx.lineWidth = 2;
  tCtx.strokeRect(offsetX, offsetY, COLS * blockSize, ROWS * blockSize);

  // Speed Block [V] Visual Buff Lines on Grid (5s duration)
  if (player.speedBlockSlowTimer > 0) {
    tCtx.save();
    tCtx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
    tCtx.lineWidth = 2;
    const offset = (performance.now() * 0.25) % 60;
    for (let i = 0; i < 8; i++) {
      const lx = offsetX + 18 + i * (blockSize * 1.2);
      const ly = offsetY + ((i * 85 + offset) % (ROWS * blockSize));
      tCtx.beginPath();
      tCtx.moveTo(lx, ly);
      tCtx.lineTo(lx, Math.min(offsetY + ROWS * blockSize, ly + 36));
      tCtx.stroke();
    }
    tCtx.restore();
  }

  // Draw Block Matrix
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = player.grid.matrix[r][c];
      if (cell.type !== null) {
        const color = cell.type === 'GARBAGE' ? '#555555' : playerColor;
        drawBlock(tCtx, c, r, color, offsetX, offsetY, cell.type === 'GARBAGE' ? 'GARBAGE' : cell.special, false, blockSize, cell.type);
      }
    }
  }

  // Ghost Piece Logic — only show for our own player in online mode
  if (player.currentPiece && showGhostPiece && isMyPlayer) {
    let ghostY = player.currentPiece.y;
    while (!player.grid.checkCollision(player.currentPiece, player.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    
    // Draw Ghost
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          drawBlock(tCtx, player.currentPiece.x + c, ghostY + r, '#00E5FF', offsetX, offsetY, undefined, true, blockSize, player.currentPiece.type);
        }
      }
    }
  }

  // Draw Current Piece
  if (player.currentPiece) {
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    const color = playerColor;

    // Speed Block [V] Motion Trail Afterimages (5s duration)
    if (player.speedBlockSlowTimer > 0) {
      for (let trail = 1; trail <= 3; trail++) {
        const ty = player.currentPiece.y - trail;
        if (ty < 0) continue;
        tCtx.save();
        tCtx.globalAlpha = 0.26 / trail;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (shape[r][c] !== 0) {
              tCtx.fillStyle = '#00E5FF';
              tCtx.fillRect(
                offsetX + (player.currentPiece.x + c) * blockSize + 3,
                offsetY + (ty + r) * blockSize + 3,
                blockSize - 6,
                blockSize - 6
              );
            }
          }
        }
        tCtx.restore();
      }
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const specialKey = `${r},${c}`;
          const isSpecial = player.currentPiece.specialBlocks.get(specialKey);
          drawBlock(tCtx, player.currentPiece.x + c, player.currentPiece.y + r, color, offsetX, offsetY, isSpecial, false, blockSize, player.currentPiece.type);
        }
      }
    }
  }

  // ─── Stage 3 Tutorial Visuals in All Modes ───
  const boardPixelW = COLS * blockSize;
  const boardPixelH = ROWS * blockSize;

  // 1. Bomb Block [B] 3×3 Blast Box & Expanding Shockwave
  if (player.bombBlastVisual && player.bombBlastVisual.timer > 0) {
    const bv = player.bombBlastVisual;
    const progress = 1 - bv.timer / bv.maxTimer;
    const alpha = Math.max(0, bv.timer / bv.maxTimer);
    const cx = offsetX + (bv.col + 0.5) * blockSize;
    const cy = offsetY + (bv.row + 0.5) * blockSize;
    const radius = 12 + progress * (blockSize * 2.2);

    tCtx.save();
    // 3×3 blast zone box
    tCtx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.9})`;
    tCtx.lineWidth = 2.5;
    tCtx.setLineDash([5, 3]);
    tCtx.strokeRect(
      offsetX + (bv.col - 1) * blockSize,
      offsetY + (bv.row - 1) * blockSize,
      blockSize * 3,
      blockSize * 3
    );
    tCtx.setLineDash([]);

    // Expanding shockwave ring
    const grad = tCtx.createRadialGradient(cx, cy, 4, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.85})`);
    grad.addColorStop(0.45, `rgba(255, 215, 0, ${alpha * 0.65})`);
    grad.addColorStop(0.8, `rgba(255, 85, 85, ${alpha * 0.45})`);
    grad.addColorStop(1, 'rgba(255, 85, 85, 0)');
    tCtx.fillStyle = grad;
    tCtx.beginPath();
    tCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    tCtx.fill();
    tCtx.restore();
  }

  // 2. Heavy Block [W] Downward Crush Wave
  if (player.heavyCrushVisual && player.heavyCrushVisual.timer > 0) {
    const hv = player.heavyCrushVisual;
    const alpha = Math.max(0, hv.timer / hv.maxTimer);
    const crushY = offsetY + Math.max(0, hv.row - 1) * blockSize;
    tCtx.save();
    tCtx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.42})`;
    tCtx.fillRect(offsetX, crushY, boardPixelW, Math.min(boardPixelH - (crushY - offsetY), blockSize * 2));
    tCtx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
    tCtx.lineWidth = 3;
    tCtx.strokeRect(offsetX + 2, crushY + 2, boardPixelW - 4, Math.min(boardPixelH - (crushY - offsetY), blockSize * 2) - 4);
    tCtx.restore();
  }

  // 5. Shield Block [S] / Fortify Defensive Border & Deflection Flash
  if (player.shieldActive || player.fortifyCharges > 0 || player.shieldDeflectTimer > 0) {
    tCtx.save();
    const isDeflecting = player.shieldDeflectTimer > 0;

    tCtx.strokeStyle = isDeflecting ? '#FFFFFF' : 'rgba(0, 255, 136, 0.85)';
    tCtx.lineWidth = isDeflecting ? 6 : 3;
    tCtx.shadowColor = '#00FF88';
    tCtx.shadowBlur = isDeflecting ? 26 : 14;
    tCtx.strokeRect(offsetX + 3, offsetY + 3, boardPixelW - 6, boardPixelH - 6);
    tCtx.restore();
  }

  // 6. Freeze Block [F] Frost Overlay on Affected Board
  if (player.abilityFreezeTimer > 0) {
    tCtx.save();
    tCtx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    tCtx.fillRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.strokeStyle = '#38BDF8';
    tCtx.lineWidth = 3;
    tCtx.shadowColor = '#38BDF8';
    tCtx.shadowBlur = 14;
    tCtx.strokeRect(offsetX + 2, offsetY + 2, boardPixelW - 4, boardPixelH - 4);
    tCtx.restore();
  }

  // 7. Garbage Eater [G] Golden Conversion Flash
  if (player.garbageEaterTimer > 0) {
    const alpha = Math.max(0, player.garbageEaterTimer / 950);
    tCtx.save();
    tCtx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.28})`;
    tCtx.fillRect(offsetX, offsetY + (ROWS - 4) * blockSize, boardPixelW, blockSize * 4);
    tCtx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
    tCtx.lineWidth = 3;
    tCtx.strokeRect(offsetX + 2, offsetY + (ROWS - 4) * blockSize + 2, boardPixelW - 4, blockSize * 4 - 4);
    tCtx.restore();
  }

  // Stage 2 Class Ability Overlays: Bullet Time (QUICKSILVER) & Chaos Mode (CHAOS)
  if (player.quicksilverTimer > 0) {
    tCtx.save();
    tCtx.fillStyle = 'rgba(0, 229, 255, 0.18)';
    tCtx.fillRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.strokeStyle = '#00E5FF';
    tCtx.lineWidth = 3.5;
    tCtx.shadowColor = '#00E5FF';
    tCtx.shadowBlur = 18;
    tCtx.strokeRect(offsetX + 2, offsetY + 2, boardPixelW - 4, boardPixelH - 4);
    tCtx.restore();
  } else if (player.chaosTimer > 0) {
    tCtx.save();
    tCtx.fillStyle = 'rgba(255, 20, 147, 0.14)';
    tCtx.fillRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.strokeStyle = '#FF1493';
    tCtx.lineWidth = 3;
    tCtx.shadowColor = '#FF1493';
    tCtx.shadowBlur = 14;
    tCtx.strokeRect(offsetX + 2, offsetY + 2, boardPixelW - 4, boardPixelH - 4);
    tCtx.restore();
  }

  const layoutEntry = boardLayout[index];
  const headerH = layoutEntry?.headerHeight || 36;
  const cardH = layoutEntry?.cardHeight || 54;
  const myPlayer = gameManager.players[gameManager.myPlayerIndex ?? 0];
  const isTargeted = Boolean(myPlayer && myPlayer.selectedTargetIndex === index && !player.isToppedOut);

  // Faction awareness for 3v3 Team Deathmatch
  const isTeamMode = Boolean(gameManager.isTeamMode || activeOnlineMode === 'team-deathmatch');
  const myPlayerTeam = onlinePlayerTeams[gameManager.myPlayerIndex ?? 0] || (gameManager.players[gameManager.myPlayerIndex ?? 0]?.team);
  const targetPlayerTeam = onlinePlayerTeams[index] || player.team;
  const isAlly = Boolean(isTeamMode && myPlayerTeam && targetPlayerTeam && myPlayerTeam === targetPlayerTeam && !isMyPlayer);
  const isEnemy = Boolean(isTeamMode && myPlayerTeam && targetPlayerTeam && myPlayerTeam !== targetPlayerTeam);
  const isAllyInDanger = Boolean(isAlly && !player.isToppedOut && gameManager.getMaxColumnHeight(player) >= 14);

  // Squad Glow Border around player board
  if (isAllyInDanger) {
    tCtx.save();
    tCtx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
    tCtx.lineWidth = 2.5;
    tCtx.shadowColor = '#F59E0B';
    tCtx.shadowBlur = 12;
    tCtx.strokeRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.restore();
  } else if (isAlly) {
    tCtx.save();
    tCtx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    tCtx.lineWidth = 1.5;
    tCtx.strokeRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.restore();
  } else if (isEnemy && !isTargeted) {
    tCtx.save();
    tCtx.strokeStyle = 'rgba(255, 0, 127, 0.35)';
    tCtx.lineWidth = 1.5;
    tCtx.strokeRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.restore();
  }

  // 1. Board Header Badge (Multi-board layout / FFA / TDM)
  if (!isDuo && blockSize >= 20) {
    const hx = offsetX;
    const hy = offsetY - headerH - 5;
    const hw = boardPixelW;
    const hh = headerH;

    tCtx.save();
    drawRoundedCard(tCtx, hx, hy, hw, hh, 6);
    if (isTargeted) {
      tCtx.fillStyle = 'rgba(52, 8, 30, 0.94)';
      tCtx.fill();
      tCtx.strokeStyle = '#FF007F';
      tCtx.lineWidth = 2.5;
      tCtx.shadowColor = '#FF007F';
      tCtx.shadowBlur = 10;
      tCtx.stroke();
    } else if (isMyPlayer) {
      tCtx.fillStyle = 'rgba(6, 28, 48, 0.94)';
      tCtx.fill();
      tCtx.strokeStyle = '#00E5FF';
      tCtx.lineWidth = 2;
      tCtx.shadowColor = '#00E5FF';
      tCtx.shadowBlur = 8;
      tCtx.stroke();
    } else if (isAllyInDanger) {
      tCtx.fillStyle = 'rgba(40, 20, 8, 0.94)';
      tCtx.fill();
      tCtx.strokeStyle = '#F59E0B';
      tCtx.lineWidth = 2.5;
      tCtx.shadowColor = '#F59E0B';
      tCtx.shadowBlur = 10;
      tCtx.stroke();
    } else if (isAlly) {
      tCtx.fillStyle = 'rgba(6, 24, 40, 0.92)';
      tCtx.fill();
      tCtx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
      tCtx.lineWidth = 2;
      tCtx.stroke();
    } else if (isEnemy) {
      tCtx.fillStyle = 'rgba(28, 8, 20, 0.92)';
      tCtx.fill();
      tCtx.strokeStyle = 'rgba(255, 0, 127, 0.55)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    } else if (player.isToppedOut) {
      tCtx.fillStyle = 'rgba(28, 10, 16, 0.88)';
      tCtx.fill();
      tCtx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    } else {
      tCtx.fillStyle = 'rgba(12, 16, 36, 0.92)';
      tCtx.fill();
      tCtx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    }
    tCtx.restore();

    // Content inside Header Badge
    tCtx.save();
    // Left Status Tag (YOU, ▼ TARGET, REBOOT, K.O., ALLY, RIVAL, or P#)
    let tagText = `P${index + 1}`;
    let tagColor = '#94A3B8';
    if (isMyPlayer) {
      tagText = 'YOU';
      tagColor = '#00E5FF';
    } else if (isTargeted) {
      tagText = '▼ TARGET';
      tagColor = '#FF007F';
    } else if (player.tdmRespawnTimer > 0) {
      tagText = 'REBOOT';
      tagColor = '#FF3366';
    } else if (player.isToppedOut) {
      tagText = 'K.O.';
      tagColor = '#EF4444';
    } else if (isAllyInDanger) {
      tagText = '⚠️ DANGER';
      tagColor = '#F59E0B';
    } else if (isAlly) {
      tagText = 'ALLY';
      tagColor = '#00E5FF';
    } else if (isEnemy) {
      tagText = 'RIVAL';
      tagColor = '#FF007F';
    }

    tCtx.font = 'bold 9px "Press Start 2P", monospace';
    tCtx.fillStyle = tagColor;
    tCtx.textAlign = 'left';
    tCtx.textBaseline = 'middle';
    tCtx.fillText(tagText, hx + 10, hy + hh / 2);

    const tagWidth = tCtx.measureText(tagText).width;

    // Player Name
    const rawName = onlinePlayerSpecs[index]?.name || player.id || `Player ${index + 1}`;
    tCtx.font = 'bold 12px "Inter", sans-serif';
    tCtx.fillStyle = player.isToppedOut ? '#64748B' : '#FFFFFF';
    
    let displayName = rawName;
    const maxNameWidth = hw - (tagWidth + 24) - 95;
    if (tCtx.measureText(displayName).width > maxNameWidth && maxNameWidth > 20) {
      while (displayName.length > 2 && tCtx.measureText(displayName + '…').width > maxNameWidth) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '…';
    }
    tCtx.fillText(displayName, hx + 10 + tagWidth + 8, hy + hh / 2);

    // Right: Class Name + Icon
    const classInfo = PLAYER_CLASSES.find(c => c.id === player.playerClass);
    const className = classInfo?.name || player.playerClass || '';
    const classColor = player.playerClass === 'SPEEDSTER' ? '#00E5FF' :
                       player.playerClass === 'TANK' ? '#00FF88' :
                       player.playerClass === 'SABOTEUR' ? '#E879F9' :
                       player.playerClass === 'SUPPORT' ? '#FFD700' : '#94A3B8';

    const classIcon = classIconCache[player.playerClass];
    const iconSz = 18;
    const iconX = hx + hw - iconSz - 8;
    const iconY = hy + (hh - iconSz) / 2;

    if (classIcon && classIcon.complete && classIcon.naturalWidth > 0) {
      tCtx.drawImage(classIcon, iconX, iconY, iconSz, iconSz);
      tCtx.textAlign = 'right';
      tCtx.font = 'bold 10px "Inter", sans-serif';
      tCtx.fillStyle = classColor;
      tCtx.fillText(className.toUpperCase(), iconX - 6, hy + hh / 2);
    } else {
      tCtx.textAlign = 'right';
      tCtx.font = 'bold 10px "Inter", sans-serif';
      tCtx.fillStyle = classColor;
      tCtx.fillText(className.toUpperCase(), hx + hw - 10, hy + hh / 2);
    }
    tCtx.restore();
  }

  // 2. Draw topping out overlay and elimination banner
  if (player.isToppedOut) {
    tCtx.fillStyle = 'rgba(20, 8, 14, 0.76)';
    tCtx.fillRect(offsetX, offsetY, boardPixelW, boardPixelH);

    // Cyberpunk Elimination Stamp Banner
    const bannerW = Math.min(boardPixelW - 24, 240);
    const bannerH = 46;
    const bx = offsetX + (boardPixelW - bannerW) / 2;
    const by = offsetY + (boardPixelH - bannerH) / 2;

    tCtx.save();
    drawRoundedCard(tCtx, bx, by, bannerW, bannerH, 6);
    tCtx.fillStyle = 'rgba(38, 10, 18, 0.96)';
    tCtx.fill();
    tCtx.strokeStyle = '#EF4444';
    tCtx.lineWidth = 2.5;
    tCtx.shadowColor = '#EF4444';
    tCtx.shadowBlur = 14;
    tCtx.stroke();

    tCtx.font = 'bold 12px "Press Start 2P", monospace';
    tCtx.fillStyle = '#FF3366';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.shadowColor = '#FF3366';
    tCtx.shadowBlur = 10;

    if (player.tdmRespawnTimer > 0) {
      const secLeft = Math.ceil(player.tdmRespawnTimer / 1000);
      tCtx.fillText('REBOOTING', bx + bannerW / 2, by + 16);
      tCtx.font = 'bold 9px "Inter", sans-serif';
      tCtx.fillStyle = '#FCA5A5';
      tCtx.shadowBlur = 0;
      tCtx.fillText(`RESPAWN IN ${secLeft}s · -20% PTS`, bx + bannerW / 2, by + 32);
    } else {
      tCtx.fillText('ELIMINATED', bx + bannerW / 2, by + 16);
      tCtx.font = 'bold 9px "Inter", sans-serif';
      tCtx.fillStyle = '#FDA4AF';
      tCtx.shadowBlur = 0;
      tCtx.fillText('OUT OF MATCH · K.O.', bx + bannerW / 2, by + 32);
    }
    tCtx.restore();
  }

  // 3. Target Indicator & Glowing Border
  if (isTargeted) {
    tCtx.save();
    tCtx.fillStyle = '#FF007F';
    tCtx.beginPath();
    const centerX = offsetX + boardPixelW / 2;
    tCtx.moveTo(centerX - 10, offsetY - 2);
    tCtx.lineTo(centerX + 10, offsetY - 2);
    tCtx.lineTo(centerX, offsetY + 12);
    tCtx.fill();
    
    // Glowing border for targeted player
    tCtx.strokeStyle = 'rgba(255, 0, 127, 0.9)';
    tCtx.lineWidth = 3.5;
    tCtx.shadowColor = '#FF007F';
    tCtx.shadowBlur = 12;
    tCtx.strokeRect(offsetX, offsetY, boardPixelW, boardPixelH);
    tCtx.restore();
  }

  // 4. Score Card Underneath Each Player Board
  if (!isDuo && blockSize >= 20) {
    const cx = offsetX;
    const cy = offsetY + boardPixelH + 8;
    const cw = boardPixelW;
    const ch = cardH;

    tCtx.save();
    drawRoundedCard(tCtx, cx, cy, cw, ch, 6);
    tCtx.fillStyle = 'rgba(10, 14, 32, 0.94)';
    tCtx.fill();

    // Card Border
    if (isTargeted) {
      tCtx.strokeStyle = 'rgba(255, 0, 127, 0.85)';
      tCtx.lineWidth = 2;
      tCtx.shadowColor = '#FF007F';
      tCtx.shadowBlur = 8;
      tCtx.stroke();
    } else if (isMyPlayer) {
      tCtx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    } else if (isAllyInDanger) {
      tCtx.strokeStyle = '#F59E0B';
      tCtx.lineWidth = 2;
      tCtx.stroke();
    } else if (isAlly) {
      tCtx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    } else if (isEnemy) {
      tCtx.strokeStyle = 'rgba(255, 0, 127, 0.45)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    } else if (player.isToppedOut) {
      tCtx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      tCtx.lineWidth = 1;
      tCtx.stroke();
    } else {
      tCtx.strokeStyle = 'rgba(90, 105, 145, 0.4)';
      tCtx.lineWidth = 1.5;
      tCtx.stroke();
    }
    tCtx.restore();

    // Card Top Accent Line (2px)
    tCtx.save();
    const grad = tCtx.createLinearGradient(cx, cy, cx + cw, cy);
    const accentCol = isTargeted ? '#FF007F' : isMyPlayer ? '#00E5FF' : (playerColor || '#FFD700');
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, accentCol);
    grad.addColorStop(0.7, accentCol);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    tCtx.fillStyle = grad;
    tCtx.fillRect(cx + 8, cy + 1, cw - 16, 2);
    tCtx.restore();

    // Card Content - Row 1 (Score + Class)
    tCtx.save();
    // Left: Score
    tCtx.font = 'bold 9px "Inter", sans-serif';
    tCtx.fillStyle = '#94A3B8';
    tCtx.textAlign = 'left';
    tCtx.textBaseline = 'alphabetic';
    tCtx.fillText('SCORE', cx + 12, cy + 19);

    const scoreVal = Math.round(player.scoreManager.score).toLocaleString();
    tCtx.font = 'bold 12px "Press Start 2P", monospace';
    tCtx.fillStyle = player.isToppedOut ? '#64748B' : '#FFD700';
    tCtx.fillText(scoreVal, cx + 64, cy + 20);

    // Right: Class Name + Icon
    const classInfo = PLAYER_CLASSES.find(c => c.id === player.playerClass);
    const className = classInfo?.name || player.playerClass || 'CLASS';
    const classColor = player.playerClass === 'SPEEDSTER' ? '#00E5FF' :
                       player.playerClass === 'TANK' ? '#00FF88' :
                       player.playerClass === 'SABOTEUR' ? '#E879F9' :
                       player.playerClass === 'SUPPORT' ? '#FFD700' : '#94A3B8';

    const classIcon = classIconCache[player.playerClass];
    const iconSz = 20;
    const iconX = cx + cw - iconSz - 10;
    const iconY = cy + 7;

    if (classIcon && classIcon.complete && classIcon.naturalWidth > 0) {
      tCtx.drawImage(classIcon, iconX, iconY, iconSz, iconSz);
      tCtx.textAlign = 'right';
      tCtx.font = 'bold 11px "Inter", sans-serif';
      tCtx.fillStyle = classColor;
      tCtx.fillText(className, iconX - 6, cy + 21);
    } else {
      tCtx.textAlign = 'right';
      tCtx.font = 'bold 11px "Inter", sans-serif';
      tCtx.fillStyle = classColor;
      tCtx.fillText(className, cx + cw - 12, cy + 21);
    }

    // Card Content - Row 2 (Lines, Kills + Status Pill)
    tCtx.font = 'bold 9px "Inter", sans-serif';
    tCtx.fillStyle = '#94A3B8';
    tCtx.textAlign = 'left';
    tCtx.fillText('LINES', cx + 12, cy + 42);

    tCtx.font = 'bold 11px "Press Start 2P", monospace';
    tCtx.fillStyle = '#E2E8F0';
    tCtx.fillText(String(player.scoreManager.totalLinesCleared), cx + 58, cy + 43);

    if (player.kills > 0) {
      tCtx.font = 'bold 9px "Inter", sans-serif';
      tCtx.fillStyle = '#94A3B8';
      tCtx.fillText('K.O.', cx + 104, cy + 42);
      tCtx.font = 'bold 11px "Press Start 2P", monospace';
      tCtx.fillStyle = '#FF3366';
      tCtx.fillText(String(player.kills), cx + 138, cy + 43);
    }

    // Right: Live Status
    tCtx.textAlign = 'right';
    tCtx.font = 'bold 9px "Press Start 2P", monospace';
    if (player.tdmRespawnTimer > 0) {
      tCtx.fillStyle = '#F59E0B';
      tCtx.fillText('● REBOOT', cx + cw - 12, cy + 42);
    } else if (player.isToppedOut) {
      tCtx.fillStyle = '#EF4444';
      tCtx.fillText('● OUT', cx + cw - 12, cy + 42);
    } else if (isTargeted) {
      tCtx.fillStyle = '#FF007F';
      tCtx.fillText('● TARGET', cx + cw - 12, cy + 42);
    } else if (isAllyInDanger) {
      tCtx.fillStyle = '#F59E0B';
      tCtx.fillText('● DANGER', cx + cw - 12, cy + 42);
    } else if (isAlly) {
      tCtx.fillStyle = '#00E5FF';
      tCtx.fillText('● ALLY', cx + cw - 12, cy + 42);
    } else if (isEnemy) {
      tCtx.fillStyle = '#FF007F';
      tCtx.fillText('● RIVAL', cx + cw - 12, cy + 42);
    } else if (isMyPlayer) {
      tCtx.fillStyle = '#00E5FF';
      tCtx.fillText('● ACTIVE', cx + cw - 12, cy + 42);
    } else {
      tCtx.fillStyle = '#10B981';
      tCtx.fillText('● ALIVE', cx + cw - 12, cy + 42);
    }
    tCtx.restore();
  }

  // Pre-game countdown indicator: show "YOU" only on this player's own board
  if (isMyPlayer && (gameManager.state === GameState.PREGAME || !preGameOverlay.classList.contains('hidden'))) {
    const boardWidth = COLS * blockSize;
    const boardHeight = ROWS * blockSize;
    const centerX = offsetX + boardWidth / 2;
    const centerY = offsetY + boardHeight * 0.35;

    tCtx.save();
    tCtx.strokeStyle = '#00FFFF';
    tCtx.lineWidth = 4;
    tCtx.shadowColor = '#00FFFF';
    tCtx.shadowBlur = 16;
    tCtx.strokeRect(offsetX + 2, offsetY + 2, boardWidth - 4, boardHeight - 4);

    const badgeW = Math.max(120, boardWidth * 0.5);
    const badgeH = Math.max(48, blockSize * 1.8);
    tCtx.fillStyle = 'rgba(13, 11, 26, 0.9)';
    tCtx.fillRect(centerX - badgeW / 2, centerY - badgeH / 2, badgeW, badgeH);
    tCtx.lineWidth = 2;
    tCtx.strokeRect(centerX - badgeW / 2, centerY - badgeH / 2, badgeW, badgeH);

    const fontSize = Math.max(18, Math.round(blockSize * 0.85));
    tCtx.font = `bold ${fontSize}px "Press Start 2P"`;
    tCtx.fillStyle = '#00FFFF';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.fillText('YOU', centerX, centerY + 2);
    tCtx.restore();
  }
}

function render() {
  if (gameManager.state === GameState.MAIN_MENU) return;

  const activeMode = gameManager.isOnline ? activeOnlineMode : null;
  const isDuo = !gameManager.isOnline || activeMode === 'classic-pvp' || false;
  
  if (isDuo) {
    setDisplay('canvas-container', 'hidden');
    setDisplay('duo-layout-container', 'flex');
    setDisplay('hud-p1-br', 'hidden'); 
    setDisplay('hud-p2-br', 'hidden');
    
    if (gameManager.players.length > 1) {
      setDisplay('p2-pod', 'flex');
      const p1 = safeGet('p1-pod');
      if (p1) { p1.classList.remove('justify-center'); p1.classList.add('justify-end'); }
    } else {
      setDisplay('p2-pod', 'hidden');
      const p1 = safeGet('p1-pod');
      if (p1) { p1.classList.remove('justify-end'); p1.classList.add('justify-center'); }
    }
    
    // Clear mini canvases
    const b1 = safeGet('board-p1', 'canvas') as HTMLCanvasElement;
    if (b1) b1.getContext('2d')!.clearRect(0, 0, b1.width, b1.height);
    const b2 = safeGet('board-p2', 'canvas') as HTMLCanvasElement;
    if (b2) b2.getContext('2d')!.clearRect(0, 0, b2.width, b2.height);
  } else {
    setDisplay('duo-layout-container', 'hidden');
    setDisplay('canvas-container', 'flex');
    setDisplay('hud-p1-br', 'flex');
    if (gameManager.players.length > 1 && !gameManager.isOnline) setDisplay('hud-p2-br', 'flex');
  }

  // Clear main canvas (used by BR/fallback)
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const myIdxForLayout = gameManager.isOnline ? gameManager.myPlayerIndex : -1;
  boardLayout = computeBoardLayout(gameManager.players.length, myIdxForLayout, gameManager.isOnline ? activeOnlineMode : null);

  for (let i = 0; i < gameManager.players.length; i++) {
    renderPlayer(gameManager.players[i], i, isDuo);
  }

  // 3v3 Team Deathmatch: Render glowing VS Divider between friendly & enemy squad pods
  if (gameManager.isOnline && activeOnlineMode === 'team-deathmatch' && boardLayout.length >= 6) {
    const myTeam = onlinePlayerTeams[gameManager.myPlayerIndex] || (gameManager.myPlayerIndex < 3 ? 'cyan' : 'magenta');
    const friendlyIndices = boardLayout.map((_, idx) => idx).filter(idx => (onlinePlayerTeams[idx] || (idx < 3 ? 'cyan' : 'magenta')) === myTeam);
    const enemyIndices = boardLayout.map((_, idx) => idx).filter(idx => (onlinePlayerTeams[idx] || (idx < 3 ? 'cyan' : 'magenta')) !== myTeam);

    if (friendlyIndices.length > 0 && enemyIndices.length > 0) {
      const friendlyRight = Math.max(...friendlyIndices.map(idx => boardLayout[idx].offsetX + COLS * boardLayout[idx].blockSize));
      const enemyLeft = Math.min(...enemyIndices.map(idx => boardLayout[idx].offsetX));
      const dividerX = Math.round((friendlyRight + enemyLeft) / 2);

      ctx.save();
      // Glowing neon divider line
      const grad = ctx.createLinearGradient(dividerX, 10, dividerX, 480);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.1)');
      grad.addColorStop(0.3, 'rgba(0, 229, 255, 0.7)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(0.7, 'rgba(255, 0, 127, 0.7)');
      grad.addColorStop(1, 'rgba(255, 0, 127, 0.1)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(dividerX, 10);
      ctx.lineTo(dividerX, 480);
      ctx.stroke();

      // VS Badge in center
      const vsY = 240;
      ctx.beginPath();
      ctx.arc(dividerX, vsY, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#090D16';
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 10;
      ctx.stroke();

      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.fillStyle = '#FBBF24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText('VS', dividerX, vsY + 1);
      ctx.restore();
    }
  }

  // Render visual effects
  const effects = gameManager.getEffects();
  const eCanvas = safeGet('effects-canvas', 'canvas') as HTMLCanvasElement;
  let eCtx = ctx;
  if (isDuo && eCanvas) {
      eCtx = eCanvas.getContext('2d')!;
      eCtx.clearRect(0, 0, eCanvas.width, eCanvas.height);
  }

  function getCanvasRectOffset(pIdx: number) {
      if (!isDuo) return { x: 0, y: 0 };
      const localIdx = gameManager.isOnline ? gameManager.myPlayerIndex : 0;
      const targetId = pIdx === localIdx ? 'board-p1' : 'board-p2';
      const el = document.getElementById(targetId);
      const container = safeGet('effects-canvas', 'canvas');
      if (el && container) {
          const rect = el.getBoundingClientRect();
          const contRect = container.getBoundingClientRect();
          return { x: rect.left - contRect.left, y: rect.top - contRect.top };
      }
      return { x: 0, y: 0 };
  }

  // Draw Freeze Block [F] Targeting Tether between boards (Step 6 Tutorial visual)
  for (let i = 0; i < gameManager.players.length; i++) {
    const p = gameManager.players[i];
    if (!p.freezeTetherVisual || p.freezeTetherVisual.timer <= 0) continue;
    const tv = p.freezeTetherVisual;
    const progress = 1 - tv.timer / tv.maxTimer;
    const targetCtx = isDuo ? eCtx : ctx;

    let sx = 0, sy = 0, tx = 0, ty = 0;
    if (isDuo) {
      const sOff = getCanvasRectOffset(i);
      const tOff = getCanvasRectOffset(tv.targetPlayerIndex);
      sx = sOff.x + (COLS * BLOCK_SIZE) / 2;
      sy = sOff.y + 15 * BLOCK_SIZE;
      tx = tOff.x + (COLS * BLOCK_SIZE) / 2;
      ty = tOff.y + 8 * BLOCK_SIZE;
    } else {
      const sLay = boardLayout[i] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
      const tLay = boardLayout[tv.targetPlayerIndex] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
      sx = sLay.offsetX + (COLS * sLay.blockSize) / 2;
      sy = sLay.offsetY + 15 * sLay.blockSize;
      tx = tLay.offsetX + (COLS * tLay.blockSize) / 2;
      ty = tLay.offsetY + 8 * tLay.blockSize;
    }
    const curX = sx + (tx - sx) * Math.min(1, progress * 1.4);
    const curY = sy + (ty - sy) * Math.min(1, progress * 1.4);

    targetCtx.save();
    targetCtx.strokeStyle = '#38BDF8';
    targetCtx.lineWidth = 4;
    targetCtx.shadowColor = '#00E5FF';
    targetCtx.shadowBlur = 18;
    targetCtx.setLineDash([8, 4]);
    targetCtx.beginPath();
    targetCtx.moveTo(sx, sy);
    targetCtx.lineTo(curX, curY);
    targetCtx.stroke();
    targetCtx.setLineDash([]);
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.beginPath();
    targetCtx.arc(curX, curY, 7, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
  }

  // Draw line clear flashes
  for (const flash of effects.lineClearEffects) {
    const pIdx = flash.playerIndex ?? 0;
    const { blockSize, offsetX, offsetY } = boardLayout[pIdx] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
    const rectOffset = getCanvasRectOffset(pIdx);
    
    const targetCtx = isDuo ? eCtx : ctx;
    const cellSz = isDuo ? BLOCK_SIZE : blockSize;
    const finalX = isDuo ? rectOffset.x : offsetX;
    const finalY = isDuo ? rectOffset.y : offsetY;
    
    targetCtx.fillStyle = flash.color + Math.floor(flash.flash * 80).toString(16).padStart(2, '0');
    targetCtx.fillRect(finalX, finalY + flash.row * cellSz, COLS * cellSz, cellSz);
  }

  // Draw particles (stored in board-local 300x600 coordinates)
  for (const p of effects.particles) {
    const pIdx = p.playerIndex ?? 0;
    const rectOffset = getCanvasRectOffset(pIdx);
    const { blockSize, offsetX, offsetY } = boardLayout[pIdx] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
    const scale = isDuo ? 1 : (blockSize / BLOCK_SIZE);
    
    const targetCtx = isDuo ? eCtx : ctx;
    const finalX = isDuo ? (rectOffset.x + p.x) : (offsetX + p.x * scale);
    const finalY = isDuo ? (rectOffset.y + p.y) : (offsetY + p.y * scale);

    const alpha = Math.max(0, p.life / p.maxLife);
    targetCtx.globalAlpha = alpha;
    targetCtx.fillStyle = p.color;
    targetCtx.beginPath();
    targetCtx.arc(finalX, finalY, p.size * scale * alpha, 0, Math.PI * 2);
    targetCtx.fill();
  }
  if(isDuo) eCtx.globalAlpha = 1;
  ctx.globalAlpha = 1;
  
  // Draw combo & ability/block floating texts (stored in board-local 300x600 coordinates)
  for (const t of effects.comboTexts) {
    const pIdx = t.playerIndex ?? 0;
    const rectOffset = getCanvasRectOffset(pIdx);
    const { blockSize, offsetX, offsetY } = boardLayout[pIdx] ?? { blockSize: BLOCK_SIZE, offsetX: 0, offsetY: 0 };
    const scale = isDuo ? 1 : Math.max(0.6, blockSize / BLOCK_SIZE);
    
    const targetCtx = isDuo ? eCtx : ctx;
    const finalX = isDuo ? (rectOffset.x + t.x) : (offsetX + t.x * (blockSize / BLOCK_SIZE));
    const finalY = isDuo ? (rectOffset.y + t.y) : (offsetY + t.y * (blockSize / BLOCK_SIZE));

    const alpha = Math.max(0, t.life / t.maxLife);
    targetCtx.globalAlpha = alpha;
    targetCtx.fillStyle = t.color;
    targetCtx.font = `bold ${Math.max(9, Math.round(t.size * scale))}px "Press Start 2P"`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    
    targetCtx.shadowColor = t.color;
    targetCtx.shadowBlur = 16;
    targetCtx.fillText(t.text, finalX, finalY);
    targetCtx.shadowBlur = 0;
  }
  if (isDuo) eCtx.globalAlpha = 1;
  ctx.globalAlpha = 1;

  // In online mode, figure out which player index is "ours" for the left HUD
  const myIdx = gameManager.isOnline ? gameManager.myPlayerIndex : 0;
  const opIdx = gameManager.isOnline 
    ? gameManager.players.findIndex((_, i) => i !== myIdx)
    : 1;

  // Update UI for Player 1 (our player)
  const p1 = gameManager.players[myIdx];
  if (p1) {
    setText('score-p1',  `${Math.round(p1.scoreManager.score)}`); setText('score-p1-br', `${Math.round(p1.scoreManager.score)}`);

    // K.O. badge + transient stamp overlay (Battle Royale only)
    const koBadge = safeGet('ko-count-badge-p1');
    const koCountEl = safeGet('ko-count-p1');
    const koDecayEl = safeGet('ko-decay-p1');
    const koStamp = safeGet('ko-stamp-overlay');
    if (koBadge && koCountEl && koDecayEl) {
      const hasKos = (p1.koCount || 0) > 0;
      ['ko-count-badge-p1', 'ko-count-badge-p1-br'].forEach(id => { let b = document.getElementById(id); if (b) b.classList.toggle('hidden', !hasKos); });
      if (hasKos) {
        setText('ko-count-p1', `${p1.koCount}`); setText('ko-count-p1-br', `${p1.koCount}`);
        // Mirrors the server's decay formula: raw x 0.85^KOCount
        const retained = Math.round(Math.pow(0.85, p1.koCount) * 100);
        setText('ko-decay-p1', `final x${(retained / 100).toFixed(2)}`); setText('ko-decay-p1-br', `final x${(retained / 100).toFixed(2)}`);
      }
    }
    if (koStamp) {
      const stampVisible = (p1.koStampTimer || 0) > 0;
      koStamp.classList.toggle('hidden', !stampVisible);
      koStamp.classList.toggle('flex', stampVisible);
    }
    setText('level-p1', `${p1.scoreManager.totalLinesCleared}`); setText('level-p1-br', `${p1.scoreManager.totalLinesCleared}`);
    setText('combo-p1', p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : ''); setText('combo-p1-br', p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : '');
    const multTextP1 = p1.scoreManager.scoreMultiplier > 1
      ? `MULT x${p1.scoreManager.scoreMultiplier}${p1.scoreManager.multiplierTimer > 0 ? ` (${(p1.scoreManager.multiplierTimer / 1000).toFixed(1)}s)` : ''}`
      : '';
    setText('multiplier-p1', multTextP1); setText('multiplier-p1-br', multTextP1);
    renderPieceOnMiniCanvas(holdCanvasP1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
    const holdC1BR = safeGet('hold-canvas-p1-br', 'canvas') as HTMLCanvasElement;
    if (holdC1BR) renderPieceOnMiniCanvas(holdC1BR, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
    
    const p1Preview = p1.nextPiece ? [p1.nextPiece.type, ...p1.bag.getPreview(3)] : p1.bag.getPreview(4);
    // Safety clamp to exactly 4 pieces
    while (p1Preview.length < 4) p1Preview.push(p1.bag.getPreview(1)[0]);
    p1Preview.length = 4;
    renderQueueOnMiniCanvas(nextCanvasP1, p1Preview, PLAYER_COLORS[myIdx] || '#00E5FF', p1.nextPiece);
    const nextC1BR = safeGet('next-canvas-p1-br', 'canvas') as HTMLCanvasElement;
    if (nextC1BR) renderQueueOnMiniCanvas(nextC1BR, p1Preview, PLAYER_COLORS[myIdx] || '#00E5FF', p1.nextPiece);
    
    const p1PreviewText = p1.nextPiece ? [p1.nextPiece.type, ...p1.bag.getPreview(4)].join(' · ') : p1.bag.getPreview(5).join(' · ');
    nextQueueP1.innerText = p1PreviewText;
    const nextQueueP1BR = safeGet('next-queue-p1-br');
    if (nextQueueP1BR) nextQueueP1BR.innerText = p1PreviewText;

    const classInfo1 = PLAYER_CLASSES.find((c) => c.id === p1.playerClass);
    abilityMeterP1.classList.remove('hidden');
    if (classInfo1) {
      const isFrozen1 = p1.abilityFreezeTimer > 0;
      const freezeSec1 = (p1.abilityFreezeTimer / 1000).toFixed(1);
      const qCooldown = Math.max(0, p1.abilityCooldowns.Q);
      const eCooldown = Math.max(0, p1.abilityCooldowns.E);
      const eUnavailable = eCooldown > 0 || (p1.playerClass === 'SABOTEUR' && p1.gridShiftUsed);
      const qStatus = isFrozen1 ? `🔒 LOCKED (${freezeSec1}s)` : (qCooldown > 0 ? `${(qCooldown / 1000).toFixed(1)}s` : 'READY');
      const eStatus = isFrozen1 ? `🔒 LOCKED (${freezeSec1}s)` : ((p1.playerClass === 'SABOTEUR' && p1.gridShiftUsed) ? 'USED' : (eCooldown > 0 ? `${(eCooldown / 1000).toFixed(1)}s` : 'READY'));
      const activeSuffix = p1.activeEffectTimer > 0 ? ` · ${p1.activeEffectType} ${Math.ceil(p1.activeEffectTimer / 1000)}s` : '';
      const targetPlayer1 = p1.selectedTargetIndex !== null ? gameManager.players[p1.selectedTargetIndex] : null;
      const targetName = targetPlayer1 ? targetPlayer1.id : (onlinePlayerSpecs[p1.selectedTargetIndex ?? -1]?.name ?? 'default target');

      // Visually dim the ability UI when locked out by a Freeze Block [F] (matches Stage 3 Tutorial Step 6)
      abilityMeterP1.classList.toggle('opacity-45', isFrozen1);
      abilityMeterP1.classList.toggle('grayscale', isFrozen1);
      const abilityMeterP1Br = safeGet('ability-meter-p1-br');
      if (abilityMeterP1Br) {
        abilityMeterP1Br.classList.toggle('opacity-45', isFrozen1);
        abilityMeterP1Br.classList.toggle('grayscale', isFrozen1);
      }

      abilityQLabelP1.innerText = classInfo1.abilityQName.toUpperCase();
      abilityQStatusP1.innerText = qStatus;
      abilityQStatusP1.className = `text-[9px] font-bold ${isFrozen1 ? 'text-neon-pink' : (qCooldown > 0 ? 'text-gray-500' : 'text-neon-cyan')}`;
      abilityELabelP1.innerText = classInfo1.abilityEName.toUpperCase();
      abilityEStatusP1.innerText = eStatus;
      abilityEStatusP1.className = `text-[9px] font-bold ${isFrozen1 ? 'text-neon-pink' : (eUnavailable ? 'text-gray-500' : 'text-neon-yellow')}`;
      abilityLabelP1.innerText = classInfo1.ultimateName.toUpperCase();
      abilityRStatusP1.innerText = isFrozen1
        ? `🔒 ABILITIES FROZEN (${freezeSec1}s)`
        : `${Math.round(p1.classMeter)}/${classInfo1.ultimateCost} LINES · TAB: ${targetName}${activeSuffix}`;
      setWidth('ability-fill-p1', `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`); setWidth('ability-fill-p1-br', `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`);
      abilityReadyP1.classList.toggle('hidden', isFrozen1 || p1.classMeter < classInfo1.ultimateCost);
    }
  }

  // Update UI for Player 2 (opponent / bot)
  const p2 = opIdx >= 0 ? gameManager.players[opIdx] : undefined;
  if (p2) {
    scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;
    levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;
    comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
    multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1
      ? `MULT x${p2.scoreManager.scoreMultiplier}${p2.scoreManager.multiplierTimer > 0 ? ` (${(p2.scoreManager.multiplierTimer / 1000).toFixed(1)}s)` : ''}`
      : '';
    
    const holdC2 = safeGet('hold-canvas-p2', 'canvas') as HTMLCanvasElement;
    if (holdC2) renderPieceOnMiniCanvas(holdC2, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    const holdC2BR = safeGet('hold-canvas-p2-br', 'canvas') as HTMLCanvasElement;
    if (holdC2BR) renderPieceOnMiniCanvas(holdC2BR, p2.holdPiece, PLAYER_COLORS[1] || '#FF007F');
    
    const p2Preview = p2.nextPiece ? [p2.nextPiece.type, ...p2.bag.getPreview(3)] : p2.bag.getPreview(4);
    while (p2Preview.length < 4) p2Preview.push(p2.bag.getPreview(1)[0]);
    p2Preview.length = 4;
    const nextC2 = safeGet('next-canvas-p2', 'canvas') as HTMLCanvasElement;
    if (nextC2) renderQueueOnMiniCanvas(nextC2, p2Preview, PLAYER_COLORS[1] || '#FF007F', p2.nextPiece);
    const nextC2BR = safeGet('next-canvas-p2-br', 'canvas') as HTMLCanvasElement;
    if (nextC2BR) renderQueueOnMiniCanvas(nextC2BR, p2Preview, PLAYER_COLORS[1] || '#FF007F', p2.nextPiece);


    const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
    setDisplay('ability-meter-p2', 'flex');
    setDisplay('ability-meter-p2-br', 'flex');
    if (classInfo2) {
      const isFrozen2 = p2.abilityFreezeTimer > 0;
      const freezeSec2 = (p2.abilityFreezeTimer / 1000).toFixed(1);
      const qCooldown = Math.max(0, p2.abilityCooldowns?.Q || 0);
      const eCooldown = Math.max(0, p2.abilityCooldowns?.E || 0);
      const eUnavailable2 = eCooldown > 0 || (p2.playerClass === 'SABOTEUR' && p2.gridShiftUsed);
      const qStatus = isFrozen2 ? `🔒 LOCKED (${freezeSec2}s)` : (qCooldown > 0 ? `${(qCooldown / 1000).toFixed(1)}s` : 'READY');
      const eStatus = isFrozen2 ? `🔒 LOCKED (${freezeSec2}s)` : ((p2.playerClass === 'SABOTEUR' && p2.gridShiftUsed) ? 'USED' : (eCooldown > 0 ? `${(eCooldown / 1000).toFixed(1)}s` : 'READY'));
      const activeSuffix = p2.activeEffectTimer > 0 ? ` · ${p2.activeEffectType} ${Math.ceil(p2.activeEffectTimer / 1000)}s` : '';
      const targetPlayer2 = p2.selectedTargetIndex !== null ? gameManager.players[p2.selectedTargetIndex] : null;
      const targetName = targetPlayer2 ? targetPlayer2.id : (onlinePlayerSpecs[p2.selectedTargetIndex ?? -1]?.name ?? 'default target');

      const abilityMeterP2El = safeGet('ability-meter-p2');
      if (abilityMeterP2El) {
        abilityMeterP2El.classList.toggle('opacity-45', isFrozen2);
        abilityMeterP2El.classList.toggle('grayscale', isFrozen2);
      }
      const abilityMeterP2BrEl = safeGet('ability-meter-p2-br');
      if (abilityMeterP2BrEl) {
        abilityMeterP2BrEl.classList.toggle('opacity-45', isFrozen2);
        abilityMeterP2BrEl.classList.toggle('grayscale', isFrozen2);
      }
      
      setText('ability-q-label-p2', classInfo2.abilityQName.toUpperCase());
      setText('ability-q-status-p2', qStatus);
      const qEl = safeGet('ability-q-status-p2');
      if (qEl) qEl.className = `text-[9px] font-bold ${isFrozen2 ? 'text-neon-pink' : (qCooldown > 0 ? 'text-gray-500' : 'text-neon-cyan')}`;
      
      setText('ability-e-label-p2', classInfo2.abilityEName.toUpperCase());
      setText('ability-e-status-p2', eStatus);
      const eEl = safeGet('ability-e-status-p2');
      if (eEl) eEl.className = `text-[9px] font-bold ${isFrozen2 ? 'text-neon-pink' : (eUnavailable2 ? 'text-gray-500' : 'text-neon-yellow')}`;

      setText('ability-label-p2', classInfo2.ultimateName.toUpperCase());
      setText('ability-r-status-p2', isFrozen2
        ? `🔒 ABILITIES FROZEN (${freezeSec2}s)`
        : `${Math.round(p2.classMeter)}/${classInfo2.ultimateCost} LINES · TAB: ${targetName}${activeSuffix}`);
      const wid = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
      setWidth('ability-fill-p2', wid); setWidth('ability-fill-p2-br', wid);
      
      const rdy = safeGet('ability-ready-p2');
      if (rdy) rdy.classList.toggle('hidden', isFrozen2 || p2.classMeter < classInfo2.ultimateCost);
    }
  }
  // Update multiplayer scoreboard
  if (gameManager.isOnline && onlinePlayerSpecs.length > 0) {
    const scoreboard = safeGet('multiplayer-scoreboard')!;
    const entries = safeGet('scoreboard-entries')!;

    // Battle Royale uses its own HUD — keep the sidebar hidden and update BR HUD instead
    if (activeOnlineMode === 'battle-royale') {
      scoreboard.classList.add('hidden');
      updateBattleRoyalHud();
      return;
    }

    scoreboard.classList.remove('hidden');
    entries.innerHTML = '';
    const playerData: {name: string, score: number, lines: number, kills: number, alive: boolean, team: 'cyan' | 'magenta' | null}[] = [];
    for (let i = 0; i < gameManager.players.length; i++) {
      const p = gameManager.players[i];
      playerData.push({
        name: onlinePlayerSpecs[i]?.name || `Player ${i+1}`,
        score: p.scoreManager.score,
        lines: p.scoreManager.totalLinesCleared,
        kills: p.kills,
        alive: !p.isToppedOut,
        team: onlinePlayerTeams[i] ?? null
      });
    }
    if (activeOnlineMode !== 'team-deathmatch') {
      for (const player of playerData.sort((a, b) => b.score - a.score)) {
        const row = document.createElement('div');
        row.className = `flex justify-between items-center gap-4 text-sm ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`;
        row.innerHTML = `<span class="font-bold truncate max-w-[100px]">${player.name}</span><span class="font-pixel text-xs">${Math.round(player.score)}</span>`;
        entries.appendChild(row);
      }
      return;
    }
    for (const team of ['cyan', 'magenta'] as const) {
      const heading = document.createElement('div');
      heading.className = `flex justify-between items-center pt-2 text-[10px] font-pixel ${team === 'cyan' ? 'text-neonCyan' : 'text-neon-pink'}`;
      heading.innerHTML = `<span>${team === 'cyan' ? 'CYAN' : 'MAGENTA'}</span><span>${Math.round(onlineTeamScores[team])}</span>`;
      entries.appendChild(heading);
      for (const player of playerData.filter(item => item.team === team).sort((a, b) => b.score - a.score)) {
        const row = document.createElement('div');
        row.className = `flex justify-between items-center gap-4 text-sm ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`;
        row.innerHTML = `<span class="font-bold truncate max-w-[100px]">${player.name}</span><span class="font-pixel text-xs">${Math.round(player.score)}</span>`;
        entries.appendChild(row);
      }
    }
  }

  // Handle offline (Solo / VS Bot) Game Over using the Post-Game screen
  if (gameManager.state === GameState.GAME_OVER && !gameManager.isOnline) {
    handleOfflineGameOver();
  }
}

function handleOfflineGameOver() {
  gameManager.state = GameState.POST_GAME;
  if (offlineCountdownInterval !== null) {
    clearInterval(offlineCountdownInterval);
    offlineCountdownInterval = null;
  }
  AudioManager.playMusic('menu');
  updateNavHighlight('nav-modes');
  preGameOverlay.classList.add('hidden');
  gameHud.classList.add('hidden');
  gameHud.classList.remove('flex');
  lobby.hide();
  uiLayer.classList.remove('hidden');
  screenPostGame.classList.remove('hidden');
  screenPostGame.classList.add('flex');

  const p1 = gameManager.players[0];
  const finalScore = Math.round(p1?.scoreManager.score ?? 0);
  const finalLines = p1?.scoreManager.totalLinesCleared ?? 0;
  const modeKey = currentOfflineMode ?? 'SOLO';
  const { rank, topScores } = recordModeScore(modeKey, finalScore, finalLines);
  const bestScore = topScores[0]?.score ?? finalScore;

  if (modeKey === 'SOLO' || gameManager.players.length === 1) {
    postGameWinner.innerText = `FINAL SCORE: ${finalScore.toLocaleString()}`;
    postGameTeamScores.innerHTML = `<span class="text-neon-green">SOLO ENDLESS</span> <span class="text-gray-500">·</span> <span class="text-neon-cyan">${finalLines} LINES CLEARED</span>`;
  } else {
    const p2 = gameManager.players[1];
    const botScore = Math.round(p2?.scoreManager.score ?? 0);
    const playerWon = !p1?.isToppedOut && Boolean(p2?.isToppedOut);
    postGameWinner.innerText = playerWon ? 'YOU WIN!' : 'BOT WINS';
    postGameTeamScores.innerHTML = `<span class="text-neon-cyan">YOUR SCORE: ${finalScore.toLocaleString()} (${finalLines} LINES)</span> <span class="text-gray-500">—</span> <span class="text-neon-pink">${modeKey} BOT: ${botScore.toLocaleString()}</span>`;
  }

  if (rank === 1) {
    postGameVotes.innerHTML = `<span class="text-neon-yellow font-bold">★ NEW HIGH SCORE! ★</span> <span class="text-gray-400">· BEST: ${bestScore.toLocaleString()}</span>`;
  } else if (rank !== null) {
    postGameVotes.innerHTML = `<span class="text-neon-cyan font-bold">NEW #${rank} PERSONAL RECORD!</span> <span class="text-gray-400">· BEST: ${bestScore.toLocaleString()}</span>`;
  } else {
    postGameVotes.innerHTML = `<span class="text-gray-400">PERSONAL BEST: <strong class="text-white">${bestScore.toLocaleString()}</strong></span>`;
  }

  setPostGameButtonLabels('PLAY AGAIN', 'MODE SELECT');
  btnPostRematch.classList.remove('hidden');
}

window.addEventListener('keydown', (e: any) => {
  if ((gameManager.state === GameState.GAME_OVER || gameManager.state === GameState.POST_GAME) && !gameManager.isOnline) {
    if (e.key === 'Enter' && currentOfflineMode) {
      startGame(currentOfflineMode);
    } else if (e.key === 'Escape') {
      window.location.href = 'modeselect.html?screen=solo';
    }
  }
});

function returnToLobbyAuth() {
  AudioManager.playMusic('menu');
  gameManager.state = GameState.MAIN_MENU;
  gameHud.classList.add('hidden');
  gameHud.classList.remove('flex');

  // Disconnect from server and reset lobby component to auth panel
  lobby.reset();

  onlinePlayerTeams = [];
  activeOnlineMode = selectedOnlineMode;
  onlineTeamScores = { cyan: 0, magenta: 0 };
  teamMatchEndsAt = null;
  if (teamTimerInterval) clearInterval(teamTimerInterval);
  teamTimerInterval = null;

  // Reset menus
  screenDifficulty.classList.add('hidden');
  screenDifficulty.classList.remove('flex');
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  screenOnlineModeSelect.classList.add('hidden');
  screenMain.classList.add('hidden');
  
  lobby.show();
}

function returnToMenu() {
  AudioManager.playMusic('menu');
  gameManager.state = GameState.MAIN_MENU;
  gameHud.classList.add('hidden');
  gameHud.classList.remove('flex');

  // Disconnect from server and reset lobby component
  lobby.reset();

  onlinePlayerTeams = [];
  activeOnlineMode = selectedOnlineMode;
  onlineTeamScores = { cyan: 0, magenta: 0 };
  teamMatchEndsAt = null;
  if (teamTimerInterval) clearInterval(teamTimerInterval);
  teamTimerInterval = null;

  // Reset menus
  screenDifficulty.classList.add('hidden');
  screenDifficulty.classList.remove('flex');
  lobby.hide();
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  screenOnlineModeSelect.classList.add('hidden');
  spectatorBanner.classList.add('hidden');
  preGameOverlay.classList.add('hidden');
  
  teamMatchStrip.classList.add('hidden');

  safeGet('multiplayer-scoreboard')?.classList.add('hidden');
  updateNavHighlight('nav-lobby');
  screenMain.classList.remove('hidden');
  uiLayer.classList.remove('hidden');
}




// ---- BOOT SEQUENCE ----
let activeTutorialManager: TutorialManager | null = null;

function openStage2ClassSelector(initialClassId?: string) {
  showClassSelectModal({
    initialClassId: initialClassId || selectedClass,
    subtitle: 'Stage 2 · Class Certifications',
    title: 'Choose a Class to Certify',
    confirmLabel: 'START CERTIFICATION',
    cancelLabel: 'BACK TO TUTORIALS',
    isCertificationMode: true,
    onConfirm: (classId) => {
      selectedClass = classId as PlayerClass;
      activeTutorialManager?.stop();
      activeTutorialManager = new TutorialManager();
      activeTutorialManager.startStage2(selectedClass, () => {
        openStage2ClassSelector(selectedClass);
      });
    },
    onCancel: () => {
      window.location.href = 'modeselect.html?screen=tutorial';
    }
  });
}

function bootFromSessionConfig() {
  const bootConfigStr = sessionStorage.getItem('cascade_boot_config');
  if (bootConfigStr) {
    const config = JSON.parse(bootConfigStr);
    
    if (config.mode === 'TUTORIAL') {
      activeTutorialManager?.stop();
      if (config.stage === 2) {
        const initialClassId = config.selectedClass?.id || selectedClass;
        openStage2ClassSelector(initialClassId);
      } else if (config.stage === 3) {
        activeTutorialManager = new TutorialManager();
        activeTutorialManager.startStage3();
      } else {
        activeTutorialManager = new TutorialManager();
        activeTutorialManager.startStage1();
      }
    } else if (config.mode === 'SOLO' || config.mode === 'VS_BOT') {
      const initialClassId = config.selectedClass?.id || selectedClass;
      // Show loadout menu for single-player modes before starting
      showClassSelectModal({
        initialClassId: initialClassId,
        onConfirm: (classId) => {
          selectedClass = classId as PlayerClass;
          if (config.mode === 'SOLO') {
            startGame('SOLO');
          } else {
            startGame(config.botDifficulty === 'HARD' ? 'HARD' : 'EASY');
          }
        },
        onCancel: () => {
          window.location.href = 'modeselect.html?screen=solo';
        }
      });
    } else if (config.mode === 'ONLINE') {
      if (config.onlineModeId) selectedOnlineMode = config.onlineModeId;
      if (lobby && config.onlineModeId) lobby.selectedMode = config.onlineModeId;
      lobby.show();
    }
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootFromSessionConfig);
} else {
  bootFromSessionConfig();
}


