with open('modeselect.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Make the info panels wider
# Find P1 Left Info width
c = c.replace('<!-- P1 Left Info -->\n                  <div class="flex flex-col justify-between w-40 shrink-0 gap-4">', 
              '<!-- P1 Left Info -->\n                  <div class="flex flex-col justify-between w-60 shrink-0 gap-4">')

# Find P2 Right Info width
c = c.replace('<!-- P2 Right Info -->\n                  <div class="flex flex-col justify-between w-40 shrink-0 gap-4">', 
              '<!-- P2 Right Info -->\n                  <div class="flex flex-col justify-between w-60 shrink-0 gap-4">')

# Also remove h-[600px] from the board wrappers to prevent bottom clipping
c = c.replace('shrink-0 overflow-hidden h-[600px]">', 'shrink-0 overflow-hidden">')

with open('modeselect.html', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated modeselect.html widths and heights")
