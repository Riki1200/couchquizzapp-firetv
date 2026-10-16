import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { Award, Difficulty, Language, Question } from '@couch-quiz/protocol';
import {
  AWARDS_SYSTEM_PROMPT,
  AWARDS_TOOL,
  FACT_CHECK_SYSTEM_PROMPT,
  FACT_CHECK_TOOL,
  FactCheck,
  HostAi,
  InvalidModelOutput,
  PlayerFacts,
  QUESTIONS_SYSTEM_PROMPT,
  QUESTIONS_TOOL,
  TOPICS_SYSTEM_PROMPT,
  TOPICS_TOOL,
  awardsUserPrompt,
  factCheckUserPrompt,
  parseAwards,
  parseFactCheck,
  parseQuestions,
  parseTopics,
  questionsUserPrompt,
  topicsUserPrompt,
  withValidationRetry,
} from '../game/ai';

const DEFAULT_MODEL_ID = 'mistral.mistral-large-3-675b-instruct';
const DEFAULT_CHECKER_MODEL_ID = 'deepseek.v3.1';

interface JsonSchema {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/**
 * AI host on Amazon Bedrock through the bedrock-mantle endpoint (OpenAI-compatible Chat
 * Completions), used for models such as Mistral Large 3 or Google Gemma. Requests are signed with SigV4 using the
 * Lambda role (or local AWS credentials) — no API keys. The model must answer with JSON that
 * matches a schema (`response_format: json_schema`); the output is then validated with zod and
 * retried with the validation errors as feedback, exactly like the Converse-based host.
 * A second model (`checkerModelId`) fact-checks the writer's questions.
 */
export class MantleHostAi implements HostAi {
  constructor(
    private modelId: string = process.env.MODEL_ID ?? DEFAULT_MODEL_ID,
    private checkerModelId: string = process.env.CHECKER_MODEL_ID ?? DEFAULT_CHECKER_MODEL_ID,
  ) {}

  private region = process.env.AWS_REGION ?? 'us-east-1';
  private url = new URL(`https://bedrock-mantle.${this.region}.api.aws/v1/chat/completions`);
  private signer = new SignatureV4({
    service: 'bedrock-mantle',
    region: this.region,
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  writeQuestions(topic: string, difficulty: Difficulty, language: Language, count: number, avoid?: string[]): Promise<Question[]> {
    return withValidationRetry(
      (feedback) =>
        this.callJson(QUESTIONS_SYSTEM_PROMPT, questionsUserPrompt(topic, difficulty, language, count, avoid), QUESTIONS_TOOL, feedback, 4000),
      (input) => parseQuestions(input, count),
    );
  }

  writeAwards(topic: string, facts: PlayerFacts[], language: Language): Promise<Award[]> {
    return withValidationRetry(
      (feedback) => this.callJson(AWARDS_SYSTEM_PROMPT, awardsUserPrompt(topic, facts, language), AWARDS_TOOL, feedback, 1500),
      (input) => parseAwards(input, facts),
      2,
    );
  }

  checkQuestions(questions: Question[], difficulty: Difficulty, language: Language): Promise<FactCheck[]> {
    return withValidationRetry(
      (feedback) =>
        this.callJson(FACT_CHECK_SYSTEM_PROMPT, factCheckUserPrompt(questions, difficulty, language), FACT_CHECK_TOOL, feedback, 2000, this.checkerModelId, 0.1),
      (input) => parseFactCheck(input, questions),
      2,
    );
  }

  suggestTopics(difficulty: Difficulty, language: Language, count: number): Promise<string[]> {
    return withValidationRetry(
      (feedback) => this.callJson(TOPICS_SYSTEM_PROMPT, topicsUserPrompt(difficulty, language, count), TOPICS_TOOL, feedback, 300, this.modelId, 1),
      (input) => parseTopics(input, count),
      2,
    );
  }

  /** One JSON-schema answer from a model (the writer unless `model` says otherwise). */
  async callJson(
    system: string,
    prompt: string,
    format: JsonSchema,
    feedback: string | undefined,
    maxTokens: number,
    model = this.modelId,
    temperature = 0.8,
  ): Promise<unknown> {
    // The prompts say "call the tool"; with JSON mode the model answers with the tool's input instead.
    const instructions = system.replace(/Always answer by calling the \w+ tool\./, 'Answer only with JSON that matches the schema.');
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: feedback ? `${prompt}\n\n${feedback}` : prompt },
      ],
      response_format: { type: 'json_schema', json_schema: { name: format.name, schema: format.schema } },
    });

    const signed = await this.signer.sign(
      new HttpRequest({
        method: 'POST',
        protocol: 'https:',
        hostname: this.url.hostname,
        path: this.url.pathname,
        headers: { 'content-type': 'application/json', host: this.url.hostname },
        body,
      }),
    );
    const started = Date.now();
    const response = await fetch(this.url, { method: 'POST', headers: signed.headers as Record<string, string>, body });
    if (!response.ok) {
      // Service errors (access, throttling…) are not retried by withValidationRetry.
      throw new Error(`Bedrock (mantle) HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    console.log(
      `[bedrock-mantle] ${format.name} ${model} ${Date.now() - started}ms`,
      `in=${data.usage?.prompt_tokens} out=${data.usage?.completion_tokens}`,
    );
    return parseJsonContent(data.choices?.[0]?.message?.content);
  }
}

/** The JSON object in the model's reply (tolerates Markdown code fences around it). */
function parseJsonContent(content: string | undefined): unknown {
  if (!content) throw new InvalidModelOutput('The model returned an empty answer.');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) throw new InvalidModelOutput('The answer was not a JSON object.');
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new InvalidModelOutput('The answer was not valid JSON.');
  }
}
