const fs = require('fs');

function removeTestButton(filename) {
  if (fs.existsSync(filename)) {
    let html = fs.readFileSync(filename, 'utf8');
    html = html.replace(/<button type="button" id="btn-test-success"[\s\S]*?<\/button>\n?/g, '');
    fs.writeFileSync(filename, html);
    console.log('Removed from', filename);
  }
}

removeTestButton('lobby.html');
removeTestButton('modeselect.html');

let ts = fs.readFileSync('src/Auth.ts', 'utf8');
// Look for the block handling btn-test-success
const blockRegex = /const testSuccessBtn = document\.getElementById\('btn-test-success'\);\s*if\s*\(testSuccessBtn\)\s*\{\s*testSuccessBtn\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?\}\);\s*\}/;
ts = ts.replace(blockRegex, '');
fs.writeFileSync('src/Auth.ts', ts);
console.log('Removed from Auth.ts');
