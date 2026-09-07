import './style.css'
import { GameManager, GameState } from './GameManager'
import { Player } from './Player'
import { Tetromino } from './Tetromino'
import { NetworkManager, type RoomState, type GameStartData, type RoomMode } from './NetworkManager'
import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass'
import { mountOnlineModeSelect, ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect'

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
function getOrCreateOnlineModeSelectScreen() {
  const existing = document.getElementById('screen-online-mode-select');
  if (existing) return existing;

  // This fallback keeps the game playable when main.ts is updated before
  // modeselect.html. The intended HTML mount still takes precedence.
  const created = document.createElement('div');
  created.id = 'screen-online-mode-select';
  created.className = 'hidden relative z-10 w-full max-w-6xl px-4';
  created.setAttribute('aria-live', 'polite');
  uiLayer.appendChild(created);
  return created;
}
const screenOnlineModeSelect = getOrCreateOnlineModeSelectScreen();

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
const btnHostLobby = document.getElementById('btn-host-lobby')!;
const btnJoinLobby = document.getElementById('btn-join-lobby')!;
const btnLobbyStartNow = document.getElementById('btn-lobby-start-now')!;
const lobbyActionHint = document.getElementById('lobby-action-hint');
const lobbyStartHint = document.getElementById('lobby-start-hint');
const lobbyStatus = document.getElementById('lobby-status')!;
const lobbyPlayerList = document.getElementById('lobby-player-list')!;
const btnLobbyReady = document.getElementById('btn-lobby-ready')!;
const btnLobbyBack = document.getElementById('btn-lobby-back')!;
const lobbyNicknameInput = document.getElementById('lobby-nickname-input') as HTMLInputElement;
const onlineModeLabel = document.getElementById('online-mode-label');
const lobbyModeDescription = document.getElementById('lobby-mode-description');

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
const teamLobbySummary = document.getElementById('team-lobby-summary')!;
const teamLobbyCyan = document.getElementById('team-lobby-cyan')!;
const teamLobbyMagenta = document.getElementById('team-lobby-magenta')!;
const teamMatchStrip = document.getElementById('team-match-strip')!;
const teamScoreCyan = document.getElementById('team-score-cyan')!;
const teamScoreMagenta = document.getElementById('team-score-magenta')!;
const teamMatchTimer = document.getElementById('team-match-timer')!;
const postGameTeamScores = document.getElementById('post-game-team-scores')!;

const hudP2 = document.getElementById('hud-p2')!;

const scoreElementP1 = document.getElementById('score-p1')!;
const levelElementP1 = document.getElementById('level-p1')!;
const comboElementP1 = document.getElementById('combo-p1')!;
const multiplierElementP1 = document.getElementById('multiplier-p1')!;
const holdCanvasP1 = document.getElementById('hold-canvas-p1') as HTMLCanvasElement;
const nextCanvasP1 = document.getElementById('next-canvas-p1') as HTMLCanvasElement;
const nextQueueP1 = document.getElementById('next-queue-p1')!;
const abilityMeterP1 = document.getElementById('ability-meter-p1')!;
const abilityQLabelP1 = document.getElementById('ability-q-label-p1')!;
const abilityQStatusP1 = document.getElementById('ability-q-status-p1')!;
const abilityELabelP1 = document.getElementById('ability-e-label-p1')!;
const abilityEStatusP1 = document.getElementById('ability-e-status-p1')!;
const abilityLabelP1 = document.getElementById('ability-label-p1')!;
const abilityFillP1 = document.getElementById('ability-fill-p1')!;
const abilityReadyP1 = document.getElementById('ability-ready-p1')!;
const abilityRStatusP1 = document.getElementById('ability-r-status-p1')!;

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
let selectedOnlineMode: OnlineModeId = 'classic-pvp';

function getSelectedOnlineMode() {
  return ONLINE_GAME_MODES.find(mode => mode.id === selectedOnlineMode) ?? ONLINE_GAME_MODES[0];
}

function updateOnlineModeLabel() {
  const mode = getSelectedOnlineMode();
  if (onlineModeLabel) {
    onlineModeLabel.innerText = `Selected mode: ${mode.title} · ${mode.format} · ${mode.playerCount} players`;
  }
}

function showOnlineModeSelect() {
  screenMain.classList.add('hidden');
  screenClassSelect.classList.remove('flex');
  screenClassSelect.classList.add('hidden');
  screenDifficulty.classList.remove('flex');
  screenDifficulty.classList.add('hidden');
  screenLobby.classList.remove('flex');
  screenLobby.classList.add('hidden');
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  screenOnlineModeSelect.classList.remove('hidden');
}

mountOnlineModeSelect({
  container: screenOnlineModeSelect,
  initialMode: selectedOnlineMode,
  onConfirm: mode => {
    selectedOnlineMode = mode.id;
    pendingMode = 'ONLINE';
    updateOnlineModeLabel();
    screenOnlineModeSelect.classList.add('hidden');
    screenClassSelect.classList.remove('hidden');
    screenClassSelect.classList.add('flex');
  },
  onBack: () => {
    screenOnlineModeSelect.classList.add('hidden');
    screenMain.classList.remove('hidden');
  },
});

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
      <p class="text-xs text-neonCyan mb-2"><strong>Q · ${info.abilityQName}:</strong> ${info.abilityQDescription}</p>
      <p class="text-xs text-neonYellow mb-2"><strong>E · ${info.abilityEName}:</strong> ${info.abilityEDescription}</p>
      <p class="text-xs text-neonMagenta"><strong>R · ${info.ultimateName} (${info.ultimateCost} lines):</strong> ${info.ultimateDescription}</p>
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
  if (pendingMode === 'ONLINE') {
    showOnlineModeSelect();
  } else {
    screenMain.classList.remove('hidden');
  }
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
let pendingLobbyAction: 'host' | 'join' = 'join';
let currentLobbyHostId: string | null = null;
let hostRequested = false;
let onlinePlayerTeams: Array<'cyan' | 'magenta' | null> = [];
let onlineTeamScores = { cyan: 0, magenta: 0 };
let teamMatchEndsAt: number | null = null;
let teamTimerInterval: number | null = null;
let activeOnlineMode: OnlineModeId = selectedOnlineMode;
let battleRoyalRemainingPlayers = 0;
let battleRoyalPhaseLabel = '';
let battleRoyalStartedAt: number | null = null;
let battleRoyalHud: HTMLElement | null = null;

function ensureBattleRoyalHud() {
  if (battleRoyalHud) return battleRoyalHud;
  const hud = document.createElement('section');
  hud.id = 'battle-royale-hud';
  hud.className = 'hidden fixed top-3 left-1/2 -translate-x-1/2 z-40 min-w-[280px] max-w-[calc(100vw-1.5rem)] bg-black/85 border border-neon-yellow/60 px-4 py-3 text-white shadow-[0_0_24px_rgba(255,193,7,.18)] backdrop-blur';
  hud.innerHTML = '<div class="flex items-center justify-between gap-4"><strong class="text-neon-yellow text-xs font-pixel tracking-widest">BATTLE ROYALE</strong><span id="br-remaining" class="font-pixel text-sm">40 LEFT</span></div><div id="br-phase" class="mt-1 text-[10px] uppercase tracking-widest text-gray-300">Opening battle</div><div class="mt-2 h-1 bg-gray-800"><div id="br-progress" class="h-full bg-neon-yellow transition-all" style="width:0%"></div></div><div id="br-kills" class="mt-2 text-[10px] uppercase tracking-widest text-neon-cyan">0 ELIMINATIONS · TARGET 2,000,000</div>';
  document.body.appendChild(hud);
  battleRoyalHud = hud;
  return hud;
}

function updateBattleRoyalHud() {
  const hud = ensureBattleRoyalHud();
  const remaining = hud.querySelector('#br-remaining');
  const phase = hud.querySelector('#br-phase');
  const progress = hud.querySelector('#br-progress') as HTMLElement | null;
  const kills = hud.querySelector('#br-kills');
  if (remaining) remaining.textContent = `${battleRoyalRemainingPlayers || 40} LEFT`;
  if (phase) phase.textContent = battleRoyalPhaseLabel || 'Opening battle';
  if (progress) progress.style.width = `${Math.min(100, Math.max(0, ((Date.now() - (battleRoyalStartedAt || Date.now())) / (10 * 60 * 1000)) * 100))}%`;
  const localKills = gameManager.players[gameManager.myPlayerIndex]?.kills || gameManager.battleRoyalKills;
  if (kills) kills.textContent = `${localKills} ELIMINATIONS · TARGET 2,000,000`;
  hud.classList.toggle('hidden', activeOnlineMode !== 'battle-royale' || gameManager.state !== GameState.PLAYING);
}

function formatTeamTimer() {
  if (!teamMatchEndsAt) return '3:00';
  const seconds = Math.max(0, Math.ceil((teamMatchEndsAt - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function updateTeamScoreHud() {
  teamScoreCyan.innerText = `${Math.round(onlineTeamScores.cyan)}`;
  teamScoreMagenta.innerText = `${Math.round(onlineTeamScores.magenta)}`;
  teamMatchTimer.innerText = formatTeamTimer();
}

btnPlayOnline.addEventListener('click', () => {
  pendingMode = 'ONLINE';
  showOnlineModeSelect();
});

btnLobbyBack.addEventListener('click', () => {
  // If we are connected, keep the lobby session active! Don't disconnect.
  showOnlineModeSelect();
});

btnLobbyLeave.addEventListener('click', () => {
  network?.leaveLobby();
  returnToMenu();
});

btnConfirmJoinYes.addEventListener('click', () => {
  modalConfirmJoin.classList.add('hidden');
  const nickname = lobbyNicknameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
  network?.confirmJoin(pendingJoinRoomId, nickname, selectedOnlineMode);
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

btnHostLobby.addEventListener('click', () => {
  hostRequested = true;
  pendingLobbyAction = 'host';
  btnJoinLobby.click();
});

btnJoinLobby.addEventListener('click', () => {
  if (!hostRequested) pendingLobbyAction = 'join';
  hostRequested = false;
  const roomId = lobbyRoomInput.value.trim() || 'test-room';

  if (!network) {
    network = new NetworkManager();

    network.onConnected = () => {
      lobbyStatus.innerText = pendingLobbyAction === 'host' ? 'Connected. Creating room...' : 'Connected. Joining room...';
      const nickname = lobbyNicknameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
      if (pendingLobbyAction === 'host') network!.hostRoom(roomId, nickname, selectedOnlineMode);
      else network!.joinRoom(roomId, nickname, selectedOnlineMode);
    };

    network.onJoinError = (message: string) => {
      lobbyStatus.innerText = `Error: ${message}`;
      btnHostLobby.removeAttribute('disabled');
      btnJoinLobby.removeAttribute('disabled');
      hostRequested = false;
    };

    network.onRoomUpdate = (state: RoomState) => {
      inRoom = true;
      activeOnlineMode = state.mode.id;
      selectedOnlineMode = state.mode.id;
      onlineTeamScores = state.teamScores || onlineTeamScores;
        currentLobbyHostId = state.hostId;
      const isHost = currentLobbyHostId === network?.mySocketId;
      btnLobbyStartNow.classList.toggle('hidden', !isHost || state.phase !== 'lobby');
      btnHostLobby.classList.toggle('hidden', inRoom);
      btnJoinLobby.classList.toggle('hidden', inRoom);
      if (lobbyStartHint) lobbyStartHint.innerText = isHost
        ? `You are hosting ${state.mode.title}. Start with the current roster or wait for the full ${state.capacity}-player room.`
        : `Waiting for the host. This room currently has ${state.players.length}/${state.capacity} players.`;
      if (onlineModeLabel) {
        onlineModeLabel.innerText = `${state.mode.title} · ${state.mode.format} · ${state.mode.winnerRule}`;
      }
      if (lobbyModeDescription) {
        lobbyModeDescription.innerText = state.mode.isTeamMode
          ? 'Cyan Circuit versus Magenta Voltage. Highest combined score wins at the horn.'
          : state.mode.winnerRule;
      }
      
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

    network.onRoomHostChanged = ({ hostId }) => {
      currentLobbyHostId = hostId;
      const isHost = currentLobbyHostId === network?.mySocketId;
      btnLobbyStartNow.classList.toggle('hidden', !isHost);
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
      
      if (data.winnerTeam) {
        postGameWinner.innerText = `${data.winnerName} WINS`;
        postGameTeamScores.innerHTML = `<span class="text-neon-cyan">CYAN ${Math.round(data.teamScores.cyan)}</span> <span class="text-gray-500">—</span> <span class="text-neon-pink">MAGENTA ${Math.round(data.teamScores.magenta)}</span>`;
      } else {
        const isDraw = data.winnerName.startsWith('Draw');
        postGameWinner.innerText = isDraw ? 'MATCH DRAW' : `${data.winnerName} WINS`;
        postGameTeamScores.innerText = `${getSelectedOnlineMode().title} · ${getSelectedOnlineMode().winCondition}`;
      }
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
      activeOnlineMode = data.modeId;
      battleRoyalRemainingPlayers = data.modeId === 'battle-royale' ? data.players.length : 0;
      battleRoyalPhaseLabel = data.modeId === 'battle-royale' ? 'Opening battle' : '';
      battleRoyalStartedAt = null;
      updateBattleRoyalHud();
      selectedOnlineMode = data.modeId;
      onlinePlayerTeams = data.players.map(player => player.team);
      onlineTeamScores = data.teamScores;
      startOnlineGame(data.players.length, data.myIndex, data.players.map(p => p.name), data.mode);
    };

    network.onBattleRoyalPhase = (data) => {
      battleRoyalPhaseLabel = data.label;
      battleRoyalRemainingPlayers = data.remainingPlayers;
      if (!battleRoyalStartedAt) battleRoyalStartedAt = Date.now();
      updateBattleRoyalHud();
    };
    network.onBattleRoyalCull = (data) => {
      battleRoyalRemainingPlayers = data.remainingPlayers;
      battleRoyalPhaseLabel = data.reason === 'score-cull'
        ? 'Culling lowest score · tie-break lines, kills'
        : data.reason === 'line-cull'
          ? 'Culling lowest line count · tie-break score, kills'
          : 'Culling lowest kills · tie-break lines, score';
      updateBattleRoyalHud();
    };
    network.onBattleRoyalSuddenDeath = (data) => {
      battleRoyalRemainingPlayers = data.remainingPlayers;
      battleRoyalPhaseLabel = 'Sudden death · solid garbage incoming';
      updateBattleRoyalHud();
    };
    network.onBattleRoyalPostGame = (data) => {
      const rankingText = data.rankings.slice(0, 10).map(entry => `${entry.rank}. ${entry.name} · ${Math.round(entry.score).toLocaleString()} pts · ${entry.lines} lines · ${entry.kills} kills`).join('<br>');
      postGameTeamScores.innerHTML = `<div class="text-neon-yellow mb-2">TARGET ${data.targetScore.toLocaleString()} · ${data.reason}</div><div class="text-left text-xs leading-5">${rankingText}</div>`;
    };
    network.onTeamScoreUpdate = (data) => {
      onlineTeamScores = data.teamScores;
      updateTeamScoreHud();
    };

    network.onMatchTimerStart = (data) => {
      teamMatchEndsAt = data.endsAt;
      if (teamTimerInterval) clearInterval(teamTimerInterval);
      teamTimerInterval = window.setInterval(updateTeamScoreHud, 250);
      updateTeamScoreHud();
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
    if (pendingLobbyAction === 'host') network.hostRoom(roomId, nickname, selectedOnlineMode);
    else network.joinRoom(roomId, nickname, selectedOnlineMode);
  }

  lobbyStatus.innerText = pendingLobbyAction === 'host' ? 'Creating lobby...' : 'Joining lobby...';
  btnHostLobby.setAttribute('disabled', 'true');
  btnJoinLobby.setAttribute('disabled', 'true');
});

btnLobbyStartNow.addEventListener('click', () => {
  network?.startLobbyNow();
  btnLobbyStartNow.setAttribute('disabled', 'true');
  lobbyStatus.innerText = 'Host started the match countdown...';
});

btnLobbyReady.addEventListener('click', () => {
  myReady = !myReady;
  network?.setReady(myReady);
  btnLobbyReady.innerText = myReady ? 'READY! (click to cancel)' : 'READY UP';
});

function renderLobbyPlayers(state: RoomState) {
  lobbyStatus.innerText = `${state.mode.title} · ${state.mode.format} — ${state.players.length}/${state.capacity} players. ${state.mode.winnerRule}.`;
  if (lobbyActionHint) lobbyActionHint.innerText = state.mode.id === 'battle-royale'
    ? 'Host a 40-player Battle Royale room or join one with the same room code. The host can start before all seats are filled.'
    : `Host a ${state.mode.title} room or join an existing ${state.mode.title} room. The host can start before the room reaches ${state.capacity} players.`;
  btnHostLobby.removeAttribute('disabled');
  btnJoinLobby.removeAttribute('disabled');

  if (inRoom) {
    btnLobbyReady.classList.remove('hidden');
    btnLobbyLeave.classList.remove('hidden');
  }

  lobbyPlayerList.innerHTML = '';
  if (state.mode.id === 'battle-royale') {
    teamLobbySummary.classList.add('hidden');
    lobbyPlayerList.className = 'w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-8 max-h-[46vh] overflow-y-auto pr-1';
    const title = document.createElement('div');
    title.className = 'sm:col-span-2 lg:col-span-4 text-[10px] font-bold tracking-[0.22em] uppercase px-3 py-3 text-neon-yellow bg-neon-yellow/5 border border-neon-yellow/20';
    title.innerText = `BATTLE ROYALE · ${state.players.length}/${state.capacity} PLAYERS · HOST MAY START EARLY`;
    lobbyPlayerList.appendChild(title);
    for (let slot = 0; slot < state.capacity; slot++) {
      const player = state.players[slot];
      const row = document.createElement('div');
      row.className = 'flex min-w-0 items-center justify-between gap-2 border border-card-border bg-card-bg/70 px-3 py-2 text-xs';
      if (!player) {
        row.innerHTML = `<span class="text-gray-600 font-bold">OPEN ${String(slot + 1).padStart(2, '0')}</span><span class="text-gray-600 uppercase tracking-widest text-[9px]">Waiting</span>`;
      } else {
        const isMe = network && player.id === network.mySocketId;
        const isHost = state.hostId === player.id;
        row.innerHTML = `<span class="truncate font-bold ${isMe ? 'text-neon-cyan' : 'text-white'}">${slot + 1}. ${player.name}${isMe ? ' (you)' : ''}</span><span class="shrink-0 text-[9px] uppercase tracking-widest ${isHost ? 'text-neon-pink' : player.ready ? 'text-neon-cyan' : 'text-gray-500'}">${isHost ? 'Host' : player.ready ? 'Ready' : 'Waiting'}</span>`;
      }
      lobbyPlayerList.appendChild(row);
    }
    return;
  }
  lobbyPlayerList.className = 'w-full flex flex-col gap-2 mb-8';
  if (!state.mode.isTeamMode) {
    teamLobbySummary.classList.add('hidden');
    const title = document.createElement('div');
    title.className = 'text-[10px] font-bold tracking-[0.22em] uppercase px-3 py-2 text-neon-cyan bg-neon-cyan/5';
    title.innerText = `${state.mode.title} · ${state.capacity} seats`;
    lobbyPlayerList.appendChild(title);

    for (let slot = 0; slot < state.capacity; slot++) {
      const player = state.players[slot];
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center bg-bgPanel border border-bgPanelBorder px-4 py-3';
      if (!player) {
        row.innerHTML = `<span class="text-gray-600 font-bold">OPEN SLOT ${slot + 1}</span><span class="text-gray-600 text-xs uppercase tracking-widest">Waiting</span>`;
      } else {
        const isMe = network && player.id === network.mySocketId;
        const isHost = state.hostId === player.id;
        row.innerHTML = `<span class="font-bold">${player.name}${isMe ? ' (you)' : ''}${isHost ? ' · HOST' : ''}</span><span class="${player.ready ? 'text-neonCyan' : 'text-gray-500'} text-xs font-bold uppercase tracking-widest">${player.ready ? '✓ Ready' : 'Not Ready'}</span>`;
      }
      lobbyPlayerList.appendChild(row);
    }
    return;
  }

  teamLobbySummary.classList.remove('hidden');
  const cyanPlayers = state.players.filter(player => player.team === 'cyan');
  const magentaPlayers = state.players.filter(player => player.team === 'magenta');
  teamLobbyCyan.innerText = `${cyanPlayers.length}/${state.teamSize}`;
  teamLobbyMagenta.innerText = `${magentaPlayers.length}/${state.teamSize}`;
  for (const team of ['cyan', 'magenta'] as const) {
    const title = document.createElement('div');
    title.className = `text-[10px] font-bold tracking-[0.22em] uppercase px-3 py-2 ${team === 'cyan' ? 'text-neon-cyan bg-neon-cyan/5' : 'text-neon-pink bg-neon-pink/5'}`;
    title.innerText = team === 'cyan' ? 'Cyan Circuit · 3 seats' : 'Magenta Voltage · 3 seats';
    lobbyPlayerList.appendChild(title);

    const teamPlayers = state.players.filter(player => player.team === team);
    for (let slot = 0; slot < (state.teamSize || 3); slot++) {
      const player = teamPlayers[slot];
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center bg-bgPanel border border-bgPanelBorder px-4 py-3';
      if (!player) {
        row.innerHTML = `<span class="text-gray-600 font-bold">OPEN SLOT ${slot + 1}</span><span class="text-gray-600 text-xs uppercase tracking-widest">Waiting</span>`;
      } else {
        const isMe = network && player.id === network.mySocketId;
        row.innerHTML = `<span class="font-bold">${player.name}${isMe ? ' (you)' : ''}</span><span class="${player.ready ? (team === 'cyan' ? 'text-neonCyan' : 'text-neon-pink') : 'text-gray-500'} text-xs font-bold uppercase tracking-widest">${player.ready ? '✓ Ready' : 'Not Ready'}</span>`;
      }
      lobbyPlayerList.appendChild(row);
    }
  }
}

/**
 * Start an online multiplayer game.
 * Called when the server emits 'game-start'.
 */
let onlinePlayerNames: string[] = [];

function startOnlineGame(playerCount: number, myIndex: number, playerNames?: string[], mode?: RoomMode) {
  if (playerNames) {
    onlinePlayerNames = playerNames;
  }
  // Hide lobby, show game
  uiLayer.classList.add('hidden');
  gameHud.classList.remove('hidden');
  gameHud.classList.add('flex');
  spectatorBanner.classList.add('hidden');
  if (mode?.isTeamMode) {
    teamMatchStrip.classList.remove('hidden');
    updateTeamScoreHud();
  } else {
    teamMatchStrip.classList.add('hidden');
  }
  if (mode?.id === 'battle-royale') {
    ensureBattleRoyalHud();
    battleRoyalPhaseLabel = 'Opening battle';
    battleRoyalRemainingPlayers = playerCount;
    updateBattleRoyalHud();
  } else if (battleRoyalHud) {
    battleRoyalHud.classList.add('hidden');
  }

  // Size the canvas for the number of players; CSS constrains the visual width
  // on smaller screens so the left skill HUD remains reachable in 4- and 6-board modes.
  canvas.width = (COLS * BLOCK_SIZE * playerCount) + (PADDING * (playerCount - 1));
  canvas.height = ROWS * BLOCK_SIZE;
  canvas.style.maxWidth = playerCount >= 4 ? '58vw' : 'min(58vw, 600px)';

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
  teamMatchStrip.classList.add('hidden');
  
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

function getSpecialBlockLetter(special: string): string {
  switch (special) {
    case 'BOMB': return 'B';
    case 'HEAVY': return 'W';
    case 'MULTIPLIER': return 'X';
    case 'SPEED': return 'V';
    case 'SHIELD': return 'S';
    case 'FREEZE': return 'F';
    case 'GARBAGE_EATER': return 'G';
    default: return '?';
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
    
    const icon = getSpecialBlockLetter(isSpecial);

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
        const specialKey = `${r},${c}`;
        const specialType = piece.specialBlocks.get(specialKey);

        tCtx.fillStyle = '#000000';
        tCtx.fillRect(fx, fy, MINI_BLOCK_SIZE, MINI_BLOCK_SIZE);
        tCtx.strokeStyle = color;
        tCtx.lineWidth = 2;
        tCtx.strokeRect(fx+1, fy+1, MINI_BLOCK_SIZE-2, MINI_BLOCK_SIZE-2);

        if (specialType) {
          // Draw the special block letter indicator
          tCtx.fillStyle = color;
          tCtx.font = 'bold 12px "Press Start 2P"';
          tCtx.textAlign = 'center';
          tCtx.textBaseline = 'middle';
          tCtx.fillText(getSpecialBlockLetter(specialType), fx + MINI_BLOCK_SIZE / 2, fy + MINI_BLOCK_SIZE / 2);
        } else {
          tCtx.fillStyle = color;
          tCtx.fillRect(fx+4, fy+4, MINI_BLOCK_SIZE-8, MINI_BLOCK_SIZE-8);
        }
      }
    }
  }
}

// Assign colors per player index for multiplayer
const PLAYER_COLORS = ['#00E5FF', '#40C4FF', '#80DEEA', '#FF007F', '#FF4081', '#FF80AB'];

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
    nextQueueP1.innerText = p1.bag.getPreview(5).join(' · ');

    const classInfo1 = PLAYER_CLASSES.find((c) => c.id === p1.playerClass);
    abilityMeterP1.classList.remove('hidden');
    if (classInfo1) {
      const qCooldown = Math.max(0, p1.abilityCooldowns.Q);
      const eCooldown = Math.max(0, p1.abilityCooldowns.E);
      const qStatus = qCooldown > 0 ? `${(qCooldown / 1000).toFixed(1)}s` : 'READY';
      const eStatus = eCooldown > 0 ? `${(eCooldown / 1000).toFixed(1)}s` : 'READY';
      const activeSuffix = p1.activeEffectTimer > 0 ? ` · ${p1.activeEffectType} ${Math.ceil(p1.activeEffectTimer / 1000)}s` : '';
      const targetName = p1.selectedTargetIndex === null ? 'default target' : (onlinePlayerNames[p1.selectedTargetIndex] ?? `P${p1.selectedTargetIndex + 1}`);
      abilityQLabelP1.innerText = classInfo1.abilityQName.toUpperCase();
      abilityQStatusP1.innerText = qStatus;
      abilityQStatusP1.className = `text-[9px] font-bold ${qCooldown > 0 ? 'text-gray-500' : 'text-neon-cyan'}`;
      abilityELabelP1.innerText = classInfo1.abilityEName.toUpperCase();
      abilityEStatusP1.innerText = eStatus;
      abilityEStatusP1.className = `text-[9px] font-bold ${eCooldown > 0 ? 'text-gray-500' : 'text-neon-yellow'}`;
      abilityLabelP1.innerText = classInfo1.ultimateName.toUpperCase();
      abilityRStatusP1.innerText = `${Math.round(p1.classMeter)}/${classInfo1.ultimateCost} LINES · TAB: ${targetName}${activeSuffix}`;
      abilityFillP1.style.width = `${Math.min(100, (p1.classMeter / classInfo1.ultimateCost) * 100)}%`;
      abilityReadyP1.classList.toggle('hidden', p1.classMeter < classInfo1.ultimateCost);
    }
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
      abilityLabelP2.innerText = `R: ${classInfo2.ultimateName.toUpperCase()} ${p2.classMeter}/${classInfo2.ultimateCost}`;
      abilityFillP2.style.width = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
    }
  }

  // Update multiplayer scoreboard
  if (gameManager.isOnline && onlinePlayerNames.length > 0) {
    const scoreboard = document.getElementById('multiplayer-scoreboard')!;
    const entries = document.getElementById('scoreboard-entries')!;
    scoreboard.classList.remove('hidden');
    
    entries.innerHTML = '';
    const playerData: {name: string, score: number, lines: number, kills: number, alive: boolean, team: 'cyan' | 'magenta' | null}[] = [];
    for (let i = 0; i < gameManager.players.length; i++) {
      const p = gameManager.players[i];
      playerData.push({
        name: onlinePlayerNames[i] || `Player ${i+1}`,
        score: p.scoreManager.score,
        lines: p.scoreManager.totalLinesCleared,
        kills: p.kills,
        alive: !p.isToppedOut,
        team: onlinePlayerTeams[i] ?? null
      });
    }
    if (activeOnlineMode === 'battle-royale') {
      for (const player of playerData.sort((a, b) => b.score - a.score || b.lines - a.lines || b.kills - a.kills)) {
        const row = document.createElement('div');
        row.className = `flex justify-between items-center gap-4 text-sm ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`;
        row.innerHTML = `<span class="font-bold truncate max-w-[160px]">${player.name} <small class="text-gray-400">${player.lines}L · ${player.kills}K</small></span><span class="font-pixel text-xs">${Math.round(player.score).toLocaleString()}</span>`;
        entries.appendChild(row);
      }
      updateBattleRoyalHud();
      return;
    }
    if (activeOnlineMode !== 'team-deathmatch') {
      for (const player of playerData.sort((a, b) => b.score - a.score)) {
        const row = document.createElement('div');
        row.className = `flex justify-between items-center gap-4 text-sm ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`;
        row.innerHTML = `<span class="font-bold truncate max-w-[100px]">${player.name}</span><span class="font-pixel text-xs">${Math.round(player.score)}</span>`;
        entries.appendChild(row);
      }
      return;
    }
    for (const team of ['cyan', 'magenta'] as const) {
      const heading = document.createElement('div');
      heading.className = `flex justify-between items-center pt-2 text-[10px] font-pixel ${team === 'cyan' ? 'text-neonCyan' : 'text-neon-pink'}`;
      heading.innerHTML = `<span>${team === 'cyan' ? 'CYAN' : 'MAGENTA'}</span><span>${Math.round(onlineTeamScores[team])}</span>`;
      entries.appendChild(heading);
      for (const player of playerData.filter(item => item.team === team).sort((a, b) => b.score - a.score)) {
        const row = document.createElement('div');
        row.className = `flex justify-between items-center gap-4 text-sm ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`;
        row.innerHTML = `<span class="font-bold truncate max-w-[100px]">${player.name}</span><span class="font-pixel text-xs">${Math.round(player.score)}</span>`;
        entries.appendChild(row);
      }
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
  onlinePlayerTeams = [];
  activeOnlineMode = selectedOnlineMode;
  onlineTeamScores = { cyan: 0, magenta: 0 };
  teamMatchEndsAt = null;
  if (teamTimerInterval) clearInterval(teamTimerInterval);
  teamTimerInterval = null;

  // Reset menus
  screenDifficulty.classList.add('hidden');
  screenDifficulty.classList.remove('flex');
  screenLobby.classList.remove('flex');
  screenLobby.classList.add('hidden');
  screenPostGame.classList.remove('flex');
  screenPostGame.classList.add('hidden');
  screenOnlineModeSelect.classList.add('hidden');
  spectatorBanner.classList.add('hidden');
  preGameOverlay.classList.add('hidden');
  modalConfirmJoin.classList.add('hidden');
  
  lobbyStatus.innerText = '';
  if (onlineModeLabel) onlineModeLabel.innerText = '';
  if (lobbyModeDescription) lobbyModeDescription.innerText = 'Choose a mode to create a room';
  lobbyPlayerList.innerHTML = '';
  btnLobbyReady.classList.add('hidden');
  btnLobbyReady.innerText = 'READY UP';
  btnLobbyLeave.classList.add('hidden');
  btnLobbyStartNow.classList.add('hidden');
  btnLobbyStartNow.removeAttribute('disabled');
  btnHostLobby.classList.remove('hidden');
  btnJoinLobby.classList.remove('hidden');
  btnHostLobby.removeAttribute('disabled');
  btnJoinLobby.removeAttribute('disabled');
  teamLobbySummary.classList.add('hidden');
  teamMatchStrip.classList.add('hidden');
  btnJoinLobby.removeAttribute('disabled');

  document.getElementById('multiplayer-scoreboard')?.classList.add('hidden');
  screenMain.classList.remove('hidden');
  uiLayer.classList.remove('hidden');
}
