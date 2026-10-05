import { getBattleRoyalRound } from './Server/battleRoyal.js';

const room = {
  mode: { id: 'battle-royale' },
  phase: 'in-game',
  currentRoundIndex: undefined,
  battleRoyalStartedAt: null,
  players: new Map([
    ['p1', { state: 'playing', isBot: false, ownerId: 'p1' }],
    ['b1', { state: 'playing', isBot: true, ownerId: 'p1' }]
  ])
};

try {
  if (room.currentRoundIndex === undefined) {
    room.currentRoundIndex = 0;
  }
  
  const round = getBattleRoyalRound(room.currentRoundIndex);
  room.battleRoyalStartedAt = Date.now();
  
  for (const [id, player] of room.players) {
    if (player.state === 'playing') {
      const socketId = player.isBot ? player.ownerId : id;
      console.log('Emit round-start to', socketId);
    }
  }

  // emitBattleRoyalRound simulation
  room.battleRoyalPhase = round.id;
  const alive = Array.from(room.players.values()).filter(p => p.state === 'playing').length;
  const toEliminate = Math.max(0, alive - round.targetSurvivors);
  
  console.log('Emit battle-royale-phase:', {
    phase: round.id,
    label: round.label,
    remainingPlayers: alive,
    cullThreshold: toEliminate,
    scoreMultiplier: round.scoreMultiplier,
    atMs: 0,
    nextAtMs: round.durationMs,
    solidGarbage: Boolean(round.solidGarbage),
  });
} catch (e) {
  console.error('CRASH:', e);
}
