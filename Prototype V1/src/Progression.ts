import { supabase } from './supabase';
import { showToast } from './Toast';
import { AudioManager, OST_TRACKS } from './AudioManager';

export type ProgressionMode = 'classic-pvp' | 'free-for-all' | 'team-deathmatch' | 'battle-royale';
export type CosmeticKind = 'block-skin' | 'special-effect' | 'profile-style' | 'music';

export interface MatchProgressionInput {
  mode: ProgressionMode;
  won: boolean;
  score: number;
  lines: number;
  kills: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  reward: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface Cosmetic {
  id: string;
  name: string;
  kind: CosmeticKind;
  description: string;
  cost: number;
  accent: string;
  unlocked: boolean;
  equipped: boolean;
}

interface SaveData {
  points: number;
  wins: number;
  matches: number;
  achievements: Record<string, { unlocked: boolean; unlockedAt?: number }>;
  cosmetics: Record<string, { unlocked: boolean; equipped: boolean }>;
  /** Compact array of unlocked song initials (e.g. ['SF', 'SC']) */
  unlockedMusic: string[];
  /** Currently equipped song initial (e.g. 'SF' or 'SC') */
  equippedMusic: string;
}

const STORAGE_KEY = 'cascade-aurelius-progression-v1';
const MODE_LABELS: Record<ProgressionMode, string> = {
  'classic-pvp': 'Classic PvP',
  'free-for-all': 'Free For All',
  'team-deathmatch': '3v3 Deathmatch',
  'battle-royale': 'Battle Royale',
};

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
  { id: 'first-win', title: 'First Victory', description: 'Win your first multiplayer match.', reward: 100 },
  { id: 'top-player', title: 'Top Player', description: 'Win a match while leading the final result.', reward: 150 },
  { id: 'top-lines', title: 'Line Architect', description: 'Clear at least 20 lines in one match.', reward: 125 },
  { id: 'classic-champion', title: 'Classic Champion', description: 'Win a Classic PvP match.', reward: 150 },
  { id: 'ffa-champion', title: 'FFA Champion', description: 'Win a Free For All match.', reward: 200 },
  { id: 'tdm-champion', title: 'Circuit Champion', description: 'Win a 3v3 Deathmatch match.', reward: 250 },
  { id: 'br-champion', title: 'Last Board Standing', description: 'Win a Battle Royale match.', reward: 400 },
  { id: 'high-score', title: 'Score Surge', description: 'Reach 100,000 points in a match.', reward: 200 },
  { id: 'triple-threat', title: 'Triple Threat', description: 'Win in Classic, FFA, and 3v3 Deathmatch.', reward: 500 },
];

const MUSIC_COSMETIC_DEFS: Omit<Cosmetic, 'unlocked' | 'equipped'>[] = Object.values(OST_TRACKS).map(track => ({
  id: track.code,
  name: `${track.name} (${track.code})`,
  kind: 'music' as const,
  description: track.description,
  cost: track.cost,
  accent: track.accent,
}));

const COSMETIC_DEFS: Omit<Cosmetic, 'unlocked' | 'equipped'>[] = [
  { id: 'cyan-circuit', name: 'Cyan Circuit', kind: 'block-skin', description: 'Electric cyan blocks with a bright edge highlight.', cost: 0, accent: '#00e5ff' },
  { id: 'solar-gold', name: 'Solar Gold', kind: 'block-skin', description: 'Warm gold blocks for a championship look.', cost: 250, accent: '#ffd700' },
  { id: 'neon-orchid', name: 'Neon Orchid', kind: 'block-skin', description: 'Violet-magenta blocks with a high-contrast glow.', cost: 500, accent: '#d946ef' },
  { id: 'profile-operator', name: 'Operator Profile', kind: 'profile-style', description: 'A premium profile frame and rank accent.', cost: 350, accent: '#a78bfa' },
  { id: 'spark-burst', name: 'Spark Burst', kind: 'special-effect', description: 'A gold burst when a reward or achievement unlocks.', cost: 300, accent: '#ffc107' },
  { id: 'void-pulse', name: 'Void Pulse', kind: 'special-effect', description: 'A purple pulse for elite match results.', cost: 650, accent: '#8b5cf6' },
  ...MUSIC_COSMETIC_DEFS,
];

