import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { BATTLE_ROYALE_RULES, selectBattleRoyalCullTargets, rankBattleRoyalPlayers, closestToTarget } from '../Server/battleRoyal.js';

const serverUrl = process.env.GAME_SERVER_URL || 'http://localhost:3200';
const roomId = `BR-SMOKE-${Date.now()}`;
const clients = [];
const states = new Map();

function waitFor(socket, event, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, value => { clearTimeout(timer); resolve(value); });
  });
}

function waitForRoomSize(socket, size, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for room size ${size}`)), timeout);
    const onUpdate = state => {
      if (state.players.length < size) return;
      clearTimeout(timer);
      socket.off('room-update', onUpdate);
      resolve(state);
    };
    socket.on('room-update', onUpdate);
  });
}

function makePlayer(index) {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, { transports: ['websocket'] });
    clients.push(socket);
    const timer = setTimeout(() => reject(new Error(`Player ${index} failed to connect`)), 8000);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.on('room-update', state => states.set(socket.id, state));
      socket.emit(index === 0 ? 'host-room' : 'join-room', { roomId, name: `BR-${index + 1}`, modeId: 'battle-royale' });
      resolve(socket);
    });
    socket.on('connect_error', reject);
  });
}

try {
  assert.equal(BATTLE_ROYALE_RULES.capacity, 40);
  assert.equal(BATTLE_ROYALE_RULES.durationMs, 600000);
  assert.equal(BATTLE_ROYALE_RULES.targetScore, 2000000);

  const sample = Array.from({ length: 40 }, (_, index) => ({ id: String(index), name: `P${index}`, state: 'playing', score: index * 100, lines: 40 - index, kills: index % 4 }));
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
  const killCull = selectBattleRoyalCullTargets(killTieSample, 2, 'kills', ['lines', 'score']);
  assert.deepEqual(killCull.map(player => player.id), ['k1', 'k2']);
  assert.equal((await import('../Server/battleRoyal.js')).getBattleRoyalPhase(8 * 60 * 1000).id, 'cull-kills');
  assert.equal((await import('../Server/battleRoyal.js')).getBattleRoyalPhase(9 * 60 * 1000).id, 'sudden-death');

  const rankings = rankBattleRoyalPlayers([{ id: 'a', name: 'A', state: 'playing', score: 100, lines: 2, kills: 1 }, { id: 'b', name: 'B', state: 'playing', score: 100, lines: 3, kills: 0 }, { id: 'c', name: 'C', state: 'playing', score: 99, lines: 10, kills: 10 }]);
  assert.deepEqual(rankings.map(player => player.id), ['b', 'a', 'c']);
  assert.equal(closestToTarget([{ id: 'a', state: 'playing', score: 1_999_900 }, { id: 'b', state: 'playing', score: 1_998_000 }]).id, 'a');

  const sockets = [await makePlayer(0)];
  await waitFor(sockets[0], 'room-update');
  for (let index = 1; index < 40; index += 1) sockets.push(await makePlayer(index));
  const state = await waitForRoomSize(sockets[0], 40);
  assert.equal(state.mode.id, 'battle-royale');
  assert.equal(state.capacity, 40);
  assert.equal(state.players.length, 40);

  for (const socket of sockets) socket.emit('player-ready', { ready: true });
  const gameStart = await waitFor(sockets[0], 'game-start', 15000);
  assert.equal(gameStart.modeId, 'battle-royale');
  assert.equal(gameStart.players.length, 40);

  const finished = waitFor(sockets[0], 'post-game-start', 6000);
  sockets[0].emit('score-update', { score: 2_000_000, lines: 200, kills: 5, combo: 0, multiplier: 1 });
  const result = await finished;
  assert.equal(result.battleRoyal, true);
  assert.equal(result.reason, 'target-score');
  assert.equal(result.targetScore, 2_000_000);
  assert.equal(result.winnerName, 'BR-1');
  console.log('PASS: Battle Royale rules, 40-player room formation, target-score victory, and ranking helpers verified.');
} finally {
  for (const socket of clients) socket.disconnect();
}
