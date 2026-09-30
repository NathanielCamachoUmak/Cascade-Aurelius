// Battle Royale rules — single source of truth for the 4-minute "Culling Game".
// Both the schedule timers and the client HUD read from here.

export const BATTLE_ROYALE_RULES = Object.freeze({
  id: 'battle-royale',
  title: 'Battle Royale',
  format: '8-30 player solo',
  capacity: 30,
  minPlayers: 8,      // below this, culling events freeze
  koFloor: 4,         // K.O. mechanic ONLY applies when 4 or fewer players remain!
  teamSize: 0,
  isTeamMode: false,
  winnerRule: 'Highest score / last survivor at 4:00',
  durationMs: 4 * 60 * 1000,      // Fixed to 4 minutes
  targetScore: 1_000_000,
  suddenDeathAtMs: 3 * 60 * 1000, // Starts at 3:00

  koScorePenalty: 0.20,   // 20% score deduction on K.O.
  koDecayBase: 0.85,      // final = raw * 0.85^KOCount

  // Exact 4-Minute Culling Game Schedule
  phaseBreaks: [
    {
      atMs: 0, 
      id: 'garbage-surge', 
      label: 'High Garbage Surge',
      gravityScale: 1, 
      scoreMultiplier: 1, 
      garbageRate: 2.5,          // High Garbage Distribution (0:00 - 1:00)
      itemBlockRate: 0.5,
      idlePenaltyMs: 0,
    },
    {
      atMs: 60 * 1000, 
      id: 'item-frenzy', 
      label: 'Item Block Frenzy',
      gravityScale: 1.1, 
      scoreMultiplier: 1, 
      garbageRate: 1, 
      itemBlockRate: 3.0,        // High Item Blocks Distribution (1:01 - 2:00)
      idlePenaltyMs: 0,
    },
    {
      atMs: 120 * 1000, 
      id: 'score-frenzy', 
      label: 'High Score Multiplier',
      gravityScale: 1.25, 
      scoreMultiplier: 3.0,      // High Score Multiplier (2:01 - 3:00)
      garbageRate: 1.0, 
      itemBlockRate: 1.0,
      idlePenaltyMs: 15 * 1000,
    },
    {
      atMs: 180 * 1000, 
      id: 'pure-skill', 
      label: 'Sudden Death (Pure Skill)',
      gravityScale: 2.0, 
      scoreMultiplier: 1.0, 
      garbageRate: 1.0, 
      itemBlockRate: 0,          // No events/items, just skills & remaining players (3:01 - 4:00)
      idlePenaltyMs: 10 * 1000, 
      solidGarbage: true,
    },
  ],
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

export const DYNAMIC_RULES = Object.freeze([
  { id: 'double-points', label: 'Double Points', scoreMultiplier: 2 },
  { id: 'garbage-surge', label: 'Garbage Surge', garbageRate: 1.5 },
]);

const numeric = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

export function getBattleRoyalPhase(elapsedMs) {
  const elapsed = numeric(elapsedMs);
  const breaks = BATTLE_ROYALE_RULES.phaseBreaks;
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (elapsed >= breaks[i].atMs) return breaks[i];
  }
  return breaks[0];
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
  return [...players].sort((a, b) => {
    const aFinal = finalScoreWithDecay(a.score, a.koCount);
    const bFinal = finalScoreWithDecay(b.score, b.koCount);
    if (bFinal !== aFinal) return bFinal - aFinal;
    if (numeric(a.koCount) !== numeric(b.koCount)) return numeric(a.koCount) - numeric(b.koCount);
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