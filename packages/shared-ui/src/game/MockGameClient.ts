import { GameClient, GameClientEvent } from './GameClient';
import {
  Award,
  Difficulty,
  FamilyStanding,
  Player,
  PlayerResult,
  Question,
  Language,
  QUESTION_BANKS,
  QuestionSource,
  Room,
  bankKey,
  bankPool,
  isFinalQuestion,
  pickGame,
  pointsFor,
  randomIdeas,
  randomRoomCode,
  smallerTeam,
  timeLimitMs,
  translate,
} from './types';

const BOTS: Array<Pick<Player, 'id' | 'name' | 'avatar'> & { joinAfterMs: number }> = [
  { id: 'bot-1', name: 'Mia', avatar: '🦊', joinAfterMs: 1500 },
  { id: 'bot-2', name: 'Leo', avatar: '🐼', joinAfterMs: 3000 },
  { id: 'bot-3', name: 'Dad', avatar: '🐙', joinAfterMs: 5000 },
];
const GENERATION_DELAY_MS = 2500;
const BOT_ACCURACY = 0.65;

/** Simulates the backend and three bot players so the TV UI can be built without a server. */
export class MockGameClient implements GameClient {
  private listeners = new Set<(event: GameClientEvent) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private generationTimer: ReturnType<typeof setTimeout> | null = null;
  private players: Player[] = [];
  private questions: Question[] = [];
  private source: QuestionSource = 'bank';
  private game: { key: string; ids: string[] } | null = null;
  private played = new Map<string, string[]>(); // like the server, but only for this session
  private difficulty: Difficulty = 'easy';
  private language: Language = 'en';
  private answers = new Map<string, { choice: number; ms: number }>();
  private correctMs = new Map<string, number[]>();
  private streaks = new Map<string, number>();
  private currentIndex = -1;
  private teams = false;
  private suggested = false;
  private family = new Map<string, FamilyStanding[]>(); // this session only

  async createRoom(): Promise<Room> {
    const roomCode = randomRoomCode();
    for (const bot of BOTS) {
      this.later(bot.joinAfterMs, () => {
        const team = this.teams ? smallerTeam(this.players) : null;
        this.players.push({ id: bot.id, name: bot.name, avatar: bot.avatar, score: 0, connected: true, team });
        this.emitPlayers();
      });
    }
    return { roomCode, joinUrl: `https://couchquiz.example/join?room=${roomCode}` };
  }

  configure(topic: string, difficulty: Difficulty, language: Language, questionCount: number, teams: boolean): void {
    this.difficulty = difficulty;
    this.language = language;
    this.teams = teams;
    this.players.forEach((p, i) => {
      p.score = 0;
      p.team = teams ? i % 2 : null;
    });
    this.emit({ type: 'topicSuggestions', suggestions: [] });
    if (!this.suggested) {
      // The first bot suggests a topic from its "phone", once.
      this.suggested = true;
      const topic = language === 'es' ? 'Piratas' : 'Pirates';
      this.later(6000, () => this.emit({ type: 'topicSuggestions', suggestions: [{ playerId: BOTS[0].id, name: BOTS[0].name, avatar: BOTS[0].avatar, topic }] }));
    }
    this.correctMs.clear();
    this.streaks.clear();
    this.emitPlayers();
    if (this.generationTimer) clearTimeout(this.generationTimer);
    this.emit({ type: 'generation', status: 'pending', topic });

    // Preset topic: a bank game not completed yet (new cycle when used up). Custom topic: a random mix
    // from the bank stands in for the AI host.
    const pool = bankPool(topic, difficulty, language);
    const key = bankKey(topic, difficulty, language);
    let game = pool ? pickGame(pool, this.played.get(key) ?? [], questionCount) : pickGame(QUESTION_BANKS[language], [], questionCount);
    if (pool && !game) {
      this.played.set(key, []); // every game of this topic was completed: start a new cycle
      game = pickGame(pool, [], questionCount);
    }
    this.questions = game!.questions;
    this.source = pool ? 'bank' : 'ai';
    this.game = pool ? { key, ids: game!.ids } : null;
    this.generationTimer = setTimeout(
      () => this.emit({ type: 'generation', status: 'ready', topic, questions: this.questions, source: this.source }),
      pool ? 300 : GENERATION_DELAY_MS,
    );
  }

