import { Difficulty, Room, ServerEvent } from './types';

/**
 * What the TV (the host) can do. The TV owns the game phase; the server stores
 * room state, collects phone answers, scores them and generates questions.
 * Implemented by MockGameClient (local bots) and, from Day 4, the WebSocket client.
 */
export interface GameClient {
  createRoom(): Promise<Room>;
  /** Sets the topic and starts question generation in the background. */
  configure(topic: string, difficulty: Difficulty): void;
  /** timeLimitMs is null in kids mode (no timer). */
  startQuestion(index: number, timeLimitMs: number | null): void;
  reveal(index: number): void;
  endGame(): void;
  subscribe(listener: (event: ServerEvent) => void): () => void;
  close(): void;
}
