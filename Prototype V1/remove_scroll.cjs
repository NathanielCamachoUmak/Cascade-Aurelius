const fs = require('fs');
let html = fs.readFileSync('lobby.html', 'utf8');

html = html.replace(/max-h-\[calc\(100vh-2rem\)\] overflow-y-auto /g, '');

fs.writeFileSync('lobby.html', html);
