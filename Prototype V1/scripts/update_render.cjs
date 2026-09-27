const fs = require('fs');

const codeToInject = `function renderLobbyPlayers(state: RoomState) {
    headerModeTag.innerText = state.mode.title;
    headerCodeDisplay.innerText = state.roomId;
    
    const host = state.players.find(p => p.id === state.hostId);
    headerHostDisplay.innerText = host ? \`\${host.name}'s Room\` : '';

    statPlayers.innerText = \`\${state.players.length}/\${state.mode.capacity}\`;
    const readyCount = state.players.filter(p => p.ready).length;
    statReady.innerText = readyCount.toString();
    statWaiting.innerText = (state.players.length - readyCount).toString();

    playerList.innerHTML = '';
    
    const isTeamMode = state.mode.isTeamMode;
    let colMagenta: HTMLElement;
    let colCyan: HTMLElement;
    let colFFA: HTMLElement;

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
      const cInfo = getPlayerClassInfo(p.classId);
      
      let borderStyle = p.ready ? 'border-neon-green/80' : 'border-card-border hover:border-gray-500';
      // Add team colored borders if team mode
      if (isTeamMode) {
        if (p.team === 'cyan') borderStyle = p.ready ? 'border-neon-cyan' : 'border-neon-cyan/40 hover:border-neon-cyan/80';
        if (p.team === 'magenta') borderStyle = p.ready ? 'border-neon-pink' : 'border-neon-pink/40 hover:border-neon-pink/80';
      }

      const nameColor = isMe ? 'text-neon-yellow' : 'text-white';
      
      const card = document.createElement('div');
      card.className = \`flex flex-col border \${borderStyle} bg-card-bg/60 rounded-xl p-4 transition-all\`;
      
      card.innerHTML = \`
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-600 bg-black/40 flex items-center justify-center shrink-0"></div>
            <div>
              <div class="\${nameColor} font-bold flex items-center gap-2">
                \${p.name}
                \${isMe ? '<span class="bg-neon-yellow text-black text-[8px] px-1 rounded font-bold uppercase">YOU</span>' : ''}
                \${isHost ? '<span class="text-orange-500 text-xs">👑</span>' : ''}
              </div>
              <div class="text-[9px] text-neon-cyan font-bold tracking-widest uppercase">\${cInfo.name}</div>
            </div>
          </div>
          <div class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">\${isTeamMode ? (p.team==='cyan'?'CYAN ':'MAGENTA ') : ''}P\${idx + 1}</div>
        </div>
        <div class="text-[9px] text-gray-400 mb-3 border-t border-white/5 pt-2">
          <span class="text-gray-500 uppercase tracking-widest block mb-1">Passive</span>
          \${cInfo.passiveDescription}
        </div>
        <div class="flex gap-2 mb-3">
          <div class="flex-1 bg-black/30 border border-white/5 rounded p-2 flex items-center gap-2 text-[9px] text-white">
            <span class="text-neon-cyan font-bold">Q</span> \${cInfo.abilityQName}
          </div>
          <div class="flex-1 bg-black/30 border border-white/5 rounded p-2 flex items-center gap-2 text-[9px] text-white">
            <span class="text-neon-yellow font-bold">E</span> \${cInfo.abilityEName}
          </div>
        </div>
        <div class="flex items-center justify-between mt-auto border-t border-white/5 pt-2">
          <div class="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold \${p.ready ? 'text-neon-green' : 'text-gray-500'}">
            <div class="w-1.5 h-1.5 rounded-full \${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>
            \${p.ready ? 'Ready' : 'Not ready'}
          </div>
          \${p.ready ? '<div class="text-[9px] border border-neon-green/30 text-neon-green px-2 py-0.5 rounded tracking-widest uppercase">READY</div>' : '<div class="text-[9px] border border-gray-600 text-gray-400 px-2 py-0.5 rounded tracking-widest uppercase">WAITING</div>'}
        </div>
      \`;
      return card;
    };

    const createEmptyCardHTML = () => {
      const isHost = network?.mySocketId === state.hostId;
      const emptyCard = document.createElement('div');
      emptyCard.className = 'flex flex-col border border-dashed border-gray-600 bg-card-bg/20 rounded-xl p-4 items-center justify-center min-h-[220px] transition-all';
      
      if (isHost) {
        emptyCard.innerHTML = \`<button class="px-6 py-3 bg-transparent border-2 border-neon-yellow/60 text-neon-yellow rounded-lg hover:bg-neon-yellow/10 transition-colors uppercase tracking-widest text-xs font-bold shadow-[0_0_15px_rgba(255,220,80,0.15)] flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          ADD BOT
        </button>\`;
        const btn = emptyCard.querySelector('button');
        btn?.addEventListener('click', () => {
          const existingNames = state.players.map(p => p.name);
          import('./BotNames').then(({ getUniqueBotName }) => {
            network?.addBot(getUniqueBotName(existingNames));
          });
        });
      } else {
        emptyCard.innerHTML = \`<span class="text-gray-500 uppercase tracking-widest text-[10px] font-bold animate-pulse">Waiting for player...</span>\`;
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
      footerStatus.innerText = \`Waiting for \${state.mode.capacity - readyCount} more player(s) to ready up...\`;
    }

    if (network?.mySocketId === state.hostId) {
      btnStartMatch.classList.remove('hidden');
      btnStartMatch.disabled = false;
    } else {
      btnStartMatch.classList.add('hidden');
    }
  }`;

let ts = fs.readFileSync('src/LobbyScreen.ts', 'utf8');

const regex = /function renderLobbyPlayers\(state: RoomState\) \{[\s\S]*?(?=\n  btnHost\.addEventListener)/;
ts = ts.replace(regex, codeToInject + '\n');
fs.writeFileSync('src/LobbyScreen.ts', ts);

console.log('LobbyScreen.ts render logic updated');
