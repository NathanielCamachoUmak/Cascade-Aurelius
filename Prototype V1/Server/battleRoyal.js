// Battle Royale rules — single source of truth for the 4-minute "Culling Game".
// Both the schedule timers and the client HUD read from here.
//
// ── Phase 1 (Panel Feedback) ────────────────────────────────────────────────
// Added: Regression-based placement scoring (Comment #4 & #6)
//        MVP composite scoring algorithm    (Comment #5)
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Regression-Based Placement Scoring (Comment #4 & #6) ────────────────────
// Formula: Points(r) = floor + ⌊maxPoints × ((N − r + 1) / N)^γ⌋ + α·ln(1+S) + β·L + μ·K
//
// - γ (gamma)     : Power-decay curvature. Higher = steeper top-heavy rewards.
// - floorPoints   : Guaranteed minimum for ANY participant (Comment #6).
// - scoreWeight α : Logarithmic bonus from in-match score (prevents runaway linear scaling).
// - linesWeight β : Linear bonus per line cleared.
// - killsWeight μ : Linear bonus per KO / elimination.
//
// The regression curve naturally scales with any N (player count) because the
// placement ratio (N − r + 1) / N normalizes rank to [0, 1].
// ─────────────────────────────────────────────────────────────────────────────
export const PLACEMENT_SCORING = Object.freeze({
  totalPlayers: 30,
  maxPoints:    1000,   // Points awarded to Rank 1 (before performance bonuses)
  floorPoints:  50,     // Guaranteed minimum for Rank 30 (Comment #6)
  gamma:        1.9,    // Power-decay exponent (1.0 = linear, 2.0 = quadratic)
  scoreWeight:  8,      // α — ln(1 + score) coefficient
  linesWeight:  3,      // β — per-line bonus
  killsWeight:  15,     // μ — per-KO bonus
});

/**
 * Computes the regression-based placement reward for a single player.
 *
 * @param {number} rank            - 1-indexed finish position (1 = winner, N = last place).
 * @param {number} totalPlayers    - Total players in the match (N).
 * @param {{ score?: number, lines?: number, kills?: number }} stats - Performance stats.
 * @returns {number} Total placement reward (integer, always >= floorPoints).
 */
export function computePlacementReward(rank, totalPlayers, stats = {}) {
  const N     = Math.max(1, Math.floor(Number(totalPlayers) || PLACEMENT_SCORING.totalPlayers));
  const r     = Math.max(1, Math.min(N, Math.floor(Number(rank) || N)));
  const S     = Math.max(0, Number(stats.score) || 0);
  const L     = Math.max(0, Number(stats.lines) || 0);
  const K     = Math.max(0, Number(stats.kills) || 0);

  const { maxPoints, floorPoints, gamma, scoreWeight, linesWeight, killsWeight } = PLACEMENT_SCORING;

  // Placement component: power-decay regression curve
  const placementRatio = (N - r + 1) / N;                          // 1.0 for rank 1, ~0.03 for rank 30
  const placementPoints = Math.floor(maxPoints * Math.pow(placementRatio, gamma));

  // Performance bonuses (additive, not multiplicative — prevents snowball)
  const scoreBonus = Math.floor(scoreWeight * Math.log(1 + S));     // Logarithmic: diminishing returns
  const linesBonus = Math.floor(linesWeight * L);                   // Linear per line
  const killsBonus = Math.floor(killsWeight * K);                   // Linear per KO

  return Math.max(floorPoints, floorPoints + placementPoints + scoreBonus + linesBonus + killsBonus);
}

/**
 * Batch helper: compute placement rewards for an already-ranked array of players.
 * Each player object is shallow-copied and receives a `placementReward` field.
 *
 * @param {Array} rankedPlayers - Players sorted by final placement (index 0 = Rank 1).
 * @param {number} totalPlayers - Total players in the match.
 * @returns {Array} New array with `placementReward` attached to each entry.
 */
export function computeAllPlacementRewards(rankedPlayers, totalPlayers) {
  const N = totalPlayers || rankedPlayers.length;
  return rankedPlayers.map((player, index) => ({
    ...player,
    placementReward: computePlacementReward(index + 1, N, {
      score: player.score,
      lines: player.lines,
      kills: player.kills,
    }),
  }));
}

// ── MVP Composite Scoring (Comment #5) ──────────────────────────────────────
// The MVP is NOT necessarily the winner. A Saboteur who got 10 KOs but placed
// 5th can out-MVP a passive 1st-place survivor. Each stat category is
// min-max normalized to [0, 1] and then weighted.
// ─────────────────────────────────────────────────────────────────────────────
export const MVP_WEIGHTS = Object.freeze({
  placement:      0.30,   // Inverse rank (1st place = 1.0, last = 0.0)
  kills:          0.25,   // KO count normalized
  linesCleared:   0.20,   // Lines cleared normalized
  score:          0.15,   // In-match score normalized
  survivalRounds: 0.10,   // How many rounds the player survived (0–4)
});

/**
 * Computes the MVP composite score for all players and returns them sorted
 * by MVP score descending. Each player receives `mvpScore` and `mvpRank`.
 *
 * @param {Array} rankedPlayers   - Players sorted by final placement (index 0 = Rank 1).
 * @param {number} totalPlayers   - Total players in the match.
 * @param {number} finalRoundIndex - The last round index reached (0-based).
 * @returns {Array} New array sorted by mvpScore descending, with mvpScore & mvpRank.
 */
export function computeMVP(rankedPlayers, totalPlayers, finalRoundIndex = 3) {
  const N = Math.max(1, totalPlayers || rankedPlayers.length);
  const maxRounds = finalRoundIndex + 1;  // Total rounds played (1-indexed count)

  // Collect raw values for min-max normalization
  const scores = rankedPlayers.map(p => numeric(p.score));
  const kills  = rankedPlayers.map(p => numeric(p.kills));
  const lines  = rankedPlayers.map(p => numeric(p.lines));

  const minMax = (arr) => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;
    return (val) => range > 0 ? (val - min) / range : 0;
  };

  const normScore = minMax(scores);
  const normKills = minMax(kills);
  const normLines = minMax(lines);

  const withMVP = rankedPlayers.map((player, index) => {
    const rank = index + 1;

    // Placement: inverse rank normalized to [0, 1]
    const placementNorm = (N - rank) / Math.max(1, N - 1);

    // Survival: how far the player got (eliminated round / max rounds)
    const eliminatedRound = Number.isInteger(player.brEliminatedRoundIndex)
      ? player.brEliminatedRoundIndex + 1   // 1-indexed
      : maxRounds;                           // Survived to the end
    const survivalNorm = eliminatedRound / maxRounds;

    const mvpScore =
      MVP_WEIGHTS.placement      * placementNorm +
      MVP_WEIGHTS.kills          * normKills(numeric(player.kills)) +
      MVP_WEIGHTS.linesCleared   * normLines(numeric(player.lines)) +
      MVP_WEIGHTS.score          * normScore(numeric(player.score)) +
      MVP_WEIGHTS.survivalRounds * survivalNorm;

    return { ...player, mvpScore: Math.round(mvpScore * 10000) / 10000 };
  });

  // Sort by mvpScore descending (stable: original order breaks ties)
  withMVP.sort((a, b) => b.mvpScore - a.mvpScore);

  // Assign mvpRank
  return withMVP.map((player, index) => ({ ...player, mvpRank: index + 1 }));
}

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

