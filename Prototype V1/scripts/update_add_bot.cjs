const fs = require('fs');
let ts = fs.readFileSync('src/LobbyScreen.ts', 'utf8');

const replacementLogic = `
      playerList.appendChild(card);
    });

    if (state.players.length < state.mode.capacity) {
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
      playerList.appendChild(emptyCard);
    }

    if (readyCount === state.players.length && state.players.length > 1) {`;

ts = ts.replace(
  /playerList\.appendChild\(card\);\s*\}\);\s*if \(readyCount === state\.players\.length/m,
  replacementLogic.trim() + ' '
);

fs.writeFileSync('src/LobbyScreen.ts', ts);
console.log('LobbyScreen.ts updated with add-bot card');
