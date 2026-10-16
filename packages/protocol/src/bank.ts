import bankJson from './question-bank.json';
import { QUESTION_COUNT } from './rules';
import { Difficulty, Question } from './types';

export type BankLevel = 'easy' | 'medium' | 'hard';

export interface BankQuestion extends Question {
  id: string;
  topic: string;
  level: BankLevel;
}

/** Built-in questions for the preset topics (see question-bank.json). */
export const QUESTION_BANK = bankJson.questions as BankQuestion[];

/** Kids mode uses the easy questions (written to be kid-friendly). */
export function bankLevel(difficulty: Difficulty): BankLevel {
  return difficulty === 'kids' ? 'easy' : difficulty;
}

/** Questions for a preset topic and difficulty, or null when the topic is not in the bank (custom topics). */
export function bankPool(topic: string, difficulty: Difficulty): BankQuestion[] | null {
  const level = bankLevel(difficulty);
  const pool = QUESTION_BANK.filter((q) => q.topic.toLowerCase() === topic.trim().toLowerCase() && q.level === level);
  return pool.length ? pool : null;
}

/** Key under which completed questions are remembered, e.g. "space#easy". */
export function bankKey(topic: string, difficulty: Difficulty): string {
  return `${topic.trim().toLowerCase()}#${bankLevel(difficulty)}`;
}

/**
 * Builds a game from questions that were not part of a completed game yet.
 * Returns null when fewer than QUESTION_COUNT unplayed questions are left.
 */
export function pickGame(pool: BankQuestion[], playedIds: Iterable<string>): { ids: string[]; questions: Question[] } | null {
  const played = new Set(playedIds);
  const fresh = shuffle(pool.filter((q) => !played.has(q.id))).slice(0, QUESTION_COUNT);
  if (fresh.length < QUESTION_COUNT) return null;
  return { ids: fresh.map((q) => q.id), questions: fresh.map(({ text, choices, correctIndex, quip }) => shuffleChoices({ text, choices, correctIndex, quip })) };
}

/** Puts the correct answer in a random slot. */
export function shuffleChoices(question: Question): Question {
  const order = shuffle([0, 1, 2, 3]);
  return {
    ...question,
    choices: order.map((i) => question.choices[i]) as Question['choices'],
    correctIndex: order.indexOf(question.correctIndex) as Question['correctIndex'],
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
