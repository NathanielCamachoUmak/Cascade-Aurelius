import { isTutorialCompleted, markTutorialCompleted } from './TutorialManager';

export type ModeTutorialId = 'classic-pvp' | 'free-for-all' | 'team-deathmatch' | 'battle-royale';

export interface TacticalHotspot {
  id: string;
  pinNumber: number;
  title: string;
  description: string;
  xPercent: number;
  yPercent: number;
}

export interface ModeBriefingData {
  id: ModeTutorialId;
  tutorialKey: string;
  title: string;
  format: string;
  playerCount: string;
  accent: string;
  tagline: string;
  objective: string;
  keyHazard: string;
  proTip: string;
  hotspots: TacticalHotspot[];
  previewVideoSrc?: string;
  schematicSvg: string;
}

export const MODE_BRIEFINGS: Record<ModeTutorialId, ModeBriefingData> = {
  'classic-pvp': {
    id: 'classic-pvp',
    tutorialKey: 'mode-briefing-classic-pvp',
    title: '1v1 Classic PvP',
    format: 'HEAD-TO-HEAD DUEL',
    playerCount: '2 PLAYERS',
    accent: '#00e5ff',
    tagline: 'Direct Competitive Tetris Combat & Counter-Play',
    objective: 'Knock out your opponent by pushing their stack above the 20th row before they top out yours.',
    keyHazard: 'Uncancelled Garbage. Any incoming lines that you do not immediately neutralize push directly up from the bottom of your board.',
    proTip: 'Hold an I-piece in your queue! When your opponent launches a heavy garbage volley, clearing a 4-line Tetris cancels up to 4 pending lines instantly.',
    hotspots: [
      {
        id: 'garbage-gauge',
        pinNumber: 1,
        title: 'Garbage Queue Meter',
        description: 'Flashing warning column along the board edge. Shows pending red/yellow garbage lines about to push up under your board.',
        xPercent: 12,
        yPercent: 55,
      },
      {
        id: 'cancel-mechanic',
        pinNumber: 2,
        title: 'Garbage Cancellation',
        description: 'Line clears deduct line-for-line from your incoming meter before pushing excess garbage over to the opponent.',
        xPercent: 50,
        yPercent: 78,
      },
      {
        id: 'opponent-radar',
        pinNumber: 3,
        title: 'Opponent Mini-Cam',
        description: 'Live opponent telemetry showing stack height, hold piece, and imminent spikes to help time your defensive counter-attacks.',
        xPercent: 84,
        yPercent: 32,
      },
    ],
    schematicSvg: `
      <svg viewBox="0 0 600 340" class="w-full h-full" style="background:#090b1e;border-radius:8px">
        <defs>
          <linearGradient id="p1-grid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#12173d" />
            <stop offset="100%" stop-color="#070a22" />
          </linearGradient>
          <linearGradient id="garbage-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff1493" />
            <stop offset="100%" stop-color="#ff3366" />
          </linearGradient>
        </defs>
        <!-- Board Backgrounds -->
        <rect x="140" y="40" width="160" height="260" rx="6" fill="url(#p1-grid)" stroke="#00e5ff" stroke-width="2" />
        <rect x="420" y="70" width="120" height="200" rx="6" fill="#0d112d" stroke="#596080" stroke-width="1.5" />
        
        <!-- Player Matrix Lines -->
        <line x1="140" y1="90" x2="300" y2="90" stroke="#00e5ff" stroke-opacity="0.2" stroke-dasharray="3,3" />
        <line x1="140" y1="150" x2="300" y2="150" stroke="#00e5ff" stroke-opacity="0.2" stroke-dasharray="3,3" />
        <line x1="140" y1="210" x2="300" y2="210" stroke="#00e5ff" stroke-opacity="0.2" stroke-dasharray="3,3" />

        <!-- Garbage Warning Meter -->
        <rect x="118" y="100" width="14" height="200" rx="3" fill="#1b122c" stroke="#ff3366" stroke-width="1" />
        <rect x="120" y="190" width="10" height="108" rx="2" fill="url(#garbage-grad)" />
        <text x="125" y="90" fill="#ff3366" font-size="9" font-family="Inter,sans-serif" font-weight="800" text-anchor="middle">GARBAGE</text>

        <!-- Player Stack -->
        <rect x="142" y="240" width="156" height="58" rx="2" fill="#00e5ff" fill-opacity="0.3" stroke="#00e5ff" stroke-width="1" />
        <rect x="150" y="210" width="70" height="30" rx="2" fill="#ffd700" fill-opacity="0.5" stroke="#ffd700" stroke-width="1" />
        <rect x="220" y="180" width="60" height="60" rx="2" fill="#ff1493" fill-opacity="0.4" stroke="#ff1493" stroke-width="1" />

        <!-- Opponent Stack -->
        <rect x="422" y="180" width="116" height="88" rx="2" fill="#9da6c8" fill-opacity="0.25" stroke="#596080" stroke-width="1" />
        
        <!-- Attack Spike Laser Arrow -->
        <path d="M 305 210 Q 360 170 415 190" fill="none" stroke="#00e5ff" stroke-width="3" stroke-dasharray="6,4" />
        <polygon points="415,190 405,183 408,195" fill="#00e5ff" />
        <text x="360" y="165" fill="#00e5ff" font-size="10" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">LINE SPIKE</text>

        <!-- Labels -->
        <text x="220" y="30" fill="#00e5ff" font-size="12" font-family="Inter,sans-serif" font-weight="800" text-anchor="middle">YOUR BOARD</text>
        <text x="480" y="60" fill="#9da6c8" font-size="11" font-family="Inter,sans-serif" font-weight="700" text-anchor="middle">RIVAL</text>
      </svg>
    `,
  },
  'free-for-all': {
    id: 'free-for-all',
    tutorialKey: 'mode-briefing-free-for-all',
    title: 'Free For All',
    format: '1V1V1V1 SURVIVAL',
    playerCount: '4 PLAYERS',
    accent: '#ffd700',
    tagline: 'Multi-Opponent Chaos & Dynamic Target Selection',
    objective: 'Outlast all 3 opponents. Each knocked out player secures you higher placement points (1st through 4th).',
    keyHazard: 'Crossfire Danger. If two or more rivals focus fire on you simultaneously, incoming garbage accumulates exponentially!',
    proTip: 'Pay attention to who has the highest board stack. Tap your targeting switch to focus attack vulnerable opponents and claim K.O. eliminations.',
    hotspots: [
      {
        id: 'target-reticle',
        pinNumber: 1,
        title: 'Dynamic Targeting Reticle',
        description: 'Red targeting beacon displaying which opponent your line clears are currently aimed toward. Can be switched dynamically.',
        xPercent: 78,
        yPercent: 32,
      },
      {
        id: 'threat-warning',
        pinNumber: 2,
        title: 'Incoming Crossfire Warning',
        description: 'Alert indicators that highlight when multiple rivals have their targeting locks set on your board.',
        xPercent: 25,
        yPercent: 22,
      },
      {
        id: 'roster-standings',
        pinNumber: 3,
        title: 'Placement & Elimination Roster',
        description: 'Live leaderboard ranking players from 1st to 4th based on knockouts, current score, and survival time.',
        xPercent: 82,
        yPercent: 78,
      },
    ],
    schematicSvg: `
      <svg viewBox="0 0 600 340" class="w-full h-full" style="background:#090b1e;border-radius:8px">
        <!-- 4-Player Radar Layout -->
        <rect x="60" y="60" width="130" height="210" rx="6" fill="#12173d" stroke="#ffd700" stroke-width="2" />
        <rect x="235" y="50" width="95" height="150" rx="6" fill="#0c102a" stroke="#596080" stroke-width="1.5" />
        <rect x="360" y="50" width="95" height="150" rx="6" fill="#0c102a" stroke="#ff3366" stroke-width="2" />
        <rect x="485" y="50" width="95" height="150" rx="6" fill="#0c102a" stroke="#596080" stroke-width="1.5" />

        <!-- Crossfire Target Reticle on Opponent 2 -->
        <circle cx="407" cy="125" r="28" fill="none" stroke="#ff3366" stroke-width="2" stroke-dasharray="6,4" />
        <line x1="407" y1="92" x2="407" y2="158" stroke="#ff3366" stroke-width="1.5" />
        <line x1="374" y1="125" x2="440" y2="125" stroke="#ff3366" stroke-width="1.5" />
        <text x="407" y="175" fill="#ff3366" font-size="9" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">LOCKED TARGET</text>

        <!-- Player Board Attack Vector -->
        <path d="M 195 140 Q 285 70 360 110" fill="none" stroke="#ffd700" stroke-width="3" stroke-dasharray="5,4" />
        <polygon points="360,110 350,103 353,115" fill="#ffd700" />

        <!-- Live Roster Card -->
        <rect x="235" y="225" width="345" height="55" rx="6" fill="#101538" stroke="rgba(169,176,255,0.2)" />
        <text x="250" y="247" fill="#ffd700" font-size="11" font-family="Inter,sans-serif" font-weight="bold">STANDINGS</text>
        <text x="250" y="265" fill="#eef2ff" font-size="10" font-family="Inter,sans-serif">1st: YOU (Active) · 2nd: RIVAL 2 · 3rd: RIVAL 1 · 4th: RIVAL 3 [KO]</text>

        <!-- Labels -->
        <text x="125" y="45" fill="#ffd700" font-size="12" font-family="Inter,sans-serif" font-weight="800" text-anchor="middle">YOUR BOARD</text>
        <text x="282" y="38" fill="#9da6c8" font-size="10" font-family="Inter,sans-serif" text-anchor="middle">RIVAL 1</text>
        <text x="407" y="38" fill="#ff3366" font-size="10" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">RIVAL 2 (LOW HP)</text>
        <text x="532" y="38" fill="#9da6c8" font-size="10" font-family="Inter,sans-serif" text-anchor="middle">RIVAL 3</text>
      </svg>
    `,
  },
  'team-deathmatch': {
    id: 'team-deathmatch',
    tutorialKey: 'mode-briefing-team-deathmatch',
    title: '3v3 Team Deathmatch',
    format: '3V3 SQUAD DUEL',
    playerCount: '6 PLAYERS',
    accent: '#ff1493',
    tagline: 'Cyan Circuit vs Magenta Voltage Team Score Battle',
    objective: 'Combine forces with 2 teammates. The team with the highest combined cumulative score at the final horn wins!',
    keyHazard: 'Ally Neglect. When a teammate tops out, your squad suffers a score penalty and loses offensive momentum while they respawn.',
    proTip: 'Coordinate class abilities! Sentinel shields and Support recoveries should be targeted at teammates nearing top-out to keep all 3 boards active.',
    hotspots: [
      {
        id: 'team-bar',
        pinNumber: 1,
        title: 'Team Tug-of-War Score Bar',
        description: 'Prominent header banner displaying Cyan Circuit vs Magenta Voltage live pooled points. Every line cleared by any member contributes.',
        xPercent: 50,
        yPercent: 18,
      },
      {
        id: 'ally-health',
        pinNumber: 2,
        title: 'Squadmate Health Monitors',
        description: 'Mini board views showing your 2 teammates. Keep an eye on their stack height to trigger Support/Sentinel clutch saves.',
        xPercent: 18,
        yPercent: 62,
      },
      {
        id: 'horn-timer',
        pinNumber: 3,
        title: 'Match Countdown Clock',
        description: 'Timed round duration. When time strikes 0:00, the match horn sounds and the highest squad total wins the match.',
        xPercent: 50,
        yPercent: 86,
      },
    ],
    schematicSvg: `
      <svg viewBox="0 0 600 340" class="w-full h-full" style="background:#090b1e;border-radius:8px">
        <!-- Team Tug of War Header Bar -->
        <rect x="50" y="20" width="500" height="34" rx="6" fill="#0d112d" stroke="rgba(169,176,255,0.3)" />
        <rect x="52" y="22" width="280" height="30" rx="4" fill="#00e5ff" fill-opacity="0.35" />
        <rect x="332" y="22" width="216" height="30" rx="4" fill="#ff1493" fill-opacity="0.35" />
        <text x="110" y="42" fill="#00e5ff" font-size="12" font-family="Inter,sans-serif" font-weight="900">CYAN CIRCUIT: 42,500</text>
        <text x="490" y="42" fill="#ff1493" font-size="12" font-family="Inter,sans-serif" font-weight="900" text-anchor="end">MAGENTA: 38,100</text>
        <line x1="332" y1="20" x2="332" y2="54" stroke="#ffffff" stroke-width="3" />

        <!-- 3 Ally Boards (Left) -->
        <rect x="50" y="80" width="75" height="130" rx="4" fill="#12173d" stroke="#00e5ff" stroke-width="1.5" />
        <text x="87" y="73" fill="#00e5ff" font-size="9" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">ALLY 1</text>

        <rect x="140" y="80" width="105" height="180" rx="6" fill="#171e4d" stroke="#00e5ff" stroke-width="2.5" />
        <text x="192" y="73" fill="#00e5ff" font-size="11" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">YOU</text>

        <rect x="260" y="80" width="75" height="130" rx="4" fill="#12173d" stroke="#00e5ff" stroke-width="1.5" />
        <text x="297" y="73" fill="#00e5ff" font-size="9" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">ALLY 2</text>

        <!-- VS Divider -->
        <text x="355" y="160" fill="#ffd700" font-size="18" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">VS</text>

        <!-- 3 Enemy Boards (Right) -->
        <rect x="380" y="95" width="60" height="110" rx="4" fill="#1e1026" stroke="#ff1493" stroke-width="1.5" />
        <rect x="450" y="95" width="60" height="110" rx="4" fill="#1e1026" stroke="#ff1493" stroke-width="1.5" />
        <rect x="520" y="95" width="60" height="110" rx="4" fill="#1e1026" stroke="#ff1493" stroke-width="1.5" />

        <!-- Match Timer Horn Banner -->
        <rect x="220" y="280" width="160" height="34" rx="6" fill="#101538" stroke="#ffd700" stroke-width="1.5" />
        <text x="300" y="302" fill="#ffd700" font-size="12" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">⏱️ 01:45 REMAINING</text>
      </svg>
    `,
  },
  'battle-royale': {
    id: 'battle-royale',
    tutorialKey: 'mode-briefing-battle-royale',
    title: 'Battle Royale',
    format: '30-PLAYER TOURNAMENT',
    playerCount: '30 PLAYERS',
    accent: '#ffd700',
    tagline: 'Ten-Minute High-Stakes Solo Survival Race',
    objective: 'Survive across escalating culling phases. The closest surviving player to 1,000,000 points takes first place.',
    keyHazard: 'The Scheduled Cull. At every phase milestone, any player whose score is below the red elimination line is instantly removed!',
    proTip: 'Speed is king. Clear consecutive Tetrises and Special Blocks early to build an insurmountable score cushion before the Sudden Death phase begins.',
    hotspots: [
      {
        id: 'cull-threshold',
        pinNumber: 1,
        title: 'Culling Danger Threshold',
        description: 'Red survival cutoff score line. If your score is beneath this line when the phase timer reaches 0, you get eliminated.',
        xPercent: 48,
        yPercent: 48,
      },
      {
        id: 'phase-timer',
        pinNumber: 2,
        title: 'Phase Transition Timer',
        description: 'Indicates time remaining before the next cull wave (Phase 1 Warmup -> Phase 2 Elimination -> Final Sudden Death).',
        xPercent: 50,
        yPercent: 18,
      },
      {
        id: 'matrix-view',
        pinNumber: 3,
        title: '30-Player Radar Matrix',
        description: 'Panoramic grid showing the stack heights and survival statuses of all 30 competitors simultaneously.',
        xPercent: 82,
        yPercent: 62,
      },
    ],
    schematicSvg: `
      <svg viewBox="0 0 600 340" class="w-full h-full" style="background:#090b1e;border-radius:8px">
        <!-- Phase Timer Header -->
        <rect x="180" y="15" width="240" height="34" rx="6" fill="#151228" stroke="#ff3366" stroke-width="1.5" />
        <text x="300" y="37" fill="#ff3366" font-size="12" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">⚠️ PHASE 2 CULL IN 00:38</text>

        <!-- Player Hero Board -->
        <rect x="60" y="65" width="140" height="230" rx="6" fill="#12173d" stroke="#ffd700" stroke-width="2.5" />
        <text x="130" y="55" fill="#ffd700" font-size="12" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">YOUR BOARD</text>

        <!-- Culling Cutoff Line -->
        <line x1="220" y1="150" x2="560" y2="150" stroke="#ff3366" stroke-width="2" stroke-dasharray="6,4" />
        <text x="390" y="142" fill="#ff3366" font-size="11" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">DANGER THRESHOLD (MIN 150,000 PTS)</text>

        <!-- 30-Player Radar Matrix -->
        <g opacity="0.8">
          ${Array.from({ length: 15 })
            .map((_, i) => {
              const x = 230 + (i % 5) * 65;
              const y = 165 + Math.floor(i / 5) * 45;
              const isEliminated = i === 1 || i === 7 || i === 12;
              return `<rect x="${x}" y="${y}" width="55" height="36" rx="3" fill="${isEliminated ? '#230a14' : '#0d1330'}" stroke="${isEliminated ? '#551522' : '#596080'}" />
                      <text x="${x + 27}" y="${y + 22}" fill="${isEliminated ? '#882233' : '#aeb6d2'}" font-size="8" font-family="Inter,sans-serif" text-anchor="middle">${isEliminated ? 'CULLED' : 'SURVIVOR'}</text>`;
            })
            .join('')}
        </g>

        <!-- Player Score -->
        <rect x="65" y="250" width="130" height="40" rx="4" fill="#1b2455" />
        <text x="130" y="275" fill="#00ff88" font-size="13" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">248,300 PTS (SAFE)</text>
      </svg>
    `,
  },
};