export function canFinishBattleRoyalWithSingleSurvivor(activePlayers, roundIndex) {
  return activePlayers.length <= 1;
}

// Match placement is survival order, not raw score order. Score/lines/kills
// only break ties between players eliminated during the same round.
export function rankBattleRoyalPlacements(players, winnerId = null, currentRoundIndex = 0) {
  const roundOf = player => Number.isInteger(player.brEliminatedRoundIndex)
    ? player.brEliminatedRoundIndex
    : currentRoundIndex;

  return [...players].sort((a, b) => {
    if (winnerId !== null) {
      if (String(a.id) === String(winnerId)) return -1;
      if (String(b.id) === String(winnerId)) return 1;
    }

    const roundDifference = roundOf(b) - roundOf(a);
    if (roundDifference !== 0) return roundDifference;

    const aAlive = a.state === 'playing' && !a.brPermanentlyEliminated;
    const bAlive = b.state === 'playing' && !b.brPermanentlyEliminated;
    const aliveDifference = Number(bAlive) - Number(aAlive);
    if (aliveDifference !== 0) return aliveDifference;

    if (numeric(b.score) !== numeric(a.score)) return numeric(b.score) - numeric(a.score);
    if (numeric(b.lines) !== numeric(a.lines)) return numeric(b.lines) - numeric(a.lines);
    if (numeric(b.kills) !== numeric(a.kills)) return numeric(b.kills) - numeric(a.kills);
    return String(a.id ?? a.name ?? '').localeCompare(String(b.id ?? b.name ?? ''));
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