function normalizeUnlockedMusic(codes?: string[], cosmetics?: Record<string, { unlocked: boolean; equipped: boolean }>): string[] {
  const set = new Set<string>(['SF']);
  if (Array.isArray(codes)) {
    for (const code of codes) {
      if (typeof code === 'string' && code.trim()) set.add(code.trim().toUpperCase());
    }
  }
  if (cosmetics && typeof cosmetics === 'object') {
    for (const code of Object.keys(OST_TRACKS)) {
      if (cosmetics[code]?.unlocked) set.add(code);
    }
  }
  return Array.from(set);
}

function freshSave(): SaveData {
  return { points: 0, wins: 0, matches: 0, achievements: {}, cosmetics: {}, unlockedMusic: ['SF'], equippedMusic: 'SF' };
}
function readSave(): SaveData {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<SaveData> | null;
    const cosmetics = parsed?.cosmetics || {};
    const unlockedMusic = normalizeUnlockedMusic(parsed?.unlockedMusic, cosmetics);
    const equippedMusic = parsed?.equippedMusic && unlockedMusic.includes(parsed.equippedMusic)
      ? parsed.equippedMusic
      : 'SF';
    return {
      ...freshSave(),
      ...parsed,
      achievements: parsed?.achievements || {},
      cosmetics,
      unlockedMusic,
      equippedMusic,
    };
  } catch { return freshSave(); }
}

export class ProgressionStore {
  private save: SaveData = readSave();
  private history: ProgressionMode[] = [];
  public currentUserId: string | null = null;
  public onRefreshNeeded: (() => void) | null = null;

