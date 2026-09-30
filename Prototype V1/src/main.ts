import './globalAudio';
import './style.css'
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass'
import { mountOnlineModeSelect, ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect'
import { mountProgression, type ProgressionController } from './Progression'
import { mountSettings, settingsState } from './Settings'
import { mountAuth } from './Auth'
import { isTutorialCompleted } from './TutorialManager'

const uiLayer = document.getElementById('ui-layer')!;
const screenMain = document.getElementById('screen-main')!;
const screenSoloOptions = document.getElementById('screen-solo-options')!;
const screenTutorialMenu = document.getElementById('screen-tutorial-menu');
function getOrCreateOnlineModeSelectScreen() {
  const existing = document.getElementById('screen-online-mode-select');
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = 'screen-online-mode-select';
  created.className = 'hidden relative z-10 w-full max-w-6xl px-4';
  uiLayer.appendChild(created);
  return created;
}
const screenOnlineModeSelect = getOrCreateOnlineModeSelectScreen();

const btnSolo = document.getElementById('btn-solo')!;
const btnSoloTutorial = document.getElementById('btn-solo-tutorial')!;
const btnSoloGame = document.getElementById('btn-solo-game')!;
const btnEasyBot = document.getElementById('btn-easy-bot')!;
const btnHardBot = document.getElementById('btn-hard-bot')!;
const btnBack = document.getElementById('btn-back')!;
const btnHowToPlay = document.getElementById('btn-how-to-play')!;
const btnSoloHowToPlay = document.getElementById('btn-solo-how-to-play');
const btnStartBasicsTutorial = document.getElementById('btn-start-basics-tutorial');
const statusBasicsTutorial = document.getElementById('status-basics-tutorial');
const btnTutorialMenuBack = document.getElementById('btn-tutorial-menu-back');
const btnTutorialClose = document.getElementById('btn-tutorial-close')!;
const tutorialModal = document.getElementById('tutorial-modal')!;
const btnPlayOnline = document.getElementById('btn-play-online')!;
const navProfile = document.getElementById('nav-profile');
const navSettings = document.getElementById('nav-settings');

mountAuth();
if (navProfile) mountProgression(navProfile);
if (navSettings) mountSettings(navSettings);

type ModeType = 'SOLO' | 'VS_BOT' | 'ONLINE' | null;
let pendingMode: ModeType = null;
let onlineModeId: OnlineModeId = ONLINE_GAME_MODES[0].id;

function updateNavHighlight(activeId: string) {
  const ids = ['nav-menu', 'nav-modes', 'nav-lobby', 'nav-settings', 'nav-profile'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === activeId) {
      el.classList.add('nav-active', 'text-white');
      el.classList.remove('text-gray-400', 'hover:text-gray-200');
    } else {
      el.classList.remove('nav-active', 'text-white');
      el.classList.add('text-gray-400', 'hover:text-gray-200');
    }
  });
}

function bootGame(config: any) {
  sessionStorage.setItem('cascade_boot_config', JSON.stringify(config));
  window.location.href = 'lobby.html';
}

function refreshTutorialMenuStatuses() {
  const completed = isTutorialCompleted('cascade-basics');
  if (btnStartBasicsTutorial) {
    btnStartBasicsTutorial.textContent = completed ? 'REPLAY' : 'START';
  }
  if (statusBasicsTutorial) {
    if (completed) {
      statusBasicsTutorial.textContent = '✓ COMPLETED';
      statusBasicsTutorial.className = 'min-w-[130px] text-center px-3 py-2 rounded-lg border border-neon-green/50 bg-neon-green/10 text-neon-green text-[10px] font-bold tracking-widest uppercase';
    } else {
      statusBasicsTutorial.textContent = 'NOT COMPLETED';
      statusBasicsTutorial.className = 'min-w-[130px] text-center px-3 py-2 rounded-lg border border-card-border bg-deep-purple/80 text-gray-400 text-[10px] font-bold tracking-widest uppercase';
    }
  }
}

