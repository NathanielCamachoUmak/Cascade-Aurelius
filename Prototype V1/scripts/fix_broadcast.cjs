const fs = require('fs');
let code = fs.readFileSync('Server/index.js', 'utf8');

code = code.replace(/broadcastRoomState\(roomId\);/g, "emitRoomState(roomId);");

fs.writeFileSync('Server/index.js', code);
