content = open('src/lobby.ts', 'r', encoding='utf-8').read()

# The hud innerHTML replacement didn't work - the indentation is different. Let's fix it directly.
# Find the exact NEXT PHASE label and replace it
content = content.replace(
    '<span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">NEXT PHASE</span>',
    '<span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">ROUND TIMER</span>'
)

# Fix the CULL THRESHOLD label to be more descriptive
content = content.replace(
    '<span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">CULL THRESHOLD</span>',
    '<span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">ELIMINATED AT END</span>'
)

# Fix the timer initial text from dash to 3:00
content = content.replace(
    '<span id="br-phase-timer" class="text-white font-pixel text-[13px] mt-0.5 tabular-nums">—</span>',
    '<span id="br-phase-timer" class="text-white font-pixel text-[13px] mt-0.5 tabular-nums">3:00</span>'
)

open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Done!")
