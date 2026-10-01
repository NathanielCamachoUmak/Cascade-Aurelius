import { supabase } from './supabase';
import { showToast } from './Toast';
import { PLAYER_CLASSES } from './PlayerClass';
import { getTopScores, type HighScoreModeKey } from './HighScores';
import { isClassCertified, getCertifiedClasses, isTutorialCompleted } from './TutorialManager';
import type { ProgressionStore } from './Progression';

const STAT_HIGHSCORE_MODES: Array<{ key: HighScoreModeKey; label: string; accent: string }> = [
  { key: 'SOLO', label: 'Solo Endless', accent: '#00ff88' },
  { key: 'EASY', label: 'Easy Bot (1v1)', accent: '#ffd700' },
  { key: 'HARD', label: 'Hard Bot (1v1)', accent: '#ff1493' },
];

const TUTORIAL_STAGES_INFO = [
  {
    id: 'basics-stage-1',
    legacyId: 'cascade-basics',
    stageLabel: 'STAGE 1',
    title: 'Basic Movements',
    description: 'Lateral movement, soft/hard drop, SRS rotation, and Hold piece swap.',
    accent: '#00e5ff',
  },
  {
    id: 'basics-stage-2',
    stageLabel: 'STAGE 2',
    title: 'Class Certifications',
    description: 'Dedicated 4-step certifications for Speedster, Sentinel, Saboteur, and Support.',
    accent: '#ffd700',
  },
  {
    id: 'basics-stage-3',
    stageLabel: 'STAGE 3',
    title: 'Item Blocks',
    description: '7 interactive scenarios for Bomb, Heavy, Multiplier, Speed, Shield, Freeze, and Garbage Eater.',
    accent: '#ff1493',
  },
  {
    id: 'mode-briefings',
    stageLabel: 'TACTICAL',
    title: 'Mode Intel Briefings',
    description: 'Tactical mechanics for 1v1 PvP, Free For All, 3v3 Deathmatch, and 30-Player Battle Royale.',
    accent: '#00ff88',
  },
];

export interface RankTierInfo {
  id: string;
  name: string;
  minRating: number;
  maxRating: number | null;
  accent: string;
  badge: string;
}

export const RANK_TIERS: RankTierInfo[] = [
  { id: 'unranked', name: 'Unranked / Initiate', minRating: 0, maxRating: 999, accent: '#9da6c8', badge: '◇' },
  { id: 'bronze', name: 'Bronze Circuit', minRating: 1000, maxRating: 1199, accent: '#cd7f32', badge: '◆' },
  { id: 'silver', name: 'Silver Matrix', minRating: 1200, maxRating: 1399, accent: '#e2e8f0', badge: '◈' },
  { id: 'gold', name: 'Gold Vanguard', minRating: 1400, maxRating: 1649, accent: '#ffd700', badge: '★' },
  { id: 'platinum', name: 'Platinum Pulse', minRating: 1650, maxRating: 1899, accent: '#00e5ff', badge: '✦' },
  { id: 'diamond', name: 'Diamond Overclock', minRating: 1900, maxRating: 2199, accent: '#d946ef', badge: '❖' },
  { id: 'aurelius', name: 'Aurelius Apex', minRating: 2200, maxRating: null, accent: '#ff1493', badge: '👑' },
];

export function calculateEstimatedRating(wins: number, matches: number, certifiedCount: number): number {
  if (matches === 0 && certifiedCount === 0) return 1000;
  const losses = Math.max(0, matches - wins);
  const base = 1000 + wins * 35 - losses * 12 + certifiedCount * 25;
  return Math.max(800, base);
}

