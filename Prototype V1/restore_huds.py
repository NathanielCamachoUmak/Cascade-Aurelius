import re

with open('modeselect.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. First, we need to extract the backward compatibility block and replace it with the proper BR HUDs.
# Remove the old backward compatibility block entirely.
block_to_remove = """            <!-- Kept for backwards compatibility with main.ts if it expects them outside -->
            <div id="hud-p1" class="hidden"></div>
            <div id="hud-p2" class="hidden">
               <div id="ability-meter-p2"></div>
               <div id="ability-label-p2"></div>
               <div id="ability-fill-p2"></div>
            </div>
            <div id="ko-count-badge-p1" class="hidden"><span id="ko-decay-p1"></span></div>
            <div id="team-match-strip" class="hidden"><span id="team-score-cyan"></span><span id="team-score-magenta"></span><span id="team-match-timer"></span></div>
            <!-- <div id="ability-meter-p1" class="hidden">
               <div id="ability-q-label-p1"></div><div id="ability-q-status-p1"></div>
               <div id="ability-e-label-p1"></div><div id="ability-e-status-p1"></div>
               <div id="ability-label-p1"></div><div id="ability-ready-p1"></div>
               <div id="ability-fill-p1"></div><div id="ability-r-status-p1"></div>
            </div>"""

if block_to_remove in html:
    html = html.replace(block_to_remove, "")

# 2. Inject the BR HUDs around `canvas-container`.
# We need to find `<div id="canvas-container" ...` and wrap it.
canvas_container = """            <!-- Global Canvas for Battle Royale / Fallback -->
            <div id="canvas-container" class="w-full flex-1 min-w-0 flex items-center justify-start p-4 max-h-[82vh] overflow-x-auto overflow-y-hidden">
              <canvas id="gameCanvas" class="h-auto object-contain rounded-lg border border-card-border shadow-2xl shrink-0"></canvas>
            </div>"""

br_hud_p1 = """
            <!-- BR HUD P1 -->
            <div id="hud-p1-br" class="hidden flex-col gap-4 w-48 shrink-0">
              <div class="hud-panel p-4 text-center h-32 flex flex-col justify-between">
                <h3 class="text-[10px] font-bold text-gray-400 tracking-widest">HOLD</h3>
                <canvas id="hold-canvas-p1-br" width="90" height="90" class="mx-auto"></canvas>
              </div>
              <div class="hud-panel p-4 text-center min-h-32 flex flex-col justify-between">
                <h3 class="text-[10px] font-bold text-gray-400 tracking-widest">NEXT</h3>
                <canvas id="next-canvas-p1-br" width="90" height="90" class="mx-auto"></canvas>
                <div id="next-queue-p1-br" class="mt-2 text-[9px] font-pixel tracking-[0.15em] text-neon-cyan"></div>
              </div>
              <div class="hud-panel p-4">
                <h3 class="text-neon-cyan text-[10px] font-bold tracking-widest mb-3 glow-cyan">YOU</h3>
                <div class="mb-4">
                  <div class="text-[10px] text-gray-400 uppercase tracking-wider">Score</div>
                  <div id="score-p1-br" class="text-xl font-bold font-pixel text-neon-cyan">0</div>
                </div>
                <div id="ko-count-badge-p1-br" class="mb-4 hidden">
                  <div class="text-[10px] text-gray-400 uppercase tracking-wider">K.O. Count</div>
                  <div class="flex items-baseline gap-2">
                    <span id="ko-count-p1-br" class="text-xl font-bold font-pixel text-neon-pink">0</span>
                    <span id="ko-decay-p1-br" class="text-[10px] text-gray-500 uppercase tracking-wider"></span>
                  </div>
                </div>
                <div class="mb-4">
                  <div class="text-[10px] text-gray-400 uppercase tracking-wider">Multiplier</div>
                  <div id="multiplier-p1-br" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
                </div>
                <div class="mb-4">
                  <div class="text-[10px] text-gray-400 uppercase tracking-wider">Effects</div>
                  <div id="combo-p1-br" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
                </div>
                <div class="mb-2">
                  <div class="text-[10px] text-gray-400 uppercase tracking-wider">Lines</div>
                  <div id="level-p1-br" class="text-lg font-bold">0</div>
                </div>
                <div id="ability-meter-p1-br" class="mt-2 flex flex-col gap-1.5" aria-label="Class abilities">
                  <div class="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-1">
                    <kbd class="text-center text-[10px] font-pixel text-neon-cyan">Q</kbd>
                    <span id="ability-q-label-p1-br" class="truncate text-[9px] font-bold uppercase tracking-wider text-white">ABILITY Q</span>
                    <span id="ability-q-status-p1-br" class="text-[9px] font-bold text-neon-cyan">READY</span>
                  </div>
                  <div class="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded border border-neon-yellow/30 bg-neon-yellow/5 px-2 py-1">
                    <kbd class="text-center text-[10px] font-pixel text-neon-yellow">E</kbd>
                    <span id="ability-e-label-p1-br" class="truncate text-[9px] font-bold uppercase tracking-wider text-white">ABILITY E</span>
                    <span id="ability-e-status-p1-br" class="text-[9px] font-bold text-neon-yellow">READY</span>
                  </div>
                  <div class="rounded border border-neon-magenta/30 bg-neon-magenta/5 px-2 py-1.5">
                    <div class="flex justify-between items-baseline gap-2">
                      <div class="flex min-w-0 items-center gap-2">
                        <kbd class="text-center text-[10px] font-pixel text-neon-magenta">R</kbd>
                        <div id="ability-label-p1-br" class="truncate text-[9px] text-neon-magenta uppercase font-bold tracking-wider">ULTIMATE</div>
                      </div>
                      <div id="ability-ready-p1-br" class="hidden whitespace-nowrap text-[9px] text-neon-yellow font-bold">READY</div>
                    </div>
                    <div class="mt-1 w-full bg-deep-purple border border-card-border h-2 rounded-full overflow-hidden">
                      <div id="ability-fill-p1-br" class="h-full bg-neonMagenta transition-all rounded-full" style="width: 0%"></div>
                    </div>
                    <div id="ability-r-status-p1-br" class="mt-1 text-right text-[9px] font-bold text-neon-magenta">0 LINES</div>
                  </div>
                </div>
              </div>
            </div>
"""

br_hud_p2 = """
            <!-- BR HUD P2 (used occasionally as fallback) -->
            <div id="hud-p2-br" class="absolute -bottom-24 right-[15%] flex gap-6 w-auto shrink-0 hidden hud-panel p-4 shadow-lg shadow-deep-purple/50 z-10">
               <div class="flex flex-col">
                 <div class="text-[10px] text-gray-400 uppercase tracking-wider">Score</div>
                 <div id="score-p2-br" class="text-lg font-bold font-pixel text-neonMagenta">0</div>
               </div>
               <div class="flex flex-col">
                 <div class="text-[10px] text-gray-400 uppercase tracking-wider">Mult</div>
                 <div id="multiplier-p2-br" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
               </div>
               <div class="flex flex-col">
                 <div class="text-[10px] text-gray-400 uppercase tracking-wider">Effects</div>
                 <div id="combo-p2-br" class="text-neonYellow text-sm font-bold min-h-[20px]"></div>
               </div>
               <div class="flex flex-col">
                 <div class="text-[10px] text-gray-400 uppercase tracking-wider">Lines</div>
                 <div id="level-p2-br" class="text-lg font-bold">0</div>
               </div>
               <div id="ability-meter-p2-br" class="hidden flex-col justify-center w-24">
                 <div id="ability-label-p2-br" class="text-[10px] text-neonMagenta uppercase font-bold mb-1 tracking-wider"></div>
                 <div class="w-full bg-deep-purple border border-card-border h-3 rounded-full overflow-hidden">
                   <div id="ability-fill-p2-br" class="h-full bg-neonMagenta transition-all rounded-full" style="width: 0%"></div>
                 </div>
               </div>
            </div>
            
            <div id="team-match-strip" class="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 bg-card-bg/90 backdrop-blur-md px-6 py-2 rounded-full border border-card-border shadow-lg mt-2 hidden">
              <div class="px-5 py-3 text-neon-cyan font-pixel text-xs text-right">CYAN <span id="team-score-cyan" class="text-lg ml-2">0</span></div>
              <div id="team-match-timer" class="px-4 py-3 font-pixel text-[10px] text-neon-yellow border-x border-card-border">3:00</div>
              <div class="px-5 py-3 text-neon-pink font-pixel text-xs"><span id="team-score-magenta" class="text-lg mr-2">0</span> MAGENTA</div>
            </div>
"""

new_canvas_section = br_hud_p1 + canvas_container + br_hud_p2

html = html.replace(canvas_container, new_canvas_section)

with open('modeselect.html', 'w', encoding='utf-8') as f:
    f.write(html)
    
print("Updated modeselect.html")
