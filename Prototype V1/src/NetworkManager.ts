import { io, Socket } from "socket.io-client";

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
}

export interface RoomState {
  roomId: string;
  players: LobbyPlayer[];
}

// Change this if your server ever runs somewhere other than localhost:3000
const SERVER_URL = "http://localhost:3000";

export class NetworkManager {
  private socket: Socket;
  public mySocketId: string = "";

  public onRoomUpdate: ((state: RoomState) => void) | null = null;
  public onJoinError: ((message: string) => void) | null = null;
  public onConnected: (() => void) | null = null;

  constructor() {
    this.socket = io(SERVER_URL);

    this.socket.on("connect", () => {
      this.mySocketId = this.socket.id ?? "";
      this.onConnected?.();
    });

    this.socket.on("room-update", (state: RoomState) => {
      this.onRoomUpdate?.(state);
    });

    this.socket.on("join-error", (err: { message: string }) => {
      this.onJoinError?.(err.message);
    });
  }

  public joinRoom(roomId: string, name: string) {
    this.socket.emit("join-room", { roomId, name });
  }

  public setReady(ready: boolean) {
    this.socket.emit("player-ready", { ready });
  }
}