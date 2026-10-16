import { randomUUID } from 'crypto';
import {
  ANSWER_GRACE_MS,
  AVATARS,
  Award,
  ClientMessage,
  CreateRoomResponse,
  Difficulty,
  GetRoomResponse,
  HostEvent,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_TOPIC_LENGTH,
  Player,
  PlayerEvent,
  PlayerResult,
  Question,
  QuestionSource,
  bankKey,
  bankPool,
  pickGame,
  pointsFor,
  randomRoomCode,
  timeLimitMs,
} from '@couch-quiz/protocol';
import { HostAi, PlayerFacts, fallbackAwards } from './ai';
import { ConnectionRecord, PlayerRecord, RoomRecord, Store } from './store';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'kids'];

export interface GameDeps {
  store: Store;
  ai: HostAi;
  /** Delivers an event to one WebSocket connection; must not throw for closed connections. */
  send: (connId: string, event: HostEvent | PlayerEvent) => Promise<void>;
  /**
   * Runs question generation without blocking the caller. Locally an un-awaited promise;
   * in AWS an asynchronous invocation of the generate Lambda. Ends in completeGeneration().
   */
  startGeneration: (job: GenerationJob) => Promise<void>;
  /** Base URL of the phone controller page; the room code is added as ?room=. */
  controllerUrl: string;
  now?: () => number;
}

/** A finished set of questions for a room. */
interface GameQuestions {
  questions: Question[];
  source: QuestionSource;
  bankKey?: string;
  bankQuestionIds?: string[];
}

export interface GenerationJob {
  roomCode: string;
  generationId: string;
  topic: string;
  difficulty: Difficulty;
}

export interface ConnectParams {
  room?: string;
  role?: string;
  token?: string;
  playerId?: string;
}

/**
 * All game rules, independent of the transport. The local server and the Lambda handlers
 * are thin adapters around this class. The TV (host) drives the phases; this class stores
 * state, validates and scores answers, and fans events out to the TV and the phones.
 */
export class GameService {
  constructor(private deps: GameDeps) {}

