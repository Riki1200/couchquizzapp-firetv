import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { Award, Difficulty, Language, Question } from '@couch-quiz/protocol';
import {
  AWARDS_SYSTEM_PROMPT,
  AWARDS_TOOL,
  HostAi,
  InvalidModelOutput,
  PlayerFacts,
  QUESTIONS_SYSTEM_PROMPT,
  QUESTIONS_TOOL,
  awardsUserPrompt,
  parseAwards,
  parseQuestions,
  questionsUserPrompt,
  withValidationRetry,
} from '../game/ai';

const DEFAULT_MODEL_ID = 'us.amazon.nova-2-lite-v1:0';

interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/**
 * AI host on Amazon Bedrock (Converse API). The model must answer through a tool whose
 * input schema matches what we need; the input is then validated with zod and retried
 * with the validation errors as feedback (see withValidationRetry).
 */
export class BedrockHostAi implements HostAi {
  private client = new BedrockRuntimeClient({ maxAttempts: 4, retryMode: 'adaptive' });
  private modelId = process.env.MODEL_ID ?? DEFAULT_MODEL_ID;

  writeQuestions(topic: string, difficulty: Difficulty, language: Language, count: number, avoid?: string[]): Promise<Question[]> {
    return withValidationRetry(
      (feedback) =>
        this.callTool(QUESTIONS_SYSTEM_PROMPT, questionsUserPrompt(topic, difficulty, language, count, avoid), QUESTIONS_TOOL, feedback, 4000),
      (input) => parseQuestions(input, count),
    );
  }

  writeAwards(topic: string, facts: PlayerFacts[], language: Language): Promise<Award[]> {
    return withValidationRetry(
      (feedback) => this.callTool(AWARDS_SYSTEM_PROMPT, awardsUserPrompt(topic, facts, language), AWARDS_TOOL, feedback, 1500),
      (input) => parseAwards(input, facts),
      2,
    );
  }

  private async callTool(
    system: string,
    prompt: string,
    tool: ToolDefinition,
    feedback: string | undefined,
    maxTokens: number,
  ): Promise<unknown> {
    const text = feedback ? `${prompt}\n\n${feedback}` : prompt;
    const started = Date.now();
    const response = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: system }],
        messages: [{ role: 'user', content: [{ text }] }],
        toolConfig: {
          tools: [{ toolSpec: { name: tool.name, description: tool.description, inputSchema: { json: tool.schema as never } } }],
          toolChoice: { tool: { name: tool.name } },
        },
        inferenceConfig: { maxTokens, temperature: 0.8 },
      }),
    );
    console.log(
      `[bedrock] ${tool.name} ${this.modelId} ${Date.now() - started}ms`,
      `in=${response.usage?.inputTokens} out=${response.usage?.outputTokens}`,
    );
    const toolUse = response.output?.message?.content?.find((block) => block.toolUse)?.toolUse;
    if (!toolUse) throw new InvalidModelOutput(`Model did not call ${tool.name} (stopReason: ${response.stopReason})`);
    return toolUse.input;
  }
}
