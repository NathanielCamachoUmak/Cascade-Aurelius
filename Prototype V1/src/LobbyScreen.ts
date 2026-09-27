import { NetworkManager, type RoomState } from './NetworkManager';
import { ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect';
import { GameState } from './GameManager';
import { PLAYER_CLASSES } from './PlayerClass';
import { showClassSelectModal } from './ClassSelectModal';

export interface LobbyScreenOptions {
  onBack: () => void;
  onLeaveToMenu: () => void;
  getSelectedMode: () => OnlineModeId;
  onNetworkReady: (network: NetworkManager) => void;
  getGameState?: () => GameState;
  externalScreens?: { screenPostGame?: HTMLElement; };
}

export interface LobbyScreenController {
  show(): void;
  hide(): void;
  reset(): void;
  readonly inRoom: boolean;
  readonly network: NetworkManager | null;
  readonly activeMode: OnlineModeId;
  selectedMode: OnlineModeId;
  readonly container: HTMLElement;
  readonly teamScores: { cyan: number; magenta: number };
  readonly hostId: string | null;
}

export function mountLobbyScreen(options: LobbyScreenOptions): LobbyScreenController {
  const screenLobby = document.getElementById('screen-lobby')!;
  
  const authPanel = document.getElementById('lobby-auth-panel')!;
  const authModeLabel = document.getElementById('online-mode-label')!;
  const inputNickname = document.getElementById('lobby-nickname-input') as HTMLInputElement;
  const inputRoom = document.getElementById('lobby-room-input') as HTMLInputElement;
  const btnHost = document.getElementById('btn-host-lobby') as HTMLButtonElement;
  const btnJoin = document.getElementById('btn-join-lobby') as HTMLButtonElement;
  const authStatus = document.getElementById('lobby-status')!;
  const btnBackAuth = document.getElementById('btn-lobby-back-auth')!;

  const roomPanel = document.getElementById('lobby-room-panel')!;
  const headerModeTag = document.getElementById('lobby-mode-tag')!;
  const headerCodeDisplay = document.getElementById('lobby-code-display')!;
  const headerHostDisplay = document.getElementById('lobby-host-display')!;
  
  const statPlayers = document.getElementById('lobby-stat-players')!;
  const statReady = document.getElementById('lobby-stat-ready')!;
  const statWaiting = document.getElementById('lobby-stat-waiting')!;
  
  const playerList = document.getElementById('lobby-player-list')!;
  const footerStatus = document.getElementById('lobby-footer-status')!;
  
  const yourClassDisplay = document.getElementById('your-class-display')!;
  const toggleReady = document.getElementById('lobby-ready-toggle') as HTMLInputElement;
  const btnStartMatch = document.getElementById('btn-lobby-start-match') as HTMLButtonElement;
  const btnLeaveLobby = document.getElementById('btn-lobby-leave')!;
  const btnChangeLoadout = document.getElementById('btn-lobby-change-loadout')!;
  
  const chatMessages = document.getElementById('chat-messages')!;
  const chatInput = document.getElementById('chat-input') as HTMLInputElement;
  const btnChatSend = document.getElementById('btn-chat-send')!;

  let network: NetworkManager | null = null;
  let inRoom = false;
  let myReady = false;
  let currentLobbyHostId: string | null = null;
  let selectedOnlineMode: OnlineModeId = options.getSelectedMode();
  let activeOnlineMode: OnlineModeId = selectedOnlineMode;
  let onlineTeamScores = { cyan: 0, magenta: 0 };
  let currentRoomState: RoomState | null = null;

  function getSelectedOnlineModeInfo() {
    return ONLINE_GAME_MODES.find(m => m.id === selectedOnlineMode) ?? ONLINE_GAME_MODES[0];
  }

  function getPlayerClassInfo(classId?: string) {
    const id = classId || 'SPEEDSTER';
    return PLAYER_CLASSES.find(c => c.id === id) || PLAYER_CLASSES[0];
  }

  function ensureNetwork(): NetworkManager {
    if (network) return network;
    network = new NetworkManager();

    network.onRoomUpdate = (state: RoomState) => {
      currentRoomState = state;
      currentLobbyHostId = state.hostId;
      activeOnlineMode = state.mode.id;
      onlineTeamScores = state.teamScores;
      
      const me = state.players.find(p => p.id === network?.mySocketId);
      if (me) {
        if (!inRoom) {
          inRoom = true;
          authPanel.classList.add('hidden');
          roomPanel.classList.remove('hidden');
          roomPanel.classList.add('flex');
        }
        myReady = me.ready;
        toggleReady.checked = myReady;
        const cInfo = getPlayerClassInfo(me.classId);
        yourClassDisplay.innerText = `${cInfo.name} - ${cInfo.tagline}`;
      }
      
      renderLobbyPlayers(state);
    };

    network.onPreGameCountdown = (count: number) => {
      footerStatus.innerText = `Match starting in ${count}...`;
    };
    
    network.onKicked = () => {
      alert("You have been kicked from the lobby.");
      options.onLeaveToMenu();
    };

    network.onChatMessage = (msg) => {
      const el = document.createElement('div');
      el.className = 'text-xs text-gray-300';
      el.innerHTML = `<span class="font-bold text-neon-cyan">${msg.sender}</span> ${msg.text}`;
      chatMessages.appendChild(el);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    options.onNetworkReady(network);
    return network;
  }

  function renderLobbyPlayers(state: RoomState) {
    headerModeTag.innerText = state.mode.title;
    headerCodeDisplay.innerText = state.roomId;
    
    const host = state.players.find(p => p.id === state.hostId);
    headerHostDisplay.innerText = host ? `${host.name}'s Room` : '';

    statPlayers.innerText = `${state.players.length}/${state.mode.capacity}`;
    const readyCount = state.players.filter(p => p.ready).length;
    statReady.innerText = readyCount.toString();
    statWaiting.innerText = (state.players.length - readyCount).toString();

    playerList.innerHTML = '';
    
    const isTeamMode = state.mode.isTeamMode;
    let colMagenta!: HTMLElement;
    let colCyan!: HTMLElement;
    let colFFA!: HTMLElement;

    if (isTeamMode) {
      playerList.className = 'flex flex-col lg:flex-row gap-6 w-full max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent';
      
      colMagenta = document.createElement('div');
      colMagenta.className = 'flex-1 flex flex-col gap-4';
      
      colCyan = document.createElement('div');
      colCyan.className = 'flex-1 flex flex-col gap-4';
      
      playerList.appendChild(colMagenta);
      playerList.appendChild(colCyan);
    } else {
      playerList.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent';
      colFFA = playerList;
    }

    const createCardHTML = (p: any, idx: number) => {
      const isMe = p.id === network?.mySocketId;
      const isHost = p.id === state.hostId;
      const amIHost = network?.mySocketId === state.hostId;
      const cInfo = getPlayerClassInfo(p.classId);
      
      let borderStyle = p.ready ? 'border-neon-green/80' : 'border-card-border hover:border-gray-500';
      // Add team colored borders if team mode
      if (isTeamMode) {
        if (p.team === 'cyan') borderStyle = p.ready ? 'border-neon-cyan' : 'border-neon-cyan/40 hover:border-neon-cyan/80';
        if (p.team === 'magenta') borderStyle = p.ready ? 'border-neon-pink' : 'border-neon-pink/40 hover:border-neon-pink/80';
      }

      const nameColor = isMe ? 'text-neon-yellow' : 'text-white';
      
      const card = document.createElement('div');
      card.className = `flex flex-col border ${borderStyle} bg-card-bg/60 rounded-xl p-4 transition-all`;
      
      const isMyBot = p.isBot && amIHost;
      card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-600 bg-black/40 flex items-center justify-center shrink-0"></div>
            <div>
              <div class="${nameColor} font-bold flex items-center gap-2">
                ${p.name}
                ${isMe ? '<span class="bg-neon-yellow text-black text-[8px] px-1 rounded font-bold uppercase">YOU</span>' : ''}
                ${p.isBot ? '<span class="bg-gray-600 text-white text-[8px] px-1 rounded font-bold uppercase">BOT</span>' : ''}
                ${isHost && !p.isBot ? '<span class="text-orange-500 text-xs">👑</span>' : ''}
              </div>
              <div class="class-label-edit text-[9px] text-neon-cyan font-bold tracking-widest uppercase ${isMyBot ? 'cursor-pointer hover:text-white transition-colors' : ''}">${cInfo.name} ${isMyBot ? '✎' : ''}</div>
            </div>
          </div>
          <div class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">${isTeamMode ? (p.team==='cyan'?'CYAN ':'MAGENTA ') : ''}P${idx + 1}</div>
        </div>
        <div class="text-[9px] text-gray-400 mb-3 border-t border-white/5 pt-2">
          <span class="text-gray-500 uppercase tracking-widest block mb-1">Passive</span>
          ${cInfo.passiveDescription}
        </div>
        <div class="flex gap-2 mb-3">
          <div class="flex-1 bg-black/30 border border-white/5 rounded p-2 flex items-center gap-2 text-[9px] text-white">
            <span class="text-neon-cyan font-bold">Q</span> ${cInfo.abilityQName}
          </div>
          <div class="flex-1 bg-black/30 border border-white/5 rounded p-2 flex items-center gap-2 text-[9px] text-white">
            <span class="text-neon-yellow font-bold">E</span> ${cInfo.abilityEName}
          </div>
        </div>
        <div class="flex items-center justify-between mt-auto border-t border-white/5 pt-2">
          <div class="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold ${p.ready ? 'text-neon-green' : 'text-gray-500'}">
            ${amIHost && !isMe ? `<button class="kick-btn text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors bg-black/40 border border-red-500/30 rounded px-1.5 py-0.5 mr-1 flex-shrink-0">KICK</button>` : ''}
            <div class="w-1.5 h-1.5 rounded-full ${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>
            ${p.ready ? 'Ready' : 'Not ready'}
          </div>
          ${p.ready ? '<div class="text-[9px] border border-neon-green/30 text-neon-green px-2 py-0.5 rounded tracking-widest uppercase">READY</div>' : '<div class="text-[9px] border border-gray-600 text-gray-400 px-2 py-0.5 rounded tracking-widest uppercase">WAITING</div>'}
        </div>
      `;
      
      if (amIHost && !isMe) {
        const kickBtn = card.querySelector('.kick-btn');
        kickBtn?.addEventListener('click', () => {
          if (confirm(`Kick ${p.name} from the lobby?`)) {
            network?.kickPlayer(p.id);
          }
        });
      }
      
      if (isMyBot) {
        const editBtn = card.querySelector('.class-label-edit');
        editBtn?.addEventListener('click', () => {
          showClassSelectModal({
            initialClassId: p.classId,
            onConfirm: (finalClassId) => {
              if (network) network.changeClass(finalClassId, p.id);
            }
          });
        });
      }
      return card;
    };

    const createEmptyCardHTML = () => {
      const isHost = network?.mySocketId === state.hostId;
      const emptyCard = document.createElement('div');
      emptyCard.className = 'flex flex-col border border-dashed border-gray-600 bg-card-bg/20 rounded-xl p-4 items-center justify-center min-h-[220px] transition-all';
      
      if (isHost) {
        emptyCard.innerHTML = `<button class="px-6 py-3 bg-transparent border-2 border-neon-yellow/60 text-neon-yellow rounded-lg hover:bg-neon-yellow/10 transition-colors uppercase tracking-widest text-xs font-bold shadow-[0_0_15px_rgba(255,220,80,0.15)] flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          ADD BOT
        </button>`;
        const btn = emptyCard.querySelector('button');
        btn?.addEventListener('click', () => {
          const existingNames = state.players.map(p => p.name);
          import('./BotNames').then(({ getUniqueBotName }) => {
            network?.addBot(getUniqueBotName(existingNames));
          });
        });
      } else {
        emptyCard.innerHTML = `<span class="text-gray-500 uppercase tracking-widest text-[10px] font-bold animate-pulse">Waiting for player...</span>`;
      }
      return emptyCard;
    };

    if (isTeamMode) {
      const magentaPlayers = state.players.filter(p => p.team === 'magenta');
      const cyanPlayers = state.players.filter(p => p.team === 'cyan');
      
      magentaPlayers.forEach((p, idx) => colMagenta.appendChild(createCardHTML(p, idx)));
      cyanPlayers.forEach((p, idx) => colCyan.appendChild(createCardHTML(p, idx)));
      
      // Add empty cards to fill remaining team size
      for (let i = magentaPlayers.length; i < state.mode.teamSize; i++) {
        // Only render the FIRST empty slot, not all of them
        if (i === magentaPlayers.length) colMagenta.appendChild(createEmptyCardHTML());
      }
      for (let i = cyanPlayers.length; i < state.mode.teamSize; i++) {
        if (i === cyanPlayers.length) colCyan.appendChild(createEmptyCardHTML());
      }
    } else {
      state.players.forEach((p, idx) => {
        colFFA.appendChild(createCardHTML(p, idx));
      });
      if (state.players.length < state.mode.capacity) {
        colFFA.appendChild(createEmptyCardHTML());
      }
    }

    if (readyCount === state.players.length && state.players.length > 1) {
      footerStatus.innerText = 'Everyone is ready! Host can start the match.';
    } else {
      footerStatus.innerText = `Waiting for ${state.mode.capacity - readyCount} more player(s) to ready up...`;
    }

    if (network?.mySocketId === state.hostId) {
      btnStartMatch.classList.remove('hidden');
      btnStartMatch.disabled = false;
    } else {
      btnStartMatch.classList.add('hidden');
    }
  }

  btnHost.addEventListener('click', () => {
    const bootConfig = JSON.parse(sessionStorage.getItem('cascade_boot_config') || '{}');
    const classId = bootConfig.selectedClass?.id || 'SPEEDSTER';
    
    showClassSelectModal({
      initialClassId: classId,
      onConfirm: (finalClassId) => {
        const roomId = inputRoom.value.trim() || 'test-room';
        const nickname = inputNickname.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
        ensureNetwork();
        network?.hostRoom(roomId, nickname, selectedOnlineMode, finalClassId);
        authStatus.innerText = 'Creating lobby...';
        btnHost.disabled = true; btnJoin.disabled = true;
      }
    });
  });

  btnJoin.addEventListener('click', () => {
    const bootConfig = JSON.parse(sessionStorage.getItem('cascade_boot_config') || '{}');
    const classId = bootConfig.selectedClass?.id || 'SPEEDSTER';

    showClassSelectModal({
      initialClassId: classId,
      onConfirm: (finalClassId) => {
        const roomId = inputRoom.value.trim() || 'test-room';
        const nickname = inputNickname.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
        ensureNetwork();
        network?.joinRoom(roomId, nickname, selectedOnlineMode, finalClassId);
        authStatus.innerText = 'Joining lobby...';
        btnHost.disabled = true; btnJoin.disabled = true;
      }
    });
  });

  btnBackAuth.addEventListener('click', () => {
    options.onBack();
  });

  btnLeaveLobby.addEventListener('click', () => {
    options.onLeaveToMenu();
  });

  btnStartMatch.addEventListener('click', () => {
    network?.startLobbyNow();
  });

  toggleReady.addEventListener('change', () => {
    network?.setReady(toggleReady.checked);
  });

  btnChangeLoadout.addEventListener('click', () => {
    const me = currentRoomState?.players.find(p => p.id === network?.mySocketId);
    showClassSelectModal({
      initialClassId: me?.classId || 'SPEEDSTER',
      onConfirm: (finalClassId) => {
        if (network) network.changeClass(finalClassId);
      }
    });
  });

  btnChatSend.addEventListener('click', () => {
    if (chatInput.value.trim()) {
      network?.sendChatMessage(chatInput.value.trim());
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnChatSend.click();
  });

  function show() {
    screenLobby.classList.remove('hidden');
    screenLobby.classList.add('flex');
    selectedOnlineMode = options.getSelectedMode();
    const modeInfo = getSelectedOnlineModeInfo();
    authModeLabel.innerText = `${modeInfo.title} • ${modeInfo.format} • ${modeInfo.playerCount} PLAYERS`;
  }

  function hide() {
    screenLobby.classList.remove('flex');
    screenLobby.classList.add('hidden');
  }

  function reset() {
    if (network) {
      network.leaveRoom();
      network = null;
    }
    inRoom = false;
    myReady = false;
    currentRoomState = null;
    currentLobbyHostId = null;
    
    authPanel.classList.remove('hidden');
    roomPanel.classList.add('hidden');
    roomPanel.classList.remove('flex');
    
    authStatus.innerText = '';
    btnHost.disabled = false;
    btnJoin.disabled = false;
    chatMessages.innerHTML = '';
  }

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
