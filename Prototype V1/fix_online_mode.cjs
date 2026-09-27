const fs = require('fs');
let code = fs.readFileSync('src/lobby.ts', 'utf8');

code = code.replace(
  /\} else if \(config\.mode === 'ONLINE'\) \{/,
  `} else if (config.mode === 'ONLINE') {
      if (config.onlineModeId) selectedOnlineMode = config.onlineModeId;`
);

fs.writeFileSync('src/lobby.ts', code);
