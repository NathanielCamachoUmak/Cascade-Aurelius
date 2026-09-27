const fs = require('fs');
let code = fs.readFileSync('Server/index.js', 'utf8');

// Update host-room
code = code.replace(
  /socket\.on\('host-room', \(\{\s*roomId,\s*name,\s*modeId\s*\}\) => \{/,
  "socket.on('host-room', ({ roomId, name, modeId, classId }) => {"
);
code = code.replace(
  /isHost: true,\s*ready: false/g,
  "isHost: true, ready: false, classId: classId || 'SPEEDSTER'"
);

// Update join-room
code = code.replace(
  /socket\.on\('join-room', \(\{\s*roomId,\s*name,\s*modeId\s*\}\) => \{/,
  "socket.on('join-room', ({ roomId, name, modeId, classId }) => {"
);
code = code.replace(
  /isHost: false,\s*ready: false/g,
  "isHost: false, ready: false, classId: classId || 'SPEEDSTER'"
);

// We already added chatMessage and changeClass earlier.
fs.writeFileSync('Server/index.js', code);
console.log('Server updated');
