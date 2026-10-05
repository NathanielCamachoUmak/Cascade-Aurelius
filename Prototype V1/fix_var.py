content = open('src/lobby.ts', 'r', encoding='utf-8').read()
content = content.replace('const endsAt = matchTimerEndsAt;', 'const endsAt = teamMatchEndsAt;')
open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Fixed variable name")
