const fs = require('fs');
let html = fs.readFileSync('lobby.html', 'utf8');

const modalHtml = `
  <!-- Modal: Class Select (Lobby) -->
  <div id="modal-class-select" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] hidden items-center justify-center p-4">
    <div class="bg-[#0f1123] border border-card-border rounded-xl p-8 max-w-6xl w-full flex flex-col max-h-[90vh] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      <div class="mb-6 shrink-0">
        <h2 class="text-neon-cyan text-[10px] font-black tracking-[0.2em] uppercase mb-2">Loadout Preparation</h2>
        <h1 class="text-3xl font-extrabold text-white">Choose your class</h1>
      </div>
      
      <div id="lobby-class-card-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <!-- Cards injected by TS -->
      </div>
      
      <div class="flex justify-end gap-4 mt-6 shrink-0 pt-4 border-t border-card-border">
        <button id="btn-lobby-class-cancel" class="px-8 py-3 bg-transparent border border-card-border text-white font-bold tracking-widest rounded-lg hover:bg-white/5 transition-all text-sm">CANCEL</button>
        <button id="btn-lobby-class-confirm" class="px-10 py-3 bg-neon-cyan text-deep-purple font-bold tracking-widest rounded-lg hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)] text-sm">EQUIP CLASS</button>
      </div>
    </div>
  </div>
`;

if (!html.includes('id="modal-class-select"')) {
  html = html.replace('</body>', modalHtml + '\n</body>');
  fs.writeFileSync('lobby.html', html);
  console.log('lobby.html updated with modal');
}
