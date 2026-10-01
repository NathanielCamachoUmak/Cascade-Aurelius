import { Socket } from 'socket.io-client';
import { TargetStrategy, TargetStrategyType, PlayerTargetInfo } from './TargetStrategy';

export type PlayerClass = 'SPEEDSTER' | 'TANK' | 'SABOTEUR' | 'SUPPORT';

export interface PlayerClassInfo {
  id: PlayerClass;
  name: string;
  tagline: string;
  iconUrl: string;
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
    iconUrl: '/class/Speedster.png',
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
    iconUrl: '/class/Sentinel.png',
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
    iconUrl: '/class/Saboteur.png',
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
    iconUrl: '/class/Support.png',
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

export type AbilitySlot = 'Q' | 'E' | 'R';

export interface ClassAbilityPayload {
  classId: PlayerClass;
  slot: AbilitySlot;
  abilityName: string;
  strategy?: TargetStrategyType;
  targetIndex?: number;
}

export class PlayerClassManager {
  public currentClass: PlayerClassInfo;
  private qLastUsedAt: number = 0;
  private eLastUsedAt: number = 0;
  private gridShiftUsed: boolean = false;
  private ultimateLinesProgress: number = 0;

  constructor(classId: PlayerClass = 'SPEEDSTER') {
    this.currentClass = PLAYER_CLASSES.find(c => c.id === classId) || PLAYER_CLASSES[0];
  }

  public setClass(classId: PlayerClass): void {
    const found = PLAYER_CLASSES.find(c => c.id === classId);
    if (found) {
      this.currentClass = found;
      this.resetCooldowns();
    }
  }

  public resetCooldowns(): void {
    this.qLastUsedAt = 0;
    this.eLastUsedAt = 0;
    this.gridShiftUsed = false;
    this.ultimateLinesProgress = 0;
  }

  // --- Cooldown & Availability Checks ---

  public canUseQ(): boolean {
    const cooldownMs = this.getQCooldownMs();
    return Date.now() - this.qLastUsedAt >= cooldownMs;
  }

  public canUseE(): boolean {
    if (this.currentClass.id === 'SABOTEUR') {
      return !this.gridShiftUsed;
    }
    const cooldownMs = this.getECooldownMs();
    return Date.now() - this.eLastUsedAt >= cooldownMs;
  }

  public canUseUltimate(): boolean {
    return this.ultimateLinesProgress >= this.currentClass.ultimateCost;
  }

  public addClearedLinesForUltimate(lines: number): void {
    this.ultimateLinesProgress = Math.min(
      this.currentClass.ultimateCost,
      this.ultimateLinesProgress + lines
    );
  }

  public getUltimateProgressPercentage(): number {
    return Math.min(100, (this.ultimateLinesProgress / this.currentClass.ultimateCost) * 100);
  }

  // --- Ability Triggers ---

  public triggerQ(
    socket: Socket,
    targetStrategy: TargetStrategy,
    myIndex: number,
    myTeam: string | null,
    isTeamMode: boolean,
    allPlayers: PlayerTargetInfo[]
  ): boolean {
    if (!this.canUseQ()) return false;

    const target = targetStrategy.resolveTarget(myIndex, myTeam, isTeamMode, allPlayers);
    const payload: ClassAbilityPayload = {
      classId: this.currentClass.id,
      slot: 'Q',
      abilityName: this.currentClass.abilityQName,
      strategy: targetStrategy.getStrategy(),
      targetIndex: target?.index,
    };

    socket.emit('class-ability', payload);
    this.qLastUsedAt = Date.now();
    return true;
  }

  public triggerE(
    socket: Socket,
    targetStrategy: TargetStrategy,
    myIndex: number,
    myTeam: string | null,
    isTeamMode: boolean,
    allPlayers: PlayerTargetInfo[],
    gridShiftDirection?: 'left' | 'right'
  ): boolean {
    if (!this.canUseE()) return false;

    const target = targetStrategy.resolveTarget(myIndex, myTeam, isTeamMode, allPlayers);
    const payload: ClassAbilityPayload & { direction?: string } = {
      classId: this.currentClass.id,
      slot: 'E',
      abilityName: this.currentClass.abilityEName,
      strategy: targetStrategy.getStrategy(),
      targetIndex: target?.index,
      direction: gridShiftDirection,
    };

    socket.emit('class-ability', payload);
    this.eLastUsedAt = Date.now();

    if (this.currentClass.id === 'SABOTEUR') {
      this.gridShiftUsed = true;
    }

    return true;
  }

  public triggerUltimate(
    socket: Socket,
    targetStrategy: TargetStrategy,
    myIndex: number,
    myTeam: string | null,
    isTeamMode: boolean,
    allPlayers: PlayerTargetInfo[]
  ): boolean {
    if (!this.canUseUltimate()) return false;

    const target = targetStrategy.resolveTarget(myIndex, myTeam, isTeamMode, allPlayers);
    const payload: ClassAbilityPayload = {
      classId: this.currentClass.id,
      slot: 'R',
      abilityName: this.currentClass.ultimateName,
      strategy: targetStrategy.getStrategy(),
      targetIndex: target?.index,
    };

    socket.emit('class-ability', payload);

    // Reset Ultimate progress
    this.ultimateLinesProgress = 0;

    // Saboteur Ultimate resets Grid Shift (E)
    if (this.currentClass.id === 'SABOTEUR') {
      this.gridShiftUsed = false;
    }

    return true;
  }

  // --- Internal Cooldown Parsers ---

  private getQCooldownMs(): number {
    switch (this.currentClass.id) {
      case 'TANK':
      case 'SUPPORT':
        return 10000;
      case 'SPEEDSTER':
      case 'SABOTEUR':
        return 12000;
      default:
        return 12000;
    }
  }

  private getECooldownMs(): number {
    switch (this.currentClass.id) {
      case 'SPEEDSTER':
        return 15000;
      case 'TANK':
        return 20000;
      case 'SUPPORT':
        return 25000;
      case 'SABOTEUR':
        return 0; // Handled via gridShiftUsed flag
      default:
        return 15000;
    }
  }
}