  constructor() {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      this.currentUserId = session?.user?.id || null;
      if (this.currentUserId) {
        // Fetch progression + unlocked_music from cloud (with fallback if columns aren't added yet)
        let data: any = null;
        const res = await supabase
          .from('profiles')
          .select('wins, games_played, unlocked_music, equipped_music, progression_data, settings_and_hotkeys')
          .eq('id', this.currentUserId)
          .single();
        if (!res.error && res.data) {
          data = res.data;
        } else {
          const fallback = await supabase
            .from('profiles')
            .select('wins, games_played, progression_data, settings_and_hotkeys')
            .eq('id', this.currentUserId)
            .single();
          if (!fallback.error && fallback.data) {
            data = fallback.data;
          } else {
            const legacyFallback = await supabase
              .from('profiles')
              .select('wins, games_played, settings_and_hotkeys')
              .eq('id', this.currentUserId)
              .single();
            data = legacyFallback.data;
          }
        }
        if (data) {
          this.save.wins = data.wins ?? this.save.wins;
          this.save.matches = data.games_played ?? this.save.matches;
          const cloudSettings: any = data.settings_and_hotkeys || {};
          const progSource = data.progression_data || cloudSettings.progressionData;
          if (progSource) {
            this.save.points = progSource.points ?? this.save.points;
            this.save.achievements = progSource.achievements ?? this.save.achievements;
            this.save.cosmetics = progSource.cosmetics ?? this.save.cosmetics;
          }
          const cloudMusicCodes = Array.isArray(data.unlocked_music)
            ? data.unlocked_music
            : Array.isArray(progSource?.u_music)
              ? progSource.u_music
              : this.save.unlockedMusic;
          this.save.unlockedMusic = normalizeUnlockedMusic(
            [...this.save.unlockedMusic, ...cloudMusicCodes],
            this.save.cosmetics
          );
          const cloudEquippedMusic = data.equipped_music || progSource?.e_music || this.save.equippedMusic || 'SF';
          this.save.equippedMusic = this.save.unlockedMusic.includes(cloudEquippedMusic) ? cloudEquippedMusic : 'SF';

          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save));
          if (this.onRefreshNeeded) this.onRefreshNeeded();
          window.dispatchEvent(new CustomEvent('progressionUpdated'));
        }
      }
    });
  }

  public get points() { return this.save.points; }
  public get wins() { return this.save.wins; }
  public get matches() { return this.save.matches; }
  public get unlockedMusic(): string[] { return [...this.save.unlockedMusic]; }
  public get equippedMusic(): string { return this.save.equippedMusic || 'SF'; }
  public getAchievements(): Achievement[] { return ACHIEVEMENT_DEFS.map(def => ({ ...def, ...(this.save.achievements[def.id] || {}), unlocked: Boolean(this.save.achievements[def.id]?.unlocked) })); }
  public getCosmetics(): Cosmetic[] {
    return COSMETIC_DEFS.map(def => {
      if (def.kind === 'music') {
        const unlocked = def.cost === 0 || this.save.unlockedMusic.includes(def.id) || Boolean(this.save.cosmetics[def.id]?.unlocked);
        const equipped = (this.save.equippedMusic || 'SF') === def.id;
        return { ...def, unlocked, equipped };
      }
      return {
        ...def,
        ...(this.save.cosmetics[def.id] || {}),
        unlocked: def.cost === 0 || Boolean(this.save.cosmetics[def.id]?.unlocked),
        equipped: Boolean(this.save.cosmetics[def.id]?.equipped),
      };
    });
  }
  
  private async persist() { 
    this.save.unlockedMusic = normalizeUnlockedMusic(this.save.unlockedMusic, this.save.cosmetics);
    if (!this.save.unlockedMusic.includes(this.save.equippedMusic)) {
      this.save.equippedMusic = 'SF';
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save)); 
    window.dispatchEvent(new CustomEvent('progressionUpdated'));
    if (AudioManager.currentTrack === 'game') {
      AudioManager.playMusic('game');
    }
    if (this.currentUserId) {
      const progPayload = {
        points: this.save.points,
        achievements: this.save.achievements,
        cosmetics: this.save.cosmetics,
        u_music: this.save.unlockedMusic,
        e_music: this.save.equippedMusic,
      };
      const { data: existingRow } = await supabase
        .from('profiles')
        .select('settings_and_hotkeys')
        .eq('id', this.currentUserId)
        .single();
      const mergedJsonb = {
        ...(existingRow?.settings_and_hotkeys || {}),
        progressionData: progPayload,
      };
      const { error } = await supabase.from('profiles').update({
        wins: this.save.wins,
        games_played: this.save.matches,
        unlocked_music: this.save.unlockedMusic,
        equipped_music: this.save.equippedMusic,
        progression_data: progPayload,
        settings_and_hotkeys: mergedJsonb,
      }).eq('id', this.currentUserId);
      if (error) {
        await supabase.from('profiles').update({
          wins: this.save.wins,
          games_played: this.save.matches,
          settings_and_hotkeys: mergedJsonb,
        }).eq('id', this.currentUserId);
      }
    }
  }
  private unlock(id: string): Achievement | null { const achievement = this.getAchievements().find(item => item.id === id); if (!achievement || achievement.unlocked) return null; this.save.achievements[id] = { unlocked: true, unlockedAt: Date.now() }; this.save.points += achievement.reward; return { ...achievement, unlocked: true, unlockedAt: Date.now() }; }
  public recordMatch(input: MatchProgressionInput): { earned: number; achievements: Achievement[] } {
    this.save.matches += 1; if (input.won) this.save.wins += 1;
    this.history.push(input.mode); this.history = this.history.slice(-20);
    const base = input.won ? 100 : 25; const modeBonus = input.won ? ({ 'classic-pvp': 50, 'free-for-all': 100, 'team-deathmatch': 150, 'battle-royale': 300 }[input.mode]) : 0;
    const statBonus = Math.min(100, Math.floor(input.lines / 5) * 10) + Math.min(100, input.kills * 20);
    let earned = base + modeBonus + statBonus; this.save.points += earned;
    const unlocked: Achievement[] = [];
    const ids: string[] = [];
    if (input.won) ids.push('first-win', 'top-player', `${input.mode === 'classic-pvp' ? 'classic' : input.mode === 'free-for-all' ? 'ffa' : input.mode === 'team-deathmatch' ? 'tdm' : 'br'}-champion`);
    if (input.lines >= 20) ids.push('top-lines'); if (input.score >= 100000) ids.push('high-score');
    const has = (mode: ProgressionMode) => this.history.includes(mode);
    if (has('classic-pvp') && has('free-for-all') && has('team-deathmatch')) ids.push('triple-threat');
    for (const id of ids) { const item = this.unlock(id); if (item) { unlocked.push(item); earned += item.reward; } }
    this.persist(); return { earned, achievements: unlocked };
  }
  public purchase(id: string): { ok: boolean; message: string } {
    const item = this.getCosmetics().find(cosmetic => cosmetic.id === id);
    if (!item) return { ok: false, message: 'Cosmetic not found.' };
    if (item.unlocked) return { ok: false, message: 'Already unlocked.' };
    if (this.save.points < item.cost) return { ok: false, message: `You need ${item.cost - this.save.points} more points.` };
    this.save.points -= item.cost;
    if (item.kind === 'music') {
      this.save.unlockedMusic = normalizeUnlockedMusic([...this.save.unlockedMusic, id], this.save.cosmetics);
      this.save.equippedMusic = id;
      for (const cosmetic of COSMETIC_DEFS) {
        if (cosmetic.kind === 'music') {
          this.save.cosmetics[cosmetic.id] = {
            unlocked: cosmetic.cost === 0 || this.save.unlockedMusic.includes(cosmetic.id),
            equipped: cosmetic.id === id,
          };
        }
      }
      this.persist();
      return { ok: true, message: `${item.name} unlocked and equipped.` };
    }
    this.save.cosmetics[id] = { unlocked: true, equipped: false };
    this.persist();
    return { ok: true, message: `${item.name} unlocked.` };
  }
  public equip(id: string) {
    const item = this.getCosmetics().find(cosmetic => cosmetic.id === id);
    if (!item || !item.unlocked) return;
    if (item.kind === 'music') {
      this.save.equippedMusic = id;
    }
    for (const cosmetic of COSMETIC_DEFS) {
      if (cosmetic.kind === item.kind) {
        this.save.cosmetics[cosmetic.id] = {
          ...(this.save.cosmetics[cosmetic.id] || {}),
          equipped: cosmetic.id === id,
          unlocked: cosmetic.cost === 0 || (cosmetic.kind === 'music' ? this.save.unlockedMusic.includes(cosmetic.id) : Boolean(this.save.cosmetics[cosmetic.id]?.unlocked)),
        };
      }
    }
    this.persist();
  }
  public unequip(id: string) {
    const item = this.getCosmetics().find(cosmetic => cosmetic.id === id);
    if (!item || !item.equipped) return;
    if (item.kind === 'music') {
      // Revert to default SpaceFriends ('SF') when unequipping a custom music track
      this.save.equippedMusic = 'SF';
      this.save.cosmetics[id] = { ...(this.save.cosmetics[id] || {}), equipped: false, unlocked: true };
      this.save.cosmetics['SF'] = { unlocked: true, equipped: true };
      this.persist();
      return;
    }
    this.save.cosmetics[id] = { ...(this.save.cosmetics[id] || {}), equipped: false, unlocked: item.unlocked };
    this.persist();
  }
}

