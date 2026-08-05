import { io, Socket } from "socket.io-client";

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  state: 'lobby' | 'playing' | 'spectating';
}

export interface RoomState {
  roomId: string;
  phase: 'lobby' | 'countdown' | 'in-game' | 'post-game';
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
  public currentRoomId: string | null = null;

  // --- Lobby callbacks ---
  public onRoomUpdate: ((state: RoomState) => void) | null = null;
  public onJoinError: ((message: string) => void) | null = null;
  public onConnected: (() => void) | null = null;
  public onConfirmJoin: ((data: { currentRoom: string; newRoom: string }) => void) | null = null;
  public onCountdownStart: ((seconds: number) => void) | null = null;
  public onCountdownCancel: (() => void) | null = null;
  public onPreGameCountdown: ((seconds: number) => void) | null = null;
  public onPlayerStateUpdate: ((data: { playerId: string; state: string }) => void) | null = null;
  public onPostGameStart: ((data: { winnerId: string; winnerName: string }) => void) | null = null;
  public onRematchUpdate: ((data: { votes: number; required: number }) => void) | null = null;
  public onPlayerDisconnected: ((data: { playerId: string }) => void) | null = null;

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
      this.currentRoomId = state.roomId;
      this.onRoomUpdate?.(state);
    });

    this.socket.on("join-error", (err: { message: string }) => {
      this.onJoinError?.(err.message);
    });

    this.socket.on("confirm-join", (data: { currentRoom: string; newRoom: string }) => {
      this.onConfirmJoin?.(data);
    });

    this.socket.on("countdown-start", (seconds: number) => {
      this.onCountdownStart?.(seconds);
    });

    this.socket.on("countdown-cancel", () => {
      this.onCountdownCancel?.();
    });

    this.socket.on("pre-game-countdown", (seconds: number) => {
      this.onPreGameCountdown?.(seconds);
    });

    this.socket.on("player-state-update", (data: { playerId: string; state: string }) => {
      this.onPlayerStateUpdate?.(data);
    });

    this.socket.on("post-game-start", (data: { winnerId: string; winnerName: string }) => {
      this.onPostGameStart?.(data);
    });

    this.socket.on("rematch-update", (data: { votes: number; required: number }) => {
      this.onRematchUpdate?.(data);
    });
    
    this.socket.on("player-disconnected", (data: { playerId: string }) => {
      this.onPlayerDisconnected?.(data);
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

    this.socket.on("opponent-score-update", (data: any) => {
      this.onOpponentScoreUpdate?.(data.playerIndex, { score: data.score, lines: data.lines, combo: data.combo, multiplier: data.multiplier });
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

  public confirmJoin(newRoomId: string, name: string) {
    this.socket.emit("confirm-join", { newRoomId, name });
  }

  public leaveLobby() {
    this.currentRoomId = null;
    this.socket.emit("leave-lobby");
  }

  public setReady(ready: boolean) {
    this.socket.emit("player-ready", { ready });
  }

  public voteRematch() {
    this.socket.emit("vote-rematch");
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

  public sendEliminated() {
    this.socket.emit("player-eliminated");
  }

  public sendGameOver(winnerName: string) {
    this.socket.emit("game-over", { winnerName });
  }

  public sendGarbage(count: number) {
    this.socket.emit("send-garbage", { count });
  }

  public sendRibbon(message: string) {
    this.socket.emit("broadcast-ribbon", { message });
  }

  // --- Connection management --- 

  public disconnect() {
    this.currentRoomId = null;
    this.socket.disconnect();
  }
}