// Battle Royale staged-format smoke test.
// Run the server with a short clock, then this script with the same env:
//   BR_TIME_SCALE=0.05 PORT=3200 node Server/index.js
//   BR_TIME_SCALE=0.05 node scripts/battleRoyalSmoke.mjs
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import {
  BATTLE_ROYALE_RULES, getStage, planStageCull, buildGarbageHoles, rankBattleRoyalPlayers,
} from '../Server/battleRoyal.js';

const serverUrl = process.env.GAME_SERVER_URL || 'http://localhost:3200';
const roomId = `BR-SMOKE-${Date.now()}`;
const clients = [];

function waitFor(socket, event, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, value => { clearTimeout(timer); resolve(value); });
  });
}

function makePlayer(index) {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, { transports: ['websocket'] });
    clients.push(socket);
    const timer = setTimeout(() => reject(new Error(`Player ${index} failed to connect`)), 8000);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.emit(index === 0 ? 'host-room' : 'join-room', { roomId, name: `BR-${index + 1}`, modeId: 'battle-royale' });
      resolve(socket);
    });
    socket.on('connect_error', reject);
  });
}

try {
  // --- rules table -------------------------------------------------------
  const stages = BATTLE_ROYALE_RULES.stages;
  assert.deepEqual(stages.map(s => s.playerCap), [30, 20, 10, 4]);
  assert.deepEqual(stages.map(s => s.garbageLines), [0, 4, 8, 12]);
  assert.deepEqual(stages.map(s => s.suddenDeath), [false, false, false, true]);
  assert.equal(BATTLE_ROYALE_RULES.capacity, 30);
  assert.ok(stages.every(s => s.durationMs === BATTLE_ROYALE_RULES.stageDurationMs));
  if (!process.env.BR_TIME_SCALE) {
    assert.equal(BATTLE_ROYALE_RULES.stageDurationMs, 90_000);
    assert.equal(BATTLE_ROYALE_RULES.intermissionMs, 5_000);
  }
  assert.equal(buildGarbageHoles(12).length, 12);
  assert.ok(buildGarbageHoles(12).every(h => h >= 0 && h < 10));

  // --- cull planning -----------------------------------------------------
  const sample = Array.from({ length: 30 }, (_, i) => ({ id: String(i), score: i * 100, lines: 30 - i, kills: 0 }));
  assert.equal(planStageCull(sample, 1).length, 10);                       // 30 -> 20
  assert.deepEqual(planStageCull(sample, 1).map(p => p.id), Array.from({ length: 10 }, (_, i) => String(i)));
  assert.equal(planStageCull(sample.slice(0, 15), 1).length, 0);          // already under the cap
  assert.equal(planStageCull(sample.slice(0, 10), 3).length, 6);          // 10 -> 4
  const six = [
    { id: 'a', score: 5, lines: 9, kills: 0 }, { id: 'b', score: 5, lines: 2, kills: 0 },
    { id: 'c', score: 9, lines: 0, kills: 0 }, { id: 'd', score: 50, lines: 0, kills: 0 },
    { id: 'e', score: 60, lines: 0, kills: 0 }, { id: 'f', score: 70, lines: 0, kills: 0 },
  ];
  assert.deepEqual(planStageCull(six, 3).map(p => p.id), ['b', 'a']);      // tie on score -> fewer lines goes first

  // survivors outrank earlier eliminations; later eliminations outrank earlier ones
  const ranked = rankBattleRoyalPlayers([
    { id: 'out1', state: 'spectating', eliminatedAt: 100, score: 9999 },
    { id: 'out2', state: 'spectating', eliminatedAt: 200, score: 1 },
    { id: 'live', state: 'playing', score: 10 },
  ]);
  assert.deepEqual(ranked.map(p => p.id), ['live', 'out2', 'out1']);

  // --- live: 30 players through all four stages ----------------------------
  const sockets = [await makePlayer(0)];
  await waitFor(sockets[0], 'room-update');
  for (let i = 1; i < 30; i += 1) sockets.push(await makePlayer(i));

  const phases = []; const intermissions = []; const culls = [];
  sockets[0].on('battle-royale-phase', d => d.stage && phases.push(d));
  sockets[0].on('battle-royale-intermission', d => intermissions.push(d));
  sockets[0].on('battle-royale-cull', d => culls.push(d));
  const done = waitFor(sockets[0], 'post-game-start', 60000);

  const firstPhase = waitFor(sockets[0], 'battle-royale-phase', 30000);
  sockets[0].emit('host-start-now');
  await waitFor(sockets[0], 'game-start', 20000);
  await firstPhase;

  // player i earns i+1 points, so the lowest indexes are always cut first
  sockets.forEach((s, i) => s.emit('score-event', { type: 'harddrop', lines: i + 1, combo: 0 }));

  const result = await done;

  assert.deepEqual(phases.map(p => p.stage), [1, 2, 3, 4]);
  assert.deepEqual(phases.map(p => p.garbageHoles.length), [0, 4, 8, 12]);
  assert.deepEqual(phases.map(p => p.remainingPlayers), [30, 20, 10, 4]);
  assert.equal(phases[3].suddenDeath, true);
  assert.equal(intermissions.length, 3);
  assert.ok(intermissions.every(i => i.durationMs === BATTLE_ROYALE_RULES.intermissionMs));
  assert.deepEqual(culls.map(c => c.eliminated.length), [10, 10, 6]);
  assert.equal(result.reason, 'time');
  assert.equal(result.winnerName, 'BR-30');
  assert.equal(result.rankings[0].rank, 1);
  assert.equal(result.rankings.filter(r => !r.eliminated).length, 4);
  console.log('PASS: 4 stages (30/20/10/4 players, 0/4/8/12 garbage lines), 3 intermissions, culls 10/10/6, winner = top score.');
} finally {
  for (const socket of clients) socket.disconnect();
}
