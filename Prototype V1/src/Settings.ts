import { AudioManager } from './AudioManager';
import { supabase } from './supabase';

export interface SettingsData {
  musicEnabled: boolean;
  musicVolume: number; // 0–100, only meaningful while musicEnabled
  sfxEnabled: boolean;
  sfxVolume: number; // 0–100, only meaningful while sfxEnabled
  visualEffectsEnabled: boolean; // line-clear particles/flashes
}

const STORAGE_KEY = 'cascade-aurelius-settings-v1';

function defaultSettings(): SettingsData {
  return { musicEnabled: true, musicVolume: 30, sfxEnabled: true, sfxVolume: 60, visualEffectsEnabled: true };
}

function readSettings(): SettingsData {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<SettingsData> | null;
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

// Live, shared settings state. Other modules (GameManager, main.ts) import
// and read this directly at the point of use instead of needing an
// event/callback system — matches how showGhostPiece etc. already work.
export const settingsState: SettingsData = readSettings();

let currentUserId: string | null = null;
let settingsRefreshCallback: (() => void) | null = null;

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUserId = session?.user?.id || null;
  if (currentUserId) {
    // User logged in, fetch settings from cloud
    const { data } = await supabase.from('profiles').select('settings_and_hotkeys').eq('id', currentUserId).single();
    if (data && data.settings_and_hotkeys) {
      const cloudSettings = data.settings_and_hotkeys as Partial<SettingsData>;
      Object.assign(settingsState, { ...defaultSettings(), ...cloudSettings });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsState));
      applyAudioSettings();
      if (settingsRefreshCallback) settingsRefreshCallback();
    }
  }
});

async function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsState));
  if (currentUserId) {
    // Push to Supabase quietly
    await supabase.from('profiles').update({
      settings_and_hotkeys: settingsState
    }).eq('id', currentUserId);
  }
}

function applyAudioSettings() {
  AudioManager.setMusicVolume(settingsState.musicEnabled ? settingsState.musicVolume / 100 : 0);
  AudioManager.setSfxVolume(settingsState.sfxEnabled ? settingsState.sfxVolume / 100 : 0);
}
// Apply immediately on load so the very first note of menu music already
// respects a saved mute/volume preference, not just after opening Settings.
applyAudioSettings();

