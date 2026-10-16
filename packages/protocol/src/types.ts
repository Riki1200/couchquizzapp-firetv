// Shared by the TV app, the phone controller and the backend (local server and Lambdas).

export type Difficulty = 'easy' | 'medium' | 'hard' | 'kids';

export type GenerationStatus = 'idle' | 'pending' | 'ready' | 'failed';

/** Where a game's questions came from: the built-in bank or the AI host. */
export type QuestionSource = 'bank' | 'ai';

export interface Player {
  id: string;
  name: string;
  avatar: string; // a single emoji
  score: number;
  connected: boolean;
}

export interface Question {
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  quip: string; // the AI host's one-liner shown on reveal
}

export interface PlayerResult {
  playerId: string;
  choice: number | null; // null = no answer
  correct: boolean;
  points: number;
  total: number;
}

export interface Award {
  playerId: string;
  title: string;
  line: string;
}

/** Returned by POST /rooms. */
export interface CreateRoomResponse {
  roomCode: string;
  hostToken: string;
  joinUrl: string;
}

/** Returned by GET /rooms/{code}. */
export interface GetRoomResponse {
  exists: boolean;
  playerCount: number;
}

// ---- WebSocket messages: TV (host) → server ----
export type HostMessage =
  | { action: 'configure'; topic: string; difficulty: Difficulty }
  | { action: 'startQuestion'; index: number }
  | { action: 'reveal'; index: number }
  | { action: 'endGame' };

// ---- WebSocket messages: phone (player) → server ----
export type PlayerMessage =
  | { action: 'join'; name: string; avatar: string }
  | { action: 'answer'; index: number; choice: number };

/** 'sync' asks the server for the current state right after connecting (or reconnecting). */
export type ClientMessage = HostMessage | PlayerMessage | { action: 'sync' } | { action: 'ping' };

// ---- WebSocket events: server → TV ----
export type HostEvent =
  | { type: 'players'; players: Player[] }
  | { type: 'generation'; status: GenerationStatus; topic?: string; questions?: Question[]; source?: QuestionSource }
  | { type: 'answerProgress'; index: number; answeredPlayerIds: string[] }
  | { type: 'reveal'; index: number; results: PlayerResult[] }
  | { type: 'gameOver'; awards: Award[] };

// ---- WebSocket events: server → phone ----
export type PlayerEvent =
  | { type: 'joined'; player: Player }
  | { type: 'lobby'; topic: string | null }
  | {
      type: 'question';
      index: number;
      total: number;
      text: string;
      choices: string[];
      /** Milliseconds left when sent; null in kids mode (no timer). */
      timeLeftMs: number | null;
    }
  | { type: 'answerAck'; index: number; choice: number }
  | { type: 'reveal'; index: number; correctIndex: number; correct: boolean; points: number; total: number }
  | { type: 'gameOver'; rank: number; playerCount: number; score: number; award: Award | null }
  | { type: 'hostLeft' }
  | { type: 'error'; message: string };
