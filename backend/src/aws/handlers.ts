// Lambda entry points. Each is a thin adapter around GameService (see ../game/GameService.ts).
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { GameService, GenerationJob } from '../game/GameService';
import { BedrockHostAi } from './bedrockAi';
import { MantleHostAi } from './mantleAi';
import { DynamoStore } from './dynamoStore';
import { readSound } from '../game/sounds';
import { readControllerFile } from './controllerPage';

const { TABLE_NAME, WS_ENDPOINT, GENERATE_FUNCTION, CONTROLLER_URL, PUBLIC_HTTP_URL, PUBLIC_WS_URL } = process.env;

const sockets = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });
const lambda = new LambdaClient({});

const game = new GameService({
  store: new DynamoStore(TABLE_NAME!),
  // AI_API=mantle: OpenAI-compatible bedrock-mantle endpoint (e.g. Mistral, Gemma); otherwise the Converse API.
  ai: process.env.AI_API === 'mantle' ? new MantleHostAi() : new BedrockHostAi(),
  controllerUrl: CONTROLLER_URL ?? '',
  publicUrls: { httpUrl: PUBLIC_HTTP_URL ?? '', wsUrl: PUBLIC_WS_URL ?? '' },
  send: async (connId, event) => {
    try {
      await sockets.send(new PostToConnectionCommand({ ConnectionId: connId, Data: JSON.stringify(event) }));
    } catch (error) {
      if (!(error instanceof GoneException)) throw error; // the phone/TV already left
    }
  },
  // Generation takes several seconds, so it runs in its own Lambda invoked asynchronously.
  startGeneration: async (job) => {
    await lambda.send(
      new InvokeCommand({ FunctionName: GENERATE_FUNCTION, InvocationType: 'Event', Payload: JSON.stringify(job) }),
    );
  },
});

/** HTTP API: rooms, the TV's sounds and (without CloudFront) the phone controller page. */
export async function http(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const json = (statusCode: number, body: unknown) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (event.routeKey === 'POST /rooms') return json(200, await game.createRoom());
  if (event.routeKey === 'GET /rooms/{code}') return json(200, await game.getRoom(event.pathParameters?.code ?? ''));
  if (event.routeKey === 'GET /sounds/{file}') {
    // The sound files are copied next to the bundled handler (see the stack's bundling hooks).
    const audio = readSound(__dirname + '/sounds', event.pathParameters?.file ?? '');
    if (audio) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'audio/mp4', 'Cache-Control': 'public, max-age=86400' },
        body: audio.toString('base64'),
        isBase64Encoded: true,
      };
    }
  }
  if (event.routeKey === 'GET /config.json') return json(200, { httpUrl: PUBLIC_HTTP_URL, wsUrl: PUBLIC_WS_URL });
  if (event.routeKey === 'GET /' || event.routeKey === 'GET /assets/{file}') {
    // The built controller is copied next to the bundled handler (see the stack's bundling hooks).
    const page = readControllerFile(__dirname + '/controller', event.pathParameters?.file ?? 'index.html');
    if (page) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': page.type, 'Cache-Control': page.cache },
        body: page.body.toString('base64'),
        isBase64Encoded: true,
      };
    }
  }
  return json(404, { message: 'Not found' });
}

/** WebSocket API: $connect, $disconnect and $default (all messages). */
export async function ws(
  event: APIGatewayProxyWebsocketEventV2 & { queryStringParameters?: Record<string, string> },
): Promise<APIGatewayProxyResultV2> {
  const { routeKey, connectionId } = event.requestContext;
  if (routeKey === '$connect') {
    return { statusCode: (await game.connect(connectionId, event.queryStringParameters ?? {})) ? 200 : 403 };
  }
  if (routeKey === '$disconnect') await game.disconnect(connectionId);
  else await game.message(connectionId, event.body ?? '');
  return { statusCode: 200 };
}

/** Invoked asynchronously by startGeneration: asks Bedrock for the questions and tells the TV. */
export async function generate(job: GenerationJob): Promise<void> {
  await game.runGeneration(job);
}
