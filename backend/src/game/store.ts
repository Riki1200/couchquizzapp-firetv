import { Difficulty, FamilyStanding, GenerationStatus, Language, Player, Question, QuestionSource, TopicSuggestion } from '@couch-quiz/protocol';

export type Phase = 'lobby' | 'question' | 'reveal' | 'podium';

export interface RoomRecord {
  roomCode: string;
  hostToken: string;
  hostConnId: string | null;
  phase: Phase;
  topic: string | null;
  difficulty: Difficulty;
  language: Language;
  questionCount: number;
  generation: GenerationStatus;
  /** Ignores results of a generation that was superseded by a newer configure. */
  generationId: string | null;
  questions: Question[];
  questionSource: QuestionSource | null;
  factChecked: boolean;
  /** Counts the games played in this room; answers are stored per round so a rematch starts clean. */
  round: number;
  teams: boolean;
  /** The TV's family id: finished games add to its family scores. */
  familyId: string | null;
  /** Topics suggested by the phones in the lobby. */
  suggestions: TopicSuggestion[];
  /** Bank game in play: marked as played when the game is completed. */
  bankKey: string | null;
  bankQuestionIds: string[];
  questionIndex: number;
  questionStartedAt: number | null;
  questionDeadline: number | null;
  createdAt: number;
}

export interface PlayerRecord extends Player {
  joinedAt: number;
  connId: string | null;
  correctMs: number[];
  ranks: number[]; // rank after each question, for the "comeback" award
  streak: number;
  bestStreak: number;
}

export interface AnswerRecord {
  playerId: string;
  choice: number;
  ms: number; // time from question start to the server receiving the answer
}

export interface ConnectionRecord {
  connId: string;
  roomCode: string;
  role: 'host' | 'player';
  playerId: string | null;
}

/** Persistence used by GameService. DynamoStore in AWS, MemoryStore for the local server. */
export interface Store {
  /** Returns false if the room code is already taken. */
  createRoom(room: RoomRecord): Promise<boolean>;
  getRoom(roomCode: string): Promise<RoomRecord | null>;
  updateRoom(roomCode: string, patch: Partial<RoomRecord>): Promise<void>;
  getPlayers(roomCode: string): Promise<PlayerRecord[]>;
  putPlayer(roomCode: string, player: PlayerRecord): Promise<void>;
  updatePlayer(roomCode: string, playerId: string, patch: Partial<PlayerRecord>): Promise<void>;
  /** Returns false if this player already answered this question (of this round). */
  putAnswer(roomCode: string, round: number, index: number, answer: AnswerRecord): Promise<boolean>;
  getAnswers(roomCode: string, round: number, index: number): Promise<AnswerRecord[]>;
  putConnection(connection: ConnectionRecord): Promise<void>;
  getConnection(connId: string): Promise<ConnectionRecord | null>;
  deleteConnection(connId: string): Promise<void>;
  /** Ids of bank questions from completed games, per topic and level (e.g. "space#easy"). */
  getPlayed(bankKey: string): Promise<string[]>;
  setPlayed(bankKey: string, ids: string[]): Promise<void>;
  /** Totals per person over every game finished on one TV. */
  getFamily(familyId: string): Promise<FamilyStanding[]>;
  setFamily(familyId: string, standings: FamilyStanding[]): Promise<void>;
}

export class MemoryStore implements Store {
  private rooms = new Map<string, RoomRecord>();
  private players = new Map<string, PlayerRecord[]>();
  private answers = new Map<string, AnswerRecord[]>();
  private connections = new Map<string, ConnectionRecord>();
  private played = new Map<string, string[]>();
  private families = new Map<string, FamilyStanding[]>();

  async createRoom(room: RoomRecord) {
    if (this.rooms.has(room.roomCode)) return false;
    this.rooms.set(room.roomCode, { ...room });
    this.players.set(room.roomCode, []);
    return true;
  }
  async getRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    return room ? { ...room } : null;
  }
  async updateRoom(roomCode: string, patch: Partial<RoomRecord>) {
    const room = this.rooms.get(roomCode);
    if (room) Object.assign(room, patch);
  }
  async getPlayers(roomCode: string) {
    return (this.players.get(roomCode) ?? []).map((p) => ({ ...p }));
  }
  async putPlayer(roomCode: string, player: PlayerRecord) {
    const list = this.players.get(roomCode) ?? [];
    this.players.set(roomCode, [...list.filter((p) => p.id !== player.id), { ...player }]);
  }
  async updatePlayer(roomCode: string, playerId: string, patch: Partial<PlayerRecord>) {
    const player = this.players.get(roomCode)?.find((p) => p.id === playerId);
    if (player) Object.assign(player, patch);
  }
  async putAnswer(roomCode: string, round: number, index: number, answer: AnswerRecord) {
    const key = `${roomCode}#${round}#${index}`;
    const list = this.answers.get(key) ?? [];
    if (list.some((a) => a.playerId === answer.playerId)) return false;
    this.answers.set(key, [...list, answer]);
    return true;
  }
  async getAnswers(roomCode: string, round: number, index: number) {
    return [...(this.answers.get(`${roomCode}#${round}#${index}`) ?? [])];
  }
  async putConnection(connection: ConnectionRecord) {
    this.connections.set(connection.connId, { ...connection });
  }
  async getConnection(connId: string) {
    const connection = this.connections.get(connId);
    return connection ? { ...connection } : null;
  }
  async deleteConnection(connId: string) {
    this.connections.delete(connId);
  }
  async getPlayed(bankKey: string) {
    return [...(this.played.get(bankKey) ?? [])];
  }
  async setPlayed(bankKey: string, ids: string[]) {
    this.played.set(bankKey, [...ids]);
  }
  async getFamily(familyId: string) {
    return (this.families.get(familyId) ?? []).map((f) => ({ ...f }));
  }
  async setFamily(familyId: string, standings: FamilyStanding[]) {
    this.families.set(familyId, standings.map((f) => ({ ...f })));
  }
}
