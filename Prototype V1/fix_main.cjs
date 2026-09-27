const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

code = code.replace(
  /const onlineModeSelect = mountOnlineModeSelect\(\{[\s\S]*?\}\);/,
  `mountOnlineModeSelect({
  container: screenOnlineModeSelect,
  onBack: () => {
    updateNavHighlight('nav-modes');
    screenOnlineModeSelect.classList.remove('flex');
    screenOnlineModeSelect.classList.add('hidden');
    screenMain.classList.remove('hidden');
    screenMain.classList.add('flex');
  },
  onConfirm: (mode) => {
    onlineModeId = mode.id;
    bootGame({ mode: 'ONLINE', onlineModeId });
  }
});`
);

code = code.replace(
  /onlineModeSelect\.show\(\);/,
  `screenOnlineModeSelect.classList.remove('hidden');
  screenOnlineModeSelect.classList.add('flex');`
);

fs.writeFileSync('src/main.ts', code);
