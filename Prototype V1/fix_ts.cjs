const fs = require('fs');

// Fix lobby.ts casting
let lobbyTs = fs.readFileSync('src/lobby.ts', 'utf8');
lobbyTs = lobbyTs.replace(
  /selectedClass = classId;/,
  "selectedClass = classId as PlayerClass;"
);
fs.writeFileSync('src/lobby.ts', lobbyTs);

// Fix LobbyScreen.ts state.mode.playerCount -> state.mode.capacity
let lobbyScreenTs = fs.readFileSync('src/LobbyScreen.ts', 'utf8');
lobbyScreenTs = lobbyScreenTs.replace(
  /statPlayers\.innerText = \`\$\{state\.players\.length\}\/\$\{state\.mode\.playerCount\}\`;/,
  "statPlayers.innerText = `${state.players.length}/${state.mode.capacity}`;"
);
fs.writeFileSync('src/LobbyScreen.ts', lobbyScreenTs);
