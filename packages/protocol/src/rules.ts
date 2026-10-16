import { Difficulty, Player } from './types';

/** Default questions per game; the host can pick any of QUESTION_COUNT_OPTIONS in Settings. */
export const QUESTION_COUNT = 10;
export const QUESTION_COUNT_OPTIONS = [5, 10] as const;
export const MAX_PLAYERS = 8;
export const MAX_NAME_LENGTH = 12;
export const MAX_TOPIC_LENGTH = 60;
/** Answers arriving this long after the deadline still count (network delay). */
export const ANSWER_GRACE_MS = 1000;

export const AVATARS = ['🦊', '🐼', '🐙', '🦄', '🐸', '🐯', '🐨', '🐵', '🦁', '🐧', '🐢', '🦖'];

/** Time limit per question; null = no timer (kids mode). */
export function timeLimitMs(difficulty: Difficulty): number | null {
  if (difficulty === 'kids') return null;
  return difficulty === 'hard' ? 15000 : 20000;
}

/** Streak length that earns the 🔥 badge. */
export const STREAK_BADGE = 3;

/** The last question of a game is worth double points. */
export function isFinalQuestion(index: number, total: number): boolean {
  return index === total - 1;
}

/**
 * 500 for a correct answer plus up to 500 for speed; a flat 1000 when there is no timer.
 * Doubled on the final question.
 */
export function pointsFor(correct: boolean, answerMs: number, limitMs: number | null, final = false): number {
  if (!correct) return 0;
  const base = limitMs === null ? 1000 : 500 + Math.round(500 * Math.max(0, 1 - answerMs / limitMs));
  return final ? base * 2 : base;
}

// Letters only, without ones that are easy to confuse on a TV (I, O).
const ROOM_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += ROOM_CODE_LETTERS[Math.floor(Math.random() * ROOM_CODE_LETTERS.length)];
  return code;
}

/** Team mode: two teams, balanced as players join. Names are translated ('team.0', 'team.1'). */
export const TEAMS = [
  { emoji: '🔴', color: '#EF4444' },
  { emoji: '🔵', color: '#3B82F6' },
] as const;

/** The team a new player joins: the one with fewer players (the first team on a tie). */
export function smallerTeam(players: Pick<Player, 'team'>[]): number {
  const sizes = TEAMS.map((_, team) => players.filter((p) => p.team === team).length);
  return sizes.indexOf(Math.min(...sizes));
}

/** Each team's total score. */
export function teamTotals(players: Pick<Player, 'team' | 'score'>[]): number[] {
  return TEAMS.map((_, team) => players.filter((p) => p.team === team).reduce((sum, p) => sum + p.score, 0));
}

/** The winning team, or null on a tie. */
export function winningTeam(players: Pick<Player, 'team' | 'score'>[]): number | null {
  const [a, b] = teamTotals(players);
  return a === b ? null : a > b ? 0 : 1;
}

/** Letter + color per answer slot, identical on the TV and the phones. */
export const ANSWER_STYLES = [
  { letter: 'A', color: '#14B8A6' },
  { letter: 'B', color: '#F97316' },
  { letter: 'C', color: '#EC4899' },
  { letter: 'D', color: '#6366F1' },
] as const;