const STYLE_ID = 'bq-progression-style';
function ensureStyles() { if (document.getElementById(STYLE_ID)) return; const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = `.bq-progress-overlay{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:1rem;background:rgba(2,4,15,.88);backdrop-filter:blur(8px)}.bq-progress-overlay.open{display:flex}.bq-progress-panel{width:min(100%,980px);max-height:92vh;overflow:auto;background:linear-gradient(145deg,#171943,#07091d);border:1px solid rgba(0,229,255,.4);border-radius:1rem;color:#eef2ff;box-shadow:0 0 70px rgba(0,229,255,.15);font-family:Inter,system-ui,sans-serif}.bq-progress-head{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid rgba(169,176,255,.2)}.bq-progress-head h2{margin:0;font-size:1.1rem}.bq-progress-head p{margin:.3rem 0 0;color:#00e5ff;font-size:.65rem;font-weight:800;letter-spacing:.14em}.bq-progress-close{background:transparent;border:1px solid #596080;color:white;border-radius:.4rem;font-size:1.2rem;width:2rem;height:2rem;cursor:pointer}.bq-progress-body{padding:1.25rem}.bq-progress-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:.7rem;margin-bottom:1.25rem}.bq-progress-stat{padding:.8rem;border:1px solid rgba(169,176,255,.2);border-radius:.5rem;background:rgba(255,255,255,.04)}.bq-progress-stat b{display:block;color:#ffc107;font-size:1.35rem}.bq-progress-stat span{color:#9da6c8;font-size:.68rem;text-transform:uppercase;letter-spacing:.12em}.bq-progress-section{margin-top:1.35rem}.bq-progress-section h3{display:flex;align-items:center;gap:.5rem;margin:0 0 .75rem;color:#00e5ff;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 10px rgba(0,229,255,.45)}.bq-progress-section h3::before{content:'◆';font-size:.65rem;color:#00e5ff;text-shadow:0 0 8px rgba(0,229,255,.8);opacity:.9}.bq-progress-section h3::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(0,229,255,.4) 0%,rgba(169,176,255,.12) 60%,transparent 100%);margin-left:.35rem}.bq-progress-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.65rem}.bq-progress-card{padding:.75rem;border:1px solid rgba(169,176,255,.18);border-radius:.5rem;background:rgba(255,255,255,.035)}.bq-progress-card h4{margin:0;color:white;font-size:.8rem}.bq-progress-card p{margin:.3rem 0;color:#aeb6d2;font-size:.73rem;line-height:1.4}.bq-progress-card small{color:#ffc107;font-weight:800}.bq-progress-card.locked{opacity:.58}.bq-progress-btn{margin-top:.45rem;padding:.4rem .55rem;border:1px solid rgba(0,229,255,.4);border-radius:.35rem;background:#111735;color:#dce6ff;cursor:pointer;font-size:.68rem;font-weight:800}.bq-progress-btn:hover{border-color:#00e5ff;color:#00e5ff}.bq-progress-toast{position:fixed;right:1rem;bottom:1rem;z-index:95;padding:.8rem 1rem;border:1px solid #ffc107;border-radius:.5rem;background:#151022;color:#ffe8a6;box-shadow:0 0 30px rgba(255,193,7,.25);font-size:.78rem}@media(max-width:680px){.bq-progress-summary{grid-template-columns:repeat(2,1fr)}}`; document.head.appendChild(style); }

