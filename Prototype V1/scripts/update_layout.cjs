const fs = require('fs');
let html = fs.readFileSync('lobby.html', 'utf8');

// Replace pt-20 with pt-8
html = html.replace(
  /<div id="screen-lobby" class="(.*?)pt-20(.*?)"/g,
  '<div id="screen-lobby" class="$1pt-8$2"'
);

// Move Header and Stats into Left Column
const headerStatsRegex = /<!-- Header Section -->([\s\S]*?)<!-- 2-Column Split -->\s*<div class="flex flex-col xl:flex-row gap-6 w-full items-start">\s*<!-- LEFT: ROSTER -->\s*<div class="flex-1 w-full bg-transparent flex flex-col gap-4">/;

const match = html.match(headerStatsRegex);
if (match) {
  const headerAndStats = match[1];
  const replacement = `<!-- 2-Column Split -->
            <div class="flex flex-col xl:flex-row gap-8 w-full items-start">
              
              <!-- LEFT: ROSTER -->
              <div class="flex-1 w-full bg-transparent flex flex-col gap-4">\n${headerAndStats}`;
  
  html = html.replace(headerStatsRegex, replacement);
  fs.writeFileSync('lobby.html', html);
  console.log('lobby.html updated for layout');
} else {
  console.log('Regex failed to match');
}
