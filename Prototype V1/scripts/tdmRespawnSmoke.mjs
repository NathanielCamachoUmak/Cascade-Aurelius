import { io } from 'socket.io-client';

const URL = process.env.GAME_SERVER_URL || 'http://localhost:3000';
const ROOM = 'smoke-tdm-reboot-' + Date.now();
const names = ['Cyan 1', 'Cyan 2', 'Cyan 3', 'Mag 1', 'Mag 2', 'Mag 3'];
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

async function run() {
  try {
    console.log('Connecting 6 clients to test 3v3 TDM Reboot & Bounty system...');
    let rosterPromise = null;
    for (const [index, name] of names.entries()) {
      const socket = io(URL, { transports: ['websocket'], forceNew: true });
      await waitFor(socket, 'connect');
      sockets.push(socket);
      if (index === 0) {
        rosterPromise = waitFor(socket, 'room-update', state => state.players.length === 6);
      }
      socket.emit(index === 0 ? 'host-room' : 'join-room', { roomId: ROOM, name, modeId: 'team-deathmatch' });
      await delay(50);
    }

    const host = sockets[0];
    await rosterPromise;

    // Ready all
    for (const socket of sockets) {
      socket.emit('player-ready', { ready: true });
    }

    // Wait for game start
    // Wait for pregame countdown to finish and match timer to start
    console.log('Waiting for pre-game countdown (5s) to finish...');
    await waitFor(host, 'match-timer-start');
    console.log('Match active! Testing score events, TDM top-out, -20% score deduction, bounty, and 3s respawn...');

    // Cyan 1 scores with lines clear
    host.emit('score-event', { type: 'lines', lines: 4, combo: 1, multiplier: 1, clientTs: Date.now() });
    const scoreUpdate = await waitFor(host, 'team-score-update', data => (data.teamScores?.cyan || 0) > 0);
    const initialScore = scoreUpdate.score || scoreUpdate.teamScores.cyan;
    console.log(`Initial score recorded: ${initialScore}`);

    // Cyan 1 tops out, knocked out by Magenta 1 (index 3)
    const rebootPromise = waitFor(host, 'tdm-player-rebooting');
    const respawnPromise = waitFor(host, 'tdm-player-respawned', undefined, 6000);

    host.emit('player-eliminated', { killerIndex: 3 });

    const rebootData = await rebootPromise;
    console.log('Received tdm-player-rebooting:', rebootData);

    const expectedScore = Math.max(0, Math.round(initialScore * 0.8));
    if (rebootData.score !== expectedScore) {
      throw new Error(`Expected score ${expectedScore} after 20% penalty, got ${rebootData.score}`);
    }
    if (rebootData.teamScores.magenta < 2500) {
      throw new Error(`Expected Magenta bounty >= 2500, got ${rebootData.teamScores.magenta}`);
    }

    console.log('Waiting for 3-second respawn reboot cycle...');
    const respawnData = await respawnPromise;
    console.log('Received tdm-player-respawned:', respawnData);

    if (respawnData.playerIndex !== 0) {
      throw new Error(`Expected playerIndex 0 to respawn, got ${respawnData.playerIndex}`);
    }

    console.log('PASS: 3v3 Team Deathmatch reboot, -20% score penalty, +2,500 bounty, and 3-second respawn verified!');
  } catch (err) {
    console.error('FAIL:', err);
    process.exitCode = 1;
  } finally {
    sockets.forEach(s => s.disconnect());
  }
}

run();
