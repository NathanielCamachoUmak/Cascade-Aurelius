const fs = require('fs');
let code = fs.readFileSync('src/LobbyScreen.ts', 'utf8');

const regex = /card\.innerHTML = \`[\s\S]*?\`;\n      return card;\n    \};/;
const replacement = `const isMyBot = p.isBot && network?.mySocketId === state.hostId;
      card.innerHTML = \`
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded border border-gray-600 bg-black/40 flex items-center justify-center shrink-0"></div>
            <div>
              <div class="\${nameColor} font-bold flex items-center gap-2">
                \${p.name}
                \${isMe ? '<span class="bg-neon-yellow text-black text-[8px] px-1 rounded font-bold uppercase">YOU</span>' : ''}
                \${p.isBot ? '<span class="bg-gray-600 text-white text-[8px] px-1 rounded font-bold uppercase">BOT</span>' : ''}
                \${isHost && !p.isBot ? '<span class="text-orange-500 text-xs">👑</span>' : ''}
              </div>
              <div class="class-label-edit text-[9px] text-neon-cyan font-bold tracking-widest uppercase \${isMyBot ? 'cursor-pointer hover:text-white transition-colors' : ''}">\${cInfo.name} \${isMyBot ? '✎' : ''}</div>
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
    };`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/LobbyScreen.ts', code);
