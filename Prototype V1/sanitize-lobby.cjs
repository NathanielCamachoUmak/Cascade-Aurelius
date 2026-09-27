const fs = require('fs');

let content = fs.readFileSync('src/lobby.ts', 'utf8');

// Replace ! with ? for all DOM queries so we don't crash on missing elements
content = content.replace(/document\.getElementById\((.*?)\)!/g, 'document.getElementById($1)');

// We need to inject the boot sequence at the bottom
const bootSequence = `
// ---- BOOT SEQUENCE ----
window.addEventListener('DOMContentLoaded', () => {
  const bootConfigStr = sessionStorage.getItem('cascade_boot_config');
  if (!bootConfigStr) {
    // Fallback if accessed directly
    window.location.href = 'modeselect.html';
    return;
  }
  
  const config = JSON.parse(bootConfigStr);
  const selectedClass = config.selectedClass || PLAYER_CLASSES[0];
  
  // Highlight navbar
  updateNavHighlight('nav-lobby');
  
  if (config.mode === 'SOLO') {
    startGame('SOLO');
  } else if (config.mode === 'VS_BOT') {
    // Simulate difficulty start
    botDifficulty = config.botDifficulty === 'HARD' ? 'HARD' : 'EASY';
    startGame('VS_BOT');
  } else if (config.mode === 'ONLINE') {
    lobby.selectedMode = config.onlineModeId || '1v1';
    lobby.show();
  }
});
`;

// Remove the "Menu Event Listeners" and Class Select rendering that we don't need
// and replace with boot sequence
const menuEventIndex = content.indexOf('// Menu Event Listeners');
if (menuEventIndex !== -1) {
    // Keep everything above menuEventIndex
    content = content.substring(0, menuEventIndex) + bootSequence;
}

// Write it back
fs.writeFileSync('src/lobby.ts', content);
