// Battle Royale rules — single source of truth for the 5-minute "Culling Game".
// Both the schedule timers and the client HUD read from here, so retiming the
// match only ever means editing this file.

export const BATTLE_ROYALE_RULES = Object.freeze({
  id: 'battle-royale',
  title: 'Battle Royale',
  format: '8-30 player solo',
  capacity: 30,
  minPlayers: 8,      // below this, culling events freeze (see isCullingFrozen)
  koFloor: 8,         // at or below this, top-out becomes a K.O. instead of elimination
  teamSize: 0,
  isTeamMode: false,
  winnerRule: 'Closest surviving score to 1,000,000 at 5:00',
  durationMs: 5 * 60 * 1000,
  targetScore: 1_000_000,
  suddenDeathAtMs: 4 * 60 * 1000,

  koScorePenalty: 0.20,   // immediate raw-score deduction on K.O.
  koDecayBase: 0.85,      // final = raw * 0.85^KOCount

  phaseBreaks: [
    {
      atMs: 0, id: 'warmup', label: 'Warmup',
      gravityScale: 1, scoreMultiplier: 1, garbageRate: 1,
      idlePenaltyMs: 0,
    },
    {
      atMs: 60 * 1000, id: 'rule-phase', label: 'Rule Phase',
      gravityScale: 1, scoreMultiplier: 1, garbageRate: 1,
      idlePenaltyMs: 0, dynamicRules: true,
    },
    {
      atMs: 150 * 1000, id: 'culling-escalation', label: 'Culling Escalation',
      gravityScale: 1.25, scoreMultiplier: 1, garbageRate: 1.5,
      idlePenaltyMs: 15 * 1000,
    },
    {
      atMs: 240 * 1000, id: 'sudden-death', label: 'Sudden Death',
      gravityScale: 2, scoreMultiplier: 2, garbageRate: 1.5,
      idlePenaltyMs: 15 * 1000, solidGarbage: true,
    },
  ],
});

// Adaptive density brackets — chosen by how many players are still active.
export const DENSITY_BRACKETS = Object.freeze([
  {
    id: 'high', label: 'High Density', min: 21, max: 30,
    eventRotationMs: 45 * 1000, garbageSpeedBonus: 0.5, randomizedTargeting: true,
  },
  {
    id: 'mid', label: 'Mid Density', min: 14, max: 20,
    eventRotationMs: 60 * 1000, garbageSpeedBonus: 0, randomizedTargeting: false,
  },
  {
    id: 'low', label: 'Low Density', min: 8, max: 13,
    eventRotationMs: 60 * 1000, garbageSpeedBonus: 0, randomizedTargeting: false,
    boardHeightLimit: 16, forcedRivalDuels: true,
  },
]);

// Rotating events for the Rule Phase onward.
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

// Below the player floor, culling events freeze rather than wiping a thin lobby.
export function isCullingFrozen(activePlayers) {
  return numeric(activePlayers) < BATTLE_ROYALE_RULES.minPlayers;
}

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

// Leaderboard: KOCount ascending is the primary tie-breaker, then decayed score.
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

// --- Compatibility helpers used by index.js ---

export function selectBattleRoyalCullTargets(players, count, primary, tieBreakers = []) {
  const wanted = Math.max(0, Math.floor(numeric(count)));
  if (wanted === 0) return [];
  return rankForCull(players, primary, tieBreakers).slice(0, wanted);
}

// Winner = closest surviving score to the target, using the decayed score so
// K.O. penalties count toward placement.
export function closestToTarget(players) {
  if (!players || players.length === 0) return null;
  return [...players].sort((a, b) => {
    const aDist = Math.abs(BATTLE_ROYALE_RULES.targetScore - finalScoreWithDecay(a.score, a.koCount));
    const bDist = Math.abs(BATTLE_ROYALE_RULES.targetScore - finalScoreWithDecay(b.score, b.koCount));
    if (aDist !== bDist) return aDist - bDist;
    return numeric(a.koCount) - numeric(b.koCount);
  })[0];
}