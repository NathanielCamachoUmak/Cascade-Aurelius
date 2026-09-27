const fs = require('fs');

const replacementHtml = `        <div id="screen-lobby" class="hidden flex-col items-center w-full max-w-[1400px] mx-auto px-4 sm:px-8 pt-20 relative z-10 max-h-[calc(100vh-2rem)] overflow-y-auto pb-10">
          
          <!-- PRE-JOIN STATE: Centered Card -->
          <div id="lobby-auth-panel" class="w-full max-w-lg bg-card-bg/60 backdrop-blur-md border border-card-border rounded-xl p-8 panel-glow flex flex-col gap-6 mt-10">
            <div class="text-center">
              <h1 class="text-3xl font-bold text-white mb-2">Join Lobby</h1>
              <p id="online-mode-label" class="text-neon-cyan text-[10px] font-bold uppercase tracking-[0.2em]"></p>
            </div>

            <div>
              <label for="lobby-nickname-input" class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2 block">Nickname</label>
              <input id="lobby-nickname-input" type="text" placeholder="Enter your nickname..." maxlength="16" class="w-full bg-deep-purple/80 border border-card-border text-white px-4 py-3 text-sm rounded-lg focus:outline-none focus:border-neon-pink focus:shadow-[0_0_15px_rgba(255,20,147,0.2)] transition-all" />
            </div>

            <div>
              <label for="lobby-room-input" class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2 block">Room Code</label>
              <input id="lobby-room-input" type="text" value="test-room" class="w-full bg-deep-purple/80 border border-card-border text-white px-4 py-3 text-sm rounded-lg focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all" />
            </div>

            <div class="flex gap-4 mt-2">
              <button id="btn-host-lobby" class="flex-1 px-5 py-3 bg-neon-pink text-white text-sm font-bold tracking-widest rounded-lg transition-all hover:brightness-110 cursor-pointer shadow-[0_0_15px_rgba(255,20,147,0.2)]">HOST</button>
              <button id="btn-join-lobby" class="flex-1 px-5 py-3 bg-neon-cyan text-deep-purple text-sm font-bold tracking-widest rounded-lg transition-all hover:brightness-110 cursor-pointer shadow-[0_0_15px_rgba(0,255,255,0.2)]">JOIN</button>
            </div>
            <div id="lobby-status" class="text-gray-400 text-xs min-h-[20px] text-center"></div>
            
            <button id="btn-lobby-back-auth" class="mt-4 px-6 py-2.5 w-full bg-transparent border border-card-border text-white text-sm font-bold tracking-widest rounded-lg transition-all hover:bg-white/5 cursor-pointer">
              &lt; BACK
            </button>
          </div>

          <!-- IN-ROOM STATE: Two-Column Layout -->
          <div id="lobby-room-panel" class="hidden w-full flex flex-col gap-6">
            <!-- Header Section -->
            <div class="flex flex-col gap-2 mb-2">
              <div class="flex items-center gap-3">
                <span class="text-neon-cyan text-xs font-bold uppercase tracking-widest">LOBBY</span>
                <span id="lobby-mode-tag" class="bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/40 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">4 Player FFA</span>
              </div>
              <h1 class="text-4xl md:text-5xl font-bold text-white tracking-wide">Ready Up!</h1>
              <p class="text-gray-400 text-sm mt-1">Room Code: <span id="lobby-code-display" class="text-neon-cyan font-bold">BQ-4442</span> &middot; <span id="lobby-host-display">Host's Room</span></p>
            </div>

            <!-- Stats Bar -->
            <div class="flex flex-wrap gap-4 mb-2">
              <div class="bg-card-bg/60 border border-card-border rounded-lg px-6 py-4 min-w-[160px] flex-1 sm:flex-none">
                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Players</div>
                <div id="lobby-stat-players" class="text-neon-cyan text-2xl font-bold">1/4</div>
              </div>
              <div class="bg-card-bg/60 border border-card-border rounded-lg px-6 py-4 min-w-[160px] flex-1 sm:flex-none">
                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Ready</div>
                <div id="lobby-stat-ready" class="text-neon-green text-2xl font-bold">0</div>
              </div>
              <div class="bg-card-bg/60 border border-card-border rounded-lg px-6 py-4 min-w-[160px] flex-1 sm:flex-none">
                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Waiting</div>
                <div id="lobby-stat-waiting" class="text-neon-yellow text-2xl font-bold">1</div>
              </div>
            </div>

            <!-- 2-Column Split -->
            <div class="flex flex-col xl:flex-row gap-6 w-full items-start">
              
              <!-- LEFT: ROSTER -->
              <div class="flex-1 w-full bg-transparent flex flex-col gap-4">
                <div id="lobby-player-list" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- Player Cards will be injected here by TS -->
                </div>
                
                <div class="mt-4 flex items-center gap-3 text-gray-400 text-sm">
                  <div class="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
                  <span id="lobby-footer-status">Waiting for players to ready up...</span>
                </div>
              </div>

              <!-- RIGHT: MENUS -->
              <div class="w-full xl:w-[380px] shrink-0 flex flex-col gap-5">
                
                <!-- Your Status Panel -->
                <div class="bg-[#0f1123] border border-card-border rounded-xl p-5 shadow-lg relative overflow-hidden">
                  <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-cyan to-neon-pink"></div>
                  <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-4">Your Status</div>
                  
                  <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 bg-black/40 border border-gray-600 rounded flex items-center justify-center shrink-0">
                      <!-- Blank class icon placeholder -->
                    </div>
                    <div>
                      <div class="text-neon-cyan font-bold text-lg">You</div>
                      <div id="your-class-display" class="text-neon-yellow text-[10px] font-bold tracking-widest uppercase">CLASS - UNKNOWN</div>
                    </div>
                  </div>

                  <div class="bg-black/30 border border-gray-800 rounded-lg p-4 mb-4 flex items-center justify-between">
                    <div>
                      <div class="text-neon-green font-bold flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                        Ready
                      </div>
                      <div class="text-[9px] text-gray-500 uppercase tracking-widest mt-1">Toggle when set to go</div>
                    </div>
                    <!-- Toggle Switch -->
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" id="lobby-ready-toggle" class="sr-only peer">
                      <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-green shadow-[0_0_10px_rgba(0,255,0,0.1)] peer-checked:shadow-[0_0_15px_rgba(0,255,0,0.4)]"></div>
                    </label>
                  </div>

                  <button id="btn-lobby-start-match" class="w-full hidden bg-card-bg/60 border border-neon-green/50 text-neon-green font-bold tracking-widest uppercase py-3 rounded-lg mb-3 hover:bg-neon-green hover:text-black transition-all shadow-[0_0_15px_rgba(0,255,0,0.15)]">
                    Start Match
                  </button>
                  <button id="btn-lobby-leave" class="w-full bg-transparent border border-neon-pink/30 text-neon-pink font-bold tracking-widest uppercase py-3 rounded-lg hover:bg-neon-pink/10 transition-all text-xs">
                    Leave Lobby
                  </button>
                </div>

                <!-- Change Loadout Panel -->
                <div class="bg-[#0f1123] border border-card-border rounded-xl p-5 shadow-lg">
                  <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-4">Loadout</div>
                  <button id="btn-lobby-change-loadout" class="w-full bg-neon-cyan text-deep-purple font-bold tracking-widest uppercase py-3 rounded-lg hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                    Change Class
                  </button>
                </div>

                <!-- Chat Panel -->
                <div class="bg-[#0f1123] border border-card-border rounded-xl p-5 shadow-lg flex flex-col h-[280px]">
                  <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-3 shrink-0">Lobby Chat</div>
                  
                  <div id="chat-messages" class="flex-1 overflow-y-auto flex flex-col gap-2 mb-3 pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    <!-- Messages go here -->
                  </div>

                  <div class="relative shrink-0 mt-auto">
                    <input type="text" id="chat-input" placeholder="Say something..." class="w-full bg-black/40 border border-gray-700 text-white text-xs px-4 py-3 rounded-lg focus:outline-none focus:border-neon-pink transition-colors pr-10" />
                    <button id="btn-chat-send" class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-neon-pink rounded flex items-center justify-center text-white hover:brightness-110">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>`;

let html = fs.readFileSync('lobby.html', 'utf8');

// Replace the entire <div id="screen-lobby"> ... </div> block
const startIdx = html.indexOf('<div id="screen-lobby"');
// Find the closing div for screen-lobby. Since it's huge, I'll just look for the end of the block.
// The next sibling is <div id="screen-post-game"
const endIdx = html.indexOf('<div id="screen-post-game"');

if (startIdx !== -1 && endIdx !== -1) {
  html = html.substring(0, startIdx) + replacementHtml + '\n        ' + html.substring(endIdx);
  fs.writeFileSync('lobby.html', html);
  console.log('lobby.html updated');
} else {
  console.log('Failed to find screen-lobby');
}
