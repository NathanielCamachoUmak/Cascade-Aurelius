import os

with open('src/lobby.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add postGameTime declaration
if "const postGameTime =" not in content:
    content = content.replace("const postGameWinner = safeGet('post-game-winner')!;",
                              "const postGameWinner = safeGet('post-game-winner')!;\nconst postGameTime = safeGet('post-game-time')!;")

# Helper function formatGameTime
helper_func = """
function formatGameTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
"""

if "function formatGameTime" not in content:
    content = content.replace("function handleOfflineGameOver() {", helper_func + "\nfunction handleOfflineGameOver() {")

# Update logic inside network.onPostGameStart
# We find where postGameWinner.innerText is set for network
net_update = """
    const timeStr = formatGameTime(gameManager.gameTime);
    postGameTime.innerText = `You survived for ${timeStr} amount of time`;
    postGameTime.classList.remove('hidden');
"""

# Insert it around line 833 / 829
if "postGameTime.innerText =" not in content:
    content = content.replace("postGameWinner.innerText = isDraw ? 'MATCH DRAW' : `${data.winnerName} WINS`;",
                              "postGameWinner.innerText = isDraw ? 'MATCH DRAW' : `${data.winnerName} WINS`;\n" + net_update)

# Update logic inside handleOfflineGameOver
if "postGameTime.classList.remove" not in content.split("function handleOfflineGameOver()")[1]:
    content = content.replace("setPostGameButtonLabels('PLAY AGAIN', 'MODE SELECT');",
                              net_update + "\n  setPostGameButtonLabels('PLAY AGAIN', 'MODE SELECT');")

with open('src/lobby.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("lobby.ts patched.")
