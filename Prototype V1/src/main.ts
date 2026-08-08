import './style.css'
import { GameManager, GameState } from './GameManager'
import { SpecialBlockType } from './ItemManager'
import { Player } from './Player'
import { Tetromino } from './Tetromino'
import { NetworkManager, type RoomState, type GameStartData } from './NetworkManager'
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass'

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;
const PADDING = 40; // Space between boards in 1v1

// UI Elements
const uiLayer = document.getElementById('ui-layer')!;
const screenMain = document.getElementById('screen-main')!;
const screenDifficulty = document.getElementById('screen-difficulty')!;
const gameHud = document.getElementById('game-hud')!;

const btnSolo = document.getElementById('btn-solo')!;
const btnVsBot = document.getElementById('btn-vs-bot')!;
const btnEasyBot = document.getElementById('btn-easy-bot')!;
const btnHardBot = document.getElementById('btn-hard-bot')!;
const btnBack = document.getElementById('btn-back')!;
const btnToggleGhost = document.getElementById('btn-toggle-ghost')!;

// Class select elements
const screenClassSelect = document.getElementById('screen-class-select')!;
const classCardList = document.getElementById('class-card-list')!;
const btnClassContinue = document.getElementById('btn-class-continue')!;
const btnClassBack = document.getElementById('btn-class-back')!;

// Online Lobby elements
const screenLobby = document.getElementById('screen-lobby')!;
const btnPlayOnline = document.getElementById('btn-play-online')!;
const lobbyRoomInput = document.getElementById('lobby-room-input') as HTMLInputElement;
const btnJoinLobby = document.getElementById('btn-join-lobby')!;
const lobbyStatus = document.getElementById('lobby-status')!;
const lobbyPlayerList = document.getElementById('lobby-player-list')!;
const btnLobbyReady = document.getElementById('btn-lobby-ready')!;
const btnLobbyBack = document.getElementById('btn-lobby-back')!;
const lobbyNicknameInput = document.getElementById('lobby-nickname-input') as HTMLInputElement;

// NEW: Lobby & Post-Game Elements
const navLobby = document.getElementById('nav-lobby')!;
const btnLobbyLeave = document.getElementById('btn-lobby-leave')!;
const lobbyCountdown = document.getElementById('lobby-countdown')!;
const modalConfirmJoin = document.getElementById('modal-confirm-join')!;
const btnConfirmJoinYes = document.getElementById('btn-confirm-join-yes')!;
const btnConfirmJoinNo = document.getElementById('btn-confirm-join-no')!;
const screenPostGame = document.getElementById('screen-post-game')!;
const postGameWinner = document.getElementById('post-game-winner')!;
const postGameVotes = document.getElementById('post-game-votes')!;
const btnPostRematch = document.getElementById('btn-post-rematch')!;
const btnPostLeave = document.getElementById('btn-post-leave')!;
const preGameOverlay = document.getElementById('pre-game-overlay')!;
const preGameText = document.getElementById('pre-game-text')!;
const spectatorBanner = document.getElementById('spectator-banner')!;

const hudP2 = document.getElementById('hud-p2')!;

const scoreElementP1 = document.getElementById('score-p1')!;
const levelElementP1 = document.getElementById('level-p1')!;
const comboElementP1 = document.getElementById('combo-p1')!;
const multiplierElementP1 = document.getElementById('multiplier-p1')!;
const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;
const nextCanvasP1 = document.getElementById('next-canvas-p1') as HTMLCanvasElement;
const abilityMeterP1 = document.getElementById('ability-meter-p1')!;
const abilityLabelP1 = document.getElementById('ability-label-p1')!;
const abilityFillP1 = document.getElementById('ability-fill-p1')!;
const abilityReadyP1 = document.getElementById('ability-ready-p1')!;

const scoreElementP2 = document.getElementById('score-p2')!;
const levelElementP2 = document.getElementById('level-p2')!;
const comboElementP2 = document.getElementById('combo-p2')!;
const multiplierElementP2 = document.getElementById('multiplier-p2')!;
const abilityMeterP2 = document.getElementById('ability-meter-p2')!;
const abilityLabelP2 = document.getElementById('ability-label-p2')!;
const abilityFillP2 = document.getElementById('ability-fill-p2')!;

const gameManager = new GameManager(render);

