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
  if (world.ownBoardHeight >= 14) return 100; // Mode 3 Trigger
  if (world.isSuddenDeath) return 60;
  return 0;
}

function buildPriority(world: BotWorldState): number {
  // Default fallback if others don't trigger (should rarely happen with new rules)
  return 50;
}

function attackPriority(world: BotWorldState): number {
  if (world.ownBoardHeight >= 14) return 0; // Survival overrides
  if (world.opponentCount === 0) return 0;

  // Mode 1: Aggressive (Bot is losing, or leading by less than 2000)
  if (world.scoreDelta <= 2000) return 80; 

  return 0;
}

function cruisePriority(world: BotWorldState): number {
  if (world.ownBoardHeight >= 14) return 0; // Survival overrides
  if (world.opponentCount === 0) return 0;

  // Mode 2: Passive (Bot is leading by more than 2000 points)
  if (world.scoreDelta > 2000) return 90;

  return 0;
}

function supportPriority(world: BotWorldState): number {
  if (!world.isTeamMode) return 0;
  if (world.teamAllyInDanger && world.playerClass === 'SUPPORT') return 85;
  if (world.teamAllyInDanger) return 40;
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
    bumpiness: number;
    tetrisWell: number;
  };
}

/**
 * Maps a goal to an action profile that controls how the bot plays.
 */
export function getActionProfile(goal: GoalId, world: BotWorldState): ActionProfile {
  switch (goal) {
    case 'SURVIVE': // Mode 3: Survival
      return {
        placementStrategy: 'DOWNSTACK',
        delayMultiplier: 0.7, // play faster
        weightModifiers: {
          landingHeight: 2.0,       // heavily penalise high placements
          erodedPieceCells: 3.0,    // strongly reward clearing lines immediately
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 3.0,
          bumpiness: 2.0,           // stack flat
          tetrisWell: 0.0,          // ignore wells completely
        },
      };

    case 'BUILD_TETRISES': // Fallback
      return {
        placementStrategy: 'OPTIMAL',
        delayMultiplier: 1.0,
        weightModifiers: {
          landingHeight: 1.0,
          erodedPieceCells: 1.0,
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 1.0,
          bumpiness: 1.0,
          tetrisWell: 1.0,
        },
      };

    case 'ATTACK': // Mode 1: Aggressive
      return {
        placementStrategy: 'OPTIMAL',
        delayMultiplier: 0.8, // aggressive
        weightModifiers: {
          landingHeight: 0.8,     // care slightly less about height
          erodedPieceCells: 0.5,  // care less about single lines (save them for Tetris)
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 1.5,
          bumpiness: 1.5,         // keep board flat...
          tetrisWell: 2.5,        // ...except for a massive reward for one deep well
        },
      };

    case 'CRUISE': // Mode 2: Passive
      return {
        placementStrategy: 'SUBOPTIMAL',
        delayMultiplier: clamp(1.5 + (world.scoreDelta / 10000), 1.5, 3.0), // significantly slower
        weightModifiers: {
          landingHeight: 1.0,
          erodedPieceCells: 1.5,  // clear singles/doubles safely
          rowTransitions: 1.0,
          columnTransitions: 1.0,
          holes: 1.0,
          bumpiness: 1.5,
          tetrisWell: 0.5,        // don't build deep wells
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
          bumpiness: 1.0,
          tetrisWell: 1.0,
        },
      };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
