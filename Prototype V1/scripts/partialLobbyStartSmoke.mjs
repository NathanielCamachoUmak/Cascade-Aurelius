import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const URL = process.env.GAME_SERVER_URL || 'http://localhost:3201';
const modes = ['classic-pvp', 'free-for-all', 'team-deathmatch', 'battle-royale'];

function waitFor(socket, event, predicate = () => true, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    const handler = data => {
      if (!predicate(data)) return;
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(data);
    };
    socket.on(event, handler);
  });
}

for (const modeId of modes) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  try {
    await waitFor(socket, 'connect');
    const roomId = `partial-${modeId}-${Date.now()}`;
    const roomPromise = waitFor(socket, 'room-update', state => state.mode.id === modeId && state.players.length === 1);
    socket.emit('host-room', { roomId, name: `Host-${modeId}`, modeId });
    const room = await roomPromise;
    assert.equal(room.hostId, socket.id);
    assert.equal(room.phase, 'lobby');
    const gameStart = waitFor(socket, 'game-start', data => data.modeId === modeId);
    socket.emit('host-start-now');
    const game = await gameStart;
    assert.equal(game.players.length, 1);
    assert.equal(game.modeId, modeId);
    console.log(`PASS: ${modeId} host-created room started early with one player.`);
  } finally {
    socket.disconnect();
  }
}

console.log('PASS: explicit host/join flow and partial-roster host starts passed for every mode.');
