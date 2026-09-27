const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

code = code.replace(
  /\}\);\n  \}\n\}\);\n\nbtnPlayOnline\.addEventListener/,
  `});\n\nbtnPlayOnline.addEventListener`
);

fs.writeFileSync('src/main.ts', code);
