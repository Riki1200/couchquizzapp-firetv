// Generates new bank games with Amazon Bedrock into a REVIEW file (it never edits the bank itself).
//
//   AWS credentials in the environment, then:
//   yarn workspace @couch-quiz/backend expand-bank                 # 6 games per topic and level, en + es
//   yarn workspace @couch-quiz/backend expand-bank --games 2 --lang es
//
// 1. A writer model (WRITER_MODEL, default Mistral Large 3) writes each game, avoiding the
//    questions already in the bank or generated earlier in the run.
// 2. A different checker model (CHECKER_MODEL, default Qwen3 235B) fact-checks every question.
// 3. Results go to bank-review/candidates.<lang>.json and bank-review/review.<lang>.md
//    (flagged questions first). Approve with `merge-bank` after reviewing.
//
//   expand-bank --recheck --lang en   only re-runs the fact-check on the existing candidates file.
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BankLevel, BankQuestion, Language, LANGUAGE_NAMES, QUESTION_COUNT } from '@couch-quiz/protocol';
import { MantleHostAi } from '../src/aws/mantleAi';

const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'bank-review');
const LEVELS: BankLevel[] = ['easy', 'medium', 'hard'];
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const GAMES = Number(arg('games', '6'));
const LANGS = (arg('lang', 'both') === 'both' ? ['en', 'es'] : [arg('lang', 'en')]) as Language[];
const CONCURRENCY = 5;

interface Candidate extends BankQuestion {
  review: { ok: boolean; note: string };
}

// The same writer + fact-checker pair as live games (see MantleHostAi).
const ai = new MantleHostAi(
  process.env.WRITER_MODEL ?? 'mistral.mistral-large-3-675b-instruct',
  process.env.CHECKER_MODEL ?? 'qwen.qwen3-235b-a22b-2507',
);

function bankPath(language: Language) {
  return join(ROOT, 'packages', 'protocol', 'src', language === 'en' ? 'question-bank.json' : `question-bank.${language}.json`);
}

async function checkGame(questions: BankQuestion[], language: Language, level: BankLevel) {
  try {
    return await ai.checkQuestions(questions, level, language);
  } catch (error) {
    return questions.map(() => ({ ok: false, note: `Check failed: ${error instanceof Error ? error.message : error}` }));
  }
}

/** Runs the async jobs with at most `limit` in flight. */
async function pool(jobs: Array<() => Promise<void>>, limit: number) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < jobs.length) await jobs[next++]();
    }),
  );
}

/** Re-runs the fact-check on an existing candidates file, 10 questions per call. */
async function recheck(language: Language) {
  const file = join(OUT_DIR, `candidates.${language}.json`);
  const { questions } = JSON.parse(readFileSync(file, 'utf8')) as { questions: Candidate[] };
  const groups: Candidate[][] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last.length < QUESTION_COUNT && last[0].topic === q.topic && last[0].level === q.level) last.push(q);
    else groups.push([q]);
  }
  let done = 0;
  await pool(
    groups.map((group) => async () => {
      const reviews = await checkGame(group, language, group[0].level);
      group.forEach((q, i) => (q.review = reviews[i]));
      if (++done % 10 === 0) console.log(`${language}: rechecked ${done}/${groups.length} groups`);
    }),
    CONCURRENCY,
  );
  writeResults(language, questions);
}

function writeResults(language: Language, candidates: Candidate[]) {
  writeFileSync(join(OUT_DIR, `candidates.${language}.json`), JSON.stringify({ language, questions: candidates }, null, 1) + '\n');
  writeFileSync(join(OUT_DIR, `review.${language}.md`), reviewMarkdown(language, candidates));
  const flagged = candidates.filter((c) => !c.review.ok).length;
  console.log(`${language}: ${candidates.length} candidates (${flagged} flagged) → bank-review/candidates.${language}.json`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const language of LANGS) {
    if (process.argv.includes('--recheck')) {
      await recheck(language);
      continue;
    }
    const bank = (JSON.parse(readFileSync(bankPath(language), 'utf8')) as { questions: BankQuestion[] }).questions;
    const topics = [...new Set(bank.map((q) => q.topic))];
    const candidates: Candidate[] = [];
    const seen = new Set(bank.map((q) => q.text.toLowerCase()));

    // One job per topic and level; its games run in order so each one avoids the previous ones.
    const jobs = topics.flatMap((topic) =>
      LEVELS.map((level) => async () => {
        const known = bank.filter((q) => q.topic === topic && q.level === level).map((q) => q.text);
        let n = 0;
        for (let game = 1; game <= GAMES; game++) {
          try {
            const questions = await ai.writeQuestions(topic, level, language, QUESTION_COUNT, known);
            const fresh = questions
              .filter((q) => !seen.has(q.text.toLowerCase()))
              .map((q) => ({ id: `new-${topic.toLowerCase()}-${level}-${String(++n).padStart(2, '0')}`, topic, level, ...q }));
            fresh.forEach((q) => {
              seen.add(q.text.toLowerCase());
              known.push(q.text);
            });
            const reviews = await checkGame(fresh, language, level);
            fresh.forEach((q, i) => candidates.push({ ...q, review: reviews[i] }));
            console.log(`${language} ${topic}/${level} game ${game}: ${fresh.length} new, ${reviews.filter((r) => !r.ok).length} flagged`);
          } catch (error) {
            console.warn(`${language} ${topic}/${level} game ${game} failed: ${error instanceof Error ? error.message : error}`);
          }
        }
      }),
    );
    await pool(jobs, CONCURRENCY);

    candidates.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    writeResults(language, candidates);
  }
}

function reviewMarkdown(language: Language, candidates: Candidate[]): string {
  const line = (c: Candidate) =>
    `- **${c.id}** ${c.text}\n  - ✓ ${c.choices[c.correctIndex]} · ✗ ${c.choices.filter((_, i) => i !== c.correctIndex).join(' · ')}\n  - 🎙️ ${c.quip}` +
    (c.review.ok ? '' : `\n  - ⚠️ ${c.review.note}`);
  const flagged = candidates.filter((c) => !c.review.ok);
  const ok = candidates.filter((c) => c.review.ok);
  return `# Bank candidates (${LANGUAGE_NAMES[language]})

${candidates.length} questions written by AI, ${flagged.length} flagged by the fact-checker.

How to review (in \`candidates.${language}.json\`):
- Questions that passed are merged. Delete any you don't want.
- Flagged questions are skipped unless you add \`"approved": true\` (you can fix the text or answer first).
- Then run \`yarn workspace @couch-quiz/backend merge-bank --lang ${language}\`.

## ⚠️ Flagged (${flagged.length})

${flagged.map(line).join('\n')}

## ✓ Passed the check (${ok.length})

${ok.map(line).join('\n')}
`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
