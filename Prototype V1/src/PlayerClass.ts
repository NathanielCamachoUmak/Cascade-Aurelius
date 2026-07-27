export type PlayerClass = 'SPEEDSTER' | 'TANK' | 'SABOTEUR';

export interface PlayerClassInfo {
  id: PlayerClass;
  name: string;
  tagline: string;
  passiveDescription: string;
}

export const PLAYER_CLASSES: PlayerClassInfo[] = [
  {
    id: 'SPEEDSTER',
    name: 'Speedster',
    tagline: 'Built for fast, technical play.',
    passiveDescription: 'Passive: Slower gravity gives you more time to execute rapid, precise inputs.',
  },
  {
    id: 'TANK',
    name: 'Tank',
    tagline: 'Built to take a hit.',
    passiveDescription: 'Passive: Incoming garbage lines are reduced.',
  },
  {
    id: 'SABOTEUR',
    name: 'Saboteur',
    tagline: 'Plays the long game.',
    passiveDescription: 'Passive: Single/Double line clears no longer send garbage — they charge your Sabotage Meter instead.',
  },
];