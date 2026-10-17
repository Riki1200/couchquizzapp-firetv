import { randomUUID } from 'crypto';
import {
  ANSWER_GRACE_MS,
  AVATARS,
  Award,
  ClientMessage,
  CreateRoomResponse,
  Difficulty,
  FamilyStanding,
  GetRoomResponse,
  HostEvent,
  Language,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_TOPIC_LENGTH,
  Player,
  PlayerEvent,
  PlayerResult,
  QUESTION_COUNT,
  QUESTION_COUNT_OPTIONS,
  Question,
  QuestionSource,
  TopicSuggestion,
  bankKey,
  bankPool,
  isFinalQuestion,
  isLanguage,
  pickGame,
  pointsFor,
  randomIdeas,
  randomRoomCode,
  smallerTeam,
  timeLimitMs,
  translate,
  winningTeam,
} from '@couch-quiz/protocol';
import { HostAi, PlayerFacts, fallbackAwards } from './ai';
import { HostVoice } from './voice';
import { ConnectionRecord, PlayerRecord, RoomRecord, Store } from './store';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'kids'];
const MAX_SUGGESTIONS = 4;
const MAX_FAMILY_SIZE = 30;
/** Extra questions the AI writes when a fact-checker is available, so flagged ones can be dropped. */
const SPARE_QUESTIONS = 3;
const isFamilyId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);

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
  /**
   * This backend's public HTTP and WebSocket URLs. They go into the join link (QR code) so the
   * phone talks to the same backend that created the room, wherever its page is served from.
   */
  publicUrls: { httpUrl: string; wsUrl: string };
  /** Optional spoken host (Amazon Polly in AWS). */
  voice?: HostVoice;
  now?: () => number;
}

/** A finished set of questions for a room. */
interface GameQuestions {
  questions: Question[];
  source: QuestionSource;
  factChecked?: boolean;
  bankKey?: string;
  bankQuestionIds?: string[];
}

export interface GenerationJob {
  roomCode: string;
  generationId: string;
  topic: string;
  difficulty: Difficulty;
  language: Language;
  questionCount: number;
  /** Questions of the previous game on the same topic (rematch): the AI must not repeat them. */
  avoid: string[];
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