let showGhostPiece = true;

// --- Class Select ---
let selectedClass: PlayerClass = 'TANK';
let pendingMode: 'SOLO' | 'VS_BOT' | 'ONLINE' | null = null;

function renderClassCards() {
  classCardList.innerHTML = '';
  for (const info of PLAYER_CLASSES) {
    const isSelected = info.id === selectedClass;
    const card = document.createElement('button');
    card.className = `flex-1 bg-bgPanel border-2 ${isSelected ? 'border-neonCyan shadow-[0_0_20px_rgba(0,229,255,0.2)]' : 'border-bgPanelBorder'} transition-all p-6 text-left slanted-btn`;
    card.innerHTML = `
      <h3 class="text-2xl font-bold mb-2 ${isSelected ? 'text-neonCyan' : ''}">${info.name}</h3>
      <p class="text-gray-400 text-sm mb-4">${info.tagline}</p>
      <p class="text-xs text-gray-500 mb-2">${info.passiveDescription}</p>
      <p class="text-xs text-neonMagenta">${info.activeDescription}</p>
    `;
    card.addEventListener('click', () => {
      selectedClass = info.id;
      renderClassCards();
    });
    classCardList.appendChild(card);
  }
}
renderClassCards();

// Menu Event Listeners
btnSolo.addEventListener('click', () => {
  pendingMode = 'SOLO';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
});

btnVsBot.addEventListener('click', () => {
  pendingMode = 'VS_BOT';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
});

btnClassBack.addEventListener('click', () => {
  screenClassSelect.classList.remove('flex');
  screenClassSelect.classList.add('hidden');
  screenMain.classList.remove('hidden');
});

btnClassContinue.addEventListener('click', () => {
  screenClassSelect.classList.remove('flex');
  screenClassSelect.classList.add('hidden');

  if (pendingMode === 'SOLO') {
    startGame('SOLO');
  } else if (pendingMode === 'VS_BOT') {
    screenDifficulty.classList.remove('hidden');
    screenDifficulty.classList.add('flex');
  } else if (pendingMode === 'ONLINE') {
    if (network && network.currentRoomId) {
      screenLobby.classList.remove('hidden');
      screenLobby.classList.add('flex');
    } else {
      screenLobby.classList.remove('hidden');
      screenLobby.classList.add('flex');
    }
  }
});

btnBack.addEventListener('click', () => {
  screenDifficulty.classList.remove('flex');
  screenDifficulty.classList.add('hidden');
  screenMain.classList.remove('hidden');
});

btnEasyBot.addEventListener('click', () => {
  startGame('EASY');
});

btnHardBot.addEventListener('click', () => {
  startGame('HARD');
});

btnToggleGhost.addEventListener('click', () => {
  showGhostPiece = !showGhostPiece;
  btnToggleGhost.innerText = `GHOST: ${showGhostPiece ? 'ON' : 'OFF'}`;
  btnToggleGhost.className = showGhostPiece 
    ? "bg-bgPanel border border-neonCyan text-neonCyan px-4 py-2 text-xs font-bold hover:bg-neonCyan hover:text-black transition-colors rounded"
    : "bg-bgPanel border border-gray-500 text-gray-500 px-4 py-2 text-xs font-bold hover:bg-gray-500 hover:text-white transition-colors rounded";
  // Force a render so it disappears instantly
  if (gameManager.state === GameState.PLAYING) {
    render();
  }
});

navLobby.addEventListener('click', (e) => {
  e.preventDefault();
  if (network && network.currentRoomId) {
    screenMain.classList.add('hidden');
    screenClassSelect.classList.remove('flex');
    screenClassSelect.classList.add('hidden');
    screenDifficulty.classList.remove('flex');
    screenDifficulty.classList.add('hidden');
    screenPostGame.classList.remove('flex');
    screenPostGame.classList.add('hidden');
    
    screenLobby.classList.remove('hidden');
    screenLobby.classList.add('flex');
    uiLayer.classList.remove('hidden');
  }
});

// --- Online Lobby ---
let network: NetworkManager | null = null;
let myReady = false;
let inRoom = false;
let pendingJoinRoomId = '';

btnPlayOnline.addEventListener('click', () => {
  pendingMode = 'ONLINE';
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('hidden');
  screenClassSelect.classList.add('flex');
});

