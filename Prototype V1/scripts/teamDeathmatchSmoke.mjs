import { io } from 'socket.io-client';

const URL = process.env.GAME_SERVER_URL || 'http://localhost:3100';
const ROOM = 'smoke-3v3';
const names = ['Cyan One', 'Cyan Two', 'Cyan Three', 'Magenta One', 'Magenta Two', 'Magenta Three'];
const scores = [400, 0, 0, 0, 0, 0];
const sockets = [];

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

try {
  for (const [index, name] of names.entries()) {
    const socket = io(URL, { transports: ['websocket'], forceNew: true });
    await waitFor(socket, 'connect');
    sockets.push(socket);
    const rosterPromise = index === 0
      ? waitFor(socket, 'room-update', state => state.players.length === 6)
      : null;
    socket.emit(index === 0 ? 'host-room' : 'join-room', { roomId: ROOM, name, modeId: 'team-deathmatch' });
    await delay(50);
    if (rosterPromise) socket.data = { rosterPromise };
  }

  const roster = await sockets[0].data.rosterPromise;
  const cyan = roster.players.filter(player => player.team === 'cyan');
  const magenta = roster.players.filter(player => player.team === 'magenta');
  if (cyan.length !== 3 || magenta.length !== 3) throw new Error('Room did not assign a 3v3 roster.');

  const teamScorePromise = waitFor(sockets[0], 'team-score-update', data => data.teamScores?.cyan === 400 && data.teamScores?.magenta === 0);
  for (const socket of sockets) socket.emit('player-ready', { ready: true });
  await Promise.all(sockets.map((socket, index) => waitFor(socket, 'game-start').then(() => {
    socket.emit('score-update', { score: scores[index], lines: index === 0 ? 4 : 0, combo: 0, multiplier: 1 });
  })));

  const totals = await teamScorePromise;
  if (totals.teamScores.cyan !== 400 || totals.teamScores.magenta !== 0) throw new Error('Team score aggregation was incorrect.');

  const resultPromise = waitFor(sockets[1], 'post-game-start', data => data.winnerTeam === 'cyan');
  sockets[0].disconnect();
  const result = await resultPromise;
  if (result.teamScores.cyan !== 400 || result.teamScores.magenta !== 0) throw new Error('Final team score snapshot changed during disconnect.');

  console.log('PASS: Original Block Quartet server verified six seats, 3v3 teams, Cyan 400–0 score aggregation, and highest-score result.');
} finally {
  sockets.forEach(socket => socket.disconnect());
}
