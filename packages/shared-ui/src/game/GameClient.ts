import { Difficulty, FamilyStanding, HostEvent, Language, Room } from './types';

/** Server events plus the client's own connection state. */
export type GameClientEvent = HostEvent | { type: 'connection'; connected: boolean };

/**
 * What the TV (the host) can do. The TV owns the game phase; the server stores
 * room state, collects phone answers, scores them and generates questions.
 * Implemented by MockGameClient (local bots, no server) and WsGameClient.
 */
export interface GameClient {
  /** `familyId` identifies this TV for the family scores. */
  createRoom(familyId: string | null): Promise<Room>;
  /** Starts a game: sets the topic, resets scores (and teams) and generates questions in the background. */
  configure(topic: string, difficulty: Difficulty, language: Language, questionCount: number, teams: boolean): void;
  startQuestion(index: number): void;
  reveal(index: number): void;
  endGame(): void;
  getFamily(familyId: string): Promise<FamilyStanding[]>;
  /** A few topic ideas ("Surprise me"). */
  topicIdeas(language: Language, difficulty: Difficulty): Promise<string[]>;
  subscribe(listener: (event: GameClientEvent) => void): () => void;
  close(): void;
}
