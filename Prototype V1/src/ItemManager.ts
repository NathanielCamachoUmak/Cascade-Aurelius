import { Tetromino } from './Tetromino';

export const SpecialBlockType = {
  BOMB: 'BOMB',
  HEAVY: 'HEAVY',
  MULTIPLIER: 'MULTIPLIER',
  SPEED: 'SPEED',
  SHIELD: 'SHIELD',
  FREEZE: 'FREEZE',
  GARBAGE_EATER: 'GARBAGE_EATER',
  NONE: 'NONE',
} as const;
export type SpecialBlockType = typeof SpecialBlockType[keyof typeof SpecialBlockType];

interface ItemWeight {
  type: SpecialBlockType;
  weight: number;
}

export class ItemManager {
  private itemPool: ItemWeight[] = [
    { type: SpecialBlockType.NONE, weight: 78 },
    { type: SpecialBlockType.MULTIPLIER, weight: 10 },
    { type: SpecialBlockType.BOMB, weight: 2 },
    { type: SpecialBlockType.HEAVY, weight: 2 },
    { type: SpecialBlockType.SPEED, weight: 2 },
    { type: SpecialBlockType.SHIELD, weight: 2 },
    { type: SpecialBlockType.FREEZE, weight: 2 },
    { type: SpecialBlockType.GARBAGE_EATER, weight: 2 },
  ];
  private forcedNextItem: SpecialBlockType | null = null;
  private forcedGoldDrop: boolean = false;

  public forceNextItem(item: SpecialBlockType): void {
    this.forcedNextItem = item;
  }

  public forceGoldDropNext(): void {
    this.forcedGoldDrop = true;
  }

  public applyItemToTetromino(tetromino: Tetromino): void {
    if (this.forcedGoldDrop) {
      this.forcedGoldDrop = false;
      this.applyGoldDropToTetromino(tetromino);
      return;
    }
    const itemType = this.forcedNextItem ?? this.getWeightedRandomItem();
    this.forcedNextItem = null;
    this.applySpecificItemToTetromino(tetromino, itemType);
  }

  /**
   * Support [E] Gold Drop: populates every solid block of the tetromino
   * with a distinct (unique) SpecialBlockType.
   */
  public applyGoldDropToTetromino(tetromino: Tetromino): void {
    const solidBlocks: { r: number; c: number }[] = [];
    for (let r = 0; r < tetromino.matrix.length; r++) {
      for (let c = 0; c < tetromino.matrix[r].length; c++) {
        if (tetromino.matrix[r][c] !== 0) solidBlocks.push({ r, c });
      }
    }
    if (!solidBlocks.length) return;

    const uniquePool: SpecialBlockType[] = [
      SpecialBlockType.BOMB,
      SpecialBlockType.HEAVY,
      SpecialBlockType.MULTIPLIER,
      SpecialBlockType.SPEED,
      SpecialBlockType.SHIELD,
      SpecialBlockType.FREEZE,
      SpecialBlockType.GARBAGE_EATER,
    ];

    // Fisher-Yates shuffle to pick unique item blocks
    for (let i = uniquePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniquePool[i], uniquePool[j]] = [uniquePool[j], uniquePool[i]];
    }

    tetromino.specialBlocks.clear();
    solidBlocks.forEach((cell, idx) => {
      const itemType = uniquePool[idx % uniquePool.length];
      tetromino.specialBlocks.set(`${cell.r},${cell.c}`, itemType);
    });
  }

  public applySpecificItemToTetromino(tetromino: Tetromino, itemType: SpecialBlockType): void {
    if (itemType === SpecialBlockType.NONE) return;

    const solidBlocks: { r: number; c: number }[] = [];
    for (let r = 0; r < tetromino.matrix.length; r++) {
      for (let c = 0; c < tetromino.matrix.length; c++) {
        if (tetromino.matrix[r][c] !== 0) solidBlocks.push({ r, c });
      }
    }
    if (!solidBlocks.length) return;
    const target = solidBlocks[Math.floor(Math.random() * solidBlocks.length)];
    tetromino.specialBlocks.set(`${target.r},${target.c}`, itemType);
  }

  private getWeightedRandomItem(): SpecialBlockType {
    const totalWeight = this.itemPool.reduce((sum, item) => sum + item.weight, 0);
    let value = Math.random() * totalWeight;
    for (const item of this.itemPool) {
      if (value < item.weight) return item.type;
      value -= item.weight;
    }
    return SpecialBlockType.NONE;
  }
}
