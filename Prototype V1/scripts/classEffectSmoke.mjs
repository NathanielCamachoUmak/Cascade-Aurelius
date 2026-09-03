import { io } from 'socket.io-client';

const SERVER_URL = process.env.GAME_SERVER_URL || 'http://localhost:3003';
const ROOM_ID = `class-effects-${Date.now()}`;

function waitFor(socket, event, predicate = () => true, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sockets = [];

try {
  for (let index = 0; index < 6; index += 1) {
    const socket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
    await waitFor(socket, 'connect');
    sockets.push(socket);
    socket.emit('join-room', { roomId: ROOM_ID, name: `Class ${index}`, modeId: 'team-deathmatch' });
  }

  const gameStarts = sockets.map(socket => waitFor(socket, 'game-start', data => data.modeId === 'team-deathmatch'));
  sockets.forEach(socket => socket.emit('player-ready', { ready: true }));
  await Promise.all(gameStarts);

  const enemy = sockets[4]; // Magenta; sockets 0-2 are Cyan.
  const ally = sockets[2];

  const freeze = waitFor(enemy, 'class-effect', data => data.type === 'QUICKSILVER' && data.durationMs === 5_000);
  sockets[0].emit('class-ability', { type: 'QUICKSILVER', durationMs: 5_000 });
  await freeze;

  const chaos = waitFor(enemy, 'class-effect', data => data.type === 'CHAOS' && data.durationMs === 8_000);
  sockets[0].emit('class-ability', { type: 'CHAOS', durationMs: 8_000 });
  await chaos;

  const scramble = waitFor(enemy, 'class-effect', data => data.type === 'SCRAMBLE' && data.amount === 5);
  sockets[0].emit('class-ability', { type: 'SCRAMBLE', amount: 5, targetIndex: 4 });
  await scramble;

  const shift = waitFor(enemy, 'class-effect', data => data.type === 'GRID_SHIFT' && (data.direction === -1 || data.direction === 1));
  sockets[0].emit('class-ability', { type: 'GRID_SHIFT', direction: 1, targetIndex: 4 });
  await shift;

  const quake = waitFor(enemy, 'receive-garbage', data => data.count === 10 && data.fromIndex === 0);
  sockets[0].emit('class-ability', { type: 'EARTHQUAKE', amount: 10 });
  await quake;

  const guardian = waitFor(ally, 'class-effect', data => data.type === 'GUARDIAN_ANGEL' && data.amount === 4);
  sockets[0].emit('class-ability', { type: 'GUARDIAN_ANGEL', amount: 4, targetIndex: 2 });
  await guardian;

  const reflected = waitFor(enemy, 'receive-garbage', data => data.count === 3 && data.fromIndex === 1);
  sockets[1].emit('reflect-garbage', { targetIndex: 4, count: 3 });
  await reflected;

  assert(true, 'All expected events were received.');
  console.log('PASS: revised class-effect routing, ally targeting, and Counter Strike reflection passed.');
} finally {
  sockets.forEach(socket => socket.disconnect());
}
