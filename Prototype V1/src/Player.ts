import { Grid } from "./Grid";
import { Tetromino, TetrominoBag } from "./Tetromino";
import { InputHandler } from "./InputHandler";
import { ItemManager } from "./ItemManager";
import { ScoreManager } from "./ScoreManager";
import { AIBot, type Difficulty } from "./AIBot";
import { type PlayerClass } from "./PlayerClass";

export class Player {
  public id: string;
  public grid: Grid;
  public currentPiece: Tetromino | null = null;
  public nextPiece: Tetromino | null = null;
  public holdPiece: Tetromino | null = null;
  public hasHeld: boolean = false;
  public bag: TetrominoBag;

  public playerClass: PlayerClass = 'TANK';
  public classMeter: number = 0; // 0-100 — charges via class-specific actions, spent on the class's active ability
  public activeEffectType: 'OVERDRIVE' | 'FORTIFY' | null = null; // currently-running timed effect, if any
  public activeEffectTimer: number = 0; // ms remaining on activeEffectType

  public inputHandler: InputHandler;
  public itemManager: ItemManager;
  public scoreManager: ScoreManager;
  
  public bot: AIBot | null = null;

  public dropTimer: number = 0;
  public dropInterval: number = 1000;
  public timeSurvived: number = 0;
  public isToppedOut: boolean = false;

  constructor(
    id: string,
    isBot: boolean = false,
    botDifficulty: Difficulty = 'HARD',
    listenToKeyboard: boolean = true,
    playerClass: PlayerClass = 'TANK'
  ) {
    this.id = id;
    this.grid = new Grid();
    this.bag = new TetrominoBag();
    this.playerClass = playerClass;
    this.inputHandler = new InputHandler(!isBot && listenToKeyboard);
    this.itemManager = new ItemManager();
    this.scoreManager = new ScoreManager();

    if (isBot) {
      this.bot = new AIBot(this.grid, this.inputHandler, botDifficulty);
    }
  }

  public reset() {
    this.grid = new Grid();
    this.bag = new TetrominoBag();
    this.inputHandler.clear();
    this.scoreManager = new ScoreManager();
    this.currentPiece = null;
    this.nextPiece = null;
    this.holdPiece = null;
    this.hasHeld = false;
    this.timeSurvived = 0;
    this.dropTimer = 0;
    this.dropInterval = 1000;
    this.isToppedOut = false;
    this.classMeter = 0;
    this.activeEffectType = null;
    this.activeEffectTimer = 0;
  }
}