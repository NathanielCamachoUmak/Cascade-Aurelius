const fs = require('fs');
let ts = fs.readFileSync('src/NetworkManager.ts', 'utf8');

// The easiest way is to just find the string block and replace it
const search = `public kickPlayer(targetId: string) {
        this.socket.emit("kick-player", targetId);
      }
      
    public kickPlayer(targetId: string) {
    this.socket.emit("kick-player", targetId);
  }`;

ts = ts.replace(search, `public kickPlayer(targetId: string) {
    this.socket.emit("kick-player", targetId);
  }`);

// Also fix duplicates if any
ts = ts.replace(/public kickPlayer\(targetId: string\) \{\s*this\.socket\.emit\("kick-player", targetId\);\s*\}\s*public kickPlayer/g, 'public kickPlayer');

fs.writeFileSync('src/NetworkManager.ts', ts);
