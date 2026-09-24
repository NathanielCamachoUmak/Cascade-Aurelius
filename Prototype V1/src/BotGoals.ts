import type { BotWorldState } from './BotWorldState';

// ==============================
// Goal Definitions
// ==============================

export type GoalId = 'SURVIVE' | 'BUILD_TETRISES' | 'ATTACK' | 'SUPPORT_ALLY' | 'CRUISE';

export interface GoalEvaluation {
  id: GoalId;
  priority: number; // 0–100
}

/**
 * Evaluate all goals and return them sorted by priority (highest first).
 */
export function evaluateGoals(world: BotWorldState): GoalEvaluation[] {
  const goals: GoalEvaluation[] = [
    { id: 'SURVIVE', priority: survivalPriority(world) },
    { id: 'BUILD_TETRISES', priority: buildPriority(world) },
    { id: 'ATTACK', priority: attackPriority(world) },
    { id: 'CRUISE', priority: cruisePriority(world) },
    { id: 'SUPPORT_ALLY', priority: supportPriority(world) },
  ];

  goals.sort((a, b) => b.priority - a.priority);
  return goals;
}

/**
 * Returns the highest-priority goal for the current world state.
 */
export function selectGoal(world: BotWorldState): GoalEvaluation {
  return evaluateGoals(world)[0];
}

// ==============================
// Priority Functions
// ==============================

function survivalPriority(world: BotWorldState): number {
  if (world.inCrisis) return 100;
  if (world.inDanger) return 70;
  if (world.ownBoardHeight >= 12) return 40;
  if (world.isSuddenDeath) return 60;
  return 0;
}

function buildPriority(world: BotWorldState): number {
  // Default goal when nothing else is pressing
  if (world.inCrisis) return 10; // step aside for SURVIVE
  if (world.inDanger) return 20;
  return 50;
}

function attackPriority(world: BotWorldState): number {
  if (world.inDanger || world.inCrisis) return 0; // don't attack when in trouble
  if (world.opponentCount === 0) return 0;

  // Behind on score → ramp up attack priority
  if (world.scoreDeltaPercent < -20) return 65;
  if (world.scoreDeltaPercent < -10) return 55;

  // Board is clean and stable → can afford to attack
  if (world.ownBoardHeight <= 8 && world.ownHoleCount <= 2) return 45;

  return 30;
}

function cruisePriority(world: BotWorldState): number {
  if (world.inDanger || world.inCrisis) return 0;
  if (world.opponentCount === 0) return 0;

  // DDA: when significantly ahead, cruise to let opponents catch up
  if (world.scoreDeltaPercent > 40) return 70;
  if (world.scoreDeltaPercent > 20) return 55;
  if (world.scoreDeltaPercent > 10) return 35;

  return 0;
}

function supportPriority(world: BotWorldState): number {
  if (!world.isTeamMode) return 0;
  if (world.teamAllyInDanger && world.playerClass === 'SUPPORT') return 80;
  if (world.teamAllyInDanger) return 40; // Non-support classes care less
  return 0;
}

// ==============================
// Action Profile (what the bot does differently per goal)
// ==============================

export type PlacementStrategy = 'OPTIMAL' | 'SUBOPTIMAL' | 'DOWNSTACK';

export interface ActionProfile {
  placementStrategy: PlacementStrategy;
  /** Multiplier applied to think/action delays. <1 = faster, >1 = slower */
  delayMultiplier: number;
  /** Heuristic weight overrides (multiplied onto base weights) */
  weightModifiers: {
    landingHeight: number;
    erodedPieceCells: number;
    rowTransitions: number;
    columnTransitions: number;
    holes: number;
    boardWells: number;
  };
}

/**
 * Maps a goal to an action profile that controls how the bot plays.
 */
export function getActionProfile(goal: GoalId, world: BotWorldState): ActionProfile {
  switch (goal) {
    case 'SURVIVE':
      return {
        placementStrategy: 'DOWNSTACK',
        delayMultiplier: 0.8, // play slightly faster when panicking
        weightModifiers: {
          landingHeight: 2.0,       // heavily penalise high placements
          erodedPieceCells: 2.0,    // strongly reward clearing lines
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 3.0,              // massively penalise holes
          boardWells: 0.5,         // don't worry about wells right now
        },
      };

    case 'BUILD_TETRISES':
      return {
        placementStrategy: 'OPTIMAL',
        delayMultiplier: 1.0,
        weightModifiers: {
          landingHeight: 1.0,
          erodedPieceCells: 1.0,
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 1.0,
          boardWells: 1.0,
        },
      };

    case 'ATTACK':
      return {
        placementStrategy: 'OPTIMAL',
        delayMultiplier: 0.85,  // slightly faster in attack mode
        weightModifiers: {
          landingHeight: 1.0,
          erodedPieceCells: 1.5,  // prioritise multi-line clears for garbage
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 1.2,
          boardWells: 0.8,
        },
      };

    case 'CRUISE':
      return {
        placementStrategy: 'SUBOPTIMAL',
        delayMultiplier: clamp(1.0 + (world.scoreDeltaPercent / 100), 1.0, 2.0), // slower the further ahead
        weightModifiers: {
          landingHeight: 0.7,
          erodedPieceCells: 0.7,
          rowTransitions: 0.7,
          columnTransitions: 0.7,
          holes: 0.7,
          boardWells: 0.7,
        },
      };

    case 'SUPPORT_ALLY':
      return {
        placementStrategy: 'OPTIMAL',
        delayMultiplier: 1.0,
        weightModifiers: {
          landingHeight: 1.0,
          erodedPieceCells: 1.0,
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 1.0,
          boardWells: 1.0,
        },
      };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
