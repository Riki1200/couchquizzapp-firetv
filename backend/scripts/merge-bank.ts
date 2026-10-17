// Adds reviewed candidates from bank-review/candidates.<lang>.json to the question bank.
//
//   yarn workspace @couch-quiz/backend merge-bank --lang en
//
// Merged: candidates that passed the fact-check, plus flagged ones you marked "approved": true.
// Ids are renumbered after the existing questions of each topic and level.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BankQuestion } from '@couch-quiz/protocol';

const ROOT = join(__dirname, '..', '..');
const i = process.argv.indexOf('--lang');
const language = i > 0 ? process.argv[i + 1] : 'en';
const bankFile = join(ROOT, 'packages', 'protocol', 'src', language === 'en' ? 'question-bank.json' : `question-bank.${language}.json`);
const candidateFile = join(ROOT, 'bank-review', `candidates.${language}.json`);

type Candidate = BankQuestion & { review?: { ok: boolean; note: string }; approved?: boolean };

const bank = JSON.parse(readFileSync(bankFile, 'utf8')) as { questions: BankQuestion[] };
const { questions: candidates } = JSON.parse(readFileSync(candidateFile, 'utf8')) as { questions: Candidate[] };
const seen = new Set(bank.questions.map((q) => q.text.toLowerCase()));

let added = 0;
for (const c of candidates) {
  if (!(c.review?.ok || c.approved) || seen.has(c.text.toLowerCase())) continue;
  const n = bank.questions.filter((q) => q.topic === c.topic && q.level === c.level).length + 1;
  const { topic, level, text, correctIndex, quip } = c;
  const choices = c.choices.map((x) => x.replace(/^[A-D][.)]\s+/, '')) as BankQuestion['choices'];
  bank.questions.push({ id: `${topic.toLowerCase()}-${level}-${String(n).padStart(2, '0')}`, topic, level, text, choices, correctIndex, quip });
  seen.add(text.toLowerCase());
  added++;
}
writeFileSync(bankFile, JSON.stringify(bank, null, 1) + '\n');
console.log(`Added ${added} questions → ${bank.questions.length} in the ${language} bank (~${Math.floor(bank.questions.length / 10)} games).`);