  private now() {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  // ---------- HTTP ----------

  async createRoom(): Promise<CreateRoomResponse> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const room: RoomRecord = {
        roomCode: randomRoomCode(),
        hostToken: randomUUID(),
        hostConnId: null,
        phase: 'lobby',
        topic: null,
        difficulty: 'easy',
        generation: 'idle',
        generationId: null,
        questions: [],
        questionSource: null,
        bankKey: null,
        bankQuestionIds: [],
        questionIndex: 0,
        questionStartedAt: null,
        questionDeadline: null,
        createdAt: this.now(),
      };
      if (await this.deps.store.createRoom(room)) {
        const joinUrl = `${this.deps.controllerUrl}?room=${room.roomCode}`;
        return { roomCode: room.roomCode, hostToken: room.hostToken, joinUrl };
      }
    }
    throw new Error('Could not allocate a room code');
  }

  async getRoom(roomCode: string): Promise<GetRoomResponse> {
    const room = await this.deps.store.getRoom(roomCode.toUpperCase());
    if (!room) return { exists: false, playerCount: 0 };
    return { exists: true, playerCount: (await this.deps.store.getPlayers(room.roomCode)).length };
  }

  // ---------- WebSocket lifecycle ----------

  /** Returns false to reject the connection. Nothing can be sent until the client says 'sync'. */
  async connect(connId: string, params: ConnectParams): Promise<boolean> {
    const roomCode = (params.room ?? '').toUpperCase();
    const room = await this.deps.store.getRoom(roomCode);
    if (!room) return false;

    if (params.role === 'host') {
      if (params.token !== room.hostToken) return false;
      await this.deps.store.updateRoom(roomCode, { hostConnId: connId });
      await this.deps.store.putConnection({ connId, roomCode, role: 'host', playerId: null });
      return true;
    }
    if (params.role === 'player') {
      // A returning phone passes its playerId to keep its name and score.
      const players = await this.deps.store.getPlayers(roomCode);
      const returning = params.playerId ? players.find((p) => p.id === params.playerId) : undefined;
      await this.deps.store.putConnection({ connId, roomCode, role: 'player', playerId: returning?.id ?? null });
      if (returning) await this.deps.store.updatePlayer(roomCode, returning.id, { connId, connected: true });
      return true;
    }
    return false;
  }

  async disconnect(connId: string): Promise<void> {
    const conn = await this.deps.store.getConnection(connId);
    if (!conn) return;
    await this.deps.store.deleteConnection(connId);
    const room = await this.deps.store.getRoom(conn.roomCode);
    if (!room) return;

    if (conn.role === 'host' && room.hostConnId === connId) {
      await this.deps.store.updateRoom(room.roomCode, { hostConnId: null });
      await this.toPlayers(room.roomCode, { type: 'hostLeft' });
    }
    if (conn.role === 'player' && conn.playerId) {
      const player = (await this.deps.store.getPlayers(room.roomCode)).find((p) => p.id === conn.playerId);
      // Only mark offline if this was the player's latest connection (not an old one closing late).
      if (player?.connId === connId) {
        await this.deps.store.updatePlayer(room.roomCode, conn.playerId, { connected: false, connId: null });
        await this.sendPlayersToHost(room);
      }
    }
  }

  async message(connId: string, raw: string): Promise<void> {
    const conn = await this.deps.store.getConnection(connId);
    if (!conn) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const room = await this.deps.store.getRoom(conn.roomCode);
    if (!room) return;

    if (msg.action === 'ping') return;
    if (conn.role === 'host') {
      if (room.hostConnId !== connId) return; // a newer TV connection took over
      switch (msg.action) {
        case 'sync':
          return this.syncHost(room, connId);
        case 'configure':
          return this.configure(room, msg.topic, msg.difficulty);
        case 'startQuestion':
          return this.startQuestion(room, msg.index);
        case 'reveal':
          return this.reveal(room, msg.index);
        case 'endGame':
          return this.endGame(room);
      }
    } else {
      switch (msg.action) {
        case 'sync':
          return this.syncPlayer(room, conn);
        case 'join':
          return this.join(room, conn, msg.name, msg.avatar);
        case 'answer':
          return this.answer(room, conn, msg.index, msg.choice);
      }
    }
  }

  // ---------- Host actions ----------

  private async syncHost(room: RoomRecord, connId: string) {
    await this.deps.send(connId, { type: 'players', players: publicPlayers(await this.deps.store.getPlayers(room.roomCode)) });
    await this.deps.send(connId, {
      type: 'generation',
      status: room.generation,
      topic: room.topic ?? undefined,
      questions: room.generation === 'ready' ? room.questions : undefined,
      source: room.questionSource ?? undefined,
    });
  }

  private async configure(room: RoomRecord, topic: string, difficulty: Difficulty) {
    const cleanTopic = String(topic ?? '').trim().slice(0, MAX_TOPIC_LENGTH);
    if (!cleanTopic || !DIFFICULTIES.includes(difficulty)) return;

    const generationId = randomUUID();
    const patch = { topic: cleanTopic, difficulty, generation: 'pending' as const, generationId, questions: [], phase: 'lobby' as const };
    await this.deps.store.updateRoom(room.roomCode, patch);
    const players = await this.deps.store.getPlayers(room.roomCode);
    for (const p of players) {
      await this.deps.store.updatePlayer(room.roomCode, p.id, { score: 0, correctMs: [], ranks: [], streak: 0, bestStreak: 0 });
    }
    const updated = { ...room, ...patch };
    await this.sendToHost(updated, { type: 'generation', status: 'pending', topic: cleanTopic });
    await this.sendPlayersToHost(updated);
    await this.toPlayers(room.roomCode, { type: 'lobby', topic: cleanTopic });

    const job = { roomCode: room.roomCode, generationId, topic: cleanTopic, difficulty };
    // Preset topics come from the question bank, skipping questions of games already completed.
    // Custom topics, and preset topics whose bank is used up, go to the AI host.
    const bankGame = await this.pickBankGame(cleanTopic, difficulty, false);
    if (bankGame) return this.completeGeneration(job, bankGame);
    await this.deps.startGeneration(job);
  }

  /** A bank game that was not completed yet; with `newCycle`, forgets completed games once the bank is used up. */
  private async pickBankGame(topic: string, difficulty: Difficulty, newCycle: boolean): Promise<GameQuestions | null> {
    const pool = bankPool(topic, difficulty);
    if (!pool) return null;
    const key = bankKey(topic, difficulty);
    let game = pickGame(pool, await this.deps.store.getPlayed(key));
    if (!game && newCycle) {
      await this.deps.store.setPlayed(key, []);
      game = pickGame(pool, []);
    }
    return game && { questions: game.questions, source: 'bank', bankKey: key, bankQuestionIds: game.ids };
  }

  /** Stores the questions for the room (or the failure) and tells the TV. */
  private async completeGeneration(job: GenerationJob, game: GameQuestions | null): Promise<void> {
    const room = await this.deps.store.getRoom(job.roomCode);
    if (!room || room.generationId !== job.generationId) return; // superseded by a newer configure
    const status = game ? 'ready' : 'failed';
    await this.deps.store.updateRoom(room.roomCode, {
      generation: status,
      questions: game?.questions ?? [],
      questionSource: game?.source ?? null,
      bankKey: game?.bankKey ?? null,
      bankQuestionIds: game?.bankQuestionIds ?? [],
    });
    await this.sendToHost(room, {
      type: 'generation',
      status,
      topic: job.topic,
      questions: game?.questions,
      source: game?.source,
    });
  }

  /** The generation job: ask the AI; for preset topics fall back to a new cycle of the bank. */
  async runGeneration(job: GenerationJob): Promise<void> {
    let game: GameQuestions | null = null;
    try {
      game = { questions: await this.deps.ai.writeQuestions(job.topic, job.difficulty), source: 'ai' };
    } catch (error) {
      console.warn(`[generation] AI failed for "${job.topic}": ${error instanceof Error ? error.message : error}`);
      game = await this.pickBankGame(job.topic, job.difficulty, true);
    }
    await this.completeGeneration(job, game);
  }

  private async startQuestion(room: RoomRecord, index: number) {
    const question = room.questions[index];
    if (!question) return;
    const now = this.now();
    const limit = timeLimitMs(room.difficulty);
    await this.deps.store.updateRoom(room.roomCode, {
      phase: 'question',
      questionIndex: index,
      questionStartedAt: now,
      questionDeadline: limit === null ? null : now + limit,
    });
    await this.toPlayers(room.roomCode, {
      type: 'question',
      index,
      total: room.questions.length,
      text: question.text,
      choices: question.choices,
      timeLeftMs: limit,
    });
  }

  private async reveal(room: RoomRecord, index: number) {
    if (room.phase !== 'question' || room.questionIndex !== index) return; // already revealed
    const question = room.questions[index];
    const limit = timeLimitMs(room.difficulty);
    const answers = await this.deps.store.getAnswers(room.roomCode, index);
    const players = await this.deps.store.getPlayers(room.roomCode);

    const results: PlayerResult[] = players.map((p) => {
      const answer = answers.find((a) => a.playerId === p.id);
      const correct = answer?.choice === question.correctIndex;
      const points = answer ? pointsFor(correct, answer.ms, limit) : 0;
      p.score += points;
      p.streak = correct ? p.streak + 1 : 0;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      if (correct && answer) p.correctMs.push(answer.ms);
      return { playerId: p.id, choice: answer?.choice ?? null, correct, points, total: p.score };
    });
    const ranked = [...players].sort((a, b) => b.score - a.score);
    for (const p of players) {
      p.ranks.push(ranked.indexOf(p) + 1);
      await this.deps.store.updatePlayer(room.roomCode, p.id, {
        score: p.score,
        streak: p.streak,
        bestStreak: p.bestStreak,
        correctMs: p.correctMs,
        ranks: p.ranks,
      });
    }
    await this.deps.store.updateRoom(room.roomCode, { phase: 'reveal' });

    await this.sendToHost(room, { type: 'reveal', index, results });
    await this.sendToHost(room, { type: 'players', players: publicPlayers(players) });
    for (const p of players) {
      const r = results.find((x) => x.playerId === p.id)!;
      if (p.connId) {
        await this.deps.send(p.connId, {
          type: 'reveal',
          index,
          correctIndex: question.correctIndex,
          correct: r.correct,
          points: r.points,
          total: r.total,
        });
      }
    }
  }

  private async endGame(room: RoomRecord) {
    if (room.phase === 'podium') return;
    await this.deps.store.updateRoom(room.roomCode, { phase: 'podium' });
    // The game was completed: don't serve these bank questions again until the bank is used up.
    if (room.bankKey && room.bankQuestionIds.length) {
      const played = new Set([...(await this.deps.store.getPlayed(room.bankKey)), ...room.bankQuestionIds]);
      await this.deps.store.setPlayed(room.bankKey, [...played]);
    }
    const players = await this.deps.store.getPlayers(room.roomCode);
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const facts: PlayerFacts[] = ranked.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      rank: i + 1,
      score: p.score,
      correctCount: p.correctMs.length,
      questionCount: room.questions.length,
      avgCorrectSeconds: p.correctMs.length
        ? Math.round(p.correctMs.reduce((s, ms) => s + ms, 0) / p.correctMs.length / 100) / 10
        : null,
      bestStreak: p.bestStreak,
      placesClimbed: p.ranks.length ? Math.max(...p.ranks) - (i + 1) : 0,
    }));

    let awards: Award[];
    try {
      awards = await this.deps.ai.writeAwards(room.topic ?? 'trivia', facts);
    } catch (error) {
      console.error('[awards] falling back to rule-based awards', error);
      awards = fallbackAwards(facts);
    }

    await this.sendToHost(room, { type: 'gameOver', awards });
    for (const [i, p] of ranked.entries()) {
      if (p.connId) {
        await this.deps.send(p.connId, {
          type: 'gameOver',
          rank: i + 1,
          playerCount: ranked.length,
          score: p.score,
          award: awards.find((a) => a.playerId === p.id) ?? null,
        });
      }
    }
  }

  // ---------- Player actions ----------

  private async syncPlayer(room: RoomRecord, conn: ConnectionRecord) {
    if (!conn.playerId) return; // not joined yet: the phone shows the join form
    const player = (await this.deps.store.getPlayers(room.roomCode)).find((p) => p.id === conn.playerId);
    if (!player) return;
    await this.deps.send(conn.connId, { type: 'joined', player: publicPlayers([player])[0] });
    await this.sendPhaseToPlayer(room, conn.connId);
    await this.sendPlayersToHost(room);
  }

  private async join(room: RoomRecord, conn: ConnectionRecord, name: string, avatar: string) {
    if (conn.playerId) return this.syncPlayer(room, conn);
    const cleanName = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
    if (!cleanName) return this.deps.send(conn.connId, { type: 'error', message: 'Please enter a name.' });
    const players = await this.deps.store.getPlayers(room.roomCode);
    if (players.length >= MAX_PLAYERS) return this.deps.send(conn.connId, { type: 'error', message: 'This room is full.' });

    const player: PlayerRecord = {
      id: randomUUID(),
      name: cleanName,
      avatar: AVATARS.includes(avatar) ? avatar : AVATARS[players.length % AVATARS.length],
      score: 0,
      connected: true,
      joinedAt: this.now(),
      connId: conn.connId,
      correctMs: [],
      ranks: [],
      streak: 0,
      bestStreak: 0,
    };
    await this.deps.store.putPlayer(room.roomCode, player);
    await this.deps.store.putConnection({ ...conn, playerId: player.id });
    await this.deps.send(conn.connId, { type: 'joined', player: publicPlayers([player])[0] });
    await this.sendPhaseToPlayer(room, conn.connId);
    await this.sendPlayersToHost(room);
  }

  private async answer(room: RoomRecord, conn: ConnectionRecord, index: number, choice: number) {
    if (!conn.playerId || room.phase !== 'question' || room.questionIndex !== index) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    const now = this.now();
    if (room.questionDeadline !== null && now > room.questionDeadline + ANSWER_GRACE_MS) return;

    const ms = now - (room.questionStartedAt ?? now);
    if (!(await this.deps.store.putAnswer(room.roomCode, index, { playerId: conn.playerId, choice, ms }))) return;
    await this.deps.send(conn.connId, { type: 'answerAck', index, choice });
    const answers = await this.deps.store.getAnswers(room.roomCode, index);
    await this.sendToHost(room, { type: 'answerProgress', index, answeredPlayerIds: answers.map((a) => a.playerId) });
  }

  /** Tells a (re)joining phone what is happening right now. */
  private async sendPhaseToPlayer(room: RoomRecord, connId: string) {
    const question = room.questions[room.questionIndex];
    if (room.phase === 'question' && question) {
      const timeLeftMs = room.questionDeadline === null ? null : Math.max(0, room.questionDeadline - this.now());
      await this.deps.send(connId, {
        type: 'question',
        index: room.questionIndex,
        total: room.questions.length,
        text: question.text,
        choices: question.choices,
        timeLeftMs,
      });
    } else {
      await this.deps.send(connId, { type: 'lobby', topic: room.topic });
    }
  }

  // ---------- Fan-out helpers ----------

  private async sendToHost(room: RoomRecord, event: HostEvent) {
    // Re-read: the host may have reconnected with a new connection since `room` was loaded.
    const current = await this.deps.store.getRoom(room.roomCode);
    if (current?.hostConnId) await this.deps.send(current.hostConnId, event);
  }

  private async sendPlayersToHost(room: RoomRecord) {
    const players = await this.deps.store.getPlayers(room.roomCode);
    await this.sendToHost(room, { type: 'players', players: publicPlayers(players) });
  }

  private async toPlayers(roomCode: string, event: PlayerEvent) {
    const players = await this.deps.store.getPlayers(roomCode);
    await Promise.all(players.filter((p) => p.connId).map((p) => this.deps.send(p.connId!, event)));
  }
}

function publicPlayers(players: PlayerRecord[]): Player[] {
  return players.map(({ id, name, avatar, score, connected }) => ({ id, name, avatar, score, connected }));
}
