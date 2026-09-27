import './style.css'
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass'
import { mountOnlineModeSelect, ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect'
import { mountProgression, type ProgressionController } from './Progression'
import { mountSettings } from './Settings'
import { mountAuth } from './Auth'

const uiLayer = document.getElementById('ui-layer')!;
const screenMain = document.getElementById('screen-main')!;
const screenDifficulty = document.getElementById('screen-difficulty')!;
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
const btnVsBot = document.getElementById('btn-vs-bot')!;
const btnEasyBot = document.getElementById('btn-easy-bot')!;
const btnHardBot = document.getElementById('btn-hard-bot')!;
const btnBack = document.getElementById('btn-back')!;
const btnHowToPlay = document.getElementById('btn-how-to-play')!;
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

btnSolo.addEventListener('click', () => {
  bootGame({ mode: 'SOLO' });
});

btnVsBot.addEventListener('click', () => {
  screenMain.classList.remove('flex');
  screenMain.classList.add('hidden');
  screenDifficulty.classList.remove('hidden');
  screenDifficulty.classList.add('flex');
});

btnEasyBot.addEventListener('click', () => {
  bootGame({ mode: 'VS_BOT', botDifficulty: 'EASY' });
});

btnHardBot.addEventListener('click', () => {
  bootGame({ mode: 'VS_BOT', botDifficulty: 'HARD' });
});

btnBack.addEventListener('click', () => {
  screenDifficulty.classList.remove('flex');
  screenDifficulty.classList.add('hidden');
  screenMain.classList.remove('hidden');
  screenMain.classList.add('flex');
});

btnHowToPlay.addEventListener('click', () => {
  tutorialModal.classList.remove('hidden');
});

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

// Auto-show tutorial on first visit
if (!localStorage.getItem('cascade_tutorial_seen')) {
  setTimeout(() => {
    tutorialModal.classList.remove('hidden');
    localStorage.setItem('cascade_tutorial_seen', 'true');
  }, 500);
}
