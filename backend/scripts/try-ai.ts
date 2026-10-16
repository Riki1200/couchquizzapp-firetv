// Quick manual check of the AI host against Amazon Bedrock (AWS credentials in the environment).
//   yarn workspace @couch-quiz/backend try-ai "Volcanoes" easy en 10
import { Difficulty, Language } from '@couch-quiz/protocol';
import { MantleHostAi } from '../src/aws/mantleAi';

async function main() {
  const [topic = 'Volcanoes', difficulty = 'easy', language = 'en', count = '10'] = process.argv.slice(2);
  const ai = new MantleHostAi();
  const started = Date.now();
  const questions = await ai.writeQuestions(topic, difficulty as Difficulty, language as Language, Number(count));
  console.log(`${questions.length} questions in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  for (const q of questions) console.log(`- ${q.text}\n    ✓ ${q.choices[q.correctIndex]}  |  ${q.choices.join(' / ')}\n    🎙️ ${q.quip}`);
  const awards = await ai.writeAwards(topic, [
    { playerId: 'a', name: 'Mia', rank: 1, score: 5400, correctCount: 6, questionCount: 6, avgCorrectSeconds: 4.2, bestStreak: 6, placesClimbed: 0 },
    { playerId: 'b', name: 'Leo', rank: 2, score: 4100, correctCount: 5, questionCount: 6, avgCorrectSeconds: 2.1, bestStreak: 3, placesClimbed: 1 },
  ], language as Language);
  for (const a of awards) console.log(`🏆 ${a.playerId}: ${a.title} — ${a.line}`);
}

main().catch((error) => {
  console.error('FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
