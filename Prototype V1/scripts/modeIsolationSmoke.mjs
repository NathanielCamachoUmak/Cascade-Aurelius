/**
 * Verifies that a room code is mode-locked.
 *
 * Expected server policy:
 * - The first player creates a room with a chosen mode.
 * - A player selecting a different mode cannot join that same room code.
 * - The original room remains in its original mode and its roster is unchanged.
 * - The other mode can still create a separate room with a different code.
 *
 * Run from Prototype V1 after the Socket.IO server is running:
 *   GAME_SERVER_URL=http://localhost:3000 node scripts/modeIsolationSmoke.mjs
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.GAME_SERVER_URL || 'http://localhost:3000';
const ROOM_CODE = `isolation-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitFor(socket, event, predicate = () => true, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}".`));
    }, timeoutMs);
    const handler = data => {
      if (!predicate(data)) return;
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });
}

async function connect(name) {
  const socket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await waitFor(socket, 'connect');
  socket.data = { name };
  return socket;
}

const sockets = [];

try {
  // 1. Create a Classic PvP room using the shared test code.
  const classicHost = await connect('Classic Host');
  sockets.push(classicHost);
  const classicCreated = waitFor(classicHost, 'room-update', state =>
    state.roomId === ROOM_CODE && state.mode.id === 'classic-pvp' && state.players.length === 1,
  );
  classicHost.emit('host-room', { roomId: ROOM_CODE, name: 'Classic Host', modeId: 'classic-pvp' });
  const firstState = await classicCreated;
  assert(firstState.capacity === 2, 'Classic PvP must create a two-player room.');
  assert(firstState.players[0].team === null, 'Classic PvP players must not receive team assignments.');

  // 2. Attempt to use the exact same room code from Free For All.
  const ffaIntruder = await connect('FFA Intruder');
  sockets.push(ffaIntruder);
  let intruderRoomUpdates = 0;
  ffaIntruder.on('room-update', () => { intruderRoomUpdates += 1; });
  const joinError = waitFor(ffaIntruder, 'join-error', data => /Room uses Classic PvP/.test(data.message));
  ffaIntruder.emit('join-room', { roomId: ROOM_CODE, name: 'FFA Intruder', modeId: 'free-for-all' });
  const error = await joinError;
  await delay(100);
  assert(/Classic PvP/.test(error.message), 'Cross-mode join must identify the room’s existing mode.');
  assert(intruderRoomUpdates === 0, 'Rejected cross-mode player must not receive Classic room state.');

  // 3. Join a second Classic PvP player and verify the rejected FFA attempt
  //    did not mutate the original room’s mode, capacity, or roster.
  const classicPeer = await connect('Classic Peer');
  sockets.push(classicPeer);
  const classicIntact = waitFor(classicHost, 'room-update', state =>
    state.roomId === ROOM_CODE && state.mode.id === 'classic-pvp' && state.players.length === 2,
  );
  classicPeer.emit('join-room', { roomId: ROOM_CODE, name: 'Classic Peer', modeId: 'classic-pvp' });
  const intactState = await classicIntact;
  assert(intactState.capacity === 2, 'Cross-mode attempt must not change Classic capacity.');
  assert(intactState.players.every(player => player.team === null), 'Cross-mode attempt must not assign teams to Classic players.');

  // 4. Verify Free For All can create its own correctly isolated room.
  const ffaHost = await connect('FFA Host');
  sockets.push(ffaHost);
  const ffaRoomCode = `${ROOM_CODE}-ffa`;
  const ffaCreated = waitFor(ffaHost, 'room-update', state =>
    state.roomId === ffaRoomCode && state.mode.id === 'free-for-all' && state.players.length === 1,
  );
  ffaHost.emit('host-room', { roomId: ffaRoomCode, name: 'FFA Host', modeId: 'free-for-all' });
  const ffaState = await ffaCreated;
  assert(ffaState.capacity === 4, 'Free For All must create a four-player room.');
  assert(ffaState.players[0].team === null, 'Free For All players must not receive team assignments.');

  console.log('PASS: cross-mode join was rejected; Classic PvP room remained unchanged; Free For All created an isolated room.');
} finally {
  sockets.forEach(socket => socket.disconnect());
}
