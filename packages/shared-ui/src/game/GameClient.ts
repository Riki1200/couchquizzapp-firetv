import { Difficulty, HostEvent, Room } from './types';

/** Server events plus the client's own connection state. */
export type GameClientEvent = HostEvent | { type: 'connection'; connected: boolean };

/**
 * What the TV (the host) can do. The TV owns the game phase; the server stores
 * room state, collects phone answers, scores them and generates questions.
 * Implemented by MockGameClient (local bots, no server) and WsGameClient.
 */
export interface GameClient {
  createRoom(): Promise<Room>;
  /** Sets the topic, resets scores and starts question generation in the background. */
  configure(topic: string, difficulty: Difficulty): void;
  startQuestion(index: number): void;
  reveal(index: number): void;
  endGame(): void;
  subscribe(listener: (event: GameClientEvent) => void): () => void;
  close(): void;
}
