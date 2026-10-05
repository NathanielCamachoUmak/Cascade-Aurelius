// Battle Royale rules — single source of truth for the 4-stage elimination format.
// Both the server schedule and the client HUD read from here.
//
//   Stage 1: 30 players, 0 starting garbage rows
//   Stage 2: 20 players, 4 starting garbage rows
//   Stage 3: 10 players, 8 starting garbage rows
//   Stage 4:  4 players, 12 starting garbage rows, SUDDEN DEATH
//
// Each stage lasts 90s. Between stages there is a 5s intermission: the lowest
// scorers are cut down to the next stage's player cap and every board resets.

// Dev hook: BR_TIME_SCALE=0.1 makes stages/intermissions 10x shorter for smoke tests.
const TIME_SCALE = Number(process.env.BR_TIME_SCALE) > 0 ? Number(process.env.BR_TIME_SCALE) : 1;
const STAGE_MS = Math.round(90 * 1000 * TIME_SCALE);
const INTERMISSION_MS = Math.round(5 * 1000 * TIME_SCALE);

const STAGES = Object.freeze([
  { number: 1, id: 'stage-1', label: 'Stage 1', playerCap: 30, garbageLines: 0,  suddenDeath: false },
  { number: 2, id: 'stage-2', label: 'Stage 2', playerCap: 20, garbageLines: 4,  suddenDeath: false },
  { number: 3, id: 'stage-3', label: 'Stage 3', playerCap: 10, garbageLines: 8,  suddenDeath: false },
  { number: 4, id: 'stage-4', label: 'Stage 4 · Sudden Death', playerCap: 4, garbageLines: 12, suddenDeath: true },
].map(stage => Object.freeze({
  ...stage,
  durationMs: STAGE_MS,
  koRecovery: false,   // set true on a stage to bring back K.O. recovery instead of final top-outs
  gravityScale: 1, scoreMultiplier: 1, garbageRate: 1, itemBlockRate: 1, idlePenaltyMs: 0,
})));

export const BATTLE_ROYALE_RULES = Object.freeze({
  id: 'battle-royale',
  title: 'Battle Royale',
  format: '8-30 player solo',
  capacity: 30,
  minPlayers: 8,
  koFloor: 4,
  teamSize: 0,
  isTeamMode: false,
  winnerRule: 'Last survivor, or highest score when Stage 4 ends',
  stages: STAGES,
  stageDurationMs: STAGE_MS,
  intermissionMs: INTERMISSION_MS,
  durationMs: STAGES.length * STAGE_MS + (STAGES.length - 1) * INTERMISSION_MS,
  targetScore: 1_000_000,
  koScorePenalty: 0.20,
  koDecayBase: 0.85,
});

// Adaptive density brackets
export const DENSITY_BRACKETS = Object.freeze([
  {
    id: 'high', label: 'High Density', min: 21, max: 30,
    eventRotationMs: 45 * 1000, garbageSpeedBonus: 0.5, randomizedTargeting: true,
  },
  {
    id: 'mid', label: 'Mid Density', min: 10, max: 20,
    eventRotationMs: 60 * 1000, garbageSpeedBonus: 0, randomizedTargeting: false,
  },
  {
    id: 'low', label: 'Low Density', min: 1, max: 9,
    eventRotationMs: 60 * 1000, garbageSpeedBonus: 0, randomizedTargeting: false,
    boardHeightLimit: 16, forcedRivalDuels: true,
  },
]);

const numeric = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

export function getStage(index) {
  const stages = BATTLE_ROYALE_RULES.stages;
  return stages[Math.min(stages.length - 1, Math.max(0, Math.floor(numeric(index))))];
}

// Kept for older callers: phase == stage 1 (time no longer selects the phase).
export function getBattleRoyalPhase() { return BATTLE_ROYALE_RULES.stages[0]; }

// One hole column per starting garbage row. Sent to every client so all boards match.
export function buildGarbageHoles(count, width = 10) {
  return Array.from({ length: Math.max(0, Math.floor(numeric(count))) }, () => Math.floor(Math.random() * width));
}

// Who gets cut when moving from stage `index` to the next one.
export function planStageCull(players, nextStageIndex) {
  const cap = getStage(nextStageIndex).playerCap;
  const over = players.length - cap;
  return over > 0 ? selectBattleRoyalCullTargets(players, over, 'score', ['lines', 'kills']) : [];
}

export function getDensityBracket(activePlayers) {
  const count = numeric(activePlayers);
  return DENSITY_BRACKETS.find(b => count >= b.min && count <= b.max)
    ?? (count > 30 ? DENSITY_BRACKETS[0] : DENSITY_BRACKETS[2]);
}

export function isCullingFrozen(activePlayers) {
  return numeric(activePlayers) < BATTLE_ROYALE_RULES.minPlayers;
}

// True ONLY when 4 or fewer active players remain
export function isKoFloorReached(activePlayers) {
  return numeric(activePlayers) <= BATTLE_ROYALE_RULES.koFloor;
}

export function applyKoPenalty(rawScore) {
  return Math.max(0, Math.floor(numeric(rawScore) * (1 - BATTLE_ROYALE_RULES.koScorePenalty)));
}

export function finalScoreWithDecay(rawScore, koCount) {
  return Math.max(0, Math.floor(numeric(rawScore) * Math.pow(BATTLE_ROYALE_RULES.koDecayBase, numeric(koCount))));
}

export function hasReachedTarget(score) {
  return numeric(score) >= BATTLE_ROYALE_RULES.targetScore;
}

export function rankBattleRoyalPlayers(players) {
  const alive = p => p.state === 'playing';
  return [...players].sort((a, b) => {
    if (alive(a) !== alive(b)) return alive(a) ? -1 : 1;
    if (!alive(a) && numeric(a.eliminatedAt) !== numeric(b.eliminatedAt)) return numeric(b.eliminatedAt) - numeric(a.eliminatedAt);
    const aFinal = finalScoreWithDecay(a.score, a.koCount);
    const bFinal = finalScoreWithDecay(b.score, b.koCount);
    if (bFinal !== aFinal) return bFinal - aFinal;
    if (numeric(b.lines) !== numeric(a.lines)) return numeric(b.lines) - numeric(a.lines);
    return numeric(b.kills) - numeric(a.kills);
  });
}

export function rankForCull(players, primary, tieBreakers = []) {
  const keys = [primary, ...tieBreakers];
  return [...players].sort((a, b) => {
    for (const key of keys) {
      const diff = numeric(a[key]) - numeric(b[key]);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

export function selectBattleRoyalCullTargets(players, count, primary, tieBreakers = []) {
  const wanted = Math.max(0, Math.floor(numeric(count)));
  if (wanted === 0) return [];
  return rankForCull(players, primary, tieBreakers).slice(0, wanted);
}

export function closestToTarget(players) {
  if (!players || players.length === 0) return null;
  return [...players].sort((a, b) => {
    const aDist = Math.abs(BATTLE_ROYALE_RULES.targetScore - finalScoreWithDecay(a.score, a.koCount));
    const bDist = Math.abs(BATTLE_ROYALE_RULES.targetScore - finalScoreWithDecay(b.score, b.koCount));
    if (aDist !== bDist) return aDist - bDist;
    return numeric(a.koCount) - numeric(b.koCount);
  })[0];
}