import sys
import re

with open('modeselect.html', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace the whole layout block from `<!-- The HUD wraps around the Canvas -->`
# up to `<!-- Player 2 HUD --> ... </div>`

start_marker = "<!-- The HUD wraps around the Canvas -->"
# We need to find the end of hud-p2
hud_p2_str = 'id="hud-p2"'
hud_p2_idx = content.find(hud_p2_str)

# Find the closing div of hud-p2
def find_closing_div(html, start_idx):
    idx = html.find('>', start_idx) + 1
    depth = 1
    while depth > 0 and idx < len(html):
        next_open = html.find('<div', idx)
        next_close = html.find('</div', idx)
        
        if next_open == -1: next_open = float('inf')
        if next_close == -1: next_close = float('inf')
        
        if next_close < next_open:
            depth -= 1
            idx = next_close + 6
        else:
            depth += 1
            idx = next_open + 4
    return idx

end_idx = find_closing_div(content, hud_p2_idx)
start_idx = content.find(start_marker)

if start_idx == -1 or hud_p2_idx == -1:
    print("Could not find markers")
    sys.exit(1)

new_html = """<!-- The HUD wraps around the Canvas -->
          <div id="game-layout-wrapper" class="relative flex justify-center items-start gap-4 w-full max-w-[1800px] px-8 h-[600px]">
            
            <!-- SOLO & 1V1 Layout container -->
            <div id="duo-layout-container" class="hidden w-full flex justify-center items-center gap-6">
              
              <!-- PLAYER 1 POD -->
              <div id="p1-pod" class="flex justify-end items-stretch gap-4 flex-1">
                <!-- P1 Left Info -->
                <div class="flex flex-col justify-between w-40 shrink-0 gap-4">
                  <!-- Hold -->
                  <div class="hud-panel p-4 text-center flex flex-col justify-center bg-card-bg/80 border border-card-border rounded-xl">
                    <h3 class="text-[10px] font-bold text-gray-400 tracking-widest mb-2">HOLD</h3>
                    <canvas id="hold-canvas-p1" width="90" height="90" class="mx-auto"></canvas>
                  </div>
                  <!-- Stats -->
                  <div class="hud-panel p-4 text-center bg-card-bg/80 border border-card-border rounded-xl">
                    <h3 class="text-neon-cyan text-[10px] font-bold tracking-widest mb-3 glow-cyan">YOU</h3>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Score</div>
                      <div id="score-p1" class="text-xl font-bold font-pixel text-neon-cyan">0</div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Lines Sent</div>
                      <div id="ko-count-p1" class="text-lg font-bold font-pixel text-neon-pink">0</div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Multiplier</div>
                      <div id="multiplier-p1" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Effects</div>
                      <div id="combo-p1" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Lines</div>
                      <div id="level-p1" class="text-lg font-bold">0</div>
                    </div>
                  </div>
                </div>

                <!-- P1 Board -->
                <div class="relative p-2 bg-card-bg/80 border-2 border-neon-cyan rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.2)] shrink-0 overflow-hidden h-[600px]">
                  <canvas id="board-p1" width="300" height="600" class="bg-black/50 rounded"></canvas>
                </div>

                <!-- P1 Right Info -->
                <div class="flex flex-col justify-between w-32 shrink-0 gap-4">
                  <!-- Next -->
                  <div class="hud-panel p-4 text-center flex flex-col justify-start bg-card-bg/80 border border-card-border rounded-xl h-full">
                    <h3 class="text-[10px] font-bold text-gray-400 tracking-widest mb-2">NEXT</h3>
                    <canvas id="next-canvas-p1" width="90" height="360" class="mx-auto"></canvas>
                    <div id="next-queue-p1" class="hidden"></div> <!-- kept for legacy code compat -->
                  </div>
                </div>
              </div>

              <!-- Scoreboard (Middle) -->
              <div id="multiplayer-scoreboard" class="hidden shrink-0 hud-panel p-4 z-20 pointer-events-auto min-w-[200px] h-fit self-center bg-card-bg/90 border border-card-border rounded-xl">
                <h3 class="text-[10px] font-bold text-neonYellow tracking-widest uppercase mb-3 glow-yellow text-center">SCOREBOARD</h3>
                <div id="scoreboard-entries" class="flex flex-col gap-2"></div>
              </div>

              <!-- PLAYER 2 POD -->
              <div id="p2-pod" class="hidden justify-start items-stretch gap-4 flex-1">
                <!-- P2 Left Info (Mirrored: Next) -->
                <div class="flex flex-col justify-between w-32 shrink-0 gap-4">
                  <div class="hud-panel p-4 text-center flex flex-col justify-start bg-card-bg/80 border border-card-border rounded-xl h-full">
                    <h3 class="text-[10px] font-bold text-gray-400 tracking-widest mb-2">NEXT</h3>
                    <canvas id="next-canvas-p2" width="90" height="360" class="mx-auto"></canvas>
                    <div id="next-queue-p2" class="hidden"></div>
                  </div>
                </div>

                <!-- P2 Board -->
                <div class="relative p-2 bg-card-bg/80 border-2 border-neon-magenta rounded-xl shadow-[0_0_20px_rgba(255,0,255,0.2)] shrink-0 overflow-hidden h-[600px]">
                  <canvas id="board-p2" width="300" height="600" class="bg-black/50 rounded"></canvas>
                </div>

                <!-- P2 Right Info (Mirrored: Hold, Stats) -->
                <div class="flex flex-col justify-between w-40 shrink-0 gap-4">
                  <div class="hud-panel p-4 text-center flex flex-col justify-center bg-card-bg/80 border border-card-border rounded-xl">
                    <h3 class="text-[10px] font-bold text-gray-400 tracking-widest mb-2">HOLD</h3>
                    <canvas id="hold-canvas-p2" width="90" height="90" class="mx-auto"></canvas>
                  </div>
                  <div class="hud-panel p-4 text-center bg-card-bg/80 border border-card-border rounded-xl">
                    <h3 class="text-neon-magenta text-[10px] font-bold tracking-widest mb-3 glow-pink">OPPONENT</h3>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Score</div>
                      <div id="score-p2" class="text-xl font-bold font-pixel text-neon-magenta">0</div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Lines Sent</div>
                      <div id="ko-count-p2" class="text-lg font-bold font-pixel text-neon-pink">0</div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Multiplier</div>
                      <div id="multiplier-p2" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Effects</div>
                      <div id="combo-p2" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
                    </div>
                    <div class="mb-2">
                      <div class="text-[10px] text-gray-400 uppercase tracking-wider">Lines</div>
                      <div id="level-p2" class="text-lg font-bold">0</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Global Canvas for Battle Royale / Fallback -->
            <div id="canvas-container" class="w-full flex-1 min-w-0 flex items-center justify-start p-4 max-h-[82vh] overflow-x-auto overflow-y-hidden">
              <canvas id="gameCanvas" class="h-auto object-contain rounded-lg border border-card-border shadow-2xl shrink-0"></canvas>
            </div>
            
            <!-- Kept for backwards compatibility with main.ts if it expects them outside -->
            <div id="hud-p1" class="hidden"></div>
            <div id="hud-p2" class="hidden">
               <div id="ability-meter-p2"></div>
               <div id="ability-label-p2"></div>
               <div id="ability-fill-p2"></div>
            </div>
            <div id="ko-count-badge-p1" class="hidden"><span id="ko-decay-p1"></span></div>
            <div id="team-match-strip" class="hidden"><span id="team-score-cyan"></span></div>
            <div id="ability-meter-p1" class="hidden">
               <div id="ability-q-label-p1"></div><div id="ability-q-status-p1"></div>
               <div id="ability-e-label-p1"></div><div id="ability-e-status-p1"></div>
               <div id="ability-label-p1"></div><div id="ability-ready-p1"></div>
               <div id="ability-fill-p1"></div><div id="ability-r-status-p1"></div>
            </div>
"""

new_content = content[:start_idx] + new_html + content[end_idx:]

with open('modeselect.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Updated modeselect.html")
