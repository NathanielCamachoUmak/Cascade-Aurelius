content = open('src/NetworkManager.ts', 'r', encoding='utf-8').read()

old_prop = 'public onPlayerStateUpdate: ((data: { playerId: string; playerIndex?: number; state: string }) => void) | null = null;'
new_prop = 'public onPlayerStateUpdate: ((data: { playerId: string; playerIndex?: number; state: string; remainingPlayers?: number; }) => void) | null = null;'

if old_prop in content:
    content = content.replace(old_prop, new_prop)
    open('src/NetworkManager.ts', 'w', encoding='utf-8').write(content)
    print("Fixed property type in NetworkManager.ts")
else:
    print("Could not find property type in NetworkManager.ts")
