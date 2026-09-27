const fs = require('fs');
let code = fs.readFileSync('src/NetworkManager.ts', 'utf8');

// Add onKicked callback
code = code.replace(
  /public onPreGameCountdown\?: \(count: number\) => void;/,
  `public onPreGameCountdown?: (count: number) => void;\n    public onKicked?: () => void;`
);

// Add the socket listener
code = code.replace(
  /this\.socket\.on\('preGameCountdown', \(count\) => \{[\s\S]*?\}\);/,
  `this.socket.on('preGameCountdown', (count) => {
        if (this.onPreGameCountdown) this.onPreGameCountdown(count);
      });
      
      this.socket.on('kicked', () => {
        if (this.onKicked) this.onKicked();
      });`
);

// Add the method
code = code.replace(
  /public addBot\(name\?: string\) \{/,
  `public kickPlayer(targetId: string) {
      this.socket.emit("kick-player", targetId);
    }
    
    public addBot(name?: string) {`
);

fs.writeFileSync('src/NetworkManager.ts', code);
