import { BATTLE_ROYALE_RULES, getBattleRoyalRound } from './Server/battleRoyal.js';

try {
  const round = getBattleRoyalRound(0);
  console.log('Round 0:', round.id, round.label);
} catch (e) {
  console.error('Error:', e);
}
