// Battle Royale rules — single source of truth for the 4-minute "Culling Game".
// Both the schedule timers and the client HUD read from here.

export const BATTLE_ROYALE_RULES = Object.freeze({
  id: 'battle-royale',
  title: 'Battle Royale',
  format: 'Staggered Elimination (30 player solo)',
  capacity: 30,
  minPlayers: 1,      
  koFloor: 0,         // K.O. mechanic is no longer applicable in staggered elimination
  teamSize: 0,
  isTeamMode: false,
  winnerRule: 'Last survivor at Round 4 / First to 400,000',
  targetScore: 400_000,
  intermissionMs: 5 * 1000, // 5 seconds between rounds

  rounds: [
    {
      id: 'round-1',
      label: 'Round 1 - Top 20 Qualify',
      targetSurvivors: 20,
      startGarbage: 0,
      scoreMultiplier: 1.0,
      durationMs: 90 * 1000, 
      garbageRate: 1.0,
      gravityScale: 1.0,
    },
    {
      id: 'round-2',
      label: 'Round 2 - Top 10 Qualify',
      targetSurvivors: 10,
      startGarbage: 4,
      scoreMultiplier: 1.25,
      durationMs: 90 * 1000,
      garbageRate: 1.0,
      gravityScale: 1.1,
    },
    {
      id: 'round-3',
      label: 'Round 3 - Top 4 Qualify',
      targetSurvivors: 4,
      startGarbage: 8,
      scoreMultiplier: 1.5,
      durationMs: 90 * 1000,
      garbageRate: 1.0,
      gravityScale: 1.25,
    },
    {
      id: 'round-4',
      label: 'Round 4 - Final (Sudden Death)',
      targetSurvivors: 1,
      startGarbage: 12,
      scoreMultiplier: 2.0,
      durationMs: 0, // No time limit
      garbageRate: 1.0,
      gravityScale: 1.5,
      solidGarbage: true,
    }
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

export function getBattleRoyalRound(roundIndex) {
  return BATTLE_ROYALE_RULES.rounds[roundIndex] || BATTLE_ROYALE_RULES.rounds[BATTLE_ROYALE_RULES.rounds.length - 1];
}

export function getDensityBracket(activePlayers) {
  const count = numeric(activePlayers);
  return DENSITY_BRACKETS.find(b => count >= b.min && count <= b.max)
    ?? (count > 30 ? DENSITY_BRACKETS[0] : DENSITY_BRACKETS[2]);
}

export function isCullingFrozen(activePlayers) {
  return numeric(activePlayers) < BATTLE_ROYALE_RULES.minPlayers;
}

export function isKoFloorReached(activePlayers) {
  return false; // K.O. mechanic disabled in staggered elimination
}

export function applyKoPenalty(rawScore) {
  return numeric(rawScore); // No penalty
}

export function finalScoreWithDecay(rawScore, koCount) {
  return numeric(rawScore); // No decay
}

export function hasReachedTarget(score) {
  return numeric(score) >= BATTLE_ROYALE_RULES.targetScore;
}

export function rankBattleRoyalPlayers(players) {
  return [...players].sort((a, b) => {
    if (numeric(b.score) !== numeric(a.score)) return numeric(b.score) - numeric(a.score);
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
    const aDist = Math.abs(BATTLE_ROYALE_RULES.targetScore - numeric(a.score));
    const bDist = Math.abs(BATTLE_ROYALE_RULES.targetScore - numeric(b.score));
    if (aDist !== bDist) return aDist - bDist;
    return 0;
  })[0];
}