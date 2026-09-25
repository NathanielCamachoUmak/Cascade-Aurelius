with open('modeselect.html', 'r', encoding='utf-8') as f:
    c = f.read()

# I will find the exact string that is at the end of my new_html injection
marker = """            <!-- <div id="ability-meter-p1" class="hidden">
               <div id="ability-q-label-p1"></div><div id="ability-q-status-p1"></div>
               <div id="ability-e-label-p1"></div><div id="ability-e-status-p1"></div>
               <div id="ability-label-p1"></div><div id="ability-ready-p1"></div>
               <div id="ability-fill-p1"></div><div id="ability-r-status-p1"></div>
            </div>"""

if marker in c:
    c = c.replace(marker, marker + "\n            </div> <!-- closes game-layout-wrapper -->")
    with open('modeselect.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Added missing closing div")
else:
    print("Marker not found!")
