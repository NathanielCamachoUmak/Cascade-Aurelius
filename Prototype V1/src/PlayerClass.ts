export type PlayerClass = 'SPEEDSTER' | 'TANK' | 'SABOTEUR';

export interface PlayerClassInfo {
  id: PlayerClass;
  name: string;
  tagline: string;
  passiveDescription: string;
  activeName: string;
  activeDescription: string;
}

export const PLAYER_CLASSES: PlayerClassInfo[] = [
  {
    id: 'SPEEDSTER',
    name: 'Speedster',
    tagline: 'Built for fast, technical play.',
    passiveDescription: 'Passive: Slower gravity gives you more time to execute rapid, precise inputs.',
    activeName: 'Overdrive',
    activeDescription: 'Active (meter fills from hard drops): gravity slows drastically for a few seconds — a big window to stack fast without pressure.',
  },
  {
    id: 'TANK',
    name: 'Tank',
    tagline: 'Built to take a hit.',
    passiveDescription: 'Passive: Incoming garbage lines are reduced.',
    activeName: 'Fortify',
    activeDescription: 'Active (meter fills by taking damage): blocks ALL incoming garbage for several seconds.',
  },
  {
    id: 'SABOTEUR',
    name: 'Saboteur',
    tagline: 'Plays the long game.',
    passiveDescription: 'Passive: Single/Double line clears no longer send garbage — they charge your meter instead.',
    activeName: 'Blackout',
    activeDescription: 'Active (meter fills from small clears): sends a large garbage burst at an opponent.',
  },
];