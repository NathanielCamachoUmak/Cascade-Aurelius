import os

with open('src/lobby.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Import initMobileControls
if "import { initMobileControls } from './MobileControls'" not in content:
    content = "import { initMobileControls } from './MobileControls'\n" + content

# Call initMobileControls() when DOM loads or just at top level
if "initMobileControls();" not in content:
    # Let's add it right after standard variables
    content = content.replace("const gameCanvas = safeGet('game-canvas') as HTMLCanvasElement;",
                              "initMobileControls();\nconst gameCanvas = safeGet('game-canvas') as HTMLCanvasElement;")

# game-active class toggle
content = content.replace("gameHud.classList.remove('hidden');", "gameHud.classList.remove('hidden'); document.body.classList.add('game-active');")
content = content.replace("gameHud.classList.add('hidden');", "gameHud.classList.add('hidden'); document.body.classList.remove('game-active');")

with open('src/lobby.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("lobby.ts mobile patch complete.")
