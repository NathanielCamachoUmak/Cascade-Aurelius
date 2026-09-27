const fs = require('fs');
let ts = fs.readFileSync('src/LobbyScreen.ts', 'utf8');

if (!ts.includes('modalClassSelect')) {
  // 1. Add DOM queries for the modal
  ts = ts.replace(
    /const btnChatSend = document.getElementById\('btn-chat-send'\)!;/,
    `const btnChatSend = document.getElementById('btn-chat-send')!;
  
  // Class Select Modal
  const modalClassSelect = document.getElementById('modal-class-select')!;
  const classCardList = document.getElementById('lobby-class-card-list')!;
  const btnClassCancel = document.getElementById('btn-lobby-class-cancel')!;
  const btnClassConfirm = document.getElementById('btn-lobby-class-confirm')!;`
  );

  // 2. Add local state for the modal
  ts = ts.replace(
    /let currentRoomState: RoomState \| null = null;/,
    `let currentRoomState: RoomState | null = null;
  let tempSelectedClassId = 'SPEEDSTER';`
  );

  // 3. Add function to render the modal cards
  ts = ts.replace(
    /function ensureNetwork\(\): NetworkManager \{/,
    `function renderClassModal() {
    classCardList.innerHTML = '';
    PLAYER_CLASSES.forEach((playerClass, index) => {
      const isSelected = tempSelectedClassId === playerClass.id;
      const card = document.createElement('div');
      const color = ['#00FFFF', '#FFD700', '#FF1493', '#00FF00'][index % 4];
      
      card.className = \`relative p-5 rounded-xl border transition-all duration-300 cursor-pointer \${
        isSelected ? 'border-[' + color + '] bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-card-border bg-card-bg/60 hover:border-gray-500'
      }\`;
      if (isSelected) card.style.borderColor = color;

      card.innerHTML = \`
        <div class='flex flex-col h-full'>
          <div class='flex justify-between items-start mb-3'>
            <div>
              <h3 class='text-lg font-bold uppercase tracking-wider' style='color: \${color}'>\${playerClass.name}</h3>
              <span class='text-[9px] text-gray-400 tracking-widest uppercase'>\${playerClass.tagline}</span>
            </div>
          </div>
          <div class='text-xs text-gray-300 mb-4 flex-1'>
            <p class='mb-2'><b>Passive:</b> \${playerClass.passiveDescription}</p>
          </div>
          <div class='flex flex-col gap-2 mt-auto'>
            <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
              <span class='text-neon-cyan font-bold'>Q:</span> \${playerClass.abilityQName}
            </div>
            <div class='text-[10px] bg-black/30 p-2 rounded border border-white/5'>
              <span class='text-neon-yellow font-bold'>E:</span> \${playerClass.abilityEName}
            </div>
          </div>
        </div>
      \`;

      card.addEventListener('click', () => {
        tempSelectedClassId = playerClass.id;
        renderClassModal();
      });
      classCardList.appendChild(card);
    });
  }

  function ensureNetwork(): NetworkManager {`
  );

  // 4. Update btnChangeLoadout listener
  ts = ts.replace(
    /btnChangeLoadout\.addEventListener\('click', \(\) => \{\s*alert\([^)]+\);\s*\}\);/,
    `btnChangeLoadout.addEventListener('click', () => {
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
  });`
  );

  fs.writeFileSync('src/LobbyScreen.ts', ts);
  console.log('LobbyScreen.ts updated with modal logic');
}
