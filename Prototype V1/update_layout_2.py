import sys

with open('modeselect.html', 'r', encoding='utf-8') as f:
    content = f.read()

abilities_html = """
                    <div id="ability-meter-p1" class="mt-4 flex flex-col gap-1.5" aria-label="Class abilities">
                      <div class="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-1">
                        <kbd class="text-center text-[10px] font-pixel text-neon-cyan">Q</kbd>
                        <span id="ability-q-label-p1" class="truncate text-[9px] font-bold uppercase tracking-wider text-white">ABILITY Q</span>
                        <span id="ability-q-status-p1" class="text-[9px] font-bold text-neon-cyan">READY</span>
                      </div>
                      <div class="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded border border-neon-yellow/30 bg-neon-yellow/5 px-2 py-1">
                        <kbd class="text-center text-[10px] font-pixel text-neon-yellow">E</kbd>
                        <span id="ability-e-label-p1" class="truncate text-[9px] font-bold uppercase tracking-wider text-white">ABILITY E</span>
                        <span id="ability-e-status-p1" class="text-[9px] font-bold text-neon-yellow">READY</span>
                      </div>
                      <div class="rounded border border-neon-magenta/30 bg-neon-magenta/5 px-2 py-1.5">
                        <div class="flex justify-between items-baseline gap-2">
                          <div class="flex min-w-0 items-center gap-2">
                            <kbd class="text-center text-[10px] font-pixel text-neon-magenta">R</kbd>
                            <div id="ability-label-p1" class="truncate text-[9px] text-neon-magenta uppercase font-bold tracking-wider">ULTIMATE</div>
                          </div>
                          <div id="ability-ready-p1" class="hidden whitespace-nowrap text-[9px] text-neon-yellow font-bold">READY</div>
                        </div>
                        <div class="mt-1 w-full bg-deep-purple border border-card-border h-2 rounded-full overflow-hidden">
                          <div id="ability-fill-p1" class="h-full bg-neonMagenta transition-all rounded-full" style="width: 0%"></div>
                        </div>
                        <div id="ability-r-status-p1" class="mt-1 text-right text-[9px] font-bold text-neon-magenta">0 LINES</div>
                      </div>
                    </div>
"""

p2_abilities = abilities_html.replace('-p1', '-p2').replace('ABILITY Q', 'ABILITY').replace('ABILITY E', 'ABILITY').replace('ULTIMATE', 'ULTIMATE')

# Replace the `<div id="level-p1" class="text-lg font-bold">0</div>` with it appended
content = content.replace(
    '<div id="level-p1" class="text-lg font-bold">0</div>\n                    </div>',
    '<div id="level-p1" class="text-lg font-bold">0</div>\n                    </div>' + abilities_html
)

content = content.replace(
    '<div id="level-p2" class="text-lg font-bold">0</div>\n                    </div>',
    '<div id="level-p2" class="text-lg font-bold">0</div>\n                    </div>' + p2_abilities
)

# Remove the hidden compatibility block for ability-meter
content = content.replace('<div id="ability-meter-p1" class="hidden">', '<!-- <div id="ability-meter-p1" class="hidden">')

with open('modeselect.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added abilities back to UI")
