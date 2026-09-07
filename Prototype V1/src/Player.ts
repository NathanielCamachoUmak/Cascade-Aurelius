import { Grid } from './Grid';
import { Tetromino, TetrominoBag } from './Tetromino';
import { InputHandler } from './InputHandler';
import { ItemManager } from './ItemManager';
import { ScoreManager } from './ScoreManager';
import { AIBot, type Difficulty } from './AIBot';
import { type PlayerClass } from './PlayerClass';

export type ActiveClassEffect = 'TIME_WARP' | 'QUICKSILVER' | 'CHAOS' | 'ABILITY_FREEZE' | null;

export class Player {
  public id: string;
  public grid: Grid;
  public currentPiece: Tetromino | null = null;
  public nextPiece: Tetromino | null = null;
  public holdPiece: Tetromino | null = null;
  public hasHeld = false;
  public bag: TetrominoBag;
  public playerClass: PlayerClass = 'TANK';

  /** Ultimate charge measured in cleared lines. */
  public classMeter = 0;
  public activeEffectType: ActiveClassEffect = null;
  public activeEffectTimer = 0;
  public abilityCooldowns = { Q: 0, E: 0 };
  public fortifyCharges = 0;
  public reflectGarbage = false;
  public recycleGarbageLines = 0;
  public supportPassiveConversion = false;
  public perfectClearWindow = 0;
  public gridShiftUsedLevel = -1;
  public scramblePreviewCount = 0;
  public selectedTargetIndex: number | null = null;
  public shieldActive = false;
  public abilityFreezeTimer = 0;

  public inputHandler: InputHandler;
  public itemManager: ItemManager;
  public scoreManager: ScoreManager;
  public bot: AIBot | null = null;
  public dropTimer = 0;
  public dropInterval = 1000;
  public timeSurvived = 0;
  public isToppedOut = false;
  public kills = 0;
  public battleRoyalEliminated = false;

  constructor(id: string, isBot = false, botDifficulty: Difficulty = 'HARD', listenToKeyboard = true, playerClass: PlayerClass = 'TANK') {
    this.id = id;
    this.grid = new Grid();
    this.bag = new TetrominoBag();
    this.playerClass = playerClass;
    this.inputHandler = new InputHandler(!isBot && listenToKeyboard);
    this.itemManager = new ItemManager();
    this.scoreManager = new ScoreManager();
    if (isBot) this.bot = new AIBot(this.grid, this.inputHandler, botDifficulty);
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
    this.kills = 0;
    this.battleRoyalEliminated = false;
    this.classMeter = 0;
    this.activeEffectType = null;
    this.activeEffectTimer = 0;
    this.abilityCooldowns = { Q: 0, E: 0 };
    this.fortifyCharges = 0;
    this.reflectGarbage = false;
    this.recycleGarbageLines = 0;
    this.supportPassiveConversion = false;
    this.perfectClearWindow = 0;
    this.gridShiftUsedLevel = -1;
    this.scramblePreviewCount = 0;
    this.selectedTargetIndex = null;
    this.shieldActive = false;
    this.abilityFreezeTimer = 0;
  }
}
