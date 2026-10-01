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
    accent: '#00e5ff',
    tagline: 'Cyan Circuit vs Magenta Voltage Team Tug-of-War Score Battle',
    objective: 'Work in unison with 2 squadmates to accumulate the highest combined pooled team score before the 4:00 final horn.',
    keyHazard: 'Ally Neglect & K.O. Penalties. When a teammate tops out, your squad suffers a 20% score deduction and loses momentum during their 3-second reboot.',
    proTip: 'Coordinate roles! Support classes should monitor squadmate stack alerts and deploy clutch line-clears to keep all 3 boards alive and scoring.',
    hotspots: [
      {
        id: 'team-bar',
        pinNumber: 1,
        title: 'Team Tug-of-War Score Bar',
        description: 'Live pooled scoring. All lines cleared, combos, and enemy K.O. bounties (+2,500 pts) feed directly into your squad total, shifting the momentum bar in real time.',
        xPercent: 50,
        yPercent: 8,
      },
      {
        id: 'squad-monitors',
        pinNumber: 2,
        title: 'Squadmate Vitals & Stack Alerts',
        description: 'Your friendly squad pod. When a teammate reaches 14+ rows, a pulsing danger alert warns Support and Sentinel to execute a clutch rescue before they top out.',
        xPercent: 12,
        yPercent: 44,
      },
      {
        id: 'targeting-crossfire',
        pinNumber: 3,
        title: 'Dynamic Enemy Reticle & Crossfire',
        description: 'Offensive classes cycle strictly between the 3 enemy boards. Focus attacks on vulnerable rivals to break their defenses and claim high-value K.O. bounties.',
        xPercent: 74,
        yPercent: 32,
      },
      {
        id: 'rescue-beacon',
        pinNumber: 4,
        title: 'Clutch Squad Rescue Beacons',
        description: 'Support (Recycle & Guardian Angel) and Sentinel (Fortify) can target squadmates nearing top-out to instantly clear lines and rescue their boards.',
        xPercent: 34,
        yPercent: 54,
      },
      {
        id: 'ko-respawn',
        pinNumber: 5,
        title: 'K.O. Bounty & 3s Respawn Reboot',
        description: 'Topping out triggers a 20% score deduction and a 3s reboot before respawning. Knocking out all 3 enemies simultaneously awards a massive +10,000 pt SQUAD ACE!',
        xPercent: 88,
        yPercent: 54,
      },
    ],
    schematicSvg: `
      <svg viewBox="0 0 640 350" class="w-full h-full" style="background:#07091a;border-radius:10px" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tdm-cyan-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#00a8ff" stop-opacity="0.85" />
          </linearGradient>
          <linearGradient id="tdm-mag-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ff007f" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#7928ca" stop-opacity="0.6" />
          </linearGradient>
          <linearGradient id="tdm-board-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#141a3a" />
            <stop offset="100%" stop-color="#0a0d24" />
          </linearGradient>
          <filter id="tdm-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="tdm-glow-pink" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <style>
            @keyframes laser-stream {
              0% { stroke-dashoffset: 48; opacity: 0.3; }
              50% { opacity: 1; stroke-width: 3.5; }
              100% { stroke-dashoffset: -48; opacity: 0.3; }
            }
            @keyframes rescue-beam {
              0%, 100% { stroke-opacity: 0.4; stroke-width: 2.5; filter: drop-shadow(0 0 2px #00ff88); }
              50% { stroke-opacity: 1; stroke-width: 4.5; filter: drop-shadow(0 0 8px #00ff88); }
            }
            @keyframes reticle-pulse {
              0%, 100% { transform: scale(1); stroke-opacity: 0.8; }
              50% { transform: scale(1.12); stroke-opacity: 1; }
            }
            @keyframes danger-alert {
              0%, 100% { fill: rgba(239, 68, 68, 0.2); stroke: #ef4444; }
              50% { fill: rgba(239, 68, 68, 0.65); stroke: #ff7878; }
            }
            @keyframes piece-drop {
              0% { transform: translateY(-16px); opacity: 0.7; }
              60% { transform: translateY(0px); opacity: 1; }
              100% { transform: translateY(0px); opacity: 1; }
            }
            @keyframes reboot-pulse {
              0%, 100% { opacity: 0.75; transform: scale(0.98); }
              50% { opacity: 1; transform: scale(1.02); }
            }
            @keyframes tug-pulse {
              0%, 100% { filter: drop-shadow(0 0 4px #00e5ff); }
              50% { filter: drop-shadow(0 0 10px #00e5ff); }
            }
            .anim-laser { animation: laser-stream 1.2s linear infinite; stroke-dasharray: 12, 6; }
            .anim-rescue { animation: rescue-beam 1.4s ease-in-out infinite; }
            .anim-danger { animation: danger-alert 1.2s ease-in-out infinite; }
            .anim-piece { animation: piece-drop 2s ease-in-out infinite; }
            .anim-reboot { animation: reboot-pulse 1.8s ease-in-out infinite; transform-origin: center; }
            .anim-tug { animation: tug-pulse 2s ease-in-out infinite; }
          </style>
        </defs>

        <!-- 1. Team Tug-of-War Score Bar (Header) -->
        <g id="svg-team-score-bar" class="anim-tug">
          <rect x="35" y="12" width="570" height="34" rx="7" fill="#0b0e27" stroke="rgba(169,176,255,0.3)" stroke-width="1.5" />
          <!-- Cyan Fill (55%) -->
          <rect x="37" y="14" width="313" height="30" rx="5" fill="url(#tdm-cyan-fill)" />
          <!-- Magenta Fill (45%) -->
          <rect x="350" y="14" width="253" height="30" rx="5" fill="url(#tdm-mag-fill)" />
          <!-- Tug Divider Line -->
          <line x1="350" y1="12" x2="350" y2="46" stroke="#ffffff" stroke-width="3.5" filter="drop-shadow(0 0 6px #fff)" />
          
          <!-- Team Score Labels -->
          <text x="48" y="33" fill="#ffffff" font-size="11" font-family="'Press Start 2P', monospace" font-weight="900">CYAN 48,200</text>
          <text x="180" y="32" fill="#00e5ff" font-size="9" font-family="Inter, sans-serif" font-weight="800">[+1,200 SPIKE]</text>
          <text x="592" y="33" fill="#ffffff" font-size="11" font-family="'Press Start 2P', monospace" font-weight="900" text-anchor="end">39,800 MAGENTA</text>
        </g>

        <!-- Pod Category Banners -->
        <g id="svg-pod-headers">
          <rect x="35" y="52" width="265" height="18" rx="4" fill="rgba(0, 229, 255, 0.12)" stroke="#00e5ff" stroke-width="1" />
          <text x="167" y="64" fill="#00e5ff" font-size="8.5" font-family="'Press Start 2P', monospace" font-weight="bold" text-anchor="middle">FRIENDLY SQUAD POD</text>

          <rect x="340" y="52" width="265" height="18" rx="4" fill="rgba(255, 0, 127, 0.12)" stroke="#ff007f" stroke-width="1" />
          <text x="472" y="64" fill="#ff007f" font-size="8.5" font-family="'Press Start 2P', monospace" font-weight="bold" text-anchor="middle">ENEMY SQUAD POD</text>
        </g>

        <!-- Center VS Energy Gateway -->
        <g id="svg-vs-divider">
          <line x1="320" y1="72" x2="320" y2="280" stroke="rgba(255, 215, 0, 0.35)" stroke-width="1.5" stroke-dasharray="4,4" />
          <circle cx="320" cy="170" r="16" fill="#0c102a" stroke="#ffd700" stroke-width="2" />
          <text x="320" y="175" fill="#ffd700" font-size="10" font-family="'Press Start 2P', monospace" font-weight="bold" text-anchor="middle">VS</text>
        </g>

        <!-- ================= FRIENDLY SQUAD (LEFT) ================= -->
        <!-- Ally 1: Sentinel -->
        <g id="svg-ally-1">
          <rect x="35" y="78" width="76" height="142" rx="5" fill="url(#tdm-board-grad)" stroke="#00e5ff" stroke-width="1.5" />
          <rect x="35" y="78" width="76" height="20" rx="5" fill="rgba(0,229,255,0.2)" />
          <text x="73" y="92" fill="#00e5ff" font-size="8" font-family="'Press Start 2P', monospace" text-anchor="middle">ALLY 1</text>
          <!-- Stack (Safe) -->
          <rect x="39" y="170" width="68" height="46" rx="2" fill="#00e5ff" fill-opacity="0.35" />
          <!-- Shield Block Indicator -->
          <rect x="42" y="174" width="14" height="14" rx="2" fill="#00ff88" />
          <text x="49" y="184" fill="#07091c" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">S</text>
          <text x="73" y="210" fill="#9da6c8" font-size="7.5" font-family="Inter,sans-serif" text-anchor="middle">SENTINEL [SAFE]</text>
        </g>

        <!-- Local Player: YOU (Center Prominent) -->
        <g id="svg-player-you">
          <rect x="119" y="72" width="98" height="162" rx="6" fill="#0f1535" stroke="#00e5ff" stroke-width="2.5" filter="url(#tdm-glow-cyan)" />
          <rect x="119" y="72" width="98" height="22" rx="6" fill="rgba(0, 229, 255, 0.3)" />
          <text x="168" y="87" fill="#ffffff" font-size="9" font-family="'Press Start 2P', monospace" font-weight="bold" text-anchor="middle">YOU (P1)</text>
          
          <!-- Matrix Grid Lines -->
          <line x1="123" y1="120" x2="213" y2="120" stroke="#00e5ff" stroke-opacity="0.2" stroke-dasharray="2,2" />
          <line x1="123" y1="160" x2="213" y2="160" stroke="#00e5ff" stroke-opacity="0.2" stroke-dasharray="2,2" />
          
          <!-- Dropping Cyan Tetromino (Animated) -->
          <g class="anim-piece">
            <rect x="151" y="105" width="14" height="14" rx="2" fill="#00e5ff" stroke="#fff" stroke-width="1" />
            <rect x="165" y="105" width="14" height="14" rx="2" fill="#00e5ff" stroke="#fff" stroke-width="1" />
            <rect x="179" y="105" width="14" height="14" rx="2" fill="#00e5ff" stroke="#fff" stroke-width="1" />
            <rect x="165" y="91" width="14" height="14" rx="2" fill="#00e5ff" stroke="#fff" stroke-width="1" />
          </g>

          <!-- Stack at bottom -->
          <rect x="123" y="175" width="90" height="54" rx="2" fill="#00e5ff" fill-opacity="0.4" stroke="#00e5ff" stroke-width="1" />
          <!-- Scorecard Under Board -->
          <rect x="119" y="238" width="98" height="26" rx="4" fill="#0a0d26" stroke="#00e5ff" stroke-width="1" />
          <text x="168" y="248" fill="#ffffff" font-size="7.5" font-family="'Press Start 2P', monospace" text-anchor="middle">18,400 PTS</text>
          <text x="168" y="259" fill="#00e5ff" font-size="8" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">SPEEDSTER · 14 L</text>
        </g>

        <!-- Ally 2: Support (Critical Stack Alert) -->
        <g id="svg-ally-2">
          <rect x="225" y="78" width="76" height="142" rx="5" fill="url(#tdm-board-grad)" stroke="#ff4444" stroke-width="2" class="anim-danger" />
          <rect x="225" y="78" width="76" height="20" rx="5" fill="rgba(239, 68, 68, 0.4)" />
          <text x="263" y="92" fill="#ffffff" font-size="8" font-family="'Press Start 2P', monospace" text-anchor="middle">ALLY 2</text>
          <!-- Dangerous High Stack (16 Rows) -->
          <rect x="229" y="112" width="68" height="104" rx="2" fill="#ff4444" fill-opacity="0.45" stroke="#ef4444" stroke-width="1" />
          <!-- Warning Badge -->
          <rect x="233" y="118" width="60" height="14" rx="3" fill="#1f0a10" stroke="#ef4444" stroke-width="1" />
          <text x="263" y="128" fill="#ff7878" font-size="6.5" font-family="'Press Start 2P', monospace" text-anchor="middle">STACK 16!</text>
          <text x="263" y="210" fill="#ffb4b4" font-size="7.5" font-family="Inter,sans-serif" text-anchor="middle">SUPPORT [DANGER]</text>
        </g>

        <!-- Clutch Rescue Beam (You -> Ally 2) -->
        <g id="svg-rescue-tether">
          <path d="M 217 145 C 220 145, 222 145, 229 145" fill="none" stroke="#00ff88" stroke-width="3" class="anim-rescue" />
          <circle cx="217" cy="145" r="4" fill="#00ff88" />
          <circle cx="229" cy="145" r="4" fill="#00ff88" />
          <rect x="180" y="152" width="80" height="15" rx="3" fill="#051c12" stroke="#00ff88" stroke-width="1" />
          <text x="220" y="163" fill="#00ff88" font-size="7" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">RESCUE -4 LINES</text>
        </g>

        <!-- Attack Laser Vector (You -> Enemy 2) -->
        <g id="svg-attack-lasers">
          <path d="M 217 122 Q 320 85 423 118" fill="none" stroke="#00e5ff" stroke-width="3" class="anim-laser" />
          <polygon points="423,118 412,112 415,124" fill="#00e5ff" />
          <text x="320" y="100" fill="#00e5ff" font-size="8" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">GARBAGE SPIKE →</text>
        </g>

        <!-- ================= ENEMY SQUAD (RIGHT) ================= -->
        <!-- Enemy 1 -->
        <g id="svg-enemy-1">
          <rect x="340" y="78" width="76" height="142" rx="5" fill="url(#tdm-board-grad)" stroke="#ff007f" stroke-width="1.5" />
          <rect x="340" y="78" width="76" height="20" rx="5" fill="rgba(255,0,127,0.2)" />
          <text x="378" y="92" fill="#ff007f" font-size="8" font-family="'Press Start 2P', monospace" text-anchor="middle">RIVAL 1</text>
          <!-- Stack -->
          <rect x="344" y="165" width="68" height="51" rx="2" fill="#ff007f" fill-opacity="0.3" />
          <text x="378" y="210" fill="#9da6c8" font-size="7.5" font-family="Inter,sans-serif" text-anchor="middle">TANK [ACTIVE]</text>
        </g>

        <!-- Enemy 2: Targeted Rival with Crosshair Reticle -->
        <g id="svg-enemy-2">
          <rect x="424" y="72" width="98" height="162" rx="6" fill="#1a0c20" stroke="#ff007f" stroke-width="2.5" filter="url(#tdm-glow-pink)" />
          <rect x="424" y="72" width="98" height="22" rx="6" fill="rgba(255, 0, 127, 0.4)" />
          <text x="473" y="87" fill="#ffffff" font-size="9" font-family="'Press Start 2P', monospace" font-weight="bold" text-anchor="middle">RIVAL 2</text>
          
          <!-- Targeting Reticle Header Badge -->
          <rect x="430" y="97" width="86" height="16" rx="3" fill="#38061a" stroke="#ff007f" stroke-width="1" />
          <text x="473" y="108" fill="#ff007f" font-size="7" font-family="'Press Start 2P', monospace" font-weight="900" text-anchor="middle">▼ LOCKED TARGET</text>

          <!-- Impact Sparks & Stack -->
          <rect x="428" y="145" width="90" height="84" rx="2" fill="#ff007f" fill-opacity="0.45" stroke="#ff007f" stroke-width="1" />
          <!-- Incoming Garbage Red Lines -->
          <rect x="430" y="210" width="86" height="16" rx="2" fill="#ff3366" />
          <text x="473" y="222" fill="#ffffff" font-size="7.5" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">INCOMING GARBAGE</text>
          
          <!-- Scorecard Under Board -->
          <rect x="424" y="238" width="98" height="26" rx="4" fill="#0a0d26" stroke="#ff007f" stroke-width="1" />
          <text x="473" y="248" fill="#ffffff" font-size="7.5" font-family="'Press Start 2P', monospace" text-anchor="middle">12,100 PTS</text>
          <text x="473" y="259" fill="#ff007f" font-size="8" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">SABOTEUR · 9 L</text>
        </g>

        <!-- Enemy 3: Topped Out / 3s Reboot Banner -->
        <g id="svg-enemy-3" class="anim-reboot">
          <rect x="530" y="78" width="76" height="142" rx="5" fill="#140a18" stroke="rgba(239, 68, 68, 0.6)" stroke-width="1.5" />
          <rect x="530" y="78" width="76" height="20" rx="5" fill="rgba(28, 10, 16, 0.85)" />
          <text x="568" y="92" fill="#ef4444" font-size="8" font-family="'Press Start 2P', monospace" text-anchor="middle">RIVAL 3</text>
          
          <!-- Topped-out Stack -->
          <rect x="534" y="102" width="68" height="114" rx="2" fill="#2d0a14" fill-opacity="0.8" />
          
          <!-- 3-Second Reboot Stamp -->
          <rect x="536" y="138" width="64" height="34" rx="4" fill="#3b0816" stroke="#ef4444" stroke-width="1.5" />
          <text x="568" y="151" fill="#ff3366" font-size="7" font-family="'Press Start 2P', monospace" font-weight="900" text-anchor="middle">REBOOT</text>
          <text x="568" y="164" fill="#fca5a5" font-size="7.5" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">⏱️ 02s LEFT</text>
          
          <!-- K.O. Bounty Floating Text -->
          <rect x="533" y="180" width="70" height="16" rx="3" fill="#101538" stroke="#ffd700" stroke-width="1" />
          <text x="568" y="191" fill="#ffd700" font-size="7" font-family="Inter,sans-serif" font-weight="bold" text-anchor="middle">+2,500 BOUNTY</text>
        </g>

        <!-- ================= BOTTOM HUD STRIP ================= -->
        <!-- Match Timer Clock & Tactical Cues -->
        <g id="svg-bottom-timer">
          <rect x="220" y="278" width="200" height="32" rx="6" fill="#0d112d" stroke="#ffd700" stroke-width="1.5" filter="drop-shadow(0 0 8px rgba(255,215,0,0.3))" />
          <text x="320" y="298" fill="#ffd700" font-size="10.5" font-family="'Press Start 2P', monospace" font-weight="bold" text-anchor="middle">⏱️ 02:45 REMAINING</text>

          <text x="40" y="300" fill="#9da6c8" font-size="9" font-family="Inter,sans-serif" font-weight="600">CYCLE TARGETS: <tspan fill="#00e5ff" font-weight="bold">[W] OR CLICK</tspan></text>
          <text x="600" y="300" fill="#9da6c8" font-size="9" font-family="Inter,sans-serif" font-weight="600" text-anchor="end">ACE WIPEOUT: <tspan fill="#ffd700" font-weight="bold">+10,000 PTS</tspan></text>
        </g>
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
    .bq-stepper-btn:hover {
      filter: brightness(1.25);
      transform: scale(1.03);
    }
    .bq-briefing-hotspots-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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

        <!-- Guided Concept Walkthrough Stepper -->
        <div class="bq-briefing-stepper" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.45rem 0.8rem;background:rgba(255,255,255,0.04);border:1px solid rgba(169,176,255,0.2);border-radius:0.5rem">
          <button type="button" class="bq-stepper-btn" id="btn-stepper-prev" style="padding:0.35rem 0.8rem;border:1px solid rgba(0,229,255,0.4);border-radius:0.4rem;background:rgba(0,229,255,0.1);color:#00e5ff;font-size:0.72rem;font-weight:800;letter-spacing:0.08em;cursor:pointer;transition:all 0.15s">
            ◀ PREV CONCEPT
          </button>
          <span id="bq-stepper-title" style="font-size:0.74rem;font-weight:700;color:#eef2ff;letter-spacing:0.08em;text-transform:uppercase;text-align:center">
            <span style="color:${data.accent}">CONCEPT PIN ${(data.hotspots.findIndex(h => h.id === activeHotspotId) + 1) || 1} OF ${data.hotspots.length}:</span> ${data.hotspots.find(h => h.id === activeHotspotId)?.title || ''}
          </span>
          <button type="button" class="bq-stepper-btn" id="btn-stepper-next" style="padding:0.35rem 0.8rem;border:1px solid rgba(0,229,255,0.4);border-radius:0.4rem;background:rgba(0,229,255,0.1);color:#00e5ff;font-size:0.72rem;font-weight:800;letter-spacing:0.08em;cursor:pointer;transition:all 0.15s">
            NEXT CONCEPT ▶
          </button>
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
    const stepperTitle = activeOverlay?.querySelector('#bq-stepper-title');
    if (stepperTitle) {
      const pinIdx = data.hotspots.findIndex(h => h.id === hId);
      const hot = data.hotspots[pinIdx];
      if (hot) {
        stepperTitle.innerHTML = `<span style="color:${data.accent}">CONCEPT PIN ${pinIdx + 1} OF ${data.hotspots.length}:</span> ${hot.title}`;
      }
    }
  };

  const prevBtn = activeOverlay.querySelector<HTMLButtonElement>('#btn-stepper-prev');
  const nextBtn = activeOverlay.querySelector<HTMLButtonElement>('#btn-stepper-next');
  prevBtn?.addEventListener('click', () => {
    const idx = data.hotspots.findIndex(h => h.id === activeHotspotId);
    const prevIdx = (idx - 1 + data.hotspots.length) % data.hotspots.length;
    updateActiveHotspot(data.hotspots[prevIdx].id);
  });
  nextBtn?.addEventListener('click', () => {
    const idx = data.hotspots.findIndex(h => h.id === activeHotspotId);
    const nextIdx = (idx + 1) % data.hotspots.length;
    updateActiveHotspot(data.hotspots[nextIdx].id);
  });

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
