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

// Change this if your server ever runs somewhere other than localhost:3000
const SERVER_URL = "http://localhost:3000";

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
  public onOpponentScoreUpdate: ((playerIndex: number, data: ScoreData) => void) | null = null;
  public onOpponentToppedOut: ((playerIndex: number) => void) | null = null;
  public onReceiveGarbage: ((count: number) => void) | null = null;
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
      this.onReceiveGarbage?.(count);
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

  // --- Connection management ---

  public disconnect() {
    this.socket.disconnect();
  }
}