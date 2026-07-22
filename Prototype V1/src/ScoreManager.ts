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
    this.multiplierTimer = 8000; // 8 seconds
  }

  public addScoreForLines(lines: number) {
    if (lines > 0 && lines <= 4) {
      this.totalLinesCleared += lines;
      
      let points = this.LINE_SCORES[lines];
      
      // Apply combo bonus
      points += 50 * this.combo;
      
      // Apply item & global multiplier
      points *= this.scoreMultiplier * this.globalMultiplier;

      this.score += points;

      // Update combo stack and reset decay timer
      this.combo++;
      this.comboTimer = this.COMBO_DURATION;
    }
  }

  public addDropScore(cellsDropped: number) {
    this.score += cellsDropped * this.scoreMultiplier * this.globalMultiplier;
  }
}