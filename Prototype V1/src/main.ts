import './style.css'
import { GameManager, GameState } from './GameManager'
import { SpecialBlockType } from './ItemManager'

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;

// Setup canvas size
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// UI Elements
const scoreElement = document.getElementById('score')!;
const levelElement = document.getElementById('level')!;
const comboElement = document.getElementById('combo')!;
const multiplierElement = document.getElementById('multiplier')!;

const gameManager = new GameManager(render);

function drawBlock(x: number, y: number, color: string, isSpecial: string | undefined = undefined) {
  ctx.fillStyle = '#000000'; // black bg
  ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  
  ctx.strokeStyle = color; // neon green border
  ctx.lineWidth = 2;
  ctx.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

  // Fill slightly or draw pattern based on special
  if (isSpecial) {
    ctx.fillStyle = color;
    ctx.font = '20px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let icon = '';
    if (isSpecial === SpecialBlockType.BOMB) icon = 'B';
    if (isSpecial === SpecialBlockType.HEAVY) icon = 'W';
    if (isSpecial === SpecialBlockType.MULTIPLIER) icon = 'X';

    ctx.fillText(icon, x * BLOCK_SIZE + BLOCK_SIZE / 2, y * BLOCK_SIZE + BLOCK_SIZE / 2);
  } else {
    // Standard fill style for regular blocks (maybe just grid lines or full fill)
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(x * BLOCK_SIZE + 4, y * BLOCK_SIZE + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
  }
}

function render() {
  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Grid
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = gameManager.grid.matrix[r][c];
      if (cell.type !== null) {
        drawBlock(c, r, '#00FF00', cell.special);
      } else {
        // Optional: draw empty grid cells very faintly
        ctx.strokeStyle = '#003300';
        ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }

  // Draw Current Piece
  if (gameManager.currentPiece && gameManager.state === GameState.ACTIVE_DROP) {
    const shape = gameManager.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const specialKey = `${r},${c}`;
          const isSpecial = gameManager.currentPiece.specialBlocks.get(specialKey);
          drawBlock(gameManager.currentPiece.x + c, gameManager.currentPiece.y + r, '#00FF00', isSpecial);
        }
      }
    }
  }

  // Draw Game Over overlay
  if (gameManager.state === GameState.GAME_OVER) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#00FF00';
    ctx.font = '30px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

    ctx.font = '16px "Courier New"';
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', canvas.width / 2, canvas.height / 2 + 20);
  }

  // Update UI
  scoreElement.innerText = `SCORE: ${gameManager.scoreManager.score}`;
  levelElement.innerText = `LINES: ${gameManager.scoreManager.totalLinesCleared}`;
  
  if (gameManager.scoreManager.combo > 1) {
    comboElement.innerText = `COMBO x${gameManager.scoreManager.combo}`;
  } else {
    comboElement.innerText = '';
  }

  if (gameManager.scoreManager.scoreMultiplier > 1) {
    multiplierElement.innerText = `MULT x${gameManager.scoreManager.scoreMultiplier} (${(gameManager.scoreManager.multiplierTimer / 1000).toFixed(1)}s)`;
  } else {
    multiplierElement.innerText = '';
  }
}

// Start Game
gameManager.start();

window.addEventListener('keydown', (e) => {
  if (gameManager.state === GameState.GAME_OVER && e.key === 'Enter') {
    gameManager.reset();
  }
});
