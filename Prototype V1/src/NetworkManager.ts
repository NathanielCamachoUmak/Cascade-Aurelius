import { io, Socket } from "socket.io-client";

import type { OnlineModeId } from './OnlineModeSelect';

export interface RoomMode {
  id: OnlineModeId;
  title: string;
  format: string;
  capacity: number;
  teamSize: number;
  isTeamMode: boolean;
  winnerRule: string;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  state: 'lobby' | 'playing' | 'spectating';
  index: number;
  team: 'cyan' | 'magenta' | null;
  score: number;
  lines: number;
}

export interface RoomState {
  roomId: string;
  phase: 'lobby' | 'countdown' | 'in-game' | 'post-game';
  players: LobbyPlayer[];
  capacity: number;
  teamSize: number;
  matchEndsAt: number | null;
  teamScores: { cyan: number; magenta: number };
  mode: RoomMode;
}

export interface GameStartData {
  players: { id: string; name: string; index: number; team: 'cyan' | 'magenta' | null }[];
  myIndex: number;
  teamScores: { cyan: number; magenta: number };
  modeId: OnlineModeId;
  mode: RoomMode;
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

export type ClassEffectType = 'FREEZE' | 'CHAOS' | 'SCRAMBLE' | 'GRID_SHIFT' | 'EARTHQUAKE' | 'GUARDIAN_ANGEL';
export interface ClassEffectData {
  type: ClassEffectType;
  durationMs?: number;
  amount?: number;
  direction?: -1 | 1;
  targetIndex?: number;
}

// In production, set VITE_SERVER_URL in Vercel to your public tunnel URL.
// Locally it falls back to localhost:3000 automatically.
const SERVER_URL = (import.meta as ImportMeta & { env?: { VITE_SERVER_URL?: string } }).env?.VITE_SERVER_URL || "http://localhost:3000";

export class NetworkManager {
  private socket: Socket;
  public mySocketId: string = "";
  public currentRoomId: string | null = null;

  // --- Lobby callbacks ---
  public onRoomUpdate: ((state: RoomState) => void) | null = null;
  public onJoinError: ((message: string) => void) | null = null;
  public onConnected: (() => void) | null = null;
  public onConfirmJoin: ((data: { currentRoom: string; newRoom: string; newModeId?: OnlineModeId }) => void) | null = null;
  public onCountdownStart: ((seconds: number) => void) | null = null;
  public onCountdownCancel: (() => void) | null = null;
  public onPreGameCountdown: ((seconds: number) => void) | null = null;
  public onPlayerStateUpdate: ((data: { playerId: string; state: string }) => void) | null = null;
  public onPostGameStart: ((data: { winnerId: string; winnerName: string; winnerTeam: 'cyan' | 'magenta' | null; teamScores: { cyan: number; magenta: number }; reason: string }) => void) | null = null;
  public onRematchUpdate: ((data: { votes: number; required: number }) => void) | null = null;
  public onPlayerDisconnected: ((data: { playerId: string }) => void) | null = null;
  public onTeamScoreUpdate: ((data: { playerIndex?: number; playerId?: string; teamScores: { cyan: number; magenta: number } }) => void) | null = null;
  public onMatchTimerStart: ((data: { endsAt: number; durationMs: number }) => void) | null = null;
  public onClassEffect: ((data: ClassEffectData) => void) | null = null;

  // --- Game callbacks ---
  public onGameStart: ((data: GameStartData) => void) | null = null;
  public onOpponentGridUpdate: ((playerIndex: number, grid: any[][]) => void) | null = null;
  public onOpponentPieceUpdate: ((playerIndex: number, piece: PieceData | null) => void) | null = null;
  public onOpponentScoreUpdate: (playerIndex: number, scoreData: ScoreData) => void = () => {};
  public onOpponentToppedOut: (playerIndex: number) => void = () => {};
  public onReceiveGarbage: (count: number, fromIndex?: number) => void = () => {};
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

    this.socket.on("post-game-start", (data: { winnerId: string; winnerName: string; winnerTeam: 'cyan' | 'magenta' | null; teamScores: { cyan: number; magenta: number }; reason: string }) => {
      this.onPostGameStart?.(data);
    });

    this.socket.on("rematch-update", (data: { votes: number; required: number }) => {
      this.onRematchUpdate?.(data);
    });
    
    this.socket.on("player-disconnected", (data: { playerId: string }) => {
      this.onPlayerDisconnected?.(data);
    });

    this.socket.on("team-score-update", (data: { playerIndex?: number; playerId?: string; teamScores: { cyan: number; magenta: number } }) => {
      this.onTeamScoreUpdate?.(data);
    });

    this.socket.on("match-timer-start", (data: { endsAt: number; durationMs: number }) => {
      this.onMatchTimerStart?.(data);
    });

    this.socket.on("class-effect", (data: ClassEffectData) => {
      this.onClassEffect?.(data);
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

    this.socket.on("receive-garbage", ({ count, fromIndex }: { count: number; fromIndex?: number }) => {
      this.onReceiveGarbage(count, fromIndex);
    });

    this.socket.on("show-ribbon", ({ message }: { message: string }) => {
      this.onShowRibbon(message);
    });

    this.socket.on("game-over", ({ winnerId, winnerName }: { winnerId: string; winnerName: string }) => {
      this.onGameOver?.(winnerId, winnerName);
    });
  }

  // --- Lobby emitters ---

  public joinRoom(roomId: string, name: string, modeId: OnlineModeId) {
    this.socket.emit("join-room", { roomId, name, modeId });
  }

  public confirmJoin(newRoomId: string, name: string, modeId: OnlineModeId) {
    this.socket.emit("confirm-join", { newRoomId, name, modeId });
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

  public sendClassAbility(effect: ClassEffectData) {
    this.socket.emit("class-ability", effect);
  }

  public sendReflectedGarbage(targetIndex: number, count: number) {
    this.socket.emit("reflect-garbage", { targetIndex, count });
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
