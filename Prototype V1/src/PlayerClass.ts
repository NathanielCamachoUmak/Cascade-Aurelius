export type PlayerClass = 'SPEEDSTER' | 'TANK' | 'SABOTEUR' | 'SUPPORT';

export interface PlayerClassInfo {
  id: PlayerClass;
  name: string;
  tagline: string;
  passiveDescription: string;
  abilityQName: string;
  abilityQDescription: string;
  abilityECooldown: string;
  abilityEName: string;
  abilityEDescription: string;
  ultimateName: string;
  ultimateDescription: string;
  ultimateCost: number;
}

export const PLAYER_CLASSES: PlayerClassInfo[] = [
  {
    id: 'SPEEDSTER',
    name: 'Speedster',
    tagline: 'Built for fast, technical play.',
    passiveDescription: 'Passive: A Tetris guarantees a Speed Block on your next piece.',
    abilityQName: 'Sprint',
    abilityQDescription: "Q · 12s cooldown: target's current piece and next 3 pieces drop 50% faster.",
    abilityECooldown: '15s',
    abilityEName: 'Time Warp',
    abilityEDescription: 'E · 15s cooldown: slows your drop speed by 50% for 6 seconds.',
    ultimateName: 'Bullet Time',
    ultimateDescription: 'R · 40 lines: freezes all opponents for 5 seconds while you keep playing.',
    ultimateCost: 40,
  },
  {
    id: 'TANK',
    name: 'Sentinel',
    tagline: 'Built to take a hit.',
    passiveDescription: 'Passive: A Tetris guarantees a Shield Block on your next piece.',
    abilityQName: 'Fortify',
    abilityQDescription: 'Q · 10s cooldown: ignore your next 2 garbage attacks.',
    abilityECooldown: '20s',
    abilityEName: 'Counter Strike',
    abilityEDescription: 'E · 20s cooldown: reflect the next incoming garbage attack to its sender.',
    ultimateName: 'Earthquake',
    ultimateDescription: 'R · 50 lines: send 4 garbage lines to every opponent.',
    ultimateCost: 50,
  },
  {
    id: 'SABOTEUR',
    name: 'Saboteur',
    tagline: 'Plays the long game.',
    passiveDescription: 'Passive: A Tetris guarantees a Freeze Block on your next piece.',
    abilityQName: 'Scramble',
    abilityQDescription: "Q · 12s cooldown: scramble a target's next 5 upcoming pieces.",
    abilityECooldown: 'Once per match',
    abilityEName: 'Grid Shift',
    abilityEDescription: "E · once per match: shift a target's grid 2 columns left or right.",
    ultimateName: 'Chaos Mode',
    ultimateDescription: 'R · 35 lines: reverse every opponent’s controls for 8 seconds and reset Grid Shift.',
    ultimateCost: 35,
  },
  {
    id: 'SUPPORT',
    name: 'Support',
    tagline: 'Turns pressure into recovery.',
    passiveDescription: 'Passive: A Tetris arms your next incoming garbage conversion into special blocks.',
    abilityQName: 'Recycle',
    abilityQDescription: 'Q · 10s cooldown: convert the next 4 garbage lines into special blocks on your board, or a targeted ally in 3v3.',
    abilityECooldown: '25s',
    abilityEName: 'Gold Drop',
    abilityEDescription: 'E · 25s cooldown: your next tetromino is made entirely of 4 different special item blocks.',
    ultimateName: 'Guardian Angel',
    ultimateDescription: 'R · 45 lines: clear the bottom 4 lines of your board, or an ally board in 3v3.',
    ultimateCost: 45,
  },
];
