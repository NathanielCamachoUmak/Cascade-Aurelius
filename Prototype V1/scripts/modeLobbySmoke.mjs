import { io } from 'socket.io-client';

const URL = process.env.GAME_SERVER_URL || 'http://localhost:3101';

const MODE_CASES = [
  { id: 'classic-pvp', capacity: 2 },
  { id: 'free-for-all', capacity: 4 },
  { id: 'team-deathmatch', capacity: 6 },
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function runMode({ id, capacity }) {
  const roomId = `smoke-${id}`;
  const sockets = [];
  try {
    let rosterPromise;
    for (let index = 0; index < capacity; index += 1) {
      const socket = io(URL, { transports: ['websocket'], forceNew: true });
      await waitFor(socket, 'connect');
      sockets.push(socket);
      if (index === 0) rosterPromise = waitFor(socket, 'room-update', state => state.players.length === capacity);
      socket.emit(index === 0 ? 'host-room' : 'join-room', { roomId, name: `${id}-${index + 1}`, modeId: id });
      await delay(40);
    }

    const roster = await rosterPromise;
    if (roster.mode.id !== id || roster.capacity !== capacity) throw new Error(`${id} room policy was incorrect.`);
    if (id === 'team-deathmatch') {
      const cyan = roster.players.filter(player => player.team === 'cyan').length;
      const magenta = roster.players.filter(player => player.team === 'magenta').length;
      if (cyan !== 3 || magenta !== 3) throw new Error('3v3 team assignment was incorrect.');
    } else if (roster.players.some(player => player.team !== null)) {
      throw new Error(`${id} should not assign teams.`);
    }

    const starts = sockets.map(socket => waitFor(socket, 'game-start'));
    sockets.forEach(socket => socket.emit('player-ready', { ready: true }));
    const games = await Promise.all(starts);
    if (games.some(game => game.modeId !== id || game.players.length !== capacity)) throw new Error(`${id} game start payload was incorrect.`);

    if (id === 'team-deathmatch') {
      const totals = waitFor(sockets[0], 'team-score-update', data => data.teamScores?.cyan === 400 && data.teamScores?.magenta === 0);
      sockets[0].emit('score-update', { score: 400, lines: 4, combo: 0, multiplier: 1 });
      await totals;
      const result = waitFor(sockets[1], 'post-game-start', data => data.winnerTeam === 'cyan');
      sockets[0].disconnect();
      const data = await result;
      if (data.teamScores.cyan !== 400 || data.teamScores.magenta !== 0) throw new Error('3v3 score result was incorrect.');
    } else {
      const winnerId = sockets[0].id;
      const result = waitFor(sockets[0], 'post-game-start', data => data.winnerId === winnerId);
      for (let index = 1; index < sockets.length; index += 1) sockets[index].emit('player-eliminated');
      const data = await result;
      if (data.winnerId !== winnerId) throw new Error(`${id} elimination result was incorrect.`);
    }

    console.log(`PASS: ${id} created a ${capacity}-player room and resolved using its correct mode rule.`);
  } finally {
    sockets.forEach(socket => socket.disconnect());
  }
}

for (const testCase of MODE_CASES) {
  await runMode(testCase);
}

console.log('PASS: all original Cascade online mode lobbies passed.');