btnLobbyBack.addEventListener('click', () => {
  // If we are connected, keep the lobby session active! Don't disconnect.
  screenLobby.classList.remove('flex');
  screenLobby.classList.add('hidden');
  screenMain.classList.remove('hidden');
});

btnLobbyLeave.addEventListener('click', () => {
  network?.leaveLobby();
  returnToMenu();
});

btnConfirmJoinYes.addEventListener('click', () => {
  modalConfirmJoin.classList.add('hidden');
  const nickname = lobbyNicknameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
  network?.confirmJoin(pendingJoinRoomId, nickname);
});

btnConfirmJoinNo.addEventListener('click', () => {
  modalConfirmJoin.classList.add('hidden');
  lobbyStatus.innerText = 'Join cancelled.';
  btnJoinLobby.removeAttribute('disabled');
});

btnPostRematch.addEventListener('click', () => {
  network?.voteRematch();
  btnPostRematch.classList.add('hidden');
});

btnPostLeave.addEventListener('click', () => {
  network?.leaveLobby();
  returnToMenu();
});

btnJoinLobby.addEventListener('click', () => {
  const roomId = lobbyRoomInput.value.trim() || 'test-room';

  if (!network) {
    network = new NetworkManager();

    network.onConnected = () => {
      lobbyStatus.innerText = 'Connected. Joining room...';
      const nickname = lobbyNicknameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
      network!.joinRoom(roomId, nickname);
    };

    network.onJoinError = (message: string) => {
      lobbyStatus.innerText = `Error: ${message}`;
      btnJoinLobby.removeAttribute('disabled');
    };

    network.onRoomUpdate = (state: RoomState) => {
      inRoom = true;
      
      // Auto-ready resets
      const me = state.players.find(p => p.id === network?.mySocketId);
      if (me) myReady = me.ready;
      btnLobbyReady.innerText = myReady ? 'READY! (click to cancel)' : 'READY UP';
      
      // If we came from post-game, make sure we go back to lobby UI
      if (gameManager.state === GameState.POST_GAME) {
        screenPostGame.classList.remove('flex');
        screenPostGame.classList.add('hidden');
        screenLobby.classList.remove('hidden');
        screenLobby.classList.add('flex');
      }

      renderLobbyPlayers(state);
    };

    network.onConfirmJoin = (data) => {
      pendingJoinRoomId = data.newRoom;
      modalConfirmJoin.classList.remove('hidden');
    };

    network.onCountdownStart = (seconds: number) => {
      lobbyCountdown.classList.remove('hidden');
      lobbyCountdown.innerText = `Starting in ${seconds}...`;
      let s = seconds;
      const interval = setInterval(() => {
        s--;
        if (s > 0) lobbyCountdown.innerText = `Starting in ${s}...`;
        else clearInterval(interval);
      }, 1000);
      lobbyCountdown.dataset.interval = interval.toString();
    };

    network.onCountdownCancel = () => {
      lobbyCountdown.classList.add('hidden');
      const interval = lobbyCountdown.dataset.interval;
      if (interval) clearInterval(parseInt(interval));
      lobbyStatus.innerText = 'Countdown cancelled.';
    };

    network.onPreGameCountdown = (seconds: number) => {
      preGameOverlay.classList.remove('hidden');
      // Freeze inputs for pre-game
      gameManager.players[gameManager.myPlayerIndex].inputHandler.freeze();
      
      let s = seconds;
      preGameText.innerText = s.toString();
      const interval = setInterval(() => {
        s--;
        if (s > 0) {
          preGameText.innerText = s.toString();
        } else if (s === 0) {
          preGameText.innerText = "GO!";
        } else {
          clearInterval(interval);
          preGameOverlay.classList.add('hidden');
          gameManager.players[gameManager.myPlayerIndex].inputHandler.unfreeze();
        }
      }, 1000);
    };

    network.onPlayerStateUpdate = (data) => {
      if (data.playerId === network?.mySocketId && data.state === 'spectating') {
        spectatorBanner.classList.remove('hidden');
      }
    };

    network.onPostGameStart = (data) => {
      uiLayer.classList.remove('hidden');
      screenLobby.classList.add('hidden');
      screenLobby.classList.remove('flex');
      screenPostGame.classList.remove('hidden');
      screenPostGame.classList.add('flex');
      gameHud.classList.add('hidden');
      
      postGameWinner.innerText = `Winner: ${data.winnerName}`;
      postGameVotes.innerText = `0 voted for rematch`;
      btnPostRematch.classList.remove('hidden');
      
      // Cleanup lobby countdown just in case
      lobbyCountdown.classList.add('hidden');
      const interval = lobbyCountdown.dataset.interval;
      if (interval) clearInterval(parseInt(interval));
    };

    network.onRematchUpdate = (data) => {
      postGameVotes.innerText = `${data.votes}/${data.required} voted for rematch`;
    };

    network.onPlayerDisconnected = () => {
       // A player left during game
       gameManager.network?.sendRibbon('A PLAYER DISCONNECTED');
    };

    network.onGameStart = (data: GameStartData) => {
      startOnlineGame(data.players.length, data.myIndex, data.players.map(p => p.name));
    };

    network.onShowRibbon = (message: string) => {
      const ribbon = document.getElementById('global-ribbon');
      if (ribbon) {
        ribbon.innerText = message;
        ribbon.classList.remove('hidden');
        ribbon.classList.add('opacity-100');
        setTimeout(() => {
          ribbon.classList.add('hidden');
        }, 2000); // hide after 2 seconds
      }
    };
  } else {
    const nickname = lobbyNicknameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
    network.joinRoom(roomId, nickname);
  }

  lobbyStatus.innerText = 'Connecting...';
  btnJoinLobby.setAttribute('disabled', 'true');
});