export function getRankTierForRating(rating: number, matches: number): RankTierInfo {
  if (matches === 0 && rating <= 1000) {
    return RANK_TIERS[1]; // Default starting 1000 SR Bronze Circuit
  }
  for (let i = RANK_TIERS.length - 1; i >= 1; i--) {
    if (rating >= RANK_TIERS[i].minRating) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

interface LadderRow {
  username: string;
  wins: number;
  matches: number;
  rating: number;
  isCurrentUser?: boolean;
}

const STYLE_ID = 'bq-statistics-style';

function ensureStatisticsStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bq-stats-overlay {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(2, 4, 15, 0.88);
      backdrop-filter: blur(8px);
    }
    .bq-stats-overlay.open {
      display: flex;
    }
    .bq-stats-panel {
      width: min(100%, 1040px);
      max-height: 92vh;
      overflow: auto;
      background: linear-gradient(145deg, #171943, #07091d);
      border: 1px solid rgba(0, 229, 255, 0.4);
      border-radius: 1rem;
      color: #eef2ff;
      box-shadow: 0 0 70px rgba(0, 229, 255, 0.15);
      font-family: Inter, system-ui, sans-serif;
    }
    .bq-stats-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(169, 176, 255, 0.2);
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .bq-stats-head h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .bq-stats-head p {
      margin: 0 0 0.25rem;
      color: #00e5ff;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .bq-stats-tabs {
      display: flex;
      gap: 0.45rem;
      background: rgba(13, 11, 26, 0.75);
      padding: 0.28rem;
      border-radius: 0.55rem;
      border: 1px solid rgba(169, 176, 255, 0.18);
    }
    .bq-stats-tab {
      background: transparent;
      border: none;
      color: #9da6c8;
      padding: 0.45rem 0.85rem;
      border-radius: 0.4rem;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .bq-stats-tab:hover {
      color: #ffffff;
    }
    .bq-stats-tab.active {
      background: rgba(0, 229, 255, 0.16);
      color: #00e5ff;
      box-shadow: inset 0 0 0 1px rgba(0, 229, 255, 0.45);
    }
    .bq-stats-close {
      background: transparent;
      border: 1px solid #596080;
      color: white;
      border-radius: 0.4rem;
      font-size: 1.2rem;
      width: 2rem;
      height: 2rem;
      cursor: pointer;
    }
    .bq-stats-body {
      padding: 1.25rem;
    }
    .bq-stats-summary {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.7rem;
      margin-bottom: 1.1rem;
    }
    .bq-stats-stat {
      padding: 0.8rem;
      border: 1px solid rgba(169, 176, 255, 0.2);
      border-radius: 0.5rem;
      background: rgba(255, 255, 255, 0.04);
    }
    .bq-stats-stat b {
      display: block;
      color: #ffc107;
      font-size: 1.3rem;
    }
    .bq-stats-stat span {
      color: #9da6c8;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .bq-stats-section {
      margin-top: 1.35rem;
    }
    .bq-stats-section h3 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
      color: #00e5ff;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      text-shadow: 0 0 10px rgba(0, 229, 255, 0.45);
    }
    .bq-stats-section h3::before {
      content: '◆';
      font-size: 0.65rem;
      color: #00e5ff;
      text-shadow: 0 0 8px rgba(0, 229, 255, 0.8);
      opacity: 0.9;
    }
    .bq-stats-section h3::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(0, 229, 255, 0.4) 0%, rgba(169, 176, 255, 0.12) 60%, transparent 100%);
      margin-left: 0.35rem;
    }
    .bq-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.65rem;
    }
    .bq-stats-card {
      padding: 0.8rem;
      border: 1px solid rgba(169, 176, 255, 0.18);
      border-radius: 0.5rem;
      background: rgba(255, 255, 255, 0.035);
    }
    .bq-stats-card h4 {
      margin: 0;
      color: white;
      font-size: 0.82rem;
    }
    .bq-stats-card p {
      margin: 0.35rem 0;
      color: #aeb6d2;
      font-size: 0.73rem;
      line-height: 1.4;
    }
    .bq-stats-card.locked {
      opacity: 0.62;
    }
    .bq-rank-banner {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 1rem;
      padding: 1.1rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(0, 229, 255, 0.35);
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.08), rgba(255, 20, 147, 0.06));
      margin-bottom: 1.2rem;
    }
    .bq-ladder-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }
    .bq-ladder-table th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #9da6c8;
      border-bottom: 1px solid rgba(169, 176, 255, 0.2);
    }
    .bq-ladder-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid rgba(169, 176, 255, 0.1);
    }
    .bq-ladder-row-me {
      background: rgba(0, 229, 255, 0.1);
    }
    @media (max-width: 780px) {
      .bq-stats-summary {
        grid-template-columns: repeat(2, 1fr);
      }
      .bq-rank-banner {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

export function mountStatistics(statsNav: HTMLElement, store: ProgressionStore) {
  ensureStatisticsStyles();

  const overlay = document.createElement('div');
  overlay.className = 'bq-stats-overlay';
  overlay.innerHTML = `
    <div class="bq-stats-panel" role="dialog" aria-modal="true">
      <div class="bq-stats-head">
        <div>
          <p>COMBAT TELEMETRY &amp; RANKED HUB</p>
          <h2>Player Statistics, Certifications &amp; Rank Ladder</h2>
        </div>
        <div style="display:flex;align-items:center;gap:0.65rem">
          <div class="bq-stats-tabs">
            <button type="button" class="bq-stats-tab active" data-tab="overview">Personal Stats</button>
            <button type="button" class="bq-stats-tab" data-tab="ranked">Rank &amp; Ladder</button>
          </div>
          <button class="bq-stats-close" type="button">×</button>
        </div>
      </div>

      <div class="bq-stats-body">
        <!-- TAB 1: PERSONAL STATS, HIGH SCORES & CERTIFICATIONS -->
        <div data-view="overview">
          <div class="bq-stats-summary">
            <div class="bq-stats-stat"><b data-stat-wins>0</b><span>Multiplayer Wins</span></div>
            <div class="bq-stats-stat"><b data-stat-matches>0</b><span>Matches Played</span></div>
            <div class="bq-stats-stat"><b data-stat-winrate>0%</b><span>Win Rate</span></div>
            <div class="bq-stats-stat"><b data-stat-certified>0 / 4</b><span>Classes Certified</span></div>
            <div class="bq-stats-stat"><b data-stat-stages>0 / 3</b><span>Tutorial Stages</span></div>
          </div>

          <div class="bq-stats-section">
            <h3>Personal High Scores (Top 3)</h3>
            <div class="bq-stats-grid" data-stat-highscores></div>
          </div>

          <div class="bq-stats-section">
            <h3>Class Certifications &amp; Loadout Kit</h3>
            <div class="bq-stats-grid" data-stat-certifications></div>
          </div>

          <div class="bq-stats-section">
            <h3>Tutorial Curriculum Progress</h3>
            <div class="bq-stats-grid" data-stat-tutorials></div>
          </div>
        </div>

        <!-- TAB 2: RANK & LADDER HUB -->
        <div data-view="ranked" style="display:none">
          <div class="bq-rank-banner" data-rank-banner></div>

          <div class="bq-stats-section">
            <h3>Competitive Rank Tiers</h3>
            <div class="bq-stats-grid" data-rank-tiers></div>
          </div>

          <div class="bq-stats-section">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
              <h3 style="margin:0">Global Rank Ladder</h3>
              <span style="font-size:0.65rem;color:#9da6c8;letter-spacing:0.08em;text-transform:uppercase" data-ladder-status>Live Standings</span>
            </div>
            <div class="bq-stats-card" style="padding:0;overflow:hidden">
              <table class="bq-ladder-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Operator</th>
                    <th>Tier</th>
                    <th>Rating (SR)</th>
                    <th>W / M</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody data-ladder-rows></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const classAccents: Record<string, string> = {
    SPEEDSTER: '#00FFFF',
    TANK: '#FFD700',
    SABOTEUR: '#FF1493',
    SUPPORT: '#00FF88',
  };

  let activeTab: 'overview' | 'ranked' = 'overview';
  let ladderCache: LadderRow[] = [];

  const switchTab = (tab: 'overview' | 'ranked') => {
    activeTab = tab;
    overlay.querySelectorAll<HTMLButtonElement>('.bq-stats-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    const overviewEl = overlay.querySelector<HTMLElement>('[data-view="overview"]');
    const rankedEl = overlay.querySelector<HTMLElement>('[data-view="ranked"]');
    if (overviewEl) overviewEl.style.display = tab === 'overview' ? 'block' : 'none';
    if (rankedEl) rankedEl.style.display = tab === 'ranked' ? 'block' : 'none';
    if (tab === 'ranked') {
      void fetchLadder();
    }
  };

  overlay.querySelectorAll<HTMLButtonElement>('.bq-stats-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = (btn.dataset.tab as 'overview' | 'ranked') || 'overview';
      switchTab(tab);
    });
  });

  async function fetchLadder() {
    const statusEl = overlay.querySelector<HTMLElement>('[data-ladder-status]');
    if (statusEl) statusEl.textContent = 'Syncing Ladder...';
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, wins, games_played')
        .order('wins', { ascending: false })
        .limit(15);

      if (!error && Array.isArray(data) && data.length > 0) {
        ladderCache = data.map((row: any) => {
          const wins = Number(row.wins) || 0;
          const matches = Number(row.games_played) || 0;
          const isMe = Boolean(store.currentUserId && row.id === store.currentUserId);
          const certCount = isMe ? getCertifiedClasses().length : 0;
          return {
            username: row.username || 'Operator',
            wins,
            matches,
            rating: calculateEstimatedRating(wins, matches, certCount),
            isCurrentUser: isMe,
          };
        }).sort((a, b) => b.rating - a.rating);
      }
    } catch {
      // Fallback to local player row
    }
    if (statusEl) statusEl.textContent = 'Season 1 · Live Standings';
    renderRankedView();
  }

  function renderRankedView() {
    const wins = store.wins;
    const matches = store.matches;
    const certCount = getCertifiedClasses().length;
    const rating = calculateEstimatedRating(wins, matches, certCount);
    const currentTier = getRankTierForRating(rating, matches);

    const nextTierIndex = RANK_TIERS.findIndex(t => t.id === currentTier.id) + 1;
    const nextTier = nextTierIndex < RANK_TIERS.length ? RANK_TIERS[nextTierIndex] : null;
    const progressPct = nextTier
      ? Math.max(0, Math.min(100, Math.round(((rating - currentTier.minRating) / (nextTier.minRating - currentTier.minRating)) * 100)))
      : 100;

    const bannerEl = overlay.querySelector<HTMLElement>('[data-rank-banner]');
    if (bannerEl) {
      bannerEl.innerHTML = `
        <div style="display:flex;flex-direction:column;justify-content:center;gap:0.4rem">
          <span style="font-size:0.65rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${currentTier.accent}">CURRENT COMPETITIVE STANDING</span>
          <div style="display:flex;align-items:center;gap:0.65rem">
            <span style="font-size:1.85rem;line-height:1">${currentTier.badge}</span>
            <div>
              <h3 style="margin:0;font-size:1.35rem;color:#ffffff">${currentTier.name}</h3>
              <div style="font-size:0.78rem;color:#9da6c8;margin-top:2px">Skill Rating: <strong style="color:${currentTier.accent}">${rating.toLocaleString()} SR</strong></div>
            </div>
          </div>
          <div style="margin-top:0.45rem">
            <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:#aeb6d2;margin-bottom:4px">
              <span>${nextTier ? `Progress to ${nextTier.name}` : 'Maximum Tier Reached'}</span>
              <span>${nextTier ? `${rating} / ${nextTier.minRating} SR (${progressPct}%)` : 'APEX'}</span>
            </div>
            <div style="height:7px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden">
              <div style="width:${progressPct}%;height:100%;background:${currentTier.accent};box-shadow:0 0 12px ${currentTier.accent}"></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.6rem">
          <div class="bq-stats-stat" style="background:rgba(13,11,26,0.55)">
            <b style="color:${currentTier.accent}">${rating} SR</b>
            <span>Current Rating</span>
          </div>
          <div class="bq-stats-stat" style="background:rgba(13,11,26,0.55)">
            <b>${matches > 0 ? `${Math.round((wins / matches) * 100)}%` : '0%'}</b>
            <span>Ranked Win Rate</span>
          </div>
          <div class="bq-stats-stat" style="background:rgba(13,11,26,0.55)">
            <b>${wins}W - ${Math.max(0, matches - wins)}L</b>
            <span>Season Record</span>
          </div>
          <div class="bq-stats-stat" style="background:rgba(13,11,26,0.55)">
            <b style="color:#00ff88">${certCount} / 4</b>
            <span>Certified Loadouts</span>
          </div>
        </div>
      `;
    }

    const tiersGrid = overlay.querySelector<HTMLElement>('[data-rank-tiers]');
    if (tiersGrid) {
      tiersGrid.innerHTML = RANK_TIERS.slice(1).map(tier => {
        const isCurrent = tier.id === currentTier.id;
        const rangeText = tier.maxRating ? `${tier.minRating} – ${tier.maxRating} SR` : `${tier.minRating}+ SR`;
        return `
          <article class="bq-stats-card" style="${isCurrent ? `border-color:${tier.accent};box-shadow:0 0 20px ${tier.accent}22` : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <h4 style="color:${tier.accent}">${tier.badge} ${tier.name}</h4>
              ${isCurrent ? `<small style="color:#00ff88;font-weight:800;font-size:0.62rem">CURRENT</small>` : ''}
            </div>
            <p style="margin:0.25rem 0 0;font-size:0.7rem;color:#9da6c8">${rangeText}</p>
          </article>
        `;
      }).join('');
    }

    const ladderBody = overlay.querySelector<HTMLElement>('[data-ladder-rows]');
    if (ladderBody) {
      const usernameEl = document.getElementById('auth-username');
      const localName = (usernameEl && usernameEl.textContent?.trim()) || 'You';
      const rows: LadderRow[] = ladderCache.length > 0
        ? ladderCache
        : [{ username: localName, wins, matches, rating, isCurrentUser: true }];

      ladderBody.innerHTML = rows.map((row, idx) => {
        const tier = getRankTierForRating(row.rating, row.matches);
        const wr = row.matches > 0 ? `${Math.round((row.wins / row.matches) * 100)}%` : '0%';
        return `
          <tr class="${row.isCurrentUser ? 'bq-ladder-row-me' : ''}">
            <td style="font-weight:800;color:${idx < 3 ? '#ffd700' : '#9da6c8'}">#${idx + 1}</td>
            <td style="font-weight:700;color:#ffffff">${row.username} ${row.isCurrentUser ? '<span style="font-size:0.62rem;color:#00e5ff;margin-left:4px">(YOU)</span>' : ''}</td>
            <td style="color:${tier.accent};font-weight:700">${tier.badge} ${tier.name}</td>
            <td style="font-weight:800;color:#eef2ff">${row.rating.toLocaleString()} SR</td>
            <td style="color:#aeb6d2">${row.wins}W / ${row.matches}M</td>
            <td style="color:#00ff88;font-weight:700">${wr}</td>
          </tr>
        `;
      }).join('');
    }
  }

  const refresh = () => {
    const wins = store.wins;
    const matches = store.matches;
    const winRate = matches > 0 ? `${Math.round((wins / matches) * 100)}%` : '0%';
    const certCount = getCertifiedClasses().length;

    const stage1Done = isTutorialCompleted('basics-stage-1') || isTutorialCompleted('cascade-basics');
    const stage2Done = certCount >= 4 || isTutorialCompleted('basics-stage-2');
    const stage3Done = isTutorialCompleted('basics-stage-3');
    const stagesCompletedCount = [stage1Done, stage2Done, stage3Done].filter(Boolean).length;

    const winsEl = overlay.querySelector('[data-stat-wins]');
    const matchesEl = overlay.querySelector('[data-stat-matches]');
    const winrateEl = overlay.querySelector('[data-stat-winrate]');
    const certEl = overlay.querySelector('[data-stat-certified]');
    const stagesEl = overlay.querySelector('[data-stat-stages]');

    if (winsEl) winsEl.textContent = String(wins);
    if (matchesEl) matchesEl.textContent = String(matches);
    if (winrateEl) winrateEl.textContent = winRate;
    if (certEl) certEl.textContent = `${certCount} / 4`;
    if (stagesEl) stagesEl.textContent = `${stagesCompletedCount} / 3`;

    // High Scores
    const highScoresGrid = overlay.querySelector<HTMLElement>('[data-stat-highscores]');
    if (highScoresGrid) {
      highScoresGrid.innerHTML = STAT_HIGHSCORE_MODES.map(mode => {
        const scores = getTopScores(mode.key);
        const rows = [0, 1, 2].map(i => {
          const entry = scores[i];
          if (!entry) {
            return `<div style="display:flex;justify-content:space-between;font-size:.7rem;color:#6b7280;padding:2px 0"><span>#${i + 1}</span><span>No score yet</span></div>`;
          }
          return `<div style="display:flex;justify-content:space-between;font-size:.72rem;color:#eef2ff;padding:2px 0"><span>#${i + 1}</span><strong>${entry.score.toLocaleString()} <span style="color:#9da6c8;font-weight:600">(${entry.lines}L)</span></strong></div>`;
        }).join('');
        return `
          <article class="bq-stats-card">
            <h4 style="color:${mode.accent};margin-bottom:6px">${mode.label}</h4>
            ${rows}
          </article>
        `;
      }).join('');
    }

    // Class Certifications
    const certGrid = overlay.querySelector<HTMLElement>('[data-stat-certifications]');
    if (certGrid) {
      certGrid.innerHTML = PLAYER_CLASSES.map(cls => {
        const certified = isClassCertified(cls.id);
        const accent = classAccents[cls.id] || '#00e5ff';
        return `
          <article class="bq-stats-card ${certified ? '' : 'locked'}" style="${certified ? `border-color:${accent}66` : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <div style="display:flex;align-items:center;gap:8px">
                <img src="${cls.iconUrl}" alt="${cls.name}" style="width:24px;height:24px;object-fit:contain;border-radius:4px;background:rgba(255,255,255,0.06);padding:2px" />
                <h4 style="color:${accent};margin:0">${cls.name}</h4>
              </div>
              <small style="color:${certified ? '#00ff88' : '#9da6c8'};font-weight:800">${certified ? '★ CERTIFIED' : 'UNCERTIFIED'}</small>
            </div>
            <p style="margin-top:0.4rem">[Q] ${cls.abilityQName} · [E] ${cls.abilityEName} · [R] ${cls.ultimateName}</p>
          </article>
        `;
      }).join('');
    }

    // Tutorial Curriculum Progress
    const tutorialsGrid = overlay.querySelector<HTMLElement>('[data-stat-tutorials]');
    if (tutorialsGrid) {
      tutorialsGrid.innerHTML = TUTORIAL_STAGES_INFO.map(stage => {
        let completed = isTutorialCompleted(stage.id) || (stage.legacyId ? isTutorialCompleted(stage.legacyId) : false);
        let statusLabel = completed ? '✓ COMPLETED' : 'NOT COMPLETED';
        let statusColor = completed ? '#00ff88' : '#9da6c8';

        if (stage.id === 'basics-stage-2') {
          if (certCount >= 4 || completed) {
            completed = true;
            statusLabel = '✓ 4 / 4 CERTIFIED';
            statusColor = '#00ff88';
          } else if (certCount > 0) {
            statusLabel = `${certCount} / 4 CERTIFIED`;
            statusColor = '#00e5ff';
          } else {
            statusLabel = '0 / 4 CERTIFIED';
          }
        } else if (stage.id === 'mode-briefings') {
          const modeKeys = ['mode-briefing-classic-pvp', 'mode-briefing-free-for-all', 'mode-briefing-team-deathmatch', 'mode-briefing-battle-royale'];
          const reviewedCount = modeKeys.filter(k => isTutorialCompleted(k)).length;
          completed = reviewedCount >= 4;
          if (completed) {
            statusLabel = '✓ 4 / 4 REVIEWED';
            statusColor = '#00ff88';
          } else if (reviewedCount > 0) {
            statusLabel = `${reviewedCount} / 4 REVIEWED`;
            statusColor = '#00e5ff';
          } else {
            statusLabel = '0 / 4 REVIEWED';
            statusColor = '#9da6c8';
          }
        }

        return `
          <article class="bq-stats-card ${completed ? '' : 'locked'}" style="${completed ? `border-color:${stage.accent}66` : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <h4 style="color:${stage.accent}">${stage.stageLabel} · ${stage.title}</h4>
              <small style="color:${statusColor};font-weight:800;font-size:0.65rem">${statusLabel}</small>
            </div>
            <p>${stage.description}</p>
          </article>
        `;
      }).join('');
    }

    renderRankedView();
  };

  window.addEventListener('highScoresUpdated', refresh);
  window.addEventListener('tutorialProgressUpdated', refresh);
  window.addEventListener('progressionUpdated', refresh);

  const closeOverlay = () => {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  };

  statsNav.addEventListener('click', event => {
    event.preventDefault();
    if (!store.currentUserId) {
      import('./Auth').then(m => m.openAuthModal());
      showToast('Please sign in to view your statistics.', 'warning');
      return;
    }
    refresh();
    if (activeTab === 'ranked') {
      void fetchLadder();
    }
    overlay.classList.add('open');
    overlay.style.display = 'flex';
  });

  overlay.querySelector('.bq-stats-close')?.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeOverlay();
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeOverlay();
  });

  closeOverlay();
  refresh();

  return { refresh, open: () => statsNav.click() };
}
