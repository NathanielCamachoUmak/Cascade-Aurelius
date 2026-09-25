with open('src/main.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "const koCountP1 = document.getElementById('ko-count-p1')!;",
    "const koCountP1 = document.getElementById('ko-count-p1')!;\nconst abilityMeterP2 = document.getElementById('ability-meter-p2');\nconst abilityLabelP2 = document.getElementById('ability-label-p2');\nconst abilityFillP2 = document.getElementById('ability-fill-p2');"
)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(c)
