content = open('src/NetworkManager.ts', 'r', encoding='utf-8').read()

old_type = 'this.socket.on("player-state-update", (data: { playerId: string; playerIndex?: number; state: string }) => {'
new_type = 'this.socket.on("player-state-update", (data: { playerId: string; playerIndex?: number; state: string; remainingPlayers?: number; }) => {'

if old_type in content:
    content = content.replace(old_type, new_type)
    open('src/NetworkManager.ts', 'w', encoding='utf-8').write(content)
    print("Fixed type in NetworkManager.ts")
else:
    print("Could not find old type in NetworkManager.ts")
