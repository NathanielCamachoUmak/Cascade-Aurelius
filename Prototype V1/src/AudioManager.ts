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

export type OstCode = 'SF' | 'SC' | string;

export interface OstTrackDef {
  code: OstCode;
  name: string;
  src: string;
  cost: number;
  description: string;
  accent: string;
}

/**
 * Purchasable / unlockable in-game OST catalog keyed by compact song initials:
 * - SF = SpaceFriends (Default unlocked, 0 pts)
 * - SC = Stracchino (Purchasable cosmetic, 250 pts)
 */
export const OST_TRACKS: Record<string, OstTrackDef> = {
  SF: {
    code: 'SF',
    name: 'SpaceFriends',
    src: '/audio/ost/SpaceFriends.m4a',
    cost: 0,
    description: 'Default cosmic synthwave soundtrack (SF). Included for all players.',
    accent: '#00e5ff',
  },
  SC: {
    code: 'SC',
    name: 'Stracchino',
    src: '/audio/ost/Stracchino.wav',
    cost: 250,
    description: 'High-tempo arcade soundtrack (SC). Unlockable with match points.',
    accent: '#ffd700',
  },
};

const MUSIC_TRACKS = {
  menu: ['/audio/ost/Menu.wav'],
  game: Object.values(OST_TRACKS).map(t => t.src),
  // finalRound: ['/audio/ost/FinalRound.m4a'],  // reserved for future use
} as const;

const SFX_CLIPS = {
  menuSelect: '/audio/sfx/sfx-Select.wav',
  lineClear:  '/audio/sfx/sfx-LineClear.wav',
  bomb:       '/audio/sfx/sfx-Bomb.mp3',
  death:      '/audio/sfx/sfx-Death.mp3',
  freeze:     '/audio/sfx/sfx-Freeze.mp3',
  multiplier: '/audio/sfx/sfx-Multiplier.mp3',
  shield:     '/audio/sfx/sfx-Shield.mp3',
  ultimate:   '/audio/sfx/sfx-Ultimate.mp3',
} as const;

type MusicTrack = keyof typeof MUSIC_TRACKS;
type SfxClip   = keyof typeof SFX_CLIPS;

const PROGRESSION_STORAGE_KEY = 'cascade-aurelius-progression-v1';

/**
 * Returns the candidate in-game OST file path(s) based on the player's
 * unlocked and equipped music initials in localStorage (defaults to 'SF').
 */
function getAllowedGameMusicSources(): string[] {
  try {
    const raw = localStorage.getItem(PROGRESSION_STORAGE_KEY);
    if (!raw) return [OST_TRACKS.SF.src];
    const parsed = JSON.parse(raw);
    const unlockedCodes: string[] = Array.isArray(parsed?.unlockedMusic)
      ? Array.from(new Set(['SF', ...parsed.unlockedMusic]))
      : ['SF'];
    // Also check legacy/cosmetics map for unlocked/equipped music codes
    if (parsed?.cosmetics && typeof parsed.cosmetics === 'object') {
      for (const code of Object.keys(OST_TRACKS)) {
        if (parsed.cosmetics[code]?.unlocked && !unlockedCodes.includes(code)) {
          unlockedCodes.push(code);
        }
      }
    }

    const equippedCode: string | undefined = parsed?.equippedMusic;
    if (equippedCode && unlockedCodes.includes(equippedCode) && OST_TRACKS[equippedCode]) {
      return [OST_TRACKS[equippedCode].src];
    }

    const validSources = unlockedCodes
      .map(code => OST_TRACKS[code]?.src)
      .filter((src): src is string => Boolean(src));
    return validSources.length > 0 ? validSources : [OST_TRACKS.SF.src];
  } catch {
    return [OST_TRACKS.SF.src];
  }
}

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
  for (const group of Object.values(MUSIC_TRACKS)) {
    for (const src of group) getOrCreate(src);
  }
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
    const group: readonly string[] = track === 'game' ? getAllowedGameMusicSources() : MUSIC_TRACKS[track];
    if (currentTrack === track && currentMusic && !currentMusic.paused) {
      const isCurrentAllowed = group.some(src => currentMusic === audioCache.get(src));
      if (isCurrentAllowed) return;
    }

    // Stop previous
    if (currentMusic) {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }

    const src = group[Math.floor(Math.random() * group.length)];
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

  /** Currently queued or playing track category. */
  get currentTrack() { return currentTrack; },
};
