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

export interface GameStartData {
  players: { id: string; name: string; index: number }[];
  myIndex: number;
}

export interface PieceData {
  type: string;
  x: number;
  y: number;
  rotationIndex: number;
}

export interface ScoreData {
  score: number;
  lines: number;
  combo: number;
  multiplier: number;
}

// In production, set VITE_SERVER_URL in Vercel to your public tunnel URL.
// Locally it falls back to localhost:3000 automatically.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export class NetworkManager {
  private socket: Socket;
  public mySocketId: string = "";

  // --- Lobby callbacks ---
  public onRoomUpdate: ((state: RoomState) => void) | null = null;
  public onJoinError: ((message: string) => void) | null = null;
  public onConnected: (() => void) | null = null;

  // --- Game callbacks ---
  public onGameStart: ((data: GameStartData) => void) | null = null;
  public onOpponentGridUpdate: ((playerIndex: number, grid: any[][]) => void) | null = null;
  public onOpponentPieceUpdate: ((playerIndex: number, piece: PieceData | null) => void) | null = null;
  public onOpponentScoreUpdate: (playerIndex: number, scoreData: ScoreData) => void = () => {};
  public onOpponentToppedOut: (playerIndex: number) => void = () => {};
  public onReceiveGarbage: (count: number) => void = () => {};
  public onShowRibbon: (message: string) => void = () => {};
  public onGameOver: ((winnerId: string, winnerName: string) => void) | null = null;

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

    // --- Game events ---

    this.socket.on("game-start", (data: GameStartData) => {
      this.onGameStart?.(data);
    });

    this.socket.on("opponent-grid-update", ({ playerIndex, grid }: { playerIndex: number; grid: any[][] }) => {
      this.onOpponentGridUpdate?.(playerIndex, grid);
    });

    this.socket.on("opponent-piece-update", ({ playerIndex, piece }: { playerIndex: number; piece: PieceData | null }) => {
      this.onOpponentPieceUpdate?.(playerIndex, piece);
    });

    this.socket.on("opponent-score-update", ({ playerIndex, score, lines, combo, multiplier }: { playerIndex: number; score: number; lines: number; combo: number; multiplier: number }) => {
      this.onOpponentScoreUpdate?.(playerIndex, { score, lines, combo, multiplier });
    });

    this.socket.on("opponent-topped-out", ({ playerIndex }: { playerIndex: number }) => {
      this.onOpponentToppedOut?.(playerIndex);
    });

    this.socket.on("receive-garbage", ({ count }: { count: number }) => {
      this.onReceiveGarbage(count);
    });

    this.socket.on("show-ribbon", ({ message }: { message: string }) => {
      this.onShowRibbon(message);
    });

    this.socket.on("game-over", ({ winnerId, winnerName }: { winnerId: string; winnerName: string }) => {
      this.onGameOver?.(winnerId, winnerName);
    });
  }

  // --- Lobby emitters ---

  public joinRoom(roomId: string, name: string) {
    this.socket.emit("join-room", { roomId, name });
  }

  public setReady(ready: boolean) {
    this.socket.emit("player-ready", { ready });
  }

  // --- Game emitters ---

  public sendGridUpdate(grid: any[][]) {
    this.socket.emit("grid-update", { grid });
  }

  public sendPieceUpdate(piece: PieceData | null) {
    this.socket.emit("piece-update", { piece });
  }

  public sendScoreUpdate(data: ScoreData) {
    this.socket.emit("score-update", data);
  }

  public sendToppedOut() {
    this.socket.emit("player-topped-out");
  }

  public sendGarbage(count: number) {
    this.socket.emit("send-garbage", { count });
  }

  public sendRibbon(message: string) {
    this.socket.emit("broadcast-ribbon", { message });
  }

  // --- Connection management --- 

  public disconnect() {
    this.socket.disconnect();
  }
}