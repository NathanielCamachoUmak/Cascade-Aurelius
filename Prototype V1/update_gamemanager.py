import re

with open("src/GameManager.ts", "r", encoding="utf-8") as f:
    content = f.read()

new_method = """  public applyTdmRespawn(playerIndex: number) {"""

round_start_method = """  public startNewRound() {
    for (const player of this.players) {
      if (player.state === 'playing' && !player.isToppedOut) {
        player.grid.clear();
        player.currentPiece = null;
      }
    }
    if (this.myPlayerIndex >= 0) {
      this.spawnFloatingScoreUiPopup('NEW ROUND!');
    }
  }

  public applyTdmRespawn(playerIndex: number) {"""

content = content.replace(new_method, round_start_method)

with open("src/GameManager.ts", "w", encoding="utf-8") as f:
    f.write(content)
