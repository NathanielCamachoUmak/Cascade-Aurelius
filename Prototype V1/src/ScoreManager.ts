export class ScoreManager {
  public score: number = 0;
  public totalLinesCleared: number = 0;
  
  // Combo mechanics
  public combo: number = 0;
  public comboTimer: number = 0;
  private readonly COMBO_DURATION = 3000; // 3 seconds to keep combo alive
  
  // Item mechanics
  public scoreMultiplier: number = 1;
  public multiplierTimer: number = 0;
  public globalMultiplier: number = 1;

  // Base line scores (non-linear)
  private readonly LINE_SCORES = [0, 100, 300, 500, 800];

  constructor() {}

  public update(dt: number) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }

    if (this.multiplierTimer > 0) {
      this.multiplierTimer -= dt;
      if (this.multiplierTimer <= 0) {
        this.scoreMultiplier = 1;
        this.multiplierTimer = 0;
      }
    }
  }

  public activateMultiplierBlock() {
    this.scoreMultiplier = 2;
    this.multiplierTimer = 5000; // 5 seconds (matches Stage 3 Tutorial)
  }

  public addScoreForLines(lines: number): number {
    if (lines > 0) {
      const clampedLines = Math.min(4, lines);
      const extraLines = Math.max(0, lines - 4);
      this.totalLinesCleared += lines;
      
      let points = this.LINE_SCORES[clampedLines] + extraLines * 200;
      
      // Apply combo bonus
      points += 50 * this.combo;
      
      // Apply item & global multiplier
      points *= this.scoreMultiplier * this.globalMultiplier;

      this.score += points;

      // Update combo stack and reset decay timer
      this.combo++;
      this.comboTimer = this.COMBO_DURATION;
      return points;
    }
    return 0;
  }

  public addDropScore(cellsDropped: number) {
    this.score += cellsDropped * this.scoreMultiplier * this.globalMultiplier;
  }

  public addBonusLines(lines: number) {
    if (lines <= 0) return;
    this.totalLinesCleared += lines;
    this.score += lines * 100 * this.scoreMultiplier * this.globalMultiplier;
  }

  public addFlatBonusScore(basePoints: number): number {
    if (basePoints <= 0) return 0;
    const gained = basePoints * this.scoreMultiplier * this.globalMultiplier;
    this.score += gained;
    return gained;
  }
}
