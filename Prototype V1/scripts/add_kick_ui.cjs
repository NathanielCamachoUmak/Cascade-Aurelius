const fs = require('fs');
let ts = fs.readFileSync('src/LobbyScreen.ts', 'utf8');

// Add kick button to HTML
const targetHTML = `<div class="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold \\\${p.ready ? 'text-neon-green' : 'text-gray-500'}">
            <div class="w-1.5 h-1.5 rounded-full \\\${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>
            \\\${p.ready ? 'Ready' : 'Not ready'}`;

const replacementHTML = `<div class="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold \\\${p.ready ? 'text-neon-green' : 'text-gray-500'}">
            \\\${isHost && !isMe ? \`<button class="kick-btn text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors bg-black/40 border border-red-500/30 rounded px-1.5 py-0.5 mr-1" data-id="\${p.id}">KICK</button>\` : ''}
            <div class="w-1.5 h-1.5 rounded-full \\\${p.ready ? 'bg-neon-green' : 'bg-gray-500'}"></div>
            \\\${p.ready ? 'Ready' : 'Not ready'}`;

ts = ts.replace(targetHTML, replacementHTML);

// Add event listener to kick buttons
const targetListeners = `if (isMyBot) {
        const editBtn = card.querySelector('.class-label-edit');`;

const replacementListeners = `if (isHost && !isMe) {
        const kickBtn = card.querySelector('.kick-btn');
        kickBtn?.addEventListener('click', () => {
          if (confirm(\`Kick \${p.name} from the lobby?\`)) {
            network?.kickPlayer(p.id);
          }
        });
      }
      
      if (isMyBot) {
        const editBtn = card.querySelector('.class-label-edit');`;

ts = ts.replace(targetListeners, replacementListeners);

// Add onKicked handler
const targetOnKicked = `network.onPreGameCountdown = (count: number) => {
      footerStatus.innerText = \`Match starting in \${count}...\`;
    };`;

const replacementOnKicked = `network.onPreGameCountdown = (count: number) => {
      footerStatus.innerText = \`Match starting in \${count}...\`;
    };
    
    network.onKicked = () => {
      alert("You have been kicked from the lobby.");
      options.onLeaveToMenu();
    };`;

ts = ts.replace(targetOnKicked, replacementOnKicked);

fs.writeFileSync('src/LobbyScreen.ts', ts);
