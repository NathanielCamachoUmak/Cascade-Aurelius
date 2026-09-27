export type ProgressionMode = 'classic-pvp' | 'free-for-all' | 'team-deathmatch' | 'battle-royale';
export type CosmeticKind = 'block-skin' | 'special-effect' | 'profile-style';

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

const COSMETIC_DEFS: Omit<Cosmetic, 'unlocked' | 'equipped'>[] = [
  { id: 'cyan-circuit', name: 'Cyan Circuit', kind: 'block-skin', description: 'Electric cyan blocks with a bright edge highlight.', cost: 0, accent: '#00e5ff' },
  { id: 'solar-gold', name: 'Solar Gold', kind: 'block-skin', description: 'Warm gold blocks for a championship look.', cost: 250, accent: '#ffd700' },
  { id: 'neon-orchid', name: 'Neon Orchid', kind: 'block-skin', description: 'Violet-magenta blocks with a high-contrast glow.', cost: 500, accent: '#d946ef' },
  { id: 'profile-operator', name: 'Operator Profile', kind: 'profile-style', description: 'A premium profile frame and rank accent.', cost: 350, accent: '#a78bfa' },
  { id: 'spark-burst', name: 'Spark Burst', kind: 'special-effect', description: 'A gold burst when a reward or achievement unlocks.', cost: 300, accent: '#ffc107' },
  { id: 'void-pulse', name: 'Void Pulse', kind: 'special-effect', description: 'A purple pulse for elite match results.', cost: 650, accent: '#8b5cf6' },
];

function freshSave(): SaveData {
  return { points: 0, wins: 0, matches: 0, achievements: {}, cosmetics: {} };
}
function readSave(): SaveData {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<SaveData> | null;
    return { ...freshSave(), ...parsed, achievements: parsed?.achievements || {}, cosmetics: parsed?.cosmetics || {} };
  } catch { return freshSave(); }
}

export class ProgressionStore {
  private save: SaveData = readSave();
  private history: ProgressionMode[] = [];
  public get points() { return this.save.points; }
  public get wins() { return this.save.wins; }
  public get matches() { return this.save.matches; }
  public getAchievements(): Achievement[] { return ACHIEVEMENT_DEFS.map(def => ({ ...def, ...(this.save.achievements[def.id] || {}), unlocked: Boolean(this.save.achievements[def.id]?.unlocked) })); }
  public getCosmetics(): Cosmetic[] { return COSMETIC_DEFS.map(def => ({ ...def, ...(this.save.cosmetics[def.id] || {}), unlocked: def.cost === 0 || Boolean(this.save.cosmetics[def.id]?.unlocked), equipped: Boolean(this.save.cosmetics[def.id]?.equipped) })); }
  private persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save)); }
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
  public purchase(id: string): { ok: boolean; message: string } { const item = this.getCosmetics().find(cosmetic => cosmetic.id === id); if (!item) return { ok: false, message: 'Cosmetic not found.' }; if (item.unlocked) return { ok: false, message: 'Already unlocked.' }; if (this.save.points < item.cost) return { ok: false, message: `You need ${item.cost - this.save.points} more points.` }; this.save.points -= item.cost; this.save.cosmetics[id] = { unlocked: true, equipped: false }; this.persist(); return { ok: true, message: `${item.name} unlocked.` }; }
  public equip(id: string) { const item = this.getCosmetics().find(cosmetic => cosmetic.id === id); if (!item || !item.unlocked) return; for (const cosmetic of COSMETIC_DEFS) if (cosmetic.kind === item.kind) this.save.cosmetics[cosmetic.id] = { ...(this.save.cosmetics[cosmetic.id] || {}), equipped: cosmetic.id === id, unlocked: cosmetic.cost === 0 || Boolean(this.save.cosmetics[cosmetic.id]?.unlocked) }; this.persist(); }
}

const STYLE_ID = 'bq-progression-style';
function ensureStyles() { if (document.getElementById(STYLE_ID)) return; const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = `.bq-progress-overlay{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:1rem;background:rgba(2,4,15,.88);backdrop-filter:blur(8px)}.bq-progress-overlay.open{display:flex}.bq-progress-panel{width:min(100%,980px);max-height:92vh;overflow:auto;background:linear-gradient(145deg,#171943,#07091d);border:1px solid rgba(0,229,255,.4);border-radius:1rem;color:#eef2ff;box-shadow:0 0 70px rgba(0,229,255,.15);font-family:Inter,system-ui,sans-serif}.bq-progress-head{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid rgba(169,176,255,.2)}.bq-progress-head h2{margin:0;font-size:1.1rem}.bq-progress-head p{margin:.3rem 0 0;color:#00e5ff;font-size:.65rem;font-weight:800;letter-spacing:.14em}.bq-progress-close{background:transparent;border:1px solid #596080;color:white;border-radius:.4rem;font-size:1.2rem;width:2rem;height:2rem;cursor:pointer}.bq-progress-body{padding:1.25rem}.bq-progress-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-bottom:1rem}.bq-progress-stat{padding:.8rem;border:1px solid rgba(169,176,255,.2);border-radius:.5rem;background:rgba(255,255,255,.04)}.bq-progress-stat b{display:block;color:#ffc107;font-size:1.35rem}.bq-progress-stat span{color:#9da6c8;font-size:.68rem;text-transform:uppercase;letter-spacing:.12em}.bq-progress-section{margin-top:1.2rem}.bq-progress-section h3{color:#00e5ff;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase}.bq-progress-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.65rem}.bq-progress-card{padding:.75rem;border:1px solid rgba(169,176,255,.18);border-radius:.5rem;background:rgba(255,255,255,.035)}.bq-progress-card h4{margin:0;color:white;font-size:.8rem}.bq-progress-card p{margin:.3rem 0;color:#aeb6d2;font-size:.73rem;line-height:1.4}.bq-progress-card small{color:#ffc107;font-weight:800}.bq-progress-card.locked{opacity:.58}.bq-progress-btn{margin-top:.45rem;padding:.4rem .55rem;border:1px solid rgba(0,229,255,.4);border-radius:.35rem;background:#111735;color:#dce6ff;cursor:pointer;font-size:.68rem;font-weight:800}.bq-progress-btn:hover{border-color:#00e5ff;color:#00e5ff}.bq-progress-toast{position:fixed;right:1rem;bottom:1rem;z-index:95;padding:.8rem 1rem;border:1px solid #ffc107;border-radius:.5rem;background:#151022;color:#ffe8a6;box-shadow:0 0 30px rgba(255,193,7,.25);font-size:.78rem}@media(max-width:560px){.bq-progress-summary{grid-template-columns:1fr}}`; document.head.appendChild(style); }

