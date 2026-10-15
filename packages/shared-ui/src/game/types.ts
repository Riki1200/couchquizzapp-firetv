// Game types live in packages/protocol (shared with the phone controller and the backend).
export * from '@couch-quiz/protocol';

export interface Room {
  roomCode: string;
  joinUrl: string;
}
