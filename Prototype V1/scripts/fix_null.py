import sys
import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(
    r"(abilityMeterP2\.classList\.remove\('hidden'\);\s*abilityMeterP2\.classList\.add\('flex'\);)",
    r"if (abilityMeterP2) { \1",
    c
)

c = re.sub(
    r"(abilityLabelP2\.innerText = classInfo2\.abilityName;\s*abilityFillP2\.style\.width = `\$\{Math\.min\(100, \(p2\.scoreManager\.totalLinesCleared / classInfo2\.abilityCost\) \* 100\)\}%`;\s*\})",
    r"if(abilityLabelP2 && abilityFillP2) { \1 }",
    c
)

c = re.sub(
    r"(\} else \{\s*abilityMeterP2\.classList\.add\('hidden'\);\s*abilityMeterP2\.classList\.remove\('flex'\);\s*\})",
    r"\1 }",
    c
)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(c)
