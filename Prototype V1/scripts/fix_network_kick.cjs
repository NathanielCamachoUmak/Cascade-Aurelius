const fs = require('fs');
let code = fs.readFileSync('src/NetworkManager.ts', 'utf8');

// Add onKicked property
code = code.replace(
  /public onRoomHostChanged: \(\(data: \{ hostId: string \| null \}\) => void\) \| null = null;/,
  `public onRoomHostChanged: ((data: { hostId: string | null }) => void) | null = null;\n  public onKicked: (() => void) | null = null;`
);

// Add listener
code = code.replace(
  /this\.socket\.on\("room-host-changed", \(data: \{ hostId: string \| null \}\) => \{[\s\S]*?\}\);/,
  `this.socket.on("room-host-changed", (data: { hostId: string | null }) => {
      this.onRoomHostChanged?.(data);
    });

    this.socket.on("kicked", () => {
      this.onKicked?.();
    });`
);

// Add kickPlayer method
code = code.replace(
  /public addBot\(name\?: string\) \{/,
  `public kickPlayer(targetId: string) {
    this.socket.emit("kick-player", targetId);
  }

  public addBot(name?: string) {`
);

fs.writeFileSync('src/NetworkManager.ts', code);
