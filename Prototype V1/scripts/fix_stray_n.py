with open('modeselect.html', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('`n', '\n')

with open('modeselect.html', 'w', encoding='utf-8') as f:
    f.write(c)
