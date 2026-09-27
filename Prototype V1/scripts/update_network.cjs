const fs = require('fs');
let code = fs.readFileSync('src/NetworkManager.ts', 'utf8');

// Fix hostRoom
code = code.replace(
  /public hostRoom\(roomId: string, name: string, modeId: OnlineModeId\) \{/,
  "public hostRoom(roomId: string, name: string, modeId: OnlineModeId, classId: string) {"
);
code = code.replace(
  /this\.socket\.emit\('host-room', \{ roomId, name, modeId \}\);/,
  "this.socket.emit('host-room', { roomId, name, modeId, classId });"
);

// Fix joinRoom
code = code.replace(
  /public joinRoom\(roomId: string, name: string, modeId: OnlineModeId\) \{/,
  "public joinRoom(roomId: string, name: string, modeId: OnlineModeId, classId: string) {"
);
code = code.replace(
  /this\.socket\.emit\("join-room", \{ roomId, name, modeId \}\);/,
  "this.socket.emit(\"join-room\", { roomId, name, modeId, classId });"
);

fs.writeFileSync('src/NetworkManager.ts', code);
