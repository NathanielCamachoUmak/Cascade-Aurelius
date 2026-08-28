import { Tetromino } from './Tetromino';

export const SpecialBlockType = {
  BOMB: 'BOMB',
  HEAVY: 'HEAVY',
  MULTIPLIER: 'MULTIPLIER',
  SPEED: 'SPEED',
  NONE: 'NONE',
} as const;
export type SpecialBlockType = typeof SpecialBlockType[keyof typeof SpecialBlockType];

interface ItemWeight {
  type: SpecialBlockType;
  weight: number;
}

export class ItemManager {
  private itemPool: ItemWeight[] = [
    { type: SpecialBlockType.NONE, weight: 80 },
    { type: SpecialBlockType.BOMB, weight: 5 },
    { type: SpecialBlockType.HEAVY, weight: 5 },
    { type: SpecialBlockType.MULTIPLIER, weight: 10 },
  ];
  private forcedNextItem: SpecialBlockType | null = null;

  public forceNextItem(item: SpecialBlockType): void {
    this.forcedNextItem = item;
  }

  public applyItemToTetromino(tetromino: Tetromino): void {
    const itemType = this.forcedNextItem ?? this.getWeightedRandomItem();
    this.forcedNextItem = null;
    this.applySpecificItemToTetromino(tetromino, itemType);
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