const STYLE_ID = 'bq-mode-briefing-modal-style';

function ensureBriefingStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bq-briefing-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(2, 4, 15, 0.92);
      backdrop-filter: blur(10px);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .bq-briefing-overlay.open {
      display: flex;
    }
    .bq-briefing-panel {
      width: min(100%, 960px);
      max-height: 92vh;
      overflow-y: auto;
      background: linear-gradient(155deg, #13163a, #07091c);
      border: 1px solid rgba(0, 229, 255, 0.4);
      border-radius: 1rem;
      color: #eef2ff;
      box-shadow: 0 0 60px rgba(0, 229, 255, 0.2);
      display: flex;
      flex-direction: column;
    }
    .bq-briefing-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.1rem 1.4rem;
      border-bottom: 1px solid rgba(169, 176, 255, 0.2);
    }
    .bq-briefing-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .bq-briefing-header p {
      margin: 0.25rem 0 0;
      color: #00e5ff;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .bq-briefing-close {
      background: transparent;
      border: 1px solid #596080;
      color: #aeb6d2;
      border-radius: 0.4rem;
      font-size: 1.3rem;
      width: 2.2rem;
      height: 2.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .bq-briefing-close:hover {
      color: #fff;
      border-color: #00e5ff;
      transform: scale(1.05);
    }
    .bq-briefing-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.4rem;
      padding: 0.8rem 1.4rem;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(169, 176, 255, 0.15);
    }
    .bq-briefing-tab {
      padding: 0.6rem 0.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(169, 176, 255, 0.2);
      border-radius: 0.5rem;
      color: #9da6c8;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }
    .bq-briefing-tab:hover {
      color: #fff;
      border-color: rgba(0, 229, 255, 0.5);
    }
    .bq-briefing-tab.active {
      background: rgba(0, 229, 255, 0.12);
      border-color: #00e5ff;
      color: #00e5ff;
      box-shadow: 0 0 16px rgba(0, 229, 255, 0.25);
    }
    .bq-briefing-body {
      padding: 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .bq-briefing-visual-container {
      position: relative;
      width: 100%;
      height: 280px;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 1px solid rgba(169, 176, 255, 0.25);
      background: #090b1e;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bq-briefing-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: none;
    }
    .bq-briefing-video.ready {
      display: block;
    }
    .bq-briefing-hotspot {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #00e5ff;
      color: #07091c;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 0 12px rgba(0, 229, 255, 0.8);
      border: 2px solid #ffffff;
      transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 5;
    }
    .bq-briefing-hotspot:hover, .bq-briefing-hotspot.active {
      transform: translate(-50%, -50%) scale(1.25);
      background: #ffd700;
      color: #07091c;
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.9);
    }
    .bq-briefing-hotspots-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }
    .bq-briefing-hotspot-card {
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(169, 176, 255, 0.18);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .bq-briefing-hotspot-card:hover, .bq-briefing-hotspot-card.active {
      background: rgba(0, 229, 255, 0.08);
      border-color: #00e5ff;
    }
    .bq-briefing-hotspot-card h4 {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: #00e5ff;
    }
    .bq-briefing-hotspot-card p {
      margin: 0.35rem 0 0;
      font-size: 0.72rem;
      color: #aeb6d2;
      line-height: 1.4;
    }
    .bq-briefing-rulecard {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.8rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(169, 176, 255, 0.2);
      border-radius: 0.65rem;
    }
    .bq-briefing-rule-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .bq-briefing-rule-item span {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .bq-briefing-rule-item p {
      margin: 0;
      font-size: 0.75rem;
      color: #dce6ff;
      line-height: 1.45;
    }
    .bq-briefing-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.4rem;
      border-top: 1px solid rgba(169, 176, 255, 0.2);
      background: rgba(0, 0, 0, 0.25);
    }
    .bq-briefing-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .bq-briefing-action-btn {
      padding: 0.6rem 1.4rem;
      border: 1px solid #00e5ff;
      border-radius: 0.5rem;
      background: #00e5ff;
      color: #07091c;
      font-weight: 800;
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.35);
      transition: all 0.15s ease;
    }
    .bq-briefing-action-btn:hover {
      filter: brightness(1.15);
      transform: scale(1.02);
    }
    .bq-briefing-action-btn.completed {
      background: rgba(0, 255, 136, 0.15);
      border-color: #00ff88;
      color: #00ff88;
      box-shadow: 0 0 20px rgba(0, 255, 136, 0.25);
    }
    @media (max-width: 768px) {
      .bq-briefing-tabs { grid-template-columns: repeat(2, 1fr); }
      .bq-briefing-hotspots-bar { grid-template-columns: 1fr; }
      .bq-briefing-rulecard { grid-template-columns: 1fr; }
      .bq-briefing-footer { flex-direction: column; gap: 0.75rem; align-items: stretch; text-align: center; }
    }
  `;
  document.head.appendChild(style);
}

let activeOverlay: HTMLElement | null = null;
let currentMode: ModeTutorialId = 'classic-pvp';
let activeHotspotId: string | null = null;

export function openModeBriefing(initialMode: ModeTutorialId = 'classic-pvp'): void {
  ensureBriefingStyles();
  currentMode = initialMode;

  if (!activeOverlay) {
    activeOverlay = document.createElement('div');
    activeOverlay.className = 'bq-briefing-overlay';
    document.body.appendChild(activeOverlay);

    // Escape listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeOverlay?.classList.contains('open')) {
        closeModeBriefing();
      }
    });

    activeOverlay.addEventListener('click', (e) => {
      if (e.target === activeOverlay) {
        closeModeBriefing();
      }
    });
  }

  renderModalContent();
  activeOverlay.classList.add('open');
}

export function closeModeBriefing(): void {
  if (activeOverlay) {
    activeOverlay.classList.remove('open');
    // Pause any playing videos
    const video = activeOverlay.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.pause();
      video.src = '';
    }
  }
}

function renderModalContent(): void {
  if (!activeOverlay) return;
  const data = MODE_BRIEFINGS[currentMode];
  const isCompleted = isTutorialCompleted(data.tutorialKey);
  activeHotspotId = data.hotspots[0]?.id || null;

  activeOverlay.innerHTML = `
    <div class="bq-briefing-panel" role="dialog" aria-modal="true">
      <div class="bq-briefing-header">
        <div>
          <p>TACTICAL MODE INTEL · ${data.playerCount}</p>
          <h2>${data.title}</h2>
        </div>
        <button class="bq-briefing-close" type="button" aria-label="Close Intel">×</button>
      </div>

      <div class="bq-briefing-tabs">
        ${(Object.keys(MODE_BRIEFINGS) as ModeTutorialId[])
          .map((modeKey) => {
            const m = MODE_BRIEFINGS[modeKey];
            const comp = isTutorialCompleted(m.tutorialKey);
            return `
              <button type="button" class="bq-briefing-tab ${modeKey === currentMode ? 'active' : ''}" data-tab="${modeKey}">
                ${comp ? '✓ ' : ''}${m.title}
              </button>
            `;
          })
          .join('')}
      </div>

      <div class="bq-briefing-body">
        <!-- Visual Preview / Tactical Schematic -->
        <div class="bq-briefing-visual-container">
          <div class="w-full h-full flex items-center justify-center relative">
            ${data.schematicSvg}
            ${data.hotspots
              .map(
                (h) => `
              <button 
                type="button" 
                class="bq-briefing-hotspot ${h.id === activeHotspotId ? 'active' : ''}" 
                style="left: ${h.xPercent}%; top: ${h.yPercent}%" 
                data-hotspot="${h.id}"
                title="${h.title}"
              >
                ${h.pinNumber}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Hotspot Intel Callouts -->
        <div class="bq-briefing-hotspots-bar">
          ${data.hotspots
            .map(
              (h) => `
            <div class="bq-briefing-hotspot-card ${h.id === activeHotspotId ? 'active' : ''}" data-card-hotspot="${h.id}">
              <h4 style="color:${data.accent}">
                <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${data.accent};color:#07091c;text-align:center;line-height:18px;font-size:11px">${h.pinNumber}</span>
                ${h.title}
              </h4>
              <p>${h.description}</p>
            </div>
          `
            )
            .join('')}
        </div>

        <!-- 3-Bullet Rulecard -->
        <div class="bq-briefing-rulecard">
          <div class="bq-briefing-rule-item">
            <span style="color:#00e5ff">🎯 PRIMARY OBJECTIVE</span>
            <p>${data.objective}</p>
          </div>
          <div class="bq-briefing-rule-item">
            <span style="color:#ff3366">⚠️ KEY HAZARD</span>
            <p>${data.keyHazard}</p>
          </div>
          <div class="bq-briefing-rule-item">
            <span style="color:#ffd700">💡 TACTICAL PRO-TIP</span>
            <p>${data.proTip}</p>
          </div>
        </div>
      </div>

      <div class="bq-briefing-footer">
        <div class="bq-briefing-status">
          <span style="color:${isCompleted ? '#00ff88' : '#9da6c8'}">
            ${isCompleted ? '✓ INTEL CONFIRMED' : '○ INTEL PENDING REVIEW'}
          </span>
        </div>
        <button type="button" class="bq-briefing-action-btn ${isCompleted ? 'completed' : ''}" id="btn-mark-briefing-done">
          ${isCompleted ? '✓ REVIEWED (CONFIRM AGAIN)' : 'CONFIRM &amp; COMPLETE INTEL'}
        </button>
      </div>
    </div>
  `;

  // Attach event handlers
  const closeBtn = activeOverlay.querySelector('.bq-briefing-close');
  closeBtn?.addEventListener('click', closeModeBriefing);

  // Tabs
  activeOverlay.querySelectorAll<HTMLButtonElement>('.bq-briefing-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetMode = tab.dataset.tab as ModeTutorialId;
      if (targetMode && targetMode !== currentMode) {
        currentMode = targetMode;
        renderModalContent();
      }
    });
  });

  // Hotspots selection
  const updateActiveHotspot = (hId: string) => {
    activeHotspotId = hId;
    activeOverlay?.querySelectorAll('.bq-briefing-hotspot').forEach((pin) => {
      pin.classList.toggle('active', (pin as HTMLElement).dataset.hotspot === hId);
    });
    activeOverlay?.querySelectorAll('.bq-briefing-hotspot-card').forEach((card) => {
      card.classList.toggle('active', (card as HTMLElement).dataset.cardHotspot === hId);
    });
  };

  activeOverlay.querySelectorAll<HTMLButtonElement>('.bq-briefing-hotspot').forEach((pin) => {
    pin.addEventListener('click', () => {
      const hId = pin.dataset.hotspot;
      if (hId) updateActiveHotspot(hId);
    });
  });

  activeOverlay.querySelectorAll<HTMLElement>('.bq-briefing-hotspot-card').forEach((card) => {
    card.addEventListener('click', () => {
      const hId = card.dataset.cardHotspot;
      if (hId) updateActiveHotspot(hId);
    });
  });

  // Action Button
  const actionBtn = activeOverlay.querySelector<HTMLButtonElement>('#btn-mark-briefing-done');
  actionBtn?.addEventListener('click', () => {
    markTutorialCompleted(data.tutorialKey);
    window.dispatchEvent(new CustomEvent('tutorialProgressUpdated'));
    renderModalContent();
  });
}
