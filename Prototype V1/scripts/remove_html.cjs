const fs = require('fs');
let html = fs.readFileSync('modeselect.html', 'utf8');

const regex = /<div id="screen-class-select"[\s\S]*?<!-- [^>]*Screen: Difficulty Select[^>]*-->/;

if (regex.test(html)) {
  html = html.replace(regex, '<!-- Screen: Difficulty Select -->');
  fs.writeFileSync('modeselect.html', html);
  console.log('Class select removed');
} else {
  console.log('Not found');
}
