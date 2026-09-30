import { PLAYER_CLASSES, type PlayerClassInfo } from './PlayerClass';

export interface ClassSelectModalOptions {
  onConfirm: (classId: string) => void;
  onCancel?: () => void;
  initialClassId?: string;
}

const HOVER_DELAY_MS = 3000;

function formatShortEffect(rawDescription: string): string {
  const cleaned = rawDescription
    .replace(/^[QER]\s*[·\-]\s*(?:.*?cooldown:?|once per (?:level|match):?|.*?lines:?)\s*/i, '')
    .trim();
  if (!cleaned) return rawDescription;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function showClassSelectModal(options: ClassSelectModalOptions) {
  const modal = document.getElementById('modal-class-select');
  if (!modal) return;
  
  const classCardList = document.getElementById('lobby-class-card-list')!;
  const btnCancel = document.getElementById('btn-lobby-class-cancel')!;
  const btnConfirm = document.getElementById('btn-lobby-class-confirm')!;
  
  let tempSelectedClassId = options.initialClassId || 'SPEEDSTER';
  let activeHoverTimeout: number | null = null;

  // Ensure a single floating tooltip element exists inside the modal
  let tooltipEl = document.getElementById('class-ability-hover-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'class-ability-hover-tooltip';
    tooltipEl.className =
      'fixed z-[130] hidden pointer-events-none w-64 rounded-lg border bg-[#0b0d1c]/95 px-3.5 py-2.5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.85)] backdrop-blur-md transition-opacity duration-150 opacity-0';
    document.body.appendChild(tooltipEl);
  }

  function hideTooltip() {
    if (activeHoverTimeout !== null) {
      window.clearTimeout(activeHoverTimeout);
      activeHoverTimeout = null;
    }
    if (tooltipEl) {
      tooltipEl.classList.add('hidden', 'opacity-0');
      tooltipEl.classList.remove('opacity-100');
    }
  }

  function showTooltipForElement(
    anchorEl: HTMLElement,
    slot: 'Q' | 'E' | 'R',
    abilityName: string,
    shortEffect: string,
    accentHex: string,
    ultimateCost?: number
  ) {
    if (!tooltipEl) return;

    const requirementHtml =
      slot === 'R' && ultimateCost !== undefined
        ? `<div class="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px]">
             <span class="uppercase tracking-wider text-gray-400 font-bold">Requirement</span>
             <span class="font-bold text-neon-pink">${ultimateCost} Lines Cleared</span>
           </div>`
        : '';

    tooltipEl.style.borderColor = accentHex;
    tooltipEl.innerHTML = `
      <div class="flex items-center gap-1.5 mb-1">
        <span class="text-[10px] font-black uppercase tracking-wider" style="color: ${accentHex}">[${slot}] ${abilityName}</span>
      </div>
      <p class="text-[11px] leading-snug text-gray-200">${shortEffect}</p>
      ${requirementHtml}
    `;

    tooltipEl.classList.remove('hidden');

    // Position above the hovered ability bar (or below if near top of viewport)
    const rect = anchorEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const margin = 8;

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    left = Math.max(12, Math.min(window.innerWidth - tooltipRect.width - 12, left));

    let top = rect.top - tooltipRect.height - margin;
    if (top < 12) {
      top = rect.bottom + margin;
    }

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;

    requestAnimationFrame(() => {
      tooltipEl?.classList.remove('opacity-0');
      tooltipEl?.classList.add('opacity-100');
    });
  }

  const cardElements: Array<{ card: HTMLDivElement; playerClass: PlayerClassInfo; color: string }> = [];

  function updateCardSelectionStyles() {
    cardElements.forEach(({ card, playerClass, color }) => {
      const isSelected = tempSelectedClassId === playerClass.id;
      card.className = `relative p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
        isSelected
          ? 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
          : 'border-card-border bg-card-bg/60 hover:border-gray-500'
      }`;
      card.style.borderColor = isSelected ? color : '';
    });
  }

  function createAbilityRow(
    playerClass: PlayerClassInfo,
    slot: 'Q' | 'E' | 'R',
    abilityName: string,
    rawDescription: string,
    labelColorClass: string,
    accentHex: string,
    fillRgba: string
  ): HTMLElement {
    const row = document.createElement('div');
    row.className =
      'relative overflow-hidden text-[10px] bg-black/30 p-2 rounded border border-white/5 transition-colors duration-200 select-none';

    // 3-second progress highlight fill
    const progressFill = document.createElement('div');
    progressFill.className = 'pointer-events-none absolute inset-y-0 left-0 w-0';
    progressFill.style.background = fillRgba;
    progressFill.style.boxShadow = `inset -2px 0 8px ${accentHex}`;
    progressFill.style.width = '0%';
    progressFill.style.transition = 'width 150ms ease-out';

    const content = document.createElement('div');
    content.className = 'relative z-10 flex items-center justify-between gap-2';
    content.innerHTML = `
      <div>
        <span class="${labelColorClass} font-bold">${slot}:</span>
        <span class="text-gray-100 font-medium">${abilityName}</span>
      </div>
    `;

    row.appendChild(progressFill);
    row.appendChild(content);

    const shortEffect = formatShortEffect(rawDescription);

    row.addEventListener('mouseenter', () => {
      if (activeHoverTimeout !== null) {
        window.clearTimeout(activeHoverTimeout);
        activeHoverTimeout = null;
      }
      hideTooltip();

      row.style.borderColor = `${accentHex}88`;
      // Trigger smooth 3-second progress fill
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
      // Force reflow so the 3s transition always starts cleanly from 0%
      void progressFill.offsetWidth;
      progressFill.style.transition = `width ${HOVER_DELAY_MS}ms linear`;
      progressFill.style.width = '100%';

      activeHoverTimeout = window.setTimeout(() => {
        activeHoverTimeout = null;
        showTooltipForElement(
          row,
          slot,
          abilityName,
          shortEffect,
          accentHex,
          slot === 'R' ? playerClass.ultimateCost : undefined
        );
      }, HOVER_DELAY_MS);
    });

    row.addEventListener('mouseleave', () => {
      row.style.borderColor = '';
      progressFill.style.transition = 'width 150ms ease-out';
      progressFill.style.width = '0%';
      hideTooltip();
    });

    return row;
  }

  function renderCards() {
    hideTooltip();
    classCardList.innerHTML = '';
    cardElements.length = 0;

    PLAYER_CLASSES.forEach((playerClass, index) => {
      const card = document.createElement('div');
      const color = ['#00FFFF', '#FFD700', '#FF1493', '#00FF00'][index % 4];
      const passiveText = playerClass.passiveDescription.replace(/^Passive:\s*/i, '');

      card.innerHTML = `
        <div class='flex flex-col h-full'>
          <div class='flex justify-between items-start mb-3'>
            <div>
              <h3 class='text-lg font-bold uppercase tracking-wider' style='color: ${color}'>${playerClass.name}</h3>
              <span class='text-[9px] text-gray-400 tracking-widest uppercase'>${playerClass.tagline}</span>
            </div>
          </div>
          <div class='text-xs text-gray-300 mb-4 flex-1'>
            <p class='mb-2'><b>Passive:</b> ${passiveText}</p>
          </div>
          <div class='ability-list flex flex-col gap-2 mt-auto'></div>
        </div>
      `;

      const abilityList = card.querySelector('.ability-list')!;
      abilityList.appendChild(
        createAbilityRow(
          playerClass,
          'Q',
          playerClass.abilityQName,
          playerClass.abilityQDescription,
          'text-neon-cyan',
          '#00FFFF',
          'linear-gradient(90deg, rgba(0,255,255,0.12) 0%, rgba(0,255,255,0.32) 100%)'
        )
      );
      abilityList.appendChild(
        createAbilityRow(
          playerClass,
          'E',
          playerClass.abilityEName,
          playerClass.abilityEDescription,
          'text-neon-yellow',
          '#FFD700',
          'linear-gradient(90deg, rgba(255,215,0,0.12) 0%, rgba(255,215,0,0.32) 100%)'
        )
      );
      abilityList.appendChild(
        createAbilityRow(
          playerClass,
          'R',
          playerClass.ultimateName,
          playerClass.ultimateDescription,
          'text-neon-pink',
          '#FF1493',
          'linear-gradient(90deg, rgba(255,20,147,0.12) 0%, rgba(255,20,147,0.32) 100%)'
        )
      );

      card.addEventListener('click', () => {
        tempSelectedClassId = playerClass.id;
        updateCardSelectionStyles();
      });

      cardElements.push({ card, playerClass, color });
      classCardList.appendChild(card);
    });

    updateCardSelectionStyles();
  }

  // Cleanup old listeners to prevent memory leaks when re-opening
  const newBtnCancel = btnCancel.cloneNode(true) as HTMLButtonElement;
  btnCancel.parentNode?.replaceChild(newBtnCancel, btnCancel);
  
  const newBtnConfirm = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode?.replaceChild(newBtnConfirm, btnConfirm);

  newBtnCancel.addEventListener('click', () => {
    hideTooltip();
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (options.onCancel) options.onCancel();
  });

  newBtnConfirm.addEventListener('click', () => {
    hideTooltip();
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
