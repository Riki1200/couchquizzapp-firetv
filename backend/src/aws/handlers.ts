// Lambda entry points. Each is a thin adapter around GameService (see ../game/GameService.ts).
import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { GameService, GenerationJob } from '../game/GameService';
import { BedrockHostAi } from './bedrockAi';
import { DynamoStore } from './dynamoStore';

const { TABLE_NAME, WS_ENDPOINT, GENERATE_FUNCTION, CONTROLLER_URL } = process.env;

const sockets = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });
const lambda = new LambdaClient({});

const game = new GameService({
  store: new DynamoStore(TABLE_NAME!),
  ai: new BedrockHostAi(),
  controllerUrl: CONTROLLER_URL ?? '',
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

/** HTTP API: POST /rooms, GET /rooms/{code}. */
export async function http(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const json = (statusCode: number, body: unknown) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (event.routeKey === 'POST /rooms') return json(200, await game.createRoom());
  if (event.routeKey === 'GET /rooms/{code}') return json(200, await game.getRoom(event.pathParameters?.code ?? ''));
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