btnLobbyReady.addEventListener('click', () => {
  myReady = !myReady;
  network?.setReady(myReady);
  btnLobbyReady.innerText = myReady ? 'READY! (click to cancel)' : 'READY UP';
});

function renderLobbyPlayers(state: RoomState) {
  lobbyStatus.innerText = `Room "${state.roomId}" — ${state.players.length}/4 players`;
  btnJoinLobby.removeAttribute('disabled');

  if (inRoom) {
    btnLobbyReady.classList.remove('hidden');
    btnLobbyLeave.classList.remove('hidden');
  }

  lobbyPlayerList.innerHTML = '';
  for (const p of state.players) {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center bg-bgPanel border border-bgPanelBorder px-4 py-3';

    const isMe = network && p.id === network.mySocketId;
    row.innerHTML = `
      <span class="font-bold">${p.name}${isMe ? ' (you)' : ''}</span>
      <span class="${p.ready ? 'text-neonCyan' : 'text-gray-500'} text-xs font-bold uppercase tracking-widest">
        ${p.ready ? '✓ Ready' : 'Not Ready'}
      </span>
    `;
    lobbyPlayerList.appendChild(row);
  }
}

/**
 * Start an online multiplayer game.
 * Called when the server emits 'game-start'.
 */
let onlinePlayerNames: string[] = [];

function startOnlineGame(playerCount: number, myIndex: number, playerNames?: string[]) {
  if (playerNames) {
    onlinePlayerNames = playerNames;
  }
  // Hide lobby, show game
  uiLayer.classList.add('hidden');
  gameHud.classList.remove('hidden');
  gameHud.classList.add('flex');
  spectatorBanner.classList.add('hidden');

  // Size canvas for the number of players
  canvas.width = (COLS * BLOCK_SIZE * playerCount) + (PADDING * (playerCount - 1));
  canvas.height = ROWS * BLOCK_SIZE;

  // Show P2 HUD if there are 2+ players
  if (playerCount >= 2) {
    hudP2.classList.remove('hidden');
    hudP2.classList.add('flex');
  } else {
    hudP2.classList.add('hidden');
    hudP2.classList.remove('flex');
  }

  // Initialize the online game
  gameManager.initOnline(playerCount, myIndex, network!, onlinePlayerNames, selectedClass);
}

function startGame(mode: 'SOLO' | 'EASY' | 'HARD') {
  uiLayer.classList.add('hidden');
  gameHud.classList.remove('hidden');
  gameHud.classList.add('flex');
  
  const playerCount = mode === 'SOLO' ? 1 : 2;
  canvas.width = (COLS * BLOCK_SIZE * playerCount) + (PADDING * (playerCount - 1));
  canvas.height = ROWS * BLOCK_SIZE;

  if (mode === 'SOLO') {
    hudP2.classList.add('hidden');
    hudP2.classList.remove('flex');
    gameManager.initSolo(selectedClass);
  } else {
    hudP2.classList.remove('hidden');
    hudP2.classList.add('flex');
    gameManager.init1v1(mode, selectedClass);
  }
}

