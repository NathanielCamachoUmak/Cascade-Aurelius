export const BATTLE_ROYALE_RULES = Object.freeze({
  id: 'battle-royale',
  title: 'Battle Royale',
  format: '40-player solo',
  capacity: 40,
  teamSize: 0,
  isTeamMode: false,
  winnerRule: 'Closest surviving score to 2,000,000 at 10:00',
  durationMs: 10 * 60 * 1000,
  targetScore: 2_000_000,
  suddenDeathAtMs: 9 * 60 * 1000,
  phaseBreaks: [
    { atMs: 0, id: 'opening', label: 'Opening battle', durationMs: 3 * 60 * 1000 },
    { atMs: 3 * 60 * 1000, id: 'cull-score', label: 'Cull: lowest score', eliminate: 10, primary: 'score', tieBreakers: ['lines', 'kills'] },
    { atMs: 6 * 60 * 1000, id: 'cull-lines', label: 'Cull: lowest line count', eliminate: 12, primary: 'lines', tieBreakers: ['score', 'kills'] },
    { atMs: 8 * 60 * 1000, id: 'cull-kills', label: 'Cull: lowest kill count', eliminate: 10, primary: 'kills', tieBreakers: ['lines', 'score'] },
    { atMs: 8 * 60 * 1000, id: 'final-break', label: 'Final break', durationMs: 60 * 1000 },
    { atMs: 9 * 60 * 1000, id: 'sudden-death', label: 'Sudden death: solid garbage', durationMs: 60 * 1000 },
  ],
});

const numeric = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

export function getBattleRoyalPhase(elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (elapsed >= BATTLE_ROYALE_RULES.suddenDeathAtMs) return BATTLE_ROYALE_RULES.phaseBreaks[5];
  if (elapsed >= 8 * 60 * 1000) return BATTLE_ROYALE_RULES.phaseBreaks[3];
  if (elapsed >= 6 * 60 * 1000) return BATTLE_ROYALE_RULES.phaseBreaks[2];
  if (elapsed >= 3 * 60 * 1000) return BATTLE_ROYALE_RULES.phaseBreaks[1];
  return BATTLE_ROYALE_RULES.phaseBreaks[0];
}

export function compareForCull(a, b, primary, tieBreakers = []) {
  const fields = [primary, ...tieBreakers];
  for (const field of fields) {
    const difference = numeric(a[field]) - numeric(b[field]);
    if (difference !== 0) return difference;
  }
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

export function selectBattleRoyalCullTargets(players, count, primary, tieBreakers = []) {
  return [...players]
    .filter(player => player.state === 'playing')
    .sort((a, b) => compareForCull(a, b, primary, tieBreakers))
    .slice(0, Math.max(0, count));
}

export function rankBattleRoyalPlayers(players) {
  return [...players]
    .sort((a, b) => {
      const scoreDifference = numeric(b.score) - numeric(a.score);
      if (scoreDifference !== 0) return scoreDifference;
      const lineDifference = numeric(b.lines) - numeric(a.lines);
      if (lineDifference !== 0) return lineDifference;
      const killDifference = numeric(b.kills) - numeric(a.kills);
      if (killDifference !== 0) return killDifference;
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    })
    .map((player, index) => ({
      rank: index + 1,
      id: player.id,
      name: player.name,
      score: numeric(player.score),
      lines: numeric(player.lines),
      kills: numeric(player.kills),
      state: player.state,
      eliminated: player.state !== 'playing',
    }));
}

export function closestToTarget(players, targetScore = BATTLE_ROYALE_RULES.targetScore) {
  return [...players]
    .filter(player => player.state === 'playing')
    .sort((a, b) => {
      const distanceDifference = Math.abs(numeric(a.score) - targetScore) - Math.abs(numeric(b.score) - targetScore);
      if (distanceDifference !== 0) return distanceDifference;
      return compareForCull(b, a, 'score', ['lines', 'kills']);
    })[0] ?? null;
}

export function hasReachedTarget(score, targetScore = BATTLE_ROYALE_RULES.targetScore) {
  return numeric(score) >= targetScore;
}
