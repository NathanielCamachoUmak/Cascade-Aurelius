import re

with open('modeselect.html', 'r', encoding='utf-8') as f:
    html = f.read()

pattern = r' *<div id="screen-class-select".*?<!-- ───── Screen: Online Lobby ───── -->'

replacement = """        <div id="screen-class-select" class="hidden flex-col items-start w-full max-w-7xl px-8 relative z-10 mx-auto pt-16 pb-16">
          <div class="mb-10 w-full text-left">
            <h2 class="text-neon-cyan text-[0.72rem] font-black tracking-[0.18em] uppercase mb-4">LOADOUT PREPARATION</h2>
            <h1 class="text-[clamp(1.7rem,5vw,3.25rem)] leading-none tracking-tight font-extrabold mb-5 text-white">Choose your class</h1>
            <p class="text-gray-400 text-[clamp(0.95rem,2vw,1.08rem)] leading-relaxed max-w-3xl">Select a tactical class for your upcoming match. Your class dictates your passive advantage, active abilities, and ultimate power.</p>
          </div>

          <div id="class-card-list" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 w-full mb-10">
            <!-- Class cards injected by main.ts from PLAYER_CLASSES -->
          </div>

          <div class="flex flex-wrap sm:flex-nowrap gap-5 w-full items-center mt-6">
            <button id="btn-class-back" class="order-2 sm:order-1 px-8 py-3 min-h-[46px] w-full sm:w-auto bg-transparent border border-card-border text-white font-extrabold tracking-[0.07em] rounded-[10px] uppercase transition-all hover:bg-white/5 cursor-pointer mr-auto">
              BACK
            </button>
            <button id="btn-class-continue" class="order-1 sm:order-2 px-10 py-3 min-h-[46px] w-full sm:w-auto bg-neon-cyan text-[#061019] font-extrabold tracking-[0.07em] rounded-[10px] uppercase transition-all hover:brightness-110 cursor-pointer shadow-[0_0_15px_rgba(0,255,255,0.3)]">
              CONFIRM LOADOUT
            </button>
          </div>
        </div>

        <!-- ───── Screen: Online Lobby ───── -->"""

new_html = re.sub(pattern, lambda m: replacement, html, flags=re.DOTALL)

if new_html != html:
    with open('modeselect.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
    print("Successfully replaced screen-class-select in HTML!")
else:
    print("No match found for screen-class-select in HTML")
