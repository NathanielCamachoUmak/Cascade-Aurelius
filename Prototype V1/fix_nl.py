with open('modeselect.html', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('`n<canvas id="effects-canvas"', '\n<canvas id="effects-canvas"')

with open('modeselect.html', 'w', encoding='utf-8') as f:
    f.write(c)
