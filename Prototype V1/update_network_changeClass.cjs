const fs = require('fs');
let code = fs.readFileSync('src/NetworkManager.ts', 'utf8');

code = code.replace(
  /public changeClass\(classId: string\) \{[\s\S]*?\}/,
  `public changeClass(classId: string, targetId?: string) {
    this.socket.emit("changeClass", { classId, targetId });
  }`
);

fs.writeFileSync('src/NetworkManager.ts', code);