function openTutorialMenu() {
  refreshTutorialMenuStatuses();
  screenMain.classList.remove('flex');
  screenMain.classList.add('hidden');
  screenSoloOptions.classList.remove('flex');
  screenSoloOptions.classList.add('hidden');
  if (screenTutorialMenu) {
    screenTutorialMenu.classList.remove('hidden');
    screenTutorialMenu.classList.add('flex');
  }
}

btnSolo.addEventListener('click', () => {
  screenMain.classList.remove('flex');
  screenMain.classList.add('hidden');
  screenSoloOptions.classList.remove('hidden');
  screenSoloOptions.classList.add('flex');
});

btnSoloGame.addEventListener('click', () => {
  bootGame({ mode: 'SOLO' });
});

btnSoloTutorial.addEventListener('click', () => {
  openTutorialMenu();
});

if (btnStartBasicsTutorial) {
  btnStartBasicsTutorial.addEventListener('click', () => {
    bootGame({ mode: 'TUTORIAL', stage: 1 });
  });
}

if (btnTutorialMenuBack) {
  btnTutorialMenuBack.addEventListener('click', () => {
    if (screenTutorialMenu) {
      screenTutorialMenu.classList.remove('flex');
      screenTutorialMenu.classList.add('hidden');
    }
    screenSoloOptions.classList.remove('hidden');
    screenSoloOptions.classList.add('flex');
  });
}

// Automatically open the Tutorial Menu if navigated back with ?screen=tutorial
if (new URLSearchParams(window.location.search).get('screen') === 'tutorial') {
  openTutorialMenu();
}

btnEasyBot.addEventListener('click', () => {
  bootGame({ mode: 'VS_BOT', botDifficulty: 'EASY' });
});

btnHardBot.addEventListener('click', () => {
  bootGame({ mode: 'VS_BOT', botDifficulty: 'HARD' });
});

btnBack.addEventListener('click', () => {
  screenSoloOptions.classList.remove('flex');
  screenSoloOptions.classList.add('hidden');
  screenMain.classList.remove('hidden');
  screenMain.classList.add('flex');
});

btnHowToPlay.addEventListener('click', () => {
  tutorialModal.classList.remove('hidden');
});

if (btnSoloHowToPlay) {
  btnSoloHowToPlay.addEventListener('click', () => {
    tutorialModal.classList.remove('hidden');
  });
}

btnTutorialClose.addEventListener('click', () => {
  tutorialModal.classList.add('hidden');
});

// Setup Online Mode Select Component
mountOnlineModeSelect({
  container: screenOnlineModeSelect,
  onBack: () => {
    updateNavHighlight('nav-modes');
    screenOnlineModeSelect.classList.remove('flex');
    screenOnlineModeSelect.classList.add('hidden');
    screenMain.classList.remove('hidden');
    screenMain.classList.add('flex');
  },
  onConfirm: (mode) => {
    onlineModeId = mode.id;
    bootGame({ mode: 'ONLINE', onlineModeId });
  }
});

btnPlayOnline.addEventListener('click', () => {
  pendingMode = 'ONLINE';
  screenMain.classList.remove('flex');
  screenMain.classList.add('hidden');
  screenOnlineModeSelect.classList.remove('hidden');
  screenOnlineModeSelect.classList.add('flex');
});

function updateTutorialTooltip() {
  const tooltip = document.getElementById('solo-tutorial-tooltip');
  if (!tooltip) return;

  if (settingsState.tutorialEnabled) {
    tooltip.classList.remove('hidden');
  } else {
    tooltip.classList.add('hidden');
  }
}

// Show tooltip pointing to Solo mode based on settings
setTimeout(() => {
  updateTutorialTooltip();
}, 500);

window.addEventListener('tutorialSettingChanged', () => {
  updateTutorialTooltip();
});

// Hook into btnSolo to hide tooltip and disable the setting
btnSolo.addEventListener('click', () => {
  if (settingsState.tutorialEnabled) {
    settingsState.tutorialEnabled = false;
    updateTutorialTooltip();
    
    // Also save it so it persists when turning it off via playing
    try {
      const STORAGE_KEY = 'cascade-aurelius-settings-v1';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsState));
      // Optionally we'd notify supbase here too, but simple localStorage is enough for this interaction
    } catch (e) {}
  }
});
