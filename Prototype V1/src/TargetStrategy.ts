export type TargetStrategyType = 
  | 'AUTO' 
  | 'HIGHEST_SCORE' 
  | 'LOWEST_SCORE' 
  | 'NEIGHBOR_LEFT' 
  | 'NEIGHBOR_RIGHT' 
  | 'MANUAL';

export interface PlayerTargetInfo {
  id: string;
  index: number;
  score: number;
  team: string | null;
  state: 'playing' | 'spectating' | 'lobby';
}

export class TargetStrategy {
  private currentStrategy: TargetStrategyType = 'AUTO';
  private manualTargetIndex: number | null = null;

  public setStrategy(strategy: TargetStrategyType): void {
    this.currentStrategy = strategy;
    if (strategy !== 'MANUAL') {
      this.manualTargetIndex = null;
    }
  }

  public setManualTarget(index: number): void {
    this.currentStrategy = 'MANUAL';
    this.manualTargetIndex = index;
  }

  public getStrategy(): TargetStrategyType {
    return this.currentStrategy;
  }

  public getManualTargetIndex(): number | null {
    return this.manualTargetIndex;
  }

  public cycleNextStrategy(): TargetStrategyType {
    const strategies: TargetStrategyType[] = [
      'AUTO',
      'HIGHEST_SCORE',
      'LOWEST_SCORE',
      'NEIGHBOR_LEFT',
      'NEIGHBOR_RIGHT'
    ];
    const currentIndex = strategies.indexOf(this.currentStrategy);
    const nextIndex = (currentIndex + 1) % strategies.length;
    this.currentStrategy = strategies[nextIndex];
    this.manualTargetIndex = null;
    return this.currentStrategy;
  }

  /**
   * Resolves the target player based on the active strategy.
   */
  public resolveTarget(
    myIndex: number,
    myTeam: string | null,
    isTeamMode: boolean,
    allPlayers: PlayerTargetInfo[]
  ): PlayerTargetInfo | null {
    // Filter active opponents
    const opponents = allPlayers.filter(p => {
      if (p.index === myIndex || p.state !== 'playing') return false;
      return isTeamMode ? p.team !== myTeam : true;
    });

    if (opponents.length === 0) return null;

    // Direct Manual Target selection
    if (this.currentStrategy === 'MANUAL' && this.manualTargetIndex !== null) {
      const manualMatch = opponents.find(p => p.index === this.manualTargetIndex);
      if (manualMatch) return manualMatch;
    }

    switch (this.currentStrategy) {
      case 'HIGHEST_SCORE':
        return [...opponents].sort((a, b) => b.score - a.score)[0];

      case 'LOWEST_SCORE':
        return [...opponents].sort((a, b) => a.score - b.score)[0];

      case 'NEIGHBOR_LEFT': {
        const sorted = [...opponents].sort((a, b) => a.index - b.index);
        const leftOpponents = sorted.filter(p => p.index < myIndex);
        return leftOpponents.length > 0 
          ? leftOpponents[leftOpponents.length - 1] 
          : sorted[sorted.length - 1]; // Wrap around
      }

      case 'NEIGHBOR_RIGHT': {
        const sorted = [...opponents].sort((a, b) => a.index - b.index);
        const rightOpponents = sorted.filter(p => p.index > myIndex);
        return rightOpponents.length > 0 
          ? rightOpponents[0] 
          : sorted[0]; // Wrap around
      }

      case 'AUTO':
      default:
        // Default targeting: fall back to random/first available or default opponent
        return opponents[0];
    }
  }
}