function drawBlock(
  targetCtx: CanvasRenderingContext2D,
  x: number, 
  y: number, 
  color: string, 
  offsetX: number, 
  offsetY: number = 0,
  isSpecial: string | undefined = undefined, 
  isGhost: boolean = false
) {
  const finalX = offsetX + x * BLOCK_SIZE;
  const finalY = offsetY + y * BLOCK_SIZE;

  if (isGhost) {
    targetCtx.fillStyle = 'transparent';
    targetCtx.fillRect(finalX, finalY, BLOCK_SIZE, BLOCK_SIZE);
    
    targetCtx.strokeStyle = 'rgba(0, 229, 255, 0.4)'; // Cyan dashed for ghost
    targetCtx.setLineDash([4, 2]);
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(finalX + 1, finalY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    targetCtx.setLineDash([]); // Reset
    return;
  }

  targetCtx.fillStyle = '#000000'; // black bg
  targetCtx.fillRect(finalX, finalY, BLOCK_SIZE, BLOCK_SIZE);
  
  if (isSpecial === 'GARBAGE') {
    targetCtx.strokeStyle = '#555555';
    targetCtx.fillStyle = '#333333';
    targetCtx.fillRect(finalX + 2, finalY + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
    return;
  }

  targetCtx.strokeStyle = color; // Neon border
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(finalX + 1, finalY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

  if (isSpecial) {
    targetCtx.fillStyle = color;
    targetCtx.font = '20px "Press Start 2P"';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    
    let icon = '';
    if (isSpecial === SpecialBlockType.BOMB) icon = 'B';
    if (isSpecial === SpecialBlockType.HEAVY) icon = 'W';
    if (isSpecial === SpecialBlockType.MULTIPLIER) icon = 'X';

    targetCtx.fillText(icon, finalX + BLOCK_SIZE / 2, finalY + BLOCK_SIZE / 2 + 2);
  } else {
    // Fill interior
    targetCtx.fillStyle = color;
    targetCtx.fillRect(finalX + 6, finalY + 6, BLOCK_SIZE - 12, BLOCK_SIZE - 12);
  }
}

function renderPieceOnMiniCanvas(canvasEl: HTMLCanvasElement, piece: Tetromino | null, color: string) {
  const tCtx = canvasEl.getContext('2d')!;
  tCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (!piece) return;

  const shape = piece.matrix;
  const size = shape.length;
  // Center it roughly in the 90x90 canvas (assuming max 4x4 piece blocks of 20px each)
  const MINI_BLOCK_SIZE = 20;
  const offsetX = (90 - size * MINI_BLOCK_SIZE) / 2;
  const offsetY = (90 - size * MINI_BLOCK_SIZE) / 2;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (shape[r][c] !== 0) {
        // Draw mini block
        const fx = offsetX + c * MINI_BLOCK_SIZE;
        const fy = offsetY + r * MINI_BLOCK_SIZE;
        tCtx.fillStyle = '#000000';
        tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
        tCtx.strokeStyle = color;
        tCtx.lineWidth = 2;
        tCtx.strokeRect(fx+1, fy+1, MINI_BLOCK_SIZE-2, MINI_BLOCK_SIZE-2);
        tCtx.fillStyle = color;
        tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
      }
    }
  }
}

// Assign colors per player index for multiplayer
const PLAYER_COLORS = ['#00E5FF', '#FF007F', '#FFC107', '#76FF03'];

function renderPlayer(player: Player, index: number) {
  const offsetX = index * (COLS * BLOCK_SIZE + PADDING);
  const playerColor = PLAYER_COLORS[index] || '#00E5FF';

  // Draw Grid background (optional faint lines)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX + c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
  }

  // Draw Player Grid Border
  ctx.strokeStyle = playerColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

  // Draw Block Matrix
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = player.grid.matrix[r][c];
      if (cell.type !== null) {
        const color = cell.type === 'GARBAGE' ? '#555555' : playerColor;
        drawBlock(ctx, c, r, color, offsetX, 0, cell.type === 'GARBAGE' ? 'GARBAGE' : cell.special);
      }
    }
  }

  // Ghost Piece Logic — only show for our own player in online mode
  const isMyPlayer = !gameManager.isOnline || index === gameManager.myPlayerIndex;
  if (player.currentPiece && showGhostPiece && isMyPlayer) {
    let ghostY = player.currentPiece.y;
    while (!player.grid.checkCollision(player.currentPiece, player.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    
    // Draw Ghost
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          drawBlock(ctx, player.currentPiece.x + c, ghostY + r, '#00E5FF', offsetX, 0, undefined, true);
        }
      }
    }
  }

  // Draw Current Piece
  if (player.currentPiece) {
    const shape = player.currentPiece.matrix;
    const size = shape.length;
    const color = playerColor;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shape[r][c] !== 0) {
          const specialKey = `${r},${c}`;
          const isSpecial = player.currentPiece.specialBlocks.get(specialKey);
          drawBlock(ctx, player.currentPiece.x + c, player.currentPiece.y + r, color, offsetX, 0, isSpecial);
        }
      }
    }
  }

  // Draw topping out overlay for this player
  if (player.isToppedOut) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.fillRect(offsetX, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
  }
}

