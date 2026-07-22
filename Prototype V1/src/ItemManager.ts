import { Tetromino } from "./Tetromino";

export const SpecialBlockType = {
  BOMB: "BOMB",
  HEAVY: "HEAVY",
  MULTIPLIER: "MULTIPLIER",
  NONE: "NONE"
} as const;
export type SpecialBlockType = typeof SpecialBlockType[keyof typeof SpecialBlockType];

interface ItemWeight {
  type: SpecialBlockType;
  weight: number;
}

export class ItemManager {
  private itemPool: ItemWeight[] = [
    { type: SpecialBlockType.NONE, weight: 80 }, // 80% chance for normal piece
    { type: SpecialBlockType.BOMB, weight: 5 },  // 5% chance
    { type: SpecialBlockType.HEAVY, weight: 5 }, // 5% chance
    { type: SpecialBlockType.MULTIPLIER, weight: 10 } // 10% chance
  ];

  constructor() {}

  public applyItemToTetromino(tetromino: Tetromino): void {
    const itemType = this.getWeightedRandomItem();
    if (itemType === SpecialBlockType.NONE) return;

    // Pick a random solid block in the tetromino to embed the item
    const solidBlocks: { r: number, c: number }[] = [];
    const size = tetromino.matrix.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (tetromino.matrix[r][c] !== 0) {
          solidBlocks.push({ r, c });
        }
      }
    }

    if (solidBlocks.length > 0) {
      const target = solidBlocks[Math.floor(Math.random() * solidBlocks.length)];
      tetromino.specialBlocks.set(`${target.r},${target.c}`, itemType);
    }
  }

  private getWeightedRandomItem(): SpecialBlockType {
    let sum = 0;
    for (const item of this.itemPool) {
      sum += item.weight;
    }
    
    let rand = Math.random() * sum;
    for (const item of this.itemPool) {
      if (rand < item.weight) {
        return item.type;
      }
      rand -= item.weight;
    }
    
    return SpecialBlockType.NONE;
  }
}