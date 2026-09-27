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
const screenClassSelect = document.getElementById('screen-class-select')!;
const classCardList = document.getElementById('class-card-list')!;
const btnClassContinue = document.getElementById('btn-class-continue')!;
const btnClassBack = document.getElementById('btn-class-back')!;
const btnPlayOnline = document.getElementById('btn-play-online')!;
const navProfile = document.getElementById('nav-profile');
const navSettings = document.getElementById('nav-settings');

mountAuth();
if (navProfile) mountProgression(navProfile);
if (navSettings) mountSettings(navSettings);

type ModeType = 'SOLO' | 'VS_BOT' | 'ONLINE' | null;
let pendingMode: ModeType = null;
let selectedClass: any = PLAYER_CLASSES[0];
let onlineModeId: OnlineModeId = ONLINE_GAME_MODES[0].id;

function updateNavHighlight(activeId: string) {
  const ids = ['nav-menu', 'nav-modes', 'nav-lobby', 'nav-settings', 'nav-profile'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === activeId) {
      el.classList.add('nav-active', 'text-white');
      el.classList.remove('text-gray-400');
    } else {
      el.classList.remove('nav-active', 'text-white');
      el.classList.add('text-gray-400');
    }
  });
}

function bootGame(config: any) {
  sessionStorage.setItem('cascade_boot_config', JSON.stringify(config));
  window.location.href = 'lobby.html';
}

btnSolo.addEventListener('click', () => {
  updateNavHighlight('nav-modes');
  pendingMode = 'SOLO';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
  renderClassSelect();
});

btnVsBot.addEventListener('click', () => {
  updateNavHighlight('nav-modes');
  pendingMode = 'VS_BOT';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
  renderClassSelect();
});

btnPlayOnline.addEventListener('click', () => {
  updateNavHighlight('nav-modes');
  pendingMode = 'ONLINE';
  screenMain.classList.add('hidden');
  showOnlineModeSelect();
});

function showOnlineModeSelect() {
  screenOnlineModeSelect.classList.remove('hidden');
  screenOnlineModeSelect.classList.add('flex');
}

mountOnlineModeSelect({
  container: screenOnlineModeSelect,
  onConfirm: (mode) => {
    onlineModeId = mode.id;
    screenOnlineModeSelect.classList.remove('flex');
    screenOnlineModeSelect.classList.add('hidden');
    screenClassSelect.classList.remove('hidden');
    screenClassSelect.classList.add('flex');
    renderClassSelect();
  },
  onBack: () => {
    screenOnlineModeSelect.classList.remove('flex');
    screenOnlineModeSelect.classList.add('hidden');
    updateNavHighlight('nav-menu');
    screenMain.classList.remove('hidden');
  }
});

btnClassBack.addEventListener('click', () => {
  screenClassSelect.classList.remove('flex');
  screenClassSelect.classList.add('hidden');
  if (pendingMode === 'ONLINE') {
    showOnlineModeSelect();
  } else {
    updateNavHighlight('nav-menu');
    screenMain.classList.remove('hidden');
  }
});

btnClassContinue.addEventListener('click', () => {
  if (pendingMode === 'SOLO') {
    bootGame({ mode: 'SOLO', selectedClass });
  } else if (pendingMode === 'VS_BOT') {
    screenClassSelect.classList.remove('flex');
    screenClassSelect.classList.add('hidden');
    screenDifficulty.classList.remove('hidden');
    screenDifficulty.classList.add('flex');
  } else if (pendingMode === 'ONLINE') {
    bootGame({ mode: 'ONLINE', selectedClass, onlineModeId });
  }
});

btnBack.addEventListener('click', () => {
  updateNavHighlight('nav-modes');
  screenDifficulty.classList.remove('flex');
  screenDifficulty.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
});

btnEasyBot.addEventListener('click', () => {
  bootGame({ mode: 'VS_BOT', botDifficulty: 'EASY', selectedClass });
});
btnHardBot.addEventListener('click', () => {
  bootGame({ mode: 'VS_BOT', botDifficulty: 'HARD', selectedClass });
});

function renderClassSelect() {
  classCardList.innerHTML = '';
  PLAYER_CLASSES.forEach((playerClass, index) => {
    const isSelected = selectedClass === playerClass;
    const card = document.createElement('div');
    const color = ['#00FFFF', '#FFD700', '#FF1493', '#00FF00'][index];
    card.className = `relative p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
      isSelected ? 'border-[' + color + '] bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-card-border bg-card-bg/60 hover:border-gray-500'
    }`;
    card.style.borderColor = isSelected ? color : '';

    card.innerHTML = `
      <div class='flex flex-col h-full'>
        <div class='flex justify-between items-start mb-3'>
          <div>
            <h3 class='text-lg font-bold uppercase tracking-wider' style='color: ${color}'>${playerClass.name}</h3>
            <span class='text-[9px] text-gray-400 tracking-widest uppercase'>${playerClass.tagline}</span>
          </div>
        </div>
        <div class='text-xs text-gray-300 mb-4 flex-1'>
          <p class='mb-2'><b>Passive:</b> ${playerClass.passiveDescription}</p>
        </div>
        <div class='flex flex-col gap-2 mt-auto'>
          <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
            <span class='text-neon-cyan font-bold'>Q:</span> ${playerClass.abilityQName}
          </div>
          <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
            <span class='text-neon-yellow font-bold'>E:</span> ${playerClass.abilityEName}
          </div>
          <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
            <span class='text-neon-pink font-bold'>R:</span> ${playerClass.ultimateName} (${playerClass.ultimateCost})
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      selectedClass = playerClass;
      renderClassSelect();
    });
    classCardList.appendChild(card);
  });
}

btnHowToPlay.addEventListener('click', () => {
  tutorialModal.classList.remove('hidden');
  tutorialModal.classList.add('flex');
});
btnTutorialClose.addEventListener('click', () => {
  tutorialModal.classList.add('hidden');
  tutorialModal.classList.remove('flex');
});

updateNavHighlight('nav-menu');
