import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Add the justification toggle to render()
old_routing = """    if (gameManager.players.length > 1) {
      setDisplay('p2-pod', 'flex');
    } else {
      setDisplay('p2-pod', 'hidden');
    }"""

new_routing = """    if (gameManager.players.length > 1) {
      setDisplay('p2-pod', 'flex');
      const p1 = document.getElementById('p1-pod');
      if (p1) { p1.classList.remove('justify-center'); p1.classList.add('justify-end'); }
    } else {
      setDisplay('p2-pod', 'hidden');
      const p1 = document.getElementById('p1-pod');
      if (p1) { p1.classList.remove('justify-end'); p1.classList.add('justify-center'); }
    }"""

if old_routing in ts:
    ts = ts.replace(old_routing, new_routing)
    with open('src/main.ts', 'w', encoding='utf-8') as f:
        f.write(ts)
    print("Updated p1-pod justification!")
else:
    print("Could not find the routing block.")