export interface ProgressionController { recordMatch(input: MatchProgressionInput): { earned: number; achievements: Achievement[] }; store: ProgressionStore; }
export function mountProgression(profileNav: HTMLElement): ProgressionController {
  ensureStyles();
  const store = new ProgressionStore();
  const overlay = document.createElement('div');
  overlay.className = 'bq-progress-overlay';
  overlay.innerHTML = `
    <div class="bq-progress-panel" role="dialog" aria-modal="true">
      <div class="bq-progress-head">
        <div><p>PROFILE PROGRESSION</p><h2>Player Profile, Achievements &amp; Cosmetics</h2></div>
        <button class="bq-progress-close" type="button">×</button>
      </div>
      <div class="bq-progress-body">
        <div class="bq-progress-summary">
          <div class="bq-progress-stat"><b data-points>0</b><span>customization points</span></div>
          <div class="bq-progress-stat"><b data-wins>0</b><span>multiplayer wins</span></div>
          <div class="bq-progress-stat"><b data-matches>0</b><span>matches played</span></div>
          <div class="bq-progress-stat"><b data-achievements-unlocked>0 / 9</b><span>achievements unlocked</span></div>
        </div>
        <div class="bq-progress-section">
          <h3>Achievements</h3>
          <div class="bq-progress-grid" data-achievements></div>
        </div>
        <div class="bq-progress-section">
          <h3>In-Game Music (OST)</h3>
          <div class="bq-progress-grid" data-music-cosmetics></div>
        </div>
        <div class="bq-progress-section">
          <h3>Block Skins &amp; Special Effects</h3>
          <div class="bq-progress-grid" data-cosmetics></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const renderCosmeticCard = (item: Cosmetic) => {
    const isDefaultMusic = item.kind === 'music' && item.id === 'SF';
    const buttonLabel = item.unlocked
      ? item.equipped
        ? (isDefaultMusic ? 'DEFAULT EQUIPPED' : 'UNEQUIP')
        : 'EQUIP'
      : 'UNLOCK';
    return `<article class="bq-progress-card ${item.unlocked ? '' : 'locked'}"><h4 style="color:${item.accent}">${item.name}</h4><p>${item.description}</p><small>${item.unlocked ? (item.equipped ? 'EQUIPPED' : 'UNLOCKED') : `${item.cost} PTS`}</small><br><button class="bq-progress-btn" data-cosmetic="${item.id}" ${isDefaultMusic && item.equipped ? 'disabled style="opacity:0.6;cursor:default;"' : ''}>${buttonLabel}</button></article>`;
  };

  const refresh = () => {
    const allAchievements = store.getAchievements();
    const unlockedCount = allAchievements.filter(a => a.unlocked).length;
    (overlay.querySelector('[data-points]') as HTMLElement).textContent = store.points.toLocaleString();
    (overlay.querySelector('[data-wins]') as HTMLElement).textContent = String(store.wins);
    (overlay.querySelector('[data-matches]') as HTMLElement).textContent = String(store.matches);
    const unlockedEl = overlay.querySelector('[data-achievements-unlocked]') as HTMLElement | null;
    if (unlockedEl) unlockedEl.textContent = `${unlockedCount} / ${allAchievements.length}`;

    const achievements = overlay.querySelector<HTMLElement>('[data-achievements]')!;
    achievements.innerHTML = allAchievements.map(item => `<article class="bq-progress-card ${item.unlocked ? '' : 'locked'}"><h4>${item.unlocked ? '◆ ' : '◇ '}${item.title}</h4><p>${item.description}</p><small>${item.unlocked ? `UNLOCKED · +${item.reward} PTS` : `REWARD · +${item.reward} PTS`}</small></article>`).join('');

    const allCosmetics = store.getCosmetics();
    const musicCosmeticsEl = overlay.querySelector<HTMLElement>('[data-music-cosmetics]')!;
    musicCosmeticsEl.innerHTML = allCosmetics.filter(item => item.kind === 'music').map(renderCosmeticCard).join('');

    const cosmetics = overlay.querySelector<HTMLElement>('[data-cosmetics]')!;
    cosmetics.innerHTML = allCosmetics.filter(item => item.kind !== 'music').map(renderCosmeticCard).join('');

    overlay.querySelectorAll<HTMLButtonElement>('[data-cosmetic]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.cosmetic!;
      const item = store.getCosmetics().find(cosmetic => cosmetic.id === id)!;
      let result: { ok: boolean; message: string };
      if (item.unlocked && item.equipped) {
        if (item.kind === 'music' && item.id === 'SF') return;
        store.unequip(id);
        result = { ok: true, message: `${item.name} unequipped.` };
      } else if (item.unlocked) {
        store.equip(id);
        result = { ok: true, message: `${item.name} equipped.` };
      } else {
        result = store.purchase(id);
      }
      showToast(result.message);
      refresh();
    }));
  };

  store.onRefreshNeeded = refresh;

  const report = (input: MatchProgressionInput) => { const result = store.recordMatch(input); if (result.earned > 0) showToast(`+${result.earned} customization points earned`, 'reward'); for (const achievement of result.achievements) setTimeout(() => showToast(`Achievement unlocked: ${achievement.title}`, 'reward'), 300); refresh(); return result; };
  const closeOverlay = () => { overlay.classList.remove('open'); overlay.style.display = 'none'; };
  profileNav.addEventListener('click', event => { 
    event.preventDefault(); 
    if (!store.currentUserId) {
      import('./Auth').then(m => m.openAuthModal());
      showToast('Please sign in to view your profile.', 'warning');
      return;
    }
    refresh(); 
    overlay.classList.add('open'); 
    overlay.style.display = 'flex'; 
  }); 
  overlay.querySelector('.bq-progress-close')?.addEventListener('click', closeOverlay); overlay.addEventListener('click', event => { if (event.target === overlay) closeOverlay(); }); window.addEventListener('keydown', event => { if (event.key === 'Escape') closeOverlay(); }); closeOverlay(); refresh(); return { recordMatch: report, store };
}
