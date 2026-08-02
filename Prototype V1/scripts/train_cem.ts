import { Grid } from "../src/Grid";
import { TetrominoBag, Tetromino, SHAPES, type ShapeType } from "../src/Tetromino";
import { AIBot } from "../src/AIBot";
import { InputHandler } from "../src/InputHandler";

const N = 50;
const RHO = 0.2;
const ELITE_SIZE = Math.floor(N * RHO);
const MAX_GENERATIONS = 20;
const MAX_GAMES_PER_INDIVIDUAL = 3;
const MAX_PIECES = 500; // Cap per game to prevent infinite loops

type WeightVector = [number, number, number, number, number, number];

let mu: WeightVector = [-4.5, 3.4, -3.2, -9.3, -7.8, -3.3];
let sigma: WeightVector = [2, 2, 2, 2, 2, 2];

function gaussianRand() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sampleWeights(mu: WeightVector, sigma: WeightVector): WeightVector {
  return mu.map((m, i) => m + gaussianRand() * sigma[i]) as WeightVector;
}

function getRotatedMatrix(type: ShapeType, r: number): number[][] {
  return SHAPES[type][r % SHAPES[type].length];
}

function simulateGame(weights: WeightVector): number {
  const grid = new Grid();
  const inputHandler = new InputHandler(false);
  const bot = new AIBot(grid, inputHandler, 'HARD');

  bot.weights = {
    landingHeight: weights[0],
    erodedPieceCells: weights[1],
    rowTransitions: weights[2],
    columnTransitions: weights[3],
    holes: weights[4],
    boardWells: weights[5]
  };

  const bag = new TetrominoBag();
  let currentPiece = new Tetromino(bag.getNext());
  let nextPiece = new Tetromino(bag.getNext());

  let linesCleared = 0;
  let piecesPlaced = 0;

  const anyBot = bot as any;

  while (piecesPlaced < MAX_PIECES) {
    // Use the bot's internal evaluation to find the best move
    const moves = anyBot.evaluateAllMoves(currentPiece, grid.matrix);

    if (moves.length === 0) break; // Topped out

    const bestMove = moves[0];

    // Apply the move: lock piece at the target position
    const pieceMatrix = getRotatedMatrix(currentPiece.type, bestMove.r);
    for (let r = 0; r < pieceMatrix.length; r++) {
      for (let c = 0; c < pieceMatrix[r].length; c++) {
        if (pieceMatrix[r][c] !== 0) {
          const gx = bestMove.targetX + c;
          const gy = bestMove.targetY + r;
          if (gy >= 0 && gy < grid.height && gx >= 0 && gx < grid.width) {
            grid.matrix[gy][gx].type = currentPiece.type;
          }
        }
      }
    }

    // Clear lines
    let clearedThisTurn = 0;
    let writeRow = grid.height - 1;
    for (let readRow = grid.height - 1; readRow >= 0; readRow--) {
      let isFull = true;
      for (let c = 0; c < grid.width; c++) {
        if (grid.matrix[readRow][c].type === null) { isFull = false; break; }
      }
      if (isFull) {
        clearedThisTurn++;
      } else {
        if (readRow !== writeRow) {
          for (let c = 0; c < grid.width; c++) {
            grid.matrix[writeRow][c] = { ...grid.matrix[readRow][c] };
          }
        }
        writeRow--;
      }
    }
    while (writeRow >= 0) {
      for (let c = 0; c < grid.width; c++) { grid.matrix[writeRow][c] = { type: null }; }
      writeRow--;
    }

    linesCleared += clearedThisTurn;
    piecesPlaced++;

    // Advance pieces
    currentPiece = nextPiece;
    nextPiece = new Tetromino(bag.getNext());
    currentPiece.x = Math.floor(grid.width / 2) - Math.floor(currentPiece.matrix[0].length / 2);
    currentPiece.y = 0;

    if (grid.checkCollision(currentPiece)) break;
  }

  return linesCleared;
}

async function runCEM() {
  console.log("Starting CEM Training for Tetris AI (Dellacherie weights)...");
  console.log(`Population: ${N}, Elite %: ${RHO * 100}%, Generations: ${MAX_GENERATIONS}`);

  for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
    console.log(`\n--- Generation ${gen + 1} ---`);
    console.log(`Mu:    [${mu.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`Sigma: [${sigma.map(v => v.toFixed(2)).join(', ')}]`);

    const population: { weights: WeightVector; fitness: number }[] = [];

    for (let i = 0; i < N; i++) {
      const w = sampleWeights(mu, sigma);
      let totalFitness = 0;
      for (let g = 0; g < MAX_GAMES_PER_INDIVIDUAL; g++) {
        totalFitness += simulateGame(w);
      }
      population.push({ weights: w, fitness: totalFitness / MAX_GAMES_PER_INDIVIDUAL });
      process.stdout.write(".");
    }
    console.log();

    population.sort((a, b) => b.fitness - a.fitness);

    console.log(`Best:  ${population[0].fitness.toFixed(1)} lines  [${population[0].weights.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`Avg:   ${(population.reduce((s, p) => s + p.fitness, 0) / N).toFixed(1)} lines`);

    const elites = population.slice(0, ELITE_SIZE);

    const newMu: WeightVector = [0, 0, 0, 0, 0, 0];
    for (const elite of elites) {
      for (let j = 0; j < 6; j++) newMu[j] += elite.weights[j];
    }
    for (let j = 0; j < 6; j++) newMu[j] /= ELITE_SIZE;

    const noise = Math.max(1.5 - gen * 0.07, 0.05);
    const newSigma: WeightVector = [0, 0, 0, 0, 0, 0];
    for (const elite of elites) {
      for (let j = 0; j < 6; j++) newSigma[j] += Math.pow(elite.weights[j] - newMu[j], 2);
    }
    for (let j = 0; j < 6; j++) newSigma[j] = Math.sqrt(newSigma[j] / ELITE_SIZE) + noise;

    mu = newMu;
    sigma = newSigma;
  }

  console.log("\n=== Training Complete ===");
  console.log("Optimal Weights:");
  console.log(`  landingHeight:     ${mu[0]}`);
  console.log(`  erodedPieceCells:  ${mu[1]}`);
  console.log(`  rowTransitions:    ${mu[2]}`);
  console.log(`  columnTransitions: ${mu[3]}`);
  console.log(`  holes:             ${mu[4]}`);
  console.log(`  boardWells:        ${mu[5]}`);
  console.log("\nPaste into AIBot.ts weights:");
  console.log(`{`);
  console.log(`  landingHeight: ${mu[0]},`);
  console.log(`  erodedPieceCells: ${mu[1]},`);
  console.log(`  rowTransitions: ${mu[2]},`);
  console.log(`  columnTransitions: ${mu[3]},`);
  console.log(`  holes: ${mu[4]},`);
  console.log(`  boardWells: ${mu[5]}`);
  console.log(`}`);
}

runCEM().catch(console.error);
