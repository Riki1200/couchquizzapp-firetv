import { GameClient } from './GameClient';
import { SPACE_FOR_KIDS } from './mockQuestions';
import { Award, Difficulty, Player, PlayerResult, Room, ServerEvent } from './types';

const BOTS: Array<Pick<Player, 'id' | 'name' | 'avatar'> & { joinAfterMs: number }> = [
  { id: 'bot-1', name: 'Mia', avatar: '🦊', joinAfterMs: 1500 },
  { id: 'bot-2', name: 'Leo', avatar: '🐼', joinAfterMs: 3000 },
  { id: 'bot-3', name: 'Dad', avatar: '🐙', joinAfterMs: 5000 },
];
const GENERATION_DELAY_MS = 2500;
const BOT_ACCURACY = 0.65;
// Letters only, without ones that are easy to confuse on a TV (I, O).
const ROOM_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Simulates the backend and three bot players so the TV UI can be built without AWS. */
export class MockGameClient implements GameClient {
  private listeners = new Set<(event: ServerEvent) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private generationTimer: ReturnType<typeof setTimeout> | null = null;
  private players: Player[] = [];
  private answers = new Map<string, { choice: number; ms: number }>();
  private correctMs = new Map<string, number[]>();
  private currentIndex = -1;
  private timeLimitMs: number | null = null;

  async createRoom(): Promise<Room> {
    let roomCode = '';
    for (let i = 0; i < 4; i++) {
      roomCode += ROOM_CODE_LETTERS[Math.floor(Math.random() * ROOM_CODE_LETTERS.length)];
    }
    for (const bot of BOTS) {
      this.later(bot.joinAfterMs, () => {
        this.players.push({ id: bot.id, name: bot.name, avatar: bot.avatar, score: 0, connected: true });
        this.emitPlayers();
      });
    }
    return { roomCode, joinUrl: `https://couchquiz.example/join?room=${roomCode}` };
  }

  configure(_topic: string, _difficulty: Difficulty): void {
    if (this.generationTimer) clearTimeout(this.generationTimer);
    this.emit({ type: 'generation', status: 'pending' });
    this.generationTimer = setTimeout(() => {
      this.emit({ type: 'generation', status: 'ready', questions: SPACE_FOR_KIDS });
    }, GENERATION_DELAY_MS);
  }

  startQuestion(index: number, timeLimitMs: number | null): void {
    this.currentIndex = index;
    this.timeLimitMs = timeLimitMs;
    this.answers.clear();
    const correctIndex = SPACE_FOR_KIDS[index].correctIndex;
    const maxDelay = timeLimitMs ? Math.min(timeLimitMs - 1000, 8000) : 8000;
    for (const player of this.players) {
      const ms = 1500 + Math.random() * (maxDelay - 1500);
      this.later(ms, () => {
        if (this.currentIndex !== index) return; // already revealed
        const choice = Math.random() < BOT_ACCURACY ? correctIndex : (correctIndex + 1 + Math.floor(Math.random() * 3)) % 4;
        this.answers.set(player.id, { choice, ms });
        this.emit({ type: 'answerProgress', index, answeredPlayerIds: [...this.answers.keys()] });
      });
    }
  }

  reveal(index: number): void {
    const correctIndex = SPACE_FOR_KIDS[index].correctIndex;
    const results: PlayerResult[] = this.players.map((player) => {
      const answer = this.answers.get(player.id);
      const correct = answer?.choice === correctIndex;
      let points = 0;
      if (correct && answer) {
        points = this.timeLimitMs ? 500 + Math.round(500 * Math.max(0, 1 - answer.ms / this.timeLimitMs)) : 1000;
        this.correctMs.set(player.id, [...(this.correctMs.get(player.id) ?? []), answer.ms]);
      }
      player.score += points;
      return { playerId: player.id, choice: answer?.choice ?? null, correct, points, total: player.score };
    });
    this.currentIndex = -1;
    this.emit({ type: 'reveal', index, results });
    this.emitPlayers();
  }

  endGame(): void {
    const ranked = [...this.players].sort((a, b) => b.score - a.score);
    const average = (id: string) => {
      const times = this.correctMs.get(id) ?? [];
      return times.length ? times.reduce((sum, t) => sum + t, 0) / times.length : Infinity;
    };
    const fastest = [...this.players].sort((a, b) => average(a.id) - average(b.id))[0];
    const awards: Award[] = ranked.map((player, i) => {
      if (i === 0) return { playerId: player.id, title: 'Quiz Champion', line: 'The galaxy bows to your brain.' };
      if (player.id === fastest?.id) return { playerId: player.id, title: 'Fastest Finger', line: 'Faster than a shooting star.' };
      return { playerId: player.id, title: 'Good Sport', line: 'Every astronaut starts somewhere!' };
    });
    this.emit({ type: 'gameOver', awards });
  }

  subscribe(listener: (event: ServerEvent) => void): () => void {
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

  private emit(event: ServerEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
