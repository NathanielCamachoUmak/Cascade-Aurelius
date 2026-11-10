import assert from 'node:assert/strict';
import {
  BATTLE_ROYALE_RULES,
  PLACEMENT_SCORING,
  MVP_WEIGHTS,
  computePlacementReward,
  computeAllPlacementRewards,
  computeMVP,
} from '../Server/battleRoyal.js';

console.log('--- PHASE 1 MATHEMATICAL & SCORING SMOKE TEST ---');

// 1. Verify Configuration Constants
assert.equal(PLACEMENT_SCORING.totalPlayers, 30, 'Total players should default to 30');
assert.equal(PLACEMENT_SCORING.floorPoints, 50, 'Guaranteed floor should be 50 points');
assert.equal(PLACEMENT_SCORING.maxPoints, 1000, 'Max base points should be 1000');
assert.equal(PLACEMENT_SCORING.gamma, 1.9, 'Gamma curvature should be 1.9');
console.log('✓ Configuration constants verified.');

// 2. Test Comment #6: Rank 30 (instant loss) receives guaranteed floor points
const rank30ZeroStats = computePlacementReward(30, 30, { score: 0, lines: 0, kills: 0 });
console.log(`Rank 30 with 0 stats reward: ${rank30ZeroStats} pts`);
assert.ok(rank30ZeroStats >= 50, `Rank 30 must earn at least 50 points (earned ${rank30ZeroStats})`);

// Even if rank is clamped out-of-bounds or stats are negative
const rankOutOfBounds = computePlacementReward(99, 30, { score: -10, lines: -5, kills: -1 });
assert.ok(rankOutOfBounds >= 50, 'Out-of-bounds rank still receives floor');
console.log('✓ Comment #6 (Guaranteed floor for 30 players) verified.');

// 3. Test Comment #4: Regression Curvature & Monotonic Decay
const curve = [];
for (let r = 1; r <= 30; r++) {
  const pts = computePlacementReward(r, 30, { score: 10000, lines: 10, kills: 1 });
  curve.push({ rank: r, points: pts });
}

// Verify strict monotonic decrease for equal performance stats
for (let i = 0; i < curve.length - 1; i++) {
  assert.ok(
    curve[i].points > curve[i + 1].points,
    `Points must strictly decrease: Rank ${curve[i].rank} (${curve[i].points}) vs Rank ${curve[i + 1].rank} (${curve[i + 1].points})`
  );
}

console.log('Sample Regression Curve Distribution:');
console.log(`  Rank  1: ${curve[0].points} pts`);
console.log(`  Rank  5: ${curve[4].points} pts`);
console.log(`  Rank 10: ${curve[9].points} pts`);
console.log(`  Rank 15: ${curve[14].points} pts`);
console.log(`  Rank 20: ${curve[19].points} pts`);
console.log(`  Rank 25: ${curve[24].points} pts`);
console.log(`  Rank 30: ${curve[29].points} pts`);
console.log('✓ Comment #4 (Regression-based points scaling) verified.');

// 4. Test Comment #5: MVP Composite Algorithm
// Test Scenario:
// Player A: Placed 1st (passive survival, 1 kill, 10 lines, score 50000)
// Player B: Placed 4th (Saboteur aggressive play, 9 kills, 35 lines, score 85000)
// Player C: Placed 20th (early out, 0 kills, 2 lines, score 2000)
const testPlayers = [
  { id: 'player-A', name: 'Passive Winner', score: 50000, lines: 10, kills: 1, brEliminatedRoundIndex: null },
  { id: 'player-B', name: 'Aggressive Saboteur', score: 85000, lines: 35, kills: 9, brEliminatedRoundIndex: 2 },
  { id: 'player-C', name: 'Early Out', score: 2000, lines: 2, kills: 0, brEliminatedRoundIndex: 0 },
];

const mvpRankings = computeMVP(testPlayers, 3, 3);
console.log('MVP Composite Rankings:');
for (const p of mvpRankings) {
  console.log(`  MVP #${p.mvpRank}: ${p.name} (MVP Score: ${p.mvpScore})`);
}

// Player B had vastly superior kills, lines, and score, so Player B should beat Player A for MVP
assert.equal(mvpRankings[0].id, 'player-B', 'High-impact aggressive player should win MVP over passive survivor');
assert.equal(mvpRankings[0].mvpRank, 1, 'Top MVP player must have mvpRank = 1');
assert.equal(mvpRankings[2].id, 'player-C', 'Early out should be lowest MVP rank');
console.log('✓ Comment #5 (MVP Composite Evaluation) verified.');

// 5. Test computeAllPlacementRewards
const batchRewards = computeAllPlacementRewards(testPlayers, 3);
assert.equal(batchRewards.length, 3);
assert.ok(batchRewards[0].placementReward > batchRewards[1].placementReward);
assert.ok(batchRewards[1].placementReward > batchRewards[2].placementReward);
console.log('✓ computeAllPlacementRewards batch mapping verified.');

console.log('\n>>> ALL PHASE 1 SMOKE TESTS PASSED! <<<');
