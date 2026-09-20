/**
 * AudioManager — singleton for all game audio (OST + SFX).
 *
 * Usage:
 *   import { AudioManager } from './AudioManager';
 *   AudioManager.resumeContext();          // call on first user interaction
 *   AudioManager.playMusic('menu');        // start looping menu music
 *   AudioManager.playSfx('menuSelect');    // one-shot button click sound
 */

// ---------------------------------------------------------------------------
// Track definitions
// ---------------------------------------------------------------------------

const MUSIC_TRACKS = {
  menu:  '/audio/ost/Menu.wav',
  game:  '/audio/ost/GameMusic.m4a',
  // finalRound: '/audio/ost/FinalRound.m4a',  // reserved for future use
} as const;

const SFX_CLIPS = {
  menuSelect: '/audio/sfx/MenuSelect.wav',
  lineClear:  '/audio/sfx/LineClear.wav',
} as const;

type MusicTrack = keyof typeof MUSIC_TRACKS;
type SfxClip   = keyof typeof SFX_CLIPS;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let musicVolume = 0.3;
let sfxVolume   = 0.6;
let unlocked    = false;

/** The currently playing music element (if any). */
let currentMusic: HTMLAudioElement | null = null;
let currentTrack: MusicTrack | null = null;

/** Pre-loaded Audio elements keyed by path — avoids re-fetching. */
const audioCache = new Map<string, HTMLAudioElement>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrCreate(src: string): HTMLAudioElement {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = 'auto';
    audioCache.set(src, audio);
  }
  return audio;
}

/** Preload all tracks so they're ready when needed. */
function preload() {
  for (const src of Object.values(MUSIC_TRACKS)) getOrCreate(src);
  for (const src of Object.values(SFX_CLIPS))    getOrCreate(src);
}

// Kick off preloading immediately on import
preload();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const AudioManager = {
  /**
   * Must be called from a user-initiated event (click / keydown) to unlock
   * the Web Audio autoplay policy. Safe to call multiple times.
   */
  resumeContext() {
    if (unlocked) return;
    unlocked = true;

    // Play + immediately pause a silent buffer to unlock the audio context
    // across all browsers. Subsequent play() calls will work normally.
    const silent = new Audio();
    silent.play().catch(() => {/* expected to fail silently */});

    // If music was requested before unlock, start it now
    if (currentTrack && currentMusic) {
      currentMusic.play().catch(() => {});
    }
  },

  /**
   * Start looping a music track. If a different track is already playing
   * it will be stopped and replaced.
   */
  playMusic(track: MusicTrack) {
    if (currentTrack === track && currentMusic && !currentMusic.paused) return;

    // Stop previous
    if (currentMusic) {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }

    const src = MUSIC_TRACKS[track];
    const audio = getOrCreate(src);
    audio.loop = true;
    audio.volume = musicVolume;
    audio.currentTime = 0;
    currentMusic = audio;
    currentTrack = track;

    if (unlocked) {
      audio.play().catch(() => {});
    }
  },

  /** Stop all music. */
  stopMusic() {
    if (currentMusic) {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }
    currentMusic = null;
    currentTrack = null;
  },

  /**
   * Play a one-shot sound effect. Uses cloneNode so rapid-fire calls
   * (e.g. consecutive line clears) overlap instead of cutting off.
   */
  playSfx(name: SfxClip) {
    if (!unlocked) return;
    const src = SFX_CLIPS[name];
    const base = getOrCreate(src);
    const clone = base.cloneNode() as HTMLAudioElement;
    clone.volume = sfxVolume;
    clone.play().catch(() => {});
  },

  /** Set music volume (0.0 – 1.0). */
  setMusicVolume(v: number) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (currentMusic) currentMusic.volume = musicVolume;
  },

  /** Set SFX volume (0.0 – 1.0). */
  setSfxVolume(v: number) {
    sfxVolume = Math.max(0, Math.min(1, v));
  },

  /** Current music volume. */
  get musicVolume() { return musicVolume; },

  /** Current SFX volume. */
  get sfxVolume() { return sfxVolume; },
};
