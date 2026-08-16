export type TargetStrategy = 'HIGHEST_SCORE' | 'LEFT_NEIGHBOR' | 'RIGHT_NEIGHBOR';

export interface TargetStrategyInfo {
  id: TargetStrategy;
  name: string;
  description: string;
}

export const TARGET_STRATEGIES: TargetStrategyInfo[] = [
  {
    id: 'HIGHEST_SCORE',
    name: 'Highest Score',
    description: 'Your garbage always goes to whoever is currently in the lead.',
  },
  {
    id: 'LEFT_NEIGHBOR',
    name: 'Left Neighbor',
    description: 'Your garbage always goes to the player seated to your left.',
  },
  {
    id: 'RIGHT_NEIGHBOR',
    name: 'Right Neighbor',
    description: 'Your garbage always goes to the player seated to your right.',
  },
];