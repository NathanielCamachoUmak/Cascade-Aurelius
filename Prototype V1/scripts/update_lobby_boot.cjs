const fs = require('fs');
let code = fs.readFileSync('src/lobby.ts', 'utf8');

if (!code.includes('showClassSelectModal')) {
  code = code.replace(
    /import \{ mountAuth \} from '\.\/Auth'/,
    "import { mountAuth } from './Auth'\nimport { showClassSelectModal } from './ClassSelectModal'"
  );
}

const bootRegex = /window\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}\);/;
const newBoot = `window.addEventListener('DOMContentLoaded', () => {
  const bootConfigStr = sessionStorage.getItem('cascade_boot_config');
  if (bootConfigStr) {
    const config = JSON.parse(bootConfigStr);
    
    if (config.mode === 'SOLO' || config.mode === 'VS_BOT') {
      const initialClassId = config.selectedClass?.id || selectedClass;
      // Show loadout menu for single-player modes before starting
      showClassSelectModal({
        initialClassId: initialClassId,
        onConfirm: (classId) => {
          selectedClass = classId;
          if (config.mode === 'SOLO') {
            startGame('SOLO');
          } else {
            startGame(config.botDifficulty === 'HARD' ? 'HARD' : 'EASY');
          }
        }
      });
    } else if (config.mode === 'ONLINE') {
      if (lobby && config.onlineModeId) lobby.selectedMode = config.onlineModeId;
      lobby.show();
    }
  }
});`;

code = code.replace(bootRegex, newBoot);
fs.writeFileSync('src/lobby.ts', code);