const STYLE_ID = 'bq-settings-style';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.bq-settings-overlay{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:1rem;background:rgba(2,4,15,.88);backdrop-filter:blur(8px)}.bq-settings-overlay.open{display:flex}.bq-settings-panel{width:min(100%,480px);max-height:92vh;overflow:auto;background:linear-gradient(145deg,#171943,#07091d);border:1px solid rgba(0,229,255,.4);border-radius:1rem;color:#eef2ff;box-shadow:0 0 70px rgba(0,229,255,.15);font-family:Inter,system-ui,sans-serif}.bq-settings-head{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid rgba(169,176,255,.2)}.bq-settings-head h2{margin:0;font-size:1.1rem}.bq-settings-head p{margin:.3rem 0 0;color:#00e5ff;font-size:.65rem;font-weight:800;letter-spacing:.14em}.bq-settings-close{background:transparent;border:1px solid #596080;color:white;border-radius:.4rem;font-size:1.2rem;width:2rem;height:2rem;cursor:pointer}.bq-settings-body{padding:1.25rem;display:flex;flex-direction:column;gap:1rem}.bq-settings-row{padding:.85rem;border:1px solid rgba(169,176,255,.18);border-radius:.6rem;background:rgba(255,255,255,.035)}.bq-settings-row-head{display:flex;justify-content:space-between;align-items:center}.bq-settings-row-head span{font-size:.82rem;font-weight:700;color:#eef2ff}.bq-settings-row p{margin:.35rem 0 0;color:#9da6c8;font-size:.7rem;line-height:1.4}.bq-settings-slider{width:100%;margin-top:.7rem;accent-color:#00e5ff}.bq-settings-slider:disabled{opacity:.35}.bq-settings-switch{position:relative;width:2.6rem;height:1.5rem;flex-shrink:0}.bq-settings-switch input{opacity:0;width:0;height:0}.bq-settings-switch-track{position:absolute;inset:0;background:#2a2f52;border-radius:999px;cursor:pointer;transition:background .2s}.bq-settings-switch-track::before{content:'';position:absolute;left:.2rem;top:.2rem;width:1.1rem;height:1.1rem;background:#c7ccef;border-radius:50%;transition:transform .2s,background .2s}.bq-settings-switch input:checked+.bq-settings-switch-track{background:#00b8cc}.bq-settings-switch input:checked+.bq-settings-switch-track::before{transform:translateX(1.1rem);background:#eef2ff}`;
  document.head.appendChild(style);
}

export interface SettingsController {
  state: SettingsData;
}

export function mountSettings(settingsNav: HTMLElement): SettingsController {
  ensureStyles();

  const overlay = document.createElement('div');
  overlay.className = 'bq-settings-overlay';
  overlay.innerHTML = `
    <div class="bq-settings-panel" role="dialog" aria-modal="true">
      <div class="bq-settings-head">
        <div><p>GAME SETTINGS</p><h2>Audio & Effects</h2></div>
        <button class="bq-settings-close" type="button">×</button>
      </div>
      <div class="bq-settings-body">
        <div class="bq-settings-row">
          <div class="bq-settings-row-head">
            <span>Background Music</span>
            <label class="bq-settings-switch"><input type="checkbox" data-music-toggle /><span class="bq-settings-switch-track"></span></label>
          </div>
          <p>The looping menu/gameplay soundtrack.</p>
          <input type="range" min="0" max="100" class="bq-settings-slider" data-music-volume />
        </div>
        <div class="bq-settings-row">
          <div class="bq-settings-row-head">
            <span>Sound Effects</span>
            <label class="bq-settings-switch"><input type="checkbox" data-sfx-toggle /><span class="bq-settings-switch-track"></span></label>
          </div>
          <p>Line clears, menu clicks, and other one-shot sounds.</p>
          <input type="range" min="0" max="100" class="bq-settings-slider" data-sfx-volume />
        </div>
        <div class="bq-settings-row">
          <div class="bq-settings-row-head">
            <span>Visual Effects</span>
            <label class="bq-settings-switch"><input type="checkbox" data-vfx-toggle /><span class="bq-settings-switch-track"></span></label>
          </div>
          <p>Line-clear particle bursts and flash effects. Turn off for a calmer or lower-powered display.</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const musicToggle = overlay.querySelector<HTMLInputElement>('[data-music-toggle]')!;
  const musicSlider = overlay.querySelector<HTMLInputElement>('[data-music-volume]')!;
  const sfxToggle = overlay.querySelector<HTMLInputElement>('[data-sfx-toggle]')!;
  const sfxSlider = overlay.querySelector<HTMLInputElement>('[data-sfx-volume]')!;
  const vfxToggle = overlay.querySelector<HTMLInputElement>('[data-vfx-toggle]')!;

  const refresh = () => {
    musicToggle.checked = settingsState.musicEnabled;
    musicSlider.value = String(settingsState.musicVolume);
    musicSlider.disabled = !settingsState.musicEnabled;
    sfxToggle.checked = settingsState.sfxEnabled;
    sfxSlider.value = String(settingsState.sfxVolume);
    sfxSlider.disabled = !settingsState.sfxEnabled;
    vfxToggle.checked = settingsState.visualEffectsEnabled;
  };
  settingsRefreshCallback = refresh;

  musicToggle.addEventListener('change', () => {
    settingsState.musicEnabled = musicToggle.checked;
    applyAudioSettings();
    persist();
    refresh();
  });
  musicSlider.addEventListener('input', () => {
    settingsState.musicVolume = Number(musicSlider.value);
    applyAudioSettings();
    persist();
  });
  sfxToggle.addEventListener('change', () => {
    settingsState.sfxEnabled = sfxToggle.checked;
    applyAudioSettings();
    persist();
    refresh();
  });
  sfxSlider.addEventListener('input', () => {
    settingsState.sfxVolume = Number(sfxSlider.value);
    applyAudioSettings();
    persist();
  });
  sfxSlider.addEventListener('change', () => AudioManager.playSfx('menuSelect')); // preview on release
  vfxToggle.addEventListener('change', () => {
    settingsState.visualEffectsEnabled = vfxToggle.checked;
    persist();
  });

  settingsNav.addEventListener('click', event => {
    event.preventDefault();
    refresh();
    overlay.classList.add('open');
  });
  overlay.querySelector('.bq-settings-close')?.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.classList.remove('open');
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') overlay.classList.remove('open');
  });

  refresh();
  return { state: settingsState };
}