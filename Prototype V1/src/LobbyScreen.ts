import { NetworkManager, type RoomState } from './NetworkManager';
import { ONLINE_GAME_MODES, type OnlineModeId } from './OnlineModeSelect';
import { GameState } from './GameManager';
import { PLAYER_CLASSES } from './PlayerClass';

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
  
  // Class Select Modal
  const modalClassSelect = document.getElementById('modal-class-select')!;
  const classCardList = document.getElementById('lobby-class-card-list')!;
  const btnClassCancel = document.getElementById('btn-lobby-class-cancel')!;
  const btnClassConfirm = document.getElementById('btn-lobby-class-confirm')!;

  let network: NetworkManager | null = null;
  let inRoom = false;
  let myReady = false;
  let currentLobbyHostId: string | null = null;
  let selectedOnlineMode: OnlineModeId = options.getSelectedMode();
  let activeOnlineMode: OnlineModeId = selectedOnlineMode;
  let onlineTeamScores = { cyan: 0, magenta: 0 };
  let currentRoomState: RoomState | null = null;
  let tempSelectedClassId = 'SPEEDSTER';

  function getSelectedOnlineModeInfo() {
    return ONLINE_GAME_MODES.find(m => m.id === selectedOnlineMode) ?? ONLINE_GAME_MODES[0];
  }

  function getPlayerClassInfo(classId?: string) {
    const id = classId || 'SPEEDSTER';
    return PLAYER_CLASSES.find(c => c.id === id) || PLAYER_CLASSES[0];
  }

  function renderClassModal() {
    classCardList.innerHTML = '';
    PLAYER_CLASSES.forEach((playerClass, index) => {
      const isSelected = tempSelectedClassId === playerClass.id;
      const card = document.createElement('div');
      const color = ['#00FFFF', '#FFD700', '#FF1493', '#00FF00'][index % 4];
      
      card.className = `relative p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
        isSelected ? 'border-[' + color + '] bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-card-border bg-card-bg/60 hover:border-gray-500'
      }`;
      if (isSelected) card.style.borderColor = color;

      card.innerHTML = `
        <div class='flex flex-col h-full'>
          <div class='flex justify-between items-start mb-3'>
            <div>
              <h3 class='text-lg font-bold uppercase tracking-wider' style='color: ${color}'>${playerClass.name}</h3>
              <span class='text-[9px] text-gray-400 tracking-widest uppercase'>${playerClass.tagline}</span>
            </div>
          </div>
          <div class='text-xs text-gray-300 mb-4 flex-1'>
            <p class='mb-2'><b>Passive:</b> ${playerClass.passiveDescription}</p>
          </div>
          <div class='flex flex-col gap-2 mt-auto'>
            <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
              <span class='text-neon-cyan font-bold'>Q:</span> ${playerClass.abilityQName}
            </div>
            <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
              <span class='text-neon-yellow font-bold'>E:</span> ${playerClass.abilityEName}
            </div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        tempSelectedClassId = playerClass.id;
        renderClassModal();
      });
      classCardList.appendChild(card);
    });
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
    
    state.players.forEach((p, idx) => {
      const isMe = p.id === network?.mySocketId;
      const isHost = p.id === state.hostId;
      const cInfo = getPlayerClassInfo(p.classId);
      
      const cardBorder = p.ready ? 'border-neon-green/80' : 'border-card-border hover:border-gray-500';
      const nameColor = isMe ? 'text-neon-yellow' : 'text-white';
      
      const card = document.createElement('div');
      card.className = `flex flex-col border ${cardBorder} bg-card-bg/60 rounded-xl p-4 transition-all`;
      
      card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-600 bg-black/40 flex items-center justify-center shrink-0"></div>
            <div>
              <div class="${nameColor} font-bold flex items-center gap-2">
                ${p.name}
                ${isMe ? '<span class="bg-neon-yellow text-black text-[8px] px-1 rounded font-bold uppercase">YOU</span>' : ''}
                ${isHost ? '<span class="text-orange-500 text-xs">👑</span>' : ''}
              </div>
              <div class="text-[9px] text-neon-cyan font-bold tracking-widest uppercase">${cInfo.name}</div>
            </div>
          </div>
          <div class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">P${idx + 1}</div>
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
            <div class="w-1.5 h-1.5 rounded-full ${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>
            ${p.ready ? 'Ready' : 'Not ready'}
          </div>
          ${p.ready ? '<div class="text-[9px] border border-neon-green/30 text-neon-green px-2 py-0.5 rounded tracking-widest uppercase">READY</div>' : '<div class="text-[9px] border border-gray-600 text-gray-400 px-2 py-0.5 rounded tracking-widest uppercase">WAITING</div>'}
        </div>
      `;
      playerList.appendChild(card);
    });

    if (readyCount === state.players.length && state.players.length > 1) {
      footerStatus.innerText = 'Everyone is ready! Host can start the match.';
    } else {
      footerStatus.innerText = `Waiting for ${state.players.length - readyCount} more player(s) to ready up...`;
    }

    if (network?.mySocketId === state.hostId) {
      btnStartMatch.classList.remove('hidden');
      btnStartMatch.disabled = false;
    } else {
      btnStartMatch.classList.add('hidden');
    }
  }

  btnHost.addEventListener('click', () => {
    const roomId = inputRoom.value.trim() || 'test-room';
    const nickname = inputNickname.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
    const bootConfig = JSON.parse(sessionStorage.getItem('cascade_boot_config') || '{}');
    const classId = (bootConfig.selectedClass && bootConfig.selectedClass.id) ? bootConfig.selectedClass.id : 'SPEEDSTER';
    
    ensureNetwork();
    network?.hostRoom(roomId, nickname, selectedOnlineMode, classId);
    authStatus.innerText = 'Creating lobby...';
    btnHost.disabled = true; btnJoin.disabled = true;
  });

  btnJoin.addEventListener('click', () => {
    const roomId = inputRoom.value.trim() || 'test-room';
    const nickname = inputNickname.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
    const bootConfig = JSON.parse(sessionStorage.getItem('cascade_boot_config') || '{}');
    const classId = (bootConfig.selectedClass && bootConfig.selectedClass.id) ? bootConfig.selectedClass.id : 'SPEEDSTER';

    ensureNetwork();
    network?.joinRoom(roomId, nickname, selectedOnlineMode, classId);
    authStatus.innerText = 'Joining lobby...';
    btnHost.disabled = true; btnJoin.disabled = true;
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
    // Open modal with currently equipped class
    const me = currentRoomState?.players.find(p => p.id === network?.mySocketId);
    tempSelectedClassId = me?.classId || 'SPEEDSTER';
    renderClassModal();
    modalClassSelect.classList.remove('hidden');
    modalClassSelect.classList.add('flex');
  });

  btnClassCancel.addEventListener('click', () => {
    modalClassSelect.classList.add('hidden');
    modalClassSelect.classList.remove('flex');
  });

  btnClassConfirm.addEventListener('click', () => {
    modalClassSelect.classList.add('hidden');
    modalClassSelect.classList.remove('flex');
    if (network) {
      network.changeClass(tempSelectedClassId);
      
      // Also update sessionStorage so it persists for the next game
      const bootConfig = JSON.parse(sessionStorage.getItem('cascade_boot_config') || '{}');
      bootConfig.selectedClass = { id: tempSelectedClassId }; // Only need id for bootConfig logic
      sessionStorage.setItem('cascade_boot_config', JSON.stringify(bootConfig));
    }
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
