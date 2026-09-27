import { PLAYER_CLASSES } from './PlayerClass';

export interface ClassSelectModalOptions {
  onConfirm: (classId: string) => void;
  onCancel?: () => void;
  initialClassId?: string;
}

export function showClassSelectModal(options: ClassSelectModalOptions) {
  const modal = document.getElementById('modal-class-select');
  if (!modal) return;
  
  const classCardList = document.getElementById('lobby-class-card-list')!;
  const btnCancel = document.getElementById('btn-lobby-class-cancel')!;
  const btnConfirm = document.getElementById('btn-lobby-class-confirm')!;
  
  let tempSelectedClassId = options.initialClassId || 'SPEEDSTER';

  function renderCards() {
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
        renderCards();
      });
      classCardList.appendChild(card);
    });
  }

  // Cleanup old listeners to prevent memory leaks when re-opening
  const newBtnCancel = btnCancel.cloneNode(true) as HTMLButtonElement;
  btnCancel.parentNode?.replaceChild(newBtnCancel, btnCancel);
  
  const newBtnConfirm = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode?.replaceChild(newBtnConfirm, btnConfirm);

  newBtnCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (options.onCancel) options.onCancel();
  });

  newBtnConfirm.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    
    // Always persist selected class to sessionStorage
    const bootConfig = JSON.parse(sessionStorage.getItem('cascade_boot_config') || '{}');
    bootConfig.selectedClass = { id: tempSelectedClassId };
    sessionStorage.setItem('cascade_boot_config', JSON.stringify(bootConfig));
    
    options.onConfirm(tempSelectedClassId);
  });

  renderCards();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}
