import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

pattern = r"  classCardList\.innerHTML = '';\n.*?classCardList\.appendChild\(card\);\n  \}\n\}"

replacement = """  classCardList.innerHTML = '';
  const roleMap: Record<string, string> = {
    'Speedster': 'AGILITY FIGHTER',
    'Tank': 'HEAVY DEFENDER',
    'Saboteur': 'GRID DISRUPTOR',
    'Support': 'TACTICAL UTILITY'
  };

  for (const info of PLAYER_CLASSES) {
    const isSelected = info.id === selectedClass;
    const card = document.createElement('button');
    const roleText = roleMap[info.name] || 'CLASS ROLE';
    
    let selectedClasses = '';
    let hoverClasses = '';
    let accentColorClass = 'text-neon-cyan';

    if (info.name === 'Speedster') {
      selectedClasses = 'border-neon-yellow shadow-[inset_0_0_0_1px_rgba(255,215,0,1),_0_0_26px_rgba(255,215,0,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-yellow hover:shadow-[0_0_0_3px_rgba(255,215,0,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-yellow';
    } else if (info.name === 'Tank') {
      selectedClasses = 'border-neon-cyan shadow-[inset_0_0_0_1px_rgba(0,255,255,1),_0_0_26px_rgba(0,255,255,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-cyan hover:shadow-[0_0_0_3px_rgba(0,255,255,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-cyan';
    } else if (info.name === 'Saboteur') {
      selectedClasses = 'border-neon-pink shadow-[inset_0_0_0_1px_rgba(255,20,147,1),_0_0_26px_rgba(255,20,147,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-pink hover:shadow-[0_0_0_3px_rgba(255,20,147,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-pink';
    } else if (info.name === 'Support') {
      selectedClasses = 'border-neon-green shadow-[inset_0_0_0_1px_rgba(0,255,0,1),_0_0_26px_rgba(0,255,0,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-green hover:shadow-[0_0_0_3px_rgba(0,255,0,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-green';
    } else {
      selectedClasses = 'border-neon-cyan shadow-[inset_0_0_0_1px_rgba(0,255,255,1),_0_0_26px_rgba(0,255,255,0.2)] -translate-y-1';
      hoverClasses = 'hover:border-neon-cyan hover:shadow-[0_0_0_3px_rgba(0,255,255,0.18),0_14px_26px_rgba(0,0,0,0.26)]';
      accentColorClass = 'text-neon-cyan';
    }

    const unselectedClasses = `border-card-border hover:-translate-y-1 ${hoverClasses}`;
    const baseClasses = "flex-1 flex flex-col items-start bg-card-bg/80 rounded-[12px] border text-left p-6 transition-all duration-150 cursor-pointer min-h-[380px] w-full";
    
    card.className = `${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
    
    const qDesc = info.abilityQDescription.replace(/^Q [·\\-] (.*?s cooldown:?)\\s*/i, '($1) ');
    const eDesc = info.abilityEDescription.replace(/^E [·\\-] (.*?cooldown:?|once per level:?)\\s*/i, '($1) ');
    const rDesc = info.ultimateDescription.replace(/^R [·\\-] (.*?(?:lines|cost):?)\\s*/i, '');
    const passDesc = info.passiveDescription.replace(/^Passive:\\s*/i, '');

    card.innerHTML = `
      <span class="${accentColorClass} text-[0.72rem] font-black uppercase tracking-[0.16em] mb-2">${roleText}</span>
      <h3 class="text-[clamp(1.4rem,2.5vw,1.75rem)] font-extrabold leading-tight mb-2 text-white">${info.name}</h3>
      <p class="text-gray-400 text-[0.92rem] leading-relaxed mb-4">${info.tagline}</p>
      
      <div class="mt-auto w-full pt-4 border-t border-card-border flex flex-col gap-3">
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-gray-300 font-bold block mb-0.5">Passive</span>
          <span class="text-gray-400">${passDesc}</span>
        </div>
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-neon-cyan font-bold block mb-0.5">${info.abilityQName} [Q]</span>
          <span class="text-neon-cyan/80">${qDesc}</span>
        </div>
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-neon-yellow font-bold block mb-0.5">${info.abilityEName} [E]</span>
          <span class="text-neon-yellow/80">${eDesc}</span>
        </div>
        <div class="text-[0.8rem] leading-relaxed">
          <span class="text-neon-pink font-bold block mb-0.5">${info.ultimateName} [R] <span class="text-neon-pink/60 ml-1">(${info.ultimateCost} lines)</span></span>
          <span class="text-neon-pink/80">${rDesc}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      selectedClass = info.id;
      renderClassCards();
    });
    classCardList.appendChild(card);
  }
}"""

new_ts = re.sub(pattern, lambda m: replacement, ts, flags=re.DOTALL)

if new_ts != ts:
    with open('src/main.ts', 'w', encoding='utf-8') as f:
        f.write(new_ts)
    print("Successfully replaced class cards!")
else:
    print("No match found for class cards")