  startQuestion(index: number): void {
    this.currentIndex = index;
    this.answers.clear();
    const limit = timeLimitMs(this.difficulty);
    const correctIndex = this.questions[index].correctIndex;
    const maxDelay = limit ? Math.min(limit - 1000, 8000) : 8000;
    for (const player of this.players) {
      const ms = 1500 + Math.random() * (maxDelay - 1500);
      this.later(ms, () => {
        if (this.currentIndex !== index) return; // already revealed
        const choice =
          Math.random() < BOT_ACCURACY ? correctIndex : (correctIndex + 1 + Math.floor(Math.random() * 3)) % 4;
        this.answers.set(player.id, { choice, ms });
        this.emit({ type: 'answerProgress', index, answeredPlayerIds: [...this.answers.keys()] });
      });
    }
  }

  reveal(index: number): void {
    const correctIndex = this.questions[index].correctIndex;
    const limit = timeLimitMs(this.difficulty);
    const final = isFinalQuestion(index, this.questions.length);
    const results: PlayerResult[] = this.players.map((player) => {
      const answer = this.answers.get(player.id);
      const correct = answer?.choice === correctIndex;
      const points = answer ? pointsFor(correct, answer.ms, limit, final) : 0;
      const streak = correct ? (this.streaks.get(player.id) ?? 0) + 1 : 0;
      this.streaks.set(player.id, streak);
      if (correct && answer) this.correctMs.set(player.id, [...(this.correctMs.get(player.id) ?? []), answer.ms]);
      player.score += points;
      return { playerId: player.id, choice: answer?.choice ?? null, correct, points, total: player.score, streak };
    });
    this.currentIndex = -1;
    this.emit({ type: 'reveal', index, results });
    this.emitPlayers();
  }

  endGame(): void {
    if (this.game) this.played.set(this.game.key, [...(this.played.get(this.game.key) ?? []), ...this.game.ids]);
    const ranked = [...this.players].sort((a, b) => b.score - a.score);
    const average = (id: string) => {
      const times = this.correctMs.get(id) ?? [];
      return times.length ? times.reduce((sum, t) => sum + t, 0) / times.length : Infinity;
    };
    const fastest = [...this.players].sort((a, b) => average(a.id) - average(b.id))[0];
    const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(this.language, key, vars);
    const awards: Award[] = ranked.map((player, i) => {
      const correct = this.correctMs.get(player.id)?.length ?? 0;
      if (i === 0) return { playerId: player.id, title: t('award.champion'), line: t('award.championLine', { count: correct }) };
      if (player.id === fastest?.id)
        return { playerId: player.id, title: t('award.fastest'), line: t('award.fastestLine', { seconds: (average(player.id) / 1000).toFixed(1) }) };
      return { playerId: player.id, title: t('award.sport'), line: t('award.sportLine') };
    });
    this.emit({ type: 'gameOver', awards, source: 'rules', family: this.addToFamily(ranked) });
  }

  async getFamily(): Promise<FamilyStanding[]> {
    return this.family.get('mock') ?? [];
  }

  async topicIdeas(language: Language): Promise<string[]> {
    return randomIdeas(language, 3);
  }

  private addToFamily(ranked: Player[]): FamilyStanding[] {
    const standings = this.family.get('mock') ?? [];
    for (const p of ranked) {
      let s = standings.find((f) => f.name === p.name);
      if (!s) standings.push((s = { name: p.name, avatar: p.avatar, games: 0, wins: 0, points: 0, best: 0 }));
      s.games += 1;
      s.points += p.score;
      s.best = Math.max(s.best, p.score);
      if (p.score > 0 && p.score === ranked[0].score) s.wins += 1;
    }
    standings.sort((a, b) => b.wins - a.wins || b.points - a.points);
    this.family.set('mock', standings);
    return standings.map((s) => ({ ...s }));
  }

  subscribe(listener: (event: GameClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.timers.forEach(clearTimeout);
    if (this.generationTimer) clearTimeout(this.generationTimer);
    this.listeners.clear();
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private emitPlayers() {
    this.emit({ type: 'players', players: this.players.map((p) => ({ ...p })) });
  }

  private emit(event: GameClientEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
