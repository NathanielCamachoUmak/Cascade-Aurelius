/**
 * Self-contained lobby screen component for Cascade.
 *
 * Follows the same mountable-component pattern as OnlineModeSelect.ts.
 * Owns: lobby DOM elements, lobby state, NetworkManager creation,
 *       lobby-specific network callbacks, player roster rendering.
 * Exposes: controller interface so main.ts can show/hide/reset and
 *          wire game-specific callbacks onto the network instance.
 *
 *   import { mountLobbyScreen } from './LobbyScreen';
 *
 *   const lobby = mountLobbyScreen({
 *     onBack: () => showOnlineModeSelect(),
 *     onLeaveToMenu: () => returnToMenu(),
 *     getSelectedMode: () => selectedOnlineMode,
 *     onNetworkReady: (net) => wireGameCallbacks(net),
 *   });
 */

import { NetworkManager, type RoomState } from './NetworkManager';
import { ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect';
import { GameState } from './GameManager';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LobbyScreenOptions {
  /** Called when user clicks BACK from lobby (return to mode select) */
  onBack: () => void;
  /** Called when user clicks LEAVE LOBBY (full disconnect + return to menu) */
  onLeaveToMenu: () => void;
  /** Returns the currently selected online mode ID */
  getSelectedMode: () => OnlineModeId;
  /**
   * Called when a NetworkManager is created so main.ts can wire
   * game-specific callbacks (onGameStart, onPreGameCountdown, etc.).
   */
  onNetworkReady: (network: NetworkManager) => void;
  /**
   * Optional: query current game state to detect post-game → lobby transition.
   * Return GameState.POST_GAME when appropriate.
   */
  getGameState?: () => GameState;
  /** Optional: elements outside the lobby that need visibility toggling */
  externalScreens?: {
    screenPostGame?: HTMLElement;
  };
}

export interface LobbyScreenController {
  /** Show the lobby screen */
  show(): void;
  /** Hide the lobby screen */
  hide(): void;
  /** Full reset: disconnect network, clear all lobby DOM, reset state */
  reset(): void;
  /** Whether the player is currently in a room */
  readonly inRoom: boolean;
  /** The active NetworkManager instance, if connected */
  readonly network: NetworkManager | null;
  /** The active online mode of the current room */
  readonly activeMode: OnlineModeId;
  /** Current selected mode (may differ from active if not yet joined) */
  selectedMode: OnlineModeId;
  /** The lobby screen container element */
  readonly container: HTMLElement;
  /** Team scores tracked by lobby */
  readonly teamScores: { cyan: number; magenta: number };
  /** Current host ID */
  readonly hostId: string | null;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function mountLobbyScreen(options: LobbyScreenOptions): LobbyScreenController {
  // --- DOM lookups ---
  const screenLobby = document.getElementById('screen-lobby')!;
  const lobbyRoomInput = document.getElementById('lobby-room-input') as HTMLInputElement;
  const btnHostLobby = document.getElementById('btn-host-lobby')!;
  const btnJoinLobby = document.getElementById('btn-join-lobby')!;
  const btnLobbyStartNow = document.getElementById('btn-lobby-start-now')!;
  const lobbyActionHint = document.getElementById('lobby-action-hint');
  const lobbyStartHint = document.getElementById('lobby-start-hint');
  const lobbyStatus = document.getElementById('lobby-status')!;
  const lobbyPlayerList = document.getElementById('lobby-player-list')!;
  const btnLobbyReady = document.getElementById('btn-lobby-ready')!;
  const btnLobbySwitchTeam = document.getElementById('btn-lobby-switch-team')!;
  const btnLobbyBack = document.getElementById('btn-lobby-back')!;
  const lobbyNicknameInput = document.getElementById('lobby-nickname-input') as HTMLInputElement;
  const onlineModeLabel = document.getElementById('online-mode-label');
  const lobbyModeDescription = document.getElementById('lobby-mode-description');
  const btnLobbyLeave = document.getElementById('btn-lobby-leave')!;
  const lobbyCountdown = document.getElementById('lobby-countdown')!;
  const modalConfirmJoin = document.getElementById('modal-confirm-join')!;
  const btnConfirmJoinYes = document.getElementById('btn-confirm-join-yes')!;
  const btnConfirmJoinNo = document.getElementById('btn-confirm-join-no')!;
  const teamLobbySummary = document.getElementById('team-lobby-summary')!;
  const teamLobbyCyan = document.getElementById('team-lobby-cyan')!;
  const teamLobbyMagenta = document.getElementById('team-lobby-magenta')!;

  // --- Internal state ---
  let network: NetworkManager | null = null;
  let myReady = false;
  let inRoom = false;
  let pendingJoinRoomId = '';
  let pendingLobbyAction: 'host' | 'join' = 'join';
  let currentLobbyHostId: string | null = null;
  let hostRequested = false;
  let selectedOnlineMode: OnlineModeId = options.getSelectedMode();
  let activeOnlineMode: OnlineModeId = selectedOnlineMode;
  let onlineTeamScores = { cyan: 0, magenta: 0 };

  // --- Helpers ---

  function getSelectedOnlineModeInfo() {
    return ONLINE_GAME_MODES.find(m => m.id === selectedOnlineMode) ?? ONLINE_GAME_MODES[0];
  }

  function updateOnlineModeLabel() {
    const mode = getSelectedOnlineModeInfo();
    if (onlineModeLabel) {
      onlineModeLabel.innerText = `Selected mode: ${mode.title} · ${mode.format} · ${mode.playerCount} players`;
    }
  }

  // --- Player list rendering ---

  function renderLobbyPlayers(state: RoomState) {
    lobbyStatus.innerText = `${state.mode.title} · ${state.mode.format} — ${state.players.length}/${state.capacity} players. ${state.mode.winnerRule}.`;
    if (lobbyActionHint) lobbyActionHint.innerText = state.mode.id === 'battle-royale'
      ? 'Host a 30-player Battle Royale room or join one with the same room code. The host can start before all seats are filled.'
      : `Host a ${state.mode.title} room or join an existing ${state.mode.title} room. The host can start before the room reaches ${state.capacity} players.`;
    btnHostLobby.removeAttribute('disabled');
    btnJoinLobby.removeAttribute('disabled');

    if (inRoom) {
      btnLobbyReady.classList.remove('hidden');
      btnLobbyLeave.classList.remove('hidden');
      btnLobbySwitchTeam.classList.remove('hidden');
    }
    

    lobbyPlayerList.innerHTML = '';

    // --- Battle Royale ---
    if (state.mode.id === 'battle-royale') {
      teamLobbySummary.classList.add('hidden');
      lobbyPlayerList.className = 'w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 mb-4 max-h-[40vh] overflow-y-auto pr-1';
      const title = document.createElement('div');
      title.className = 'sm:col-span-3 lg:col-span-5 text-[10px] font-bold tracking-[0.22em] uppercase px-3 py-3 text-neon-yellow bg-neon-yellow/5 border border-neon-yellow/20';
      title.innerText = `BATTLE ROYALE · ${state.players.length}/${state.capacity} PLAYERS · HOST MAY START EARLY`;
      lobbyPlayerList.appendChild(title);
      // Show everyone present plus a few open slots for context
      const slotsToShow = Math.min(state.capacity, Math.max(state.players.length + 2, 8));
      for (let slot = 0; slot < slotsToShow; slot++) {
        const player = state.players[slot];
        const row = document.createElement('div');
        row.className = 'flex min-w-0 items-center justify-between gap-1 border border-card-border bg-card-bg/70 px-2 py-1 text-[10px]';
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

    // --- Standard (1v1 / FFA) ---
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
          const isBot = player.isBot;
          const isHostViewing = state.hostId === network?.mySocketId;
          
          let nameHtml = `<span class="font-bold">${player.name}${isBot ? ' [BOT]' : ''}${isMe ? ' (you)' : ''}${isHost ? ' · HOST' : ''}</span>`;
          let statusHtml = `<span class="${player.ready ? 'text-neonCyan' : 'text-gray-500'} text-xs font-bold uppercase tracking-widest">${player.ready ? '✓ Ready' : 'Not Ready'}</span>`;
          
          if (isBot && isHostViewing) {
            statusHtml += `<button data-bot-id="${player.id}" class="btn-kick-bot ml-4 text-neon-pink hover:text-white transition-colors uppercase text-[10px]">Kick</button>`;
          }
          row.innerHTML = `${nameHtml}<div class="flex items-center">${statusHtml}</div>`;
        }
        lobbyPlayerList.appendChild(row);
      }
    } else {
      // --- Team Deathmatch (3v3) ---
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
            const isBot = player.isBot;
            const isHostViewing = state.hostId === network?.mySocketId;
            
            let nameHtml = `<span class="font-bold">${player.name}${isBot ? ' [BOT]' : ''}${isMe ? ' (you)' : ''}</span>`;
            let statusHtml = `<span class="${player.ready ? (team === 'cyan' ? 'text-neonCyan' : 'text-neon-pink') : 'text-gray-500'} text-xs font-bold uppercase tracking-widest">${player.ready ? '✓ Ready' : 'Not Ready'}</span>`;
            
            if (isBot && isHostViewing) {
              statusHtml += `<button data-bot-id="${player.id}" class="btn-kick-bot ml-4 text-neon-pink hover:text-white transition-colors uppercase text-[10px]">Kick</button>`;
            }
            row.innerHTML = `${nameHtml}<div class="flex items-center">${statusHtml}</div>`;
          }
          lobbyPlayerList.appendChild(row);
        }
      }
    }
    
    // Wire kick bot buttons
    document.querySelectorAll('.btn-kick-bot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const botId = (e.target as HTMLElement).getAttribute('data-bot-id');
        if (botId && network) network.removeBot(botId);
      });
    });
  }

  // --- Network setup (called lazily on first host/join) ---

  function ensureNetwork(): NetworkManager {
    if (network) return network;

    network = new NetworkManager();

    // -- Lobby-specific callbacks --

    network.onConnected = () => {
      lobbyStatus.innerText = pendingLobbyAction === 'host' ? 'Connected. Creating room...' : 'Connected. Joining room...';
      const nickname = lobbyNicknameInput.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
      const roomId = lobbyRoomInput.value.trim() || 'test-room';
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
      const btnLobbyAddBot = document.getElementById('btn-lobby-add-bot');
      if (btnLobbyAddBot) {
        const canAddBot = isHost && state.phase === 'lobby' && state.players.length < state.capacity;
        btnLobbyAddBot.classList.toggle('hidden', !canAddBot);
      }
      if (isHost && state.phase === 'lobby') btnLobbyStartNow.removeAttribute('disabled');
      btnHostLobby.classList.toggle('hidden', inRoom);
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
      btnLobbySwitchTeam.addEventListener('click', () => {
      network?.switchTeam();
      myReady = false;
      btnLobbyReady.innerText = 'READY UP';
      });        
      if (me?.team) {
      btnLobbySwitchTeam.innerText = me.team === 'cyan' ? 'SWITCH TO MAGENTA' : 'SWITCH TO CYAN';
      }
      // If we came from post-game, make sure we go back to lobby UI
      if (options.getGameState?.() === GameState.POST_GAME) {
        const screenPostGame = options.externalScreens?.screenPostGame;
        if (screenPostGame) {
          screenPostGame.classList.remove('flex');
          screenPostGame.classList.add('hidden');
        }
        screenLobby.classList.remove('hidden');
        screenLobby.classList.add('flex');
      }

      renderLobbyPlayers(state);
    };

    network.onRoomHostChanged = ({ hostId }) => {
      currentLobbyHostId = hostId;
      const isHost = currentLobbyHostId === network?.mySocketId;
      btnLobbyStartNow.classList.toggle('hidden', !isHost);
      if (isHost) btnLobbyStartNow.removeAttribute('disabled');
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
      if (currentLobbyHostId === network?.mySocketId) btnLobbyStartNow.removeAttribute('disabled');
    };

    // Let main.ts wire game-specific callbacks
    options.onNetworkReady(network);

    return network;
  }

  // --- Button event listeners ---

  btnHostLobby.addEventListener('click', () => {
    hostRequested = true;
    pendingLobbyAction = 'host';
    btnJoinLobby.click();
  });

  btnJoinLobby.addEventListener('click', () => {
    if (!hostRequested) pendingLobbyAction = 'join';
    hostRequested = false;
    selectedOnlineMode = options.getSelectedMode();
    const roomId = lobbyRoomInput.value.trim() || 'test-room';

    if (!network) {
      ensureNetwork();
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

  const btnLobbyAddBot = document.getElementById('btn-lobby-add-bot')!;
  btnLobbyAddBot.addEventListener('click', () => {
    network?.addBot();
  });

  btnLobbyReady.addEventListener('click', () => {
    myReady = !myReady;
    network?.setReady(myReady);
    btnLobbyReady.innerText = myReady ? 'READY! (click to cancel)' : 'READY UP';
  });

  btnLobbyBack.addEventListener('click', () => {
    options.onBack();
  });

  btnLobbyLeave.addEventListener('click', () => {
    network?.leaveLobby();
    options.onLeaveToMenu();
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

  // --- Visibility controls ---

  function show() {
    screenLobby.classList.remove('hidden');
    screenLobby.classList.add('flex');
    selectedOnlineMode = options.getSelectedMode();
    updateOnlineModeLabel();
  }

  function hide() {
    screenLobby.classList.remove('flex');
    screenLobby.classList.add('hidden');
  }

  function reset() {
    // Disconnect
    if (network) {
      network.disconnect();
      network = null;
    }
    myReady = false;
    inRoom = false;
    onlineTeamScores = { cyan: 0, magenta: 0 };
    currentLobbyHostId = null;

    // Hide
    hide();
    modalConfirmJoin.classList.add('hidden');

    // Reset DOM
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
    btnLobbySwitchTeam.classList.add('hidden');
    // Clear countdown interval
    lobbyCountdown.classList.add('hidden');
    const interval = lobbyCountdown.dataset.interval;
    if (interval) clearInterval(parseInt(interval));
  }

  // --- Controller ---

  return {
    show,
    hide,
    reset,
    get inRoom() { return inRoom; },
    get network() { return network; },
    get activeMode() { return activeOnlineMode; },
    get selectedMode() { return selectedOnlineMode; },
    set selectedMode(mode: OnlineModeId) { selectedOnlineMode = mode; },
    get container() { return screenLobby; },
    get teamScores() { return onlineTeamScores; },
    get hostId() { return currentLobbyHostId; },
  };
}