export interface ProgressionController { recordMatch(input: MatchProgressionInput): { earned: number; achievements: Achievement[] }; store: ProgressionStore; }
export function mountProgression(profileNav: HTMLElement): ProgressionController {
  ensureStyles(); const store = new ProgressionStore(); const overlay = document.createElement('div'); overlay.className = 'bq-progress-overlay'; overlay.innerHTML = `<div class="bq-progress-panel" role="dialog" aria-modal="true"><div class="bq-progress-head"><div><p>PROFILE PROGRESSION</p><h2>Rewards & achievements</h2></div><button class="bq-progress-close" type="button">×</button></div><div class="bq-progress-body"><div class="bq-progress-summary"><div class="bq-progress-stat"><b data-points>0</b><span>customization points</span></div><div class="bq-progress-stat"><b data-wins>0</b><span>multiplayer wins</span></div><div class="bq-progress-stat"><b data-matches>0</b><span>matches played</span></div></div><div class="bq-progress-section"><h3>Achievements</h3><div class="bq-progress-grid" data-achievements></div></div><div class="bq-progress-section"><h3>Block skins & special effects</h3><div class="bq-progress-grid" data-cosmetics></div></div></div></div>`; document.body.appendChild(overlay);
  const refresh = () => { (overlay.querySelector('[data-points]') as HTMLElement).textContent = store.points.toLocaleString(); (overlay.querySelector('[data-wins]') as HTMLElement).textContent = String(store.wins); (overlay.querySelector('[data-matches]') as HTMLElement).textContent = String(store.matches); const achievements = overlay.querySelector<HTMLElement>('[data-achievements]')!; achievements.innerHTML = store.getAchievements().map(item => `<article class="bq-progress-card ${item.unlocked ? '' : 'locked'}"><h4>${item.unlocked ? '◆ ' : '◇ '}${item.title}</h4><p>${item.description}</p><small>${item.unlocked ? `UNLOCKED · +${item.reward} PTS` : `REWARD · +${item.reward} PTS`}</small></article>`).join(''); const cosmetics = overlay.querySelector<HTMLElement>('[data-cosmetics]')!; cosmetics.innerHTML = store.getCosmetics().map(item => `<article class="bq-progress-card ${item.unlocked ? '' : 'locked'}"><h4 style="color:${item.accent}">${item.name}</h4><p>${item.description}</p><small>${item.unlocked ? (item.equipped ? 'EQUIPPED' : 'UNLOCKED') : `${item.cost} PTS`}</small><br><button class="bq-progress-btn" data-cosmetic="${item.id}">${item.unlocked ? (item.equipped ? 'EQUIPPED' : 'EQUIP') : 'UNLOCK'}</button></article>`).join(''); cosmetics.querySelectorAll<HTMLButtonElement>('[data-cosmetic]').forEach(button => button.addEventListener('click', () => { const id = button.dataset.cosmetic!; const item = store.getCosmetics().find(cosmetic => cosmetic.id === id)!; const result = item.unlocked ? (store.equip(id), { ok: true, message: `${item.name} equipped.` }) : store.purchase(id); showToast(result.message); refresh(); })); };
  const showToast = (message: string) => { const toast = document.createElement('div'); toast.className = 'bq-progress-toast'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2600); };
  const report = (input: MatchProgressionInput) => { const result = store.recordMatch(input); if (result.earned > 0) showToast(`+${result.earned} customization points earned`); for (const achievement of result.achievements) setTimeout(() => showToast(`Achievement unlocked: ${achievement.title}`), 300); refresh(); return result; };
  const closeOverlay = () => { overlay.classList.remove('open'); overlay.style.display = 'none'; };
  profileNav.addEventListener('click', event => { event.preventDefault(); refresh(); overlay.classList.add('open'); overlay.style.display = 'flex'; }); overlay.querySelector('.bq-progress-close')?.addEventListener('click', closeOverlay); overlay.addEventListener('click', event => { if (event.target === overlay) closeOverlay(); }); window.addEventListener('keydown', event => { if (event.key === 'Escape') closeOverlay(); }); closeOverlay(); refresh(); return { recordMatch: report, store };
}
