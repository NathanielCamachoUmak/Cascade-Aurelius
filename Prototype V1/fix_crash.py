content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_cull_check = """  const otherIndices: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    if (i !== myIndex && !(gameManager.players[i] as any).isCulled) {
      otherIndices.push(i);
    }
  }"""

new_cull_check = """  const otherIndices: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    if (i !== myIndex) {
      const p = gameManager.players[i];
      if (!p || !(p as any).isCulled) {
        otherIndices.push(i);
      }
    }
  }"""

content = content.replace(old_cull_check, new_cull_check)
open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Fixed computeBoardLayout crash!")
