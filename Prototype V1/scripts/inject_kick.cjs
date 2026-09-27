const fs = require('fs');
let code = fs.readFileSync('src/LobbyScreen.ts', 'utf8');

const targetStr = `<div class="w-1.5 h-1.5 rounded-full \${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>`;
const replacementStr = `\${isHost && !isMe ? \`<button class="kick-btn text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors bg-black/40 border border-red-500/30 rounded px-1.5 py-0.5 mr-1 flex-shrink-0">KICK</button>\` : ''}
            <div class="w-1.5 h-1.5 rounded-full \${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/LobbyScreen.ts', code);
  console.log('Successfully injected kick button HTML!');
} else {
  console.log('Could not find target string.');
}
