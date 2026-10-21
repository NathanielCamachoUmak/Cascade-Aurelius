import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import {
  BATTLE_ROYALE_RULES,
  selectBattleRoyalCullTargets,
  rankBattleRoyalPlayers,
  rankBattleRoyalPlacements,
  closestToTarget,
  canFinishBattleRoyalWithSingleSurvivor,
} from '../Server/battleRoyal.js';

const serverUrl = process.env.GAME_SERVER_URL || 'http://localhost:3200';
const roomId = `BR-SMOKE-${Date.now()}`;
let socket;

function waitFor(target, event, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const handler = value => {
      clearTimeout(timer);
      target.off(event, handler);
      resolve(value);
    };
    target.on(event, handler);
  });
}

function makeHost() {
  return new Promise((resolve, reject) => {
    socket = io(serverUrl, { transports: ['websocket'] });
    const timer = setTimeout(() => reject(new Error('Host failed to connect')), 8000);
    socket.once('connect', () => {
      clearTimeout(timer);
      const roomReady = waitFor(socket, 'room-update');
      socket.emit('host-room', { roomId, name: 'BR-Smoke-Host', modeId: 'battle-royale' });
      resolve(roomReady);
    });
    socket.once('connect_error', reject);
  });
}

try {
  assert.equal(BATTLE_ROYALE_RULES.capacity, 30);
  assert.equal(BATTLE_ROYALE_RULES.targetScore, 400000);
  assert.equal(BATTLE_ROYALE_RULES.rounds.at(-1).durationMs, 0);
  assert.equal(canFinishBattleRoyalWithSingleSurvivor([{}], BATTLE_ROYALE_RULES.rounds.length - 1), true);
  assert.equal(canFinishBattleRoyalWithSingleSurvivor([{}], 0), false);

  const sample = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    name: `P${index}`,
    state: 'playing',
    score: index * 100,
    lines: 30 - index,
    kills: index % 4,
  }));
  const firstCull = selectBattleRoyalCullTargets(sample, 10, 'score', ['lines', 'kills']);
  assert.deepEqual(firstCull.map(player => player.id), Array.from({ length: 10 }, (_, index) => String(index)));
  const secondCull = selectBattleRoyalCullTargets(sample, 12, 'lines', ['score', 'kills']);
  assert.equal(secondCull.length, 12);
  assert.equal(secondCull[0].lines, 1);

  const killTieSample = [
    { id: 'k1', name: 'K1', state: 'playing', score: 500, lines: 20, kills: 0 },
    { id: 'k2', name: 'K2', state: 'playing', score: 100, lines: 30, kills: 0 },
    { id: 'k3', name: 'K3', state: 'playing', score: 200, lines: 10, kills: 1 },
  ];
  assert.deepEqual(selectBattleRoyalCullTargets(killTieSample, 2, 'kills', ['lines', 'score']).map(player => player.id), ['k1', 'k2']);

  const scoreOrder = rankBattleRoyalPlayers([
    { id: 'a', score: 100, lines: 2, kills: 1 },
    { id: 'b', score: 100, lines: 3, kills: 0 },
    { id: 'c', score: 99, lines: 10, kills: 10 },
  ]);
  assert.deepEqual(scoreOrder.map(player => player.id), ['b', 'a', 'c']);
  assert.equal(closestToTarget([{ id: 'a', score: 399900 }, { id: 'b', score: 398000 }]).id, 'a');

  const placements = rankBattleRoyalPlacements([
    { id: 'winner', state: 'playing', score: 100, brEliminatedRoundIndex: null },
    { id: 'runner-up', state: 'eliminated', score: 5000, brEliminatedRoundIndex: 2 },
    { id: 'third', state: 'eliminated', score: 9000, brEliminatedRoundIndex: 1 },
  ], 'winner', 3);
  assert.deepEqual(placements.map(player => player.id), ['winner', 'runner-up', 'third']);

  const roomReady = makeHost();
  const room = await roomReady;
  assert.equal(room.mode.id, 'battle-royale');
  assert.equal(room.capacity, BATTLE_ROYALE_RULES.capacity);

  const filledRoomPromise = waitFor(socket, 'room-update', 12000);
  const gameStartPromise = waitFor(socket, 'game-start', 15000);
  socket.emit('host-start-now');
  const filledRoom = await filledRoomPromise;
  assert.equal(filledRoom.players.length, BATTLE_ROYALE_RULES.capacity);
  const gameStart = await gameStartPromise;
  assert.equal(gameStart.modeId, 'battle-royale');
  assert.equal(gameStart.players.length, BATTLE_ROYALE_RULES.capacity);

  const resultPromise = waitFor(socket, 'post-game-start', 20000);
  // At 2,600 points per accepted T-spin event, this crosses the actual 400k target.
  for (let index = 0; index < 160; index += 1) {
    socket.emit('score-event', {
      type: 'tspin',
      lines: 3,
      combo: 20,
      multiplier: 1,
      clientTs: Date.now(),
    });
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const result = await resultPromise;
  assert.equal(result.battleRoyal, true);
  assert.equal(result.reason, 'target-score');
  assert.equal(result.targetScore, BATTLE_ROYALE_RULES.targetScore);
  assert.equal(result.winnerId, socket.id);
  assert.equal(result.rankings[0].rank, 1);
  assert.equal(result.rankings[0].id, socket.id);
  assert.deepEqual(result.rankings.slice(0, 3).map(player => player.rank), [1, 2, 3]);
  console.log('PASS: Battle Royale rules, single-survivor finish condition, placement order, score victory, and final top-three payload.');
} finally {
  socket?.disconnect();
}
