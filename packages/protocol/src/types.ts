// Shared by the TV app, the phone controller and the backend (local server and Lambdas).
import type { Language } from './i18n';

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
  /** Team index (see TEAMS) in team mode; null when everyone plays for themselves. */
  team: number | null;
}

/** A topic a phone suggested in the lobby; the TV can pick it with the D-pad. */
export interface TopicSuggestion {
  playerId: string;
  name: string;
  avatar: string;
  topic: string;
}

/** One person's totals over every game finished on the same TV (matched by name). */
export interface FamilyStanding {
  name: string;
  avatar: string;
  games: number;
  wins: number;
  points: number;
  best: number;
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
  /** Correct answers in a row, including this one (0 after a miss). */
  streak: number;
}

export interface Award {
  playerId: string;
  title: string;
  line: string;
}

/** Body of POST /rooms (optional): the TV's family id, for the family scores. */
export interface CreateRoomRequest {
  familyId?: string;
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
  language: Language;
}

/** Returned by GET /topic-ideas?language=&difficulty=. */
export interface TopicIdeasResponse {
  topics: string[];
}

/** Where the end-of-game awards came from: the AI host, or rules when the AI is unavailable. */
export type AwardSource = 'ai' | 'rules';

// ---- WebSocket messages: TV (host) → server ----
export type HostMessage =
  | { action: 'configure'; topic: string; difficulty: Difficulty; language: Language; questionCount: number; teams: boolean }
  | { action: 'startQuestion'; index: number }
  | { action: 'reveal'; index: number }
  | { action: 'endGame' };

// ---- WebSocket messages: phone (player) → server ----
export type PlayerMessage =
  | { action: 'join'; name: string; avatar: string }
  | { action: 'answer'; index: number; choice: number }
  | { action: 'suggestTopic'; topic: string };

/** 'sync' asks the server for the current state right after connecting (or reconnecting). */
export type ClientMessage = HostMessage | PlayerMessage | { action: 'sync' } | { action: 'ping' };

// ---- WebSocket events: server → TV ----
export type HostEvent =
  | { type: 'players'; players: Player[] }
  | {
      type: 'generation';
      status: GenerationStatus;
      topic?: string;
      questions?: Question[];
      source?: QuestionSource;
      /** AI questions were checked by a second model (and flagged ones replaced). */
      factChecked?: boolean;
    }
  | { type: 'topicSuggestions'; suggestions: TopicSuggestion[] }
  | { type: 'answerProgress'; index: number; answeredPlayerIds: string[] }
  | { type: 'reveal'; index: number; results: PlayerResult[] }
  | { type: 'gameOver'; awards: Award[]; source: AwardSource; family: FamilyStanding[] };

// ---- WebSocket events: server → phone ----
export type PlayerEvent =
  | { type: 'joined'; player: Player }
  | { type: 'lobby'; topic: string | null; language: Language; team: number | null }
  | {
      type: 'question';
      index: number;
      total: number;
      text: string;
      choices: string[];
      /** Milliseconds left when sent; null in kids mode (no timer). */
      timeLeftMs: number | null;
      /** The final question is worth double points. */
      double: boolean;
    }
  | { type: 'answerAck'; index: number; choice: number }
  | { type: 'reveal'; index: number; correctIndex: number; correct: boolean; points: number; total: number; streak: number }
  | {
      type: 'gameOver';
      rank: number;
      playerCount: number;
      score: number;
      award: Award | null;
      /** Team mode: the player's team and whether it won (null on a tie). */
      team: number | null;
      teamWon: boolean | null;
    }
  | { type: 'hostLeft' }
  | { type: 'error'; message: string };
