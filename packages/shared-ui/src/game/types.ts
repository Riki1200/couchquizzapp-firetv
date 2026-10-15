// Game domain types shared by the TV screens and the game clients.
// Moves to packages/protocol on Day 4 so the Lambdas and the phone controller can share it.

export type Difficulty = 'easy' | 'medium' | 'hard' | 'kids';

export type GenerationStatus = 'idle' | 'pending' | 'ready' | 'failed';

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

export interface Room {
  roomCode: string;
  joinUrl: string;
}

/** Events the server pushes to the TV. */
export type ServerEvent =
  | { type: 'players'; players: Player[] }
  | { type: 'generation'; status: GenerationStatus; questions?: Question[] }
  | { type: 'answerProgress'; index: number; answeredPlayerIds: string[] }
  | { type: 'reveal'; index: number; results: PlayerResult[] }
  | { type: 'gameOver'; awards: Award[] };
