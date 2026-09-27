const fs = require('fs');
let code = fs.readFileSync('src/NetworkManager.ts', 'utf8');

if (!code.includes('onChatMessage')) {
  // add to callbacks
  code = code.replace(
    /public onRoomUpdate:/,
    "public onChatMessage: ((data: {sender: string; text: string}) => void) | null = null;\n  public onRoomUpdate:"
  );

  // add listener in constructor
  code = code.replace(
    /this\.socket\.on\("room-update"/,
    "this.socket.on('chatMessage', (data: {sender: string; text: string}) => { this.onChatMessage?.(data); });\n    this.socket.on(\"room-update\""
  );
  
  // add sendChatMessage and changeClass methods
  code = code.replace(
    /public startLobbyNow\(\) \{/,
    `public sendChatMessage(msg: string) {
      this.socket.emit("chatMessage", msg);
    }
    public changeClass(classId: string) {
      this.socket.emit("changeClass", classId);
    }
    public startLobbyNow() {`
  );
}

if (!code.includes('public leaveRoom()')) {
  code = code.replace(
    /public startLobbyNow\(\) \{/,
    `public leaveRoom() {
      this.socket.emit("leave-lobby");
      this.socket.disconnect();
    }
    public startLobbyNow() {`
  );
}

fs.writeFileSync('src/NetworkManager.ts', code);
