content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_pre = """  network.onPreGameCountdown = (seconds: number) => {
    preGameOverlay.classList.remove('hidden');
    gameManager.players[gameManager.myPlayerIndex].inputHandler.freeze();
    let s = seconds;
    preGameText.innerText = s.toString();
    const interval = setInterval(() => {
      s--;
      if (s > 0) {
        preGameText.innerText = s.toString();
      } else if (s === 0) {
        preGameText.innerText = "GO!";
        gameManager.players[gameManager.myPlayerIndex].inputHandler.unfreeze();
      } else {
        clearInterval(interval);
        preGameOverlay.classList.add('hidden');
      }
    }, 1000);
  };"""

new_pre = """  network.onPreGameCountdown = (seconds: number) => {
    preGameOverlay.classList.remove('hidden');
    const p = gameManager.players[gameManager.myPlayerIndex ?? -1];
    if (p && p.inputHandler) p.inputHandler.freeze();
    let s = seconds;
    preGameText.innerText = s.toString();
    const interval = setInterval(() => {
      s--;
      if (s > 0) {
        preGameText.innerText = s.toString();
      } else if (s === 0) {
        preGameText.innerText = "GO!";
        const pGo = gameManager.players[gameManager.myPlayerIndex ?? -1];
        if (pGo && pGo.inputHandler) pGo.inputHandler.unfreeze();
      } else {
        clearInterval(interval);
        preGameOverlay.classList.add('hidden');
      }
    }, 1000);
  };"""

content = content.replace(old_pre, new_pre)
open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Safe pregame countdown")
