import { Grid } from '../src/Grid';
import { GameManager, GameState } from '../src/GameManager';
import { InputAction, InputHandler } from '../src/InputHandler';
import { ItemManager, SpecialBlockType } from '../src/ItemManager';
import { Player } from '../src/Player';
import { ScoreManager } from '../src/ScoreManager';
import { Tetromino, TetrominoBag } from '../src/Tetromino';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Speedster/Tank passive foundation: force a special block on the next spawned piece.
for (const type of [SpecialBlockType.SPEED, SpecialBlockType.HEAVY]) {
  const manager = new ItemManager();
  const piece = new Tetromino('T');
  manager.forceNextItem(type);
  manager.applyItemToTetromino(piece);
  assert(Array.from(piece.specialBlocks.values()).includes(type), `Expected forced ${type} block.`);
}

// Support passive/Recycle foundation: garbage becomes usable special blocks.
const grid = new Grid();
grid.addGarbageLines(2, 'HUMAN');
const converted = grid.convertGarbageToSpecialBlocks(2);
assert(converted === 2, 'Expected two garbage cells to convert.');
assert(grid.matrix.flat().filter(cell => cell.special).length === 2, 'Converted garbage must carry special-block metadata.');

// Saboteur foundation: the bag exposes and mutates a five-piece real queue.
const bag = new TetrominoBag();
assert(bag.getPreview(5).length === 5, 'Expected a five-piece preview queue.');
bag.scramblePreview(5);
assert(bag.getPreview(5).length === 5, 'Scramble must preserve a five-piece preview queue.');

// Bullet Time / Chaos input foundations: freeze expires and reversed controls remap movement.
const input = new InputHandler(false);
input.freezeFor(1_000);
input.update(500);
assert(input.isFrozen, 'Freeze should still be active halfway through its duration.');
input.update(500);
assert(!input.isFrozen, 'Freeze should expire at its configured duration.');
input.reverseFor(1_000);
input.pushInput(InputAction.LEFT);
assert(input.getNextInput() === InputAction.RIGHT, 'Chaos must reverse horizontal input while active.');

// Time Warp must restore the current piece’s exact drop speed when its duration ends.
const speedster = new Player('Speedster', false, 'HARD', false, 'SPEEDSTER');
speedster.currentPiece = new Tetromino('T');
speedster.activeEffectType = 'TIME_WARP';
speedster.activeEffectTimer = 1_000;
speedster.dropInterval = 2_000;
const manager = new GameManager(() => {});
manager.state = GameState.PLAYING;
manager.players = [speedster];
(manager as any).update(1_000);
assert(speedster.activeEffectType === null, 'Time Warp effect should expire at six-second timer completion.');
assert(speedster.dropInterval === 1_000, 'Time Warp expiry should restore the current piece’s original drop interval.');

// Perfect Clear Bonus foundation: awarded bonus lines contribute to score and ultimate charge progress.
const score = new ScoreManager();
score.addBonusLines(4);
assert(score.totalLinesCleared === 4 && score.score > 0, 'Perfect Clear Bonus must add four rewarded lines and score.');

// End-to-end Support Perfect Clear Bonus: locking an I piece into a nearly-complete
// row clears the board, then awards the normal line plus four bonus lines.
const support = new Player('Support', false, 'HARD', false, 'SUPPORT');
for (let column = 0; column < 6; column += 1) support.grid.matrix[19][column] = { type: 'J' };
support.currentPiece = new Tetromino('I');
support.currentPiece.x = 6;
support.currentPiece.y = 18;
support.perfectClearWindow = 15_000;
const supportManager = new GameManager(() => {});
supportManager.players = [support];
(supportManager as any).handlePieceLock(support);
assert(support.grid.isEmpty(), 'Test position should create a real perfect clear.');
assert(support.scoreManager.totalLinesCleared === 5, 'Perfect Clear Bonus must add four lines after the cleared line.');

// Support passive converts an entire next garbage attack; Recycle is deliberately
// limited to four converted garbage lines and leaves the remainder intact.
const passiveGrid = new Grid();
passiveGrid.addGarbageLines(6, 'HUMAN');
const passiveConverted = passiveGrid.convertGarbageToSpecialBlocks(6);
assert(passiveConverted === 6, 'Support passive conversion should transform the full incoming attack.');
const recycleGrid = new Grid();
recycleGrid.addGarbageLines(6, 'HUMAN');
const recycleConverted = recycleGrid.convertGarbageToSpecialBlocks(4);
assert(recycleConverted === 4, 'Recycle must convert only its four-line allowance.');
assert(recycleGrid.matrix.flat().some(cell => cell.type === 'GARBAGE'), 'Recycle must leave excess garbage after its allowance is spent.');

console.log('PASS: class mechanics foundations verified.');
