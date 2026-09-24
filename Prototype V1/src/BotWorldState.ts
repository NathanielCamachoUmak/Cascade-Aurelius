import type { PlayerClass } from './PlayerClass';

/**
 * BotWorldState: A snapshot of everything the bot can perceive.
 * Built each thinking cycle by GameManager and passed into the GOAP planner.
 */
export interface BotWorldState {
  // Own board state
  ownBoardHeight: number;       // max column height (0–20)
  ownHoleCount: number;         // holes in own grid
  ownScore: number;             // bot's current score
  ownLines: number;             // bot's total lines cleared

  // Opponent state (averages across all living opponents)
  opponentAvgScore: number;     // average score of living opponents
  opponentCount: number;        // number of living opponents

  // Derived metrics
  scoreDelta: number;           // ownScore - opponentAvgScore (positive = winning)
  scoreDeltaPercent: number;    // scoreDelta as percentage of opponentAvgScore

  // Danger flags
  inDanger: boolean;            // ownBoardHeight >= 14
  inCrisis: boolean;            // ownBoardHeight >= 17

  // Ability readiness
  abilityReady: { Q: boolean; E: boolean; R: boolean };

  // Environment
  isSuddenDeath: boolean;       // Battle Royale sudden death active
  teamAllyInDanger: boolean;    // (TDM) any teammate's board height > 15
  isTeamMode: boolean;          // is this a team mode game

  // Player class
  playerClass: PlayerClass;
}

/**
 * Builds a BotWorldState from the available game data.
 * Called by GameManager each time the bot enters its thinking phase.
 */
export function buildWorldState(params: {
  boardHeight: number;
  holeCount: number;
  ownScore: number;
  ownLines: number;
  opponentScores: number[];
  playerClass: PlayerClass;
  abilityCooldowns: { Q: number; E: number };
  classMeter: number;
  ultimateCost: number;
  isSuddenDeath: boolean;
  teamAllyInDanger: boolean;
  isTeamMode: boolean;
}): BotWorldState {
  const livingOpponents = params.opponentScores.filter(s => s >= 0);
  const opponentCount = livingOpponents.length;
  const opponentAvgScore = opponentCount > 0
    ? livingOpponents.reduce((a, b) => a + b, 0) / opponentCount
    : 0;

  const scoreDelta = params.ownScore - opponentAvgScore;
  const scoreDeltaPercent = opponentAvgScore > 0
    ? (scoreDelta / opponentAvgScore) * 100
    : (params.ownScore > 0 ? 100 : 0);

  return {
    ownBoardHeight: params.boardHeight,
    ownHoleCount: params.holeCount,
    ownScore: params.ownScore,
    ownLines: params.ownLines,
    opponentAvgScore,
    opponentCount,
    scoreDelta,
    scoreDeltaPercent,
    inDanger: params.boardHeight >= 14,
    inCrisis: params.boardHeight >= 17,
    abilityReady: {
      Q: params.abilityCooldowns.Q <= 0,
      E: params.abilityCooldowns.E <= 0,
      R: params.classMeter >= params.ultimateCost,
    },
    isSuddenDeath: params.isSuddenDeath,
    teamAllyInDanger: params.teamAllyInDanger,
    isTeamMode: params.isTeamMode,
    playerClass: params.playerClass,
  };
}