  async createRoom(familyId?: string): Promise<CreateRoomResponse> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const room: RoomRecord = {
        roomCode: randomRoomCode(),
        hostToken: randomUUID(),
        hostConnId: null,
        phase: 'lobby',
        topic: null,
        difficulty: 'easy',
        language: 'en',
        questionCount: QUESTION_COUNT,
        generation: 'idle',
        generationId: null,
        questions: [],
        questionSource: null,
        factChecked: false,
        round: 0,
        teams: false,
        familyId: isFamilyId(familyId) ? familyId : null,
        suggestions: [],
        bankKey: null,
        bankQuestionIds: [],
        questionIndex: 0,
        questionStartedAt: null,
        questionDeadline: null,
        createdAt: this.now(),
      };
      if (await this.deps.store.createRoom(room)) {
        const { httpUrl, wsUrl } = this.deps.publicUrls;
        const joinUrl = `${this.deps.controllerUrl}?room=${room.roomCode}&api=${encodeURIComponent(httpUrl)}&ws=${encodeURIComponent(wsUrl)}`;
        return { roomCode: room.roomCode, hostToken: room.hostToken, joinUrl };
      }
    }
    throw new Error('Could not allocate a room code');
  }

  async getRoom(roomCode: string): Promise<GetRoomResponse> {
    const room = await this.deps.store.getRoom(roomCode.toUpperCase());
    if (!room) return { exists: false, playerCount: 0, language: 'en' };
    const playerCount = (await this.deps.store.getPlayers(room.roomCode)).length;
    return { exists: true, playerCount, language: room.language };
  }

  /**
   * The host reading question `index` of a room, or its quip. The text always comes from the room's
   * own questions, so the endpoint can't be used to synthesize arbitrary text. Null if not available.
   */
  async speech(roomCode: string, index: number, kind: string): Promise<Uint8Array | null> {
    if (!this.deps.voice || (kind !== 'question' && kind !== 'quip')) return null;
    const room = await this.deps.store.getRoom(roomCode.toUpperCase());
    const question = room?.questions[index];
    if (!room || !question) return null;
    return this.deps.voice.synthesize(kind === 'question' ? question.text : question.quip, room.language);
  }

  async getFamily(familyId: string): Promise<FamilyStanding[]> {
    return isFamilyId(familyId) ? this.deps.store.getFamily(familyId) : [];
  }

  /** "Surprise me" topics: from the AI host, or the built-in list when it is unavailable. */
  async topicIdeas(language: Language, difficulty: Difficulty, count = 3): Promise<string[]> {
    const lang = isLanguage(language) ? language : 'en';
    try {
      if (this.deps.ai.suggestTopics) return await this.deps.ai.suggestTopics(DIFFICULTIES.includes(difficulty) ? difficulty : 'easy', lang, count);
    } catch (error) {
      console.warn(`[topics] using built-in ideas: ${error instanceof Error ? error.message : error}`);
    }
    return randomIdeas(lang, count);
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
          return this.configure(room, msg.topic, msg.difficulty, msg.language, msg.questionCount, msg.teams);
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
        case 'suggestTopic':
          return this.suggestTopic(room, conn, msg.topic);
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
      factChecked: room.factChecked,
    });
    await this.deps.send(connId, { type: 'topicSuggestions', suggestions: room.suggestions ?? [] });
  }

  /**
   * Starts a game in this room: a new round (scores reset, players stay), teams if asked, and questions
   * from the bank or the AI host. Also used for a rematch: same topic, new questions.
   */
  private async configure(
    room: RoomRecord,
    topic: string,
    difficulty: Difficulty,
    language: Language,
    questionCount: number,
    teams: boolean,
  ) {
    const cleanTopic = String(topic ?? '').trim().slice(0, MAX_TOPIC_LENGTH);
    if (!cleanTopic || !DIFFICULTIES.includes(difficulty)) return;
    const lang: Language = isLanguage(language) ? language : 'en';
    const count = (QUESTION_COUNT_OPTIONS as readonly number[]).includes(questionCount) ? questionCount : QUESTION_COUNT;

    // A rematch on the same topic must not repeat the AI's previous questions.
    const sameTopic = room.topic?.toLowerCase() === cleanTopic.toLowerCase() && room.questionSource === 'ai';
    const avoid = sameTopic ? room.questions.map((q) => q.text) : [];

    const generationId = randomUUID();
    const patch = {
      topic: cleanTopic,
      difficulty,
      language: lang,
      questionCount: count,
      generation: 'pending' as const,
      generationId,
      questions: [],
      questionSource: null,
      factChecked: false,
      round: (room.round ?? 0) + 1,
      teams: !!teams,
      suggestions: [],
      phase: 'lobby' as const,
    };
    await this.deps.store.updateRoom(room.roomCode, patch);
    const players = await this.deps.store.getPlayers(room.roomCode);
    for (const [i, p] of players.entries()) {
      // Teams alternate in join order, so they stay balanced.
      p.team = teams ? i % 2 : null;
      await this.deps.store.updatePlayer(room.roomCode, p.id, { score: 0, correctMs: [], ranks: [], streak: 0, bestStreak: 0, team: p.team });
    }
    const updated = { ...room, ...patch };
    await this.sendToHost(updated, { type: 'generation', status: 'pending', topic: cleanTopic });
    await this.sendToHost(updated, { type: 'topicSuggestions', suggestions: [] });
    await this.sendPlayersToHost(updated);
    await Promise.all(
      players
        .filter((p) => p.connId)
        .map((p) => this.deps.send(p.connId!, { type: 'lobby', topic: cleanTopic, language: lang, team: p.team })),
    );

    const job: GenerationJob = { roomCode: room.roomCode, generationId, topic: cleanTopic, difficulty, language: lang, questionCount: count, avoid };
    // Preset topics come from the question bank, skipping questions of games already completed.
    // Custom topics, and preset topics whose bank is used up, go to the AI host.
    const bankGame = await this.pickBankGame(job, false);
    if (bankGame) return this.completeGeneration(job, bankGame);
    await this.deps.startGeneration(job);
  }

  /** A bank game that was not completed yet; with `newCycle`, forgets completed games once the bank is used up. */
  private async pickBankGame(job: GenerationJob, newCycle: boolean): Promise<GameQuestions | null> {
    const pool = bankPool(job.topic, job.difficulty, job.language);
    if (!pool) return null;
    const key = bankKey(job.topic, job.difficulty, job.language);
    let game = pickGame(pool, await this.deps.store.getPlayed(key), job.questionCount);
    if (!game && newCycle) {
      await this.deps.store.setPlayed(key, []);
      game = pickGame(pool, [], job.questionCount);
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
      factChecked: !!game?.factChecked,
      bankKey: game?.bankKey ?? null,
      bankQuestionIds: game?.bankQuestionIds ?? [],
    });
    await this.sendToHost(room, {
      type: 'generation',
      status,
      topic: job.topic,
      questions: game?.questions,
      source: game?.source,
      factChecked: !!game?.factChecked,
    });
  }

  /** The generation job: ask the AI; for preset topics fall back to a new cycle of the bank. */
  async runGeneration(job: GenerationJob): Promise<void> {
    let game: GameQuestions | null = null;
    try {
      game = { ...(await this.writeCheckedQuestions(job)), source: 'ai' };
    } catch (error) {
      console.warn(`[generation] AI failed for "${job.topic}": ${error instanceof Error ? error.message : error}`);
      game = await this.pickBankGame(job, true);
    }
    await this.completeGeneration(job, game);
  }

  /**
   * With a fact-checker: the AI writes a few spare questions, a second model checks them all, and the
   * game uses the first ones that passed (topped up with flagged ones only if too few passed).
   */
  private async writeCheckedQuestions(job: GenerationJob): Promise<{ questions: Question[]; factChecked: boolean }> {
    const { ai } = this.deps;
    if (!ai.checkQuestions) {
      return { questions: await ai.writeQuestions(job.topic, job.difficulty, job.language, job.questionCount, job.avoid), factChecked: false };
    }
    const written = await ai.writeQuestions(job.topic, job.difficulty, job.language, job.questionCount + SPARE_QUESTIONS, job.avoid);
    try {
      const checks = await ai.checkQuestions(written, job.difficulty, job.language);
      const passed = written.filter((_, i) => checks[i].ok);
      const flagged = written.filter((_, i) => !checks[i].ok);
      flagged.forEach((q) => console.log(`[fact-check] flagged "${q.text}": ${checks[written.indexOf(q)].note}`));
      return {
        questions: [...passed, ...flagged].slice(0, job.questionCount),
        factChecked: passed.length >= job.questionCount,
      };
    } catch (error) {
      console.warn(`[fact-check] skipped: ${error instanceof Error ? error.message : error}`);
      return { questions: written.slice(0, job.questionCount), factChecked: false };
    }
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
      double: isFinalQuestion(index, room.questions.length),
    });
  }

  private async reveal(room: RoomRecord, index: number) {
    if (room.phase !== 'question' || room.questionIndex !== index) return; // already revealed
    const question = room.questions[index];
    const limit = timeLimitMs(room.difficulty);
    const final = isFinalQuestion(index, room.questions.length);
    const answers = await this.deps.store.getAnswers(room.roomCode, room.round ?? 0, index);
    const players = await this.deps.store.getPlayers(room.roomCode);

    const results: PlayerResult[] = players.map((p) => {
      const answer = answers.find((a) => a.playerId === p.id);
      const correct = answer?.choice === question.correctIndex;
      const points = answer ? pointsFor(correct, answer.ms, limit, final) : 0;
      p.score += points;
      p.streak = correct ? p.streak + 1 : 0;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      if (correct && answer) p.correctMs.push(answer.ms);
      return { playerId: p.id, choice: answer?.choice ?? null, correct, points, total: p.score, streak: p.streak };
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
          streak: r.streak,
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

    const family = room.familyId ? await this.addToFamily(room.familyId, ranked) : [];
    const teamWon = room.teams ? winningTeam(players) : null;

    let awards: Award[];
    let source: 'ai' | 'rules' = 'ai';
    try {
      awards = await this.deps.ai.writeAwards(room.topic ?? 'trivia', facts, room.language);
    } catch (error) {
      console.warn(`[awards] using rule-based awards: ${error instanceof Error ? error.message : error}`);
      awards = fallbackAwards(facts, room.language);
      source = 'rules';
    }

    await this.sendToHost(room, { type: 'gameOver', awards, source, family });
    for (const [i, p] of ranked.entries()) {
      if (p.connId) {
        await this.deps.send(p.connId, {
          type: 'gameOver',
          rank: i + 1,
          playerCount: ranked.length,
          score: p.score,
          award: awards.find((a) => a.playerId === p.id) ?? null,
          team: room.teams ? p.team : null,
          teamWon: room.teams && teamWon !== null ? teamWon === p.team : null,
        });
      }
    }
  }

  /** Adds a finished game to the TV's family scores (people are matched by name) and returns them. */
  private async addToFamily(familyId: string, ranked: PlayerRecord[]): Promise<FamilyStanding[]> {
    const standings = await this.deps.store.getFamily(familyId);
    const top = ranked[0]?.score ?? 0;
    for (const p of ranked) {
      const key = p.name.trim().toLowerCase();
      let s = standings.find((f) => f.name.trim().toLowerCase() === key);
      if (!s) standings.push((s = { name: p.name, avatar: p.avatar, games: 0, wins: 0, points: 0, best: 0 }));
      s.avatar = p.avatar;
      s.games += 1;
      s.points += p.score;
      s.best = Math.max(s.best, p.score);
      if (top > 0 && p.score === top) s.wins += 1;
    }
    const sorted = standings.sort((a, b) => b.wins - a.wins || b.points - a.points).slice(0, MAX_FAMILY_SIZE);
    await this.deps.store.setFamily(familyId, sorted);
    return sorted;
  }

  // ---------- Player actions ----------

  private async syncPlayer(room: RoomRecord, conn: ConnectionRecord) {
    if (!conn.playerId) return; // not joined yet: the phone shows the join form
    const player = (await this.deps.store.getPlayers(room.roomCode)).find((p) => p.id === conn.playerId);
    if (!player) return;
    await this.deps.send(conn.connId, { type: 'joined', player: publicPlayers([player])[0] });
    await this.sendPhaseToPlayer(room, conn.connId, player.team);
    await this.sendPlayersToHost(room);
  }

  private async join(room: RoomRecord, conn: ConnectionRecord, name: string, avatar: string) {
    if (conn.playerId) return this.syncPlayer(room, conn);
    const cleanName = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
    if (!cleanName) return this.deps.send(conn.connId, { type: 'error', message: translate(room.language, 'error.name') });
    const players = await this.deps.store.getPlayers(room.roomCode);
    if (players.length >= MAX_PLAYERS) return this.deps.send(conn.connId, { type: 'error', message: translate(room.language, 'error.full') });

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
      team: room.teams ? smallerTeam(players) : null,
    };
    await this.deps.store.putPlayer(room.roomCode, player);
    await this.deps.store.putConnection({ ...conn, playerId: player.id });
    await this.deps.send(conn.connId, { type: 'joined', player: publicPlayers([player])[0] });
    await this.sendPhaseToPlayer(room, conn.connId, player.team);
    await this.sendPlayersToHost(room);
  }

  private async answer(room: RoomRecord, conn: ConnectionRecord, index: number, choice: number) {
    if (!conn.playerId || room.phase !== 'question' || room.questionIndex !== index) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    const now = this.now();
    if (room.questionDeadline !== null && now > room.questionDeadline + ANSWER_GRACE_MS) return;

    const ms = now - (room.questionStartedAt ?? now);
    const round = room.round ?? 0;
    if (!(await this.deps.store.putAnswer(room.roomCode, round, index, { playerId: conn.playerId, choice, ms }))) return;
    await this.deps.send(conn.connId, { type: 'answerAck', index, choice });
    const answers = await this.deps.store.getAnswers(room.roomCode, round, index);
    await this.sendToHost(room, { type: 'answerProgress', index, answeredPlayerIds: answers.map((a) => a.playerId) });
  }

  /** A phone suggests a topic in the lobby; the TV shows the latest suggestions, one per player. */
  private async suggestTopic(room: RoomRecord, conn: ConnectionRecord, topic: string) {
    if (!conn.playerId || room.phase !== 'lobby') return;
    const cleanTopic = String(topic ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TOPIC_LENGTH);
    const player = (await this.deps.store.getPlayers(room.roomCode)).find((p) => p.id === conn.playerId);
    if (!cleanTopic || !player) return;
    const suggestion: TopicSuggestion = { playerId: player.id, name: player.name, avatar: player.avatar, topic: cleanTopic };
    const suggestions = [...(room.suggestions ?? []).filter((s) => s.playerId !== player.id), suggestion].slice(-MAX_SUGGESTIONS);
    await this.deps.store.updateRoom(room.roomCode, { suggestions });
    await this.sendToHost(room, { type: 'topicSuggestions', suggestions });
  }

  /** Tells a (re)joining phone what is happening right now. */
  private async sendPhaseToPlayer(room: RoomRecord, connId: string, team: number | null) {
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
        double: isFinalQuestion(room.questionIndex, room.questions.length),
      });
    } else {
      await this.deps.send(connId, { type: 'lobby', topic: room.topic, language: room.language, team: room.teams ? team : null });
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
  return players.map(({ id, name, avatar, score, connected, team }) => ({ id, name, avatar, score, connected, team: team ?? null }));
}
