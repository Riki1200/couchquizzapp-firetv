// Grows packages/protocol/src/question-bank.json with games written by Amazon Bedrock.
//
//   AWS credentials in the environment, then:
//   yarn workspace @couch-quiz/backend expand-bank            # 6 more games per topic and level
//   yarn workspace @couch-quiz/backend expand-bank --games 2  # fewer
//
// Every game goes through the same validation as live games (zod schema + retries) and
// questions whose text already exists in the bank are skipped.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BankLevel, BankQuestion, Language, QUESTION_COUNT } from '@couch-quiz/protocol';
import { BedrockHostAi } from '../src/aws/bedrockAi';
import { MantleHostAi } from '../src/aws/mantleAi';

// --lang es grows question-bank.es.json instead of the English bank.
const langArg = process.argv.indexOf('--lang');
const LANGUAGE = (langArg > 0 ? process.argv[langArg + 1] : 'en') as Language;
const BANK_PATH = join(__dirname, '..', '..', 'packages', 'protocol', 'src', LANGUAGE === 'en' ? 'question-bank.json' : `question-bank.${LANGUAGE}.json`);
const LEVELS: BankLevel[] = ['easy', 'medium', 'hard'];
const gamesArg = process.argv.indexOf('--games');
const GAMES = gamesArg > 0 ? Number(process.argv[gamesArg + 1]) : 6;

async function main() {
  const bank = JSON.parse(readFileSync(BANK_PATH, 'utf8')) as { questions: BankQuestion[] };
  const topics = [...new Set(bank.questions.map((q) => q.topic))];
  // Same AI as the deployed game: Gemma via bedrock-mantle unless AI_API=converse.
  const ai = process.env.AI_API === 'converse' ? new BedrockHostAi() : new MantleHostAi();
  const seen = new Set(bank.questions.map((q) => q.text.toLowerCase()));

  for (const topic of topics) {
    for (const level of LEVELS) {
      for (let game = 1; game <= GAMES; game++) {
        const existing = bank.questions.filter((q) => q.topic === topic && q.level === level);
        const questions = await ai.writeQuestions(topic, level, LANGUAGE, QUESTION_COUNT);
        let added = 0;
        for (const q of questions) {
          if (seen.has(q.text.toLowerCase())) continue;
          seen.add(q.text.toLowerCase());
          const id = `${topic.toLowerCase()}-${level}-${String(existing.length + ++added).padStart(2, '0')}`;
          bank.questions.push({ id, topic, level, ...q });
        }
        console.log(`${topic}/${level} game ${game}: +${added} questions`);
        writeFileSync(BANK_PATH, JSON.stringify(bank, null, 1) + '\n'); // save progress after every game
      }
    }
  }
  const games = Math.floor(bank.questions.length / QUESTION_COUNT);
  console.log(`Bank now has ${bank.questions.length} questions (~${games} games).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
