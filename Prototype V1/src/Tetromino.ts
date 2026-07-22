export type ShapeType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export const SHAPES: Record<ShapeType, number[][][]> = {
  // Each shape has 4 rotation states (0, 90, 180, 270)
  // 1 means solid block, 0 means empty space
  I: [
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    [[0,0,1,0], [0,0,1,0], [0,0,1,0], [0,0,1,0]],
    [[0,0,0,0], [0,0,0,0], [1,1,1,1], [0,0,0,0]],
    [[0,1,0,0], [0,1,0,0], [0,1,0,0], [0,1,0,0]]
  ],
  J: [
    [[1,0,0], [1,1,1], [0,0,0]],
    [[0,1,1], [0,1,0], [0,1,0]],
    [[0,0,0], [1,1,1], [0,0,1]],
    [[0,1,0], [0,1,0], [1,1,0]]
  ],
  L: [
    [[0,0,1], [1,1,1], [0,0,0]],
    [[0,1,0], [0,1,0], [0,1,1]],
    [[0,0,0], [1,1,1], [1,0,0]],
    [[1,1,0], [0,1,0], [0,1,0]]
  ],
  O: [
    [[1,1], [1,1]],
    [[1,1], [1,1]],
    [[1,1], [1,1]],
    [[1,1], [1,1]]
  ],
  S: [
    [[0,1,1], [1,1,0], [0,0,0]],
    [[0,1,0], [0,1,1], [0,0,1]],
    [[0,0,0], [0,1,1], [1,1,0]],
    [[1,0,0], [1,1,0], [0,1,0]]
  ],
  T: [
    [[0,1,0], [1,1,1], [0,0,0]],
    [[0,1,0], [0,1,1], [0,1,0]],
    [[0,0,0], [1,1,1], [0,1,0]],
    [[0,1,0], [1,1,0], [0,1,0]]
  ],
  Z: [
    [[1,1,0], [0,1,1], [0,0,0]],
    [[0,0,1], [0,1,1], [0,1,0]],
    [[0,0,0], [1,1,0], [0,1,1]],
    [[0,1,0], [1,1,0], [1,0,0]]
  ]
};

// Basic SRS Wall Kick Data (simplified for prototype: dx, dy)
// Format: State transition -> Array of (dx, dy) to test
// Positive y is down, positive x is right
// Standard tests are mostly for J, L, S, T, Z. I and O have specific/no kicks usually, but keeping it simple here.
const WALL_KICKS: Record<string, {x: number, y: number}[]> = {
  // Simplified basic kicks: try left, right, up, down
  "default": [
    {x: 0, y: 0},
    {x: -1, y: 0},
    {x: 1, y: 0},
    {x: 0, y: -1},
    {x: -1, y: -1},
    {x: 1, y: -1}
  ]
};

export class Tetromino {
  public type: ShapeType;
  public matrix: number[][];
  public rotationIndex: number = 0;
  public x: number;
  public y: number;

  // Items embedded in this tetromino. Map "row,col" -> itemType
  public specialBlocks: Map<string, string> = new Map();

  constructor(type: ShapeType) {
    this.type = type;
    this.matrix = SHAPES[type][this.rotationIndex];
    // Spawn at top middle
    this.x = Math.floor(10 / 2) - Math.floor(this.matrix[0].length / 2);
    this.y = 0;
  }

  public getMatrix(): number[][] {
    return this.matrix;
  }

  // Returns possible states to test for SRS wall kick
  public getKickData(): {x: number, y: number}[] {
    return WALL_KICKS["default"];
  }

  public rotate(dir: 1 | -1) {
    this.rotationIndex = (this.rotationIndex + dir + 4) % 4;
    this.matrix = SHAPES[this.type][this.rotationIndex];
    
    // We also need to rotate the special blocks coordinates if any, but to keep prototype simple, 
    // we'll assign special block to the grid visually differently later or just assign them upon locking.
    // For now, let's keep track of them relative to the piece's unrotated state if needed, or simply assign them after spawned.
    this.rotateSpecialBlocks(dir);
  }

  private rotateSpecialBlocks(dir: 1 | -1) {
    const size = this.matrix.length;
    const newSpecialBlocks = new Map<string, string>();
    
    for (const [key, itemType] of this.specialBlocks.entries()) {
      const [r, c] = key.split(',').map(Number);
      let newR, newC;
      if (dir === 1) { // CW
        newR = c;
        newC = size - 1 - r;
      } else { // CCW
        newR = size - 1 - c;
        newC = r;
      }
      newSpecialBlocks.set(`${newR},${newC}`, itemType);
    }
    
    this.specialBlocks = newSpecialBlocks;
  }

  public move(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }
}

export class TetrominoBag {
  private bag: ShapeType[] = [];
  
  constructor() {
    this.fillBag();
  }

  private fillBag() {
    const shapes: ShapeType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    // Fisher-Yates shuffle
    for (let i = shapes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
    }
    this.bag = shapes;
  }

  public getNext(): ShapeType {
    if (this.bag.length === 0) {
      this.fillBag();
    }
    return this.bag.pop()!;
  }
}