function render() {
  if (gameManager.state === GameState.MAIN_MENU) return;

  // Clear main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < gameManager.players.length; i++) {
    renderPlayer(gameManager.players[i], i);
  }

  // Render visual effects
  const effects = gameManager.getEffects();
  
  // Draw line clear flashes
  for (const flash of effects.lineClearEffects) {
    const BLOCK_SIZE_LOCAL = 30;
    const myIdx2 = gameManager.isOnline ? gameManager.myPlayerIndex : 0;
    const offsetX = myIdx2 * (COLS * BLOCK_SIZE + PADDING);
    ctx.fillStyle = flash.color + Math.floor(flash.flash * 80).toString(16).padStart(2, '0');
    ctx.fillRect(offsetX, flash.row * BLOCK_SIZE_LOCAL, COLS * BLOCK_SIZE_LOCAL, BLOCK_SIZE_LOCAL);
  }
  
  // Draw particles
  for (const p of effects.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  
  // Draw combo texts
  for (const t of effects.comboTexts) {
    const alpha = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.font = `bold ${t.size}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Glow effect
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 20;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // In online mode, figure out which player index is "ours" for the left HUD
  const myIdx = gameManager.isOnline ? gameManager.myPlayerIndex : 0;
  const opIdx = gameManager.isOnline 
    ? gameManager.players.findIndex((_, i) => i !== myIdx)
    : 1;

  // Update UI for Player 1 (our player)
  const p1 = gameManager.players[myIdx];
  if (p1) {
    scoreElementP1.innerText = `${Math.round(p1.scoreManager.score)}`;
    levelElementP1.innerText = `${p1.scoreManager.totalLinesCleared}`;
    comboElementP1.innerText = p1.scoreManager.combo > 1 ? `COMBO x${p1.scoreManager.combo}` : '';
    multiplierElementP1.innerText = p1.scoreManager.scoreMultiplier > 1 ? `MULT x${p1.scoreManager.scoreMultiplier}` : '';
    renderPieceOnMiniCanvas(holdCanvasP1, p1.holdPiece, PLAYER_COLORS[myIdx] || '#00E5FF');
    renderPieceOnMiniCanvas(nextCanvasP1, p1.nextPiece, PLAYER_COLORS[myIdx] || '#00E5FF');

    const classInfo1 = PLAYER_CLASSES.find((c) => c.id === p1.playerClass);
    abilityMeterP1.classList.remove('hidden');
    if (classInfo1) {
      const isActive = p1.activeEffectTimer > 0;
      abilityLabelP1.innerText = isActive
        ? `${classInfo1.activeName.toUpperCase()} ACTIVE (${Math.ceil(p1.activeEffectTimer / 1000)}s)`
        : classInfo1.activeName.toUpperCase();
    }
    abilityFillP1.style.width = `${p1.classMeter}%`;
    abilityReadyP1.classList.toggle('hidden', p1.classMeter < 100);
  }

  // Update UI for Player 2 (opponent / bot)
  const p2 = opIdx >= 0 ? gameManager.players[opIdx] : undefined;
  if (p2) {
    scoreElementP2.innerText = `${Math.round(p2.scoreManager.score)}`;
    levelElementP2.innerText = `${p2.scoreManager.totalLinesCleared}`;
    comboElementP2.innerText = p2.scoreManager.combo > 1 ? `COMBO x${p2.scoreManager.combo}` : '';
    multiplierElementP2.innerText = p2.scoreManager.scoreMultiplier > 1 ? `MULT x${p2.scoreManager.scoreMultiplier}` : '';

    const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
    abilityMeterP2.classList.remove('hidden');
    abilityMeterP2.classList.add('flex');
    if (classInfo2) {
      const isActive2 = p2.activeEffectTimer > 0;
      abilityLabelP2.innerText = isActive2
        ? `${classInfo2.activeName.toUpperCase()} (${Math.ceil(p2.activeEffectTimer / 1000)}s)`
        : classInfo2.activeName.toUpperCase();
    }
    abilityFillP2.style.width = `${p2.classMeter}%`;
  }

  // Update multiplayer scoreboard
  if (gameManager.isOnline && onlinePlayerNames.length > 0) {
    const scoreboard = document.getElementById('multiplayer-scoreboard')!;
    const entries = document.getElementById('scoreboard-entries')!;
    scoreboard.classList.remove('hidden');
    
    entries.innerHTML = '';
    const playerData: {name: string, score: number, lines: number, alive: boolean}[] = [];
    for (let i = 0; i < gameManager.players.length; i++) {
      const p = gameManager.players[i];
      playerData.push({
        name: onlinePlayerNames[i] || `Player ${i+1}`,
        score: p.scoreManager.score,
        lines: p.scoreManager.totalLinesCleared,
        alive: !p.isToppedOut
      });
    }
    // Sort by score descending
    playerData.sort((a, b) => b.score - a.score);
    for (const pd of playerData) {
      const row = document.createElement('div');
      row.className = `flex justify-between items-center gap-4 text-sm ${pd.alive ? 'text-white' : 'text-gray-600 line-through'}`;
      row.innerHTML = `
        <span class="font-bold truncate max-w-[100px]">${pd.name}</span>
        <span class="font-pixel text-xs">${Math.round(pd.score)}</span>
      `;
      entries.appendChild(row);
    }
  }

  // Draw Game Over global overlay (only for offline games now)
  if (gameManager.state === GameState.GAME_OVER) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#00E5FF';
    ctx.font = '30px "Press Start 2P"';
    ctx.textAlign = 'center';
    
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '12px "Press Start 2P"';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('PRESS ENTER TO RESTART OR ESC FOR MENU', canvas.width / 2, canvas.height / 2 + 30);
  }
}

window.addEventListener('keydown', (e) => {
  if (gameManager.state === GameState.GAME_OVER) {
    if (e.key === 'Enter') {
      if (gameManager.isOnline) {
        // Handled by UI buttons in POST_GAME state instead
      } else if (gameManager.players.length === 1) {
        gameManager.initSolo(selectedClass);
      } else {
        const botDiff = gameManager.players[1].bot!.difficulty;
        gameManager.init1v1(botDiff, selectedClass);
      }
    } else if (e.key === 'Escape') {
      returnToMenu();
    }
  }
});

function returnToMenu() {
  gameManager.state = GameState.MAIN_MENU;
  gameHud.classList.add('hidden');
  gameHud.classList.remove('flex');

  // Disconnect from server if in online mode
  if (network) {
    network.disconnect();
    network = null;
  }
  myReady = false;
  inRoom = false;

  // Reset menus
  screenDifficulty.classList.add('hidden');
  screenDifficulty.classList.remove('flex');
  screenLobby.classList.remove('flex');
  screenLobby.classList.add('hidden');
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  spectatorBanner.classList.add('hidden');
  preGameOverlay.classList.add('hidden');
  modalConfirmJoin.classList.add('hidden');
  
  lobbyStatus.innerText = '';
  lobbyPlayerList.innerHTML = '';
  btnLobbyReady.classList.add('hidden');
  btnLobbyReady.innerText = 'READY UP';
  btnLobbyLeave.classList.add('hidden');
  btnJoinLobby.removeAttribute('disabled');

  document.getElementById('multiplayer-scoreboard')?.classList.add('hidden');
  screenMain.classList.remove('hidden');
  uiLayer.classList.remove('hidden');
}