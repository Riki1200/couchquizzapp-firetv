// Local game server: the same GameService as the Lambdas, with in-memory storage and plain
// WebSockets instead of DynamoDB and API Gateway. Lets the TV (web or VVD) and real phones
// on the same Wi-Fi play without AWS.
//
//   yarn dev:server                 mock AI (bundled "Space for kids" questions)
//   AI=mantle yarn dev:server       Amazon Bedrock, Mistral Large 3 via bedrock-mantle (local AWS credentials)
//   AI=bedrock yarn dev:server      Amazon Bedrock Converse API (e.g. Amazon Nova)
import { randomUUID } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import type { Difficulty, Language } from '@couch-quiz/protocol';
import { HostAi, MockHostAi } from '../game/ai';
import { GameService } from '../game/GameService';
import { MemoryStore } from '../game/store';
import { readSound } from '../game/sounds';
import { BedrockHostAi } from '../aws/bedrockAi';
import { MantleHostAi } from '../aws/mantleAi';

const PORT = Number(process.env.PORT ?? 8787);
const lanIp =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';
const CONTROLLER_URL = process.env.CONTROLLER_URL ?? `http://${lanIp}:5173/`;

const ai: HostAi =
  process.env.AI === 'mantle' ? new MantleHostAi() : process.env.AI === 'bedrock' ? new BedrockHostAi() : new MockHostAi();
const sockets = new Map<string, WebSocket>();
const soundsServed = new Set<string>();

const game: GameService = new GameService({
  store: new MemoryStore(),
  ai,
  controllerUrl: CONTROLLER_URL,
  publicUrls: { httpUrl: `http://${lanIp}:${PORT}`, wsUrl: `ws://${lanIp}:${PORT}` },
  send: async (connId, event) => {
    const socket = sockets.get(connId);
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  },
  startGeneration: async (job) => {
    void game.runGeneration(job);
  },
});

// ---------- HTTP: rooms, family scores, topic ideas, sounds ----------

function readBody(req: IncomingMessage): Promise<{ familyId?: string } | null> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();

  const url = new URL(req.url ?? '/', 'http://local');
  const json = (status: number, body: unknown) =>
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  try {
    if (req.method === 'POST' && url.pathname === '/rooms') {
      const room = await game.createRoom((await readBody(req))?.familyId);
      console.log(`room ${room.roomCode} created → ${room.joinUrl.split('&')[0]}`);
      return json(200, room);
    }
    const sound = url.pathname.match(/^\/sounds\/([a-z]+\.m4a)$/);
    const audio = sound && readSound(join(__dirname, '..', '..', 'assets', 'sounds'), sound[1]);
    if (audio) {
      if (!soundsServed.has(sound![1])) console.log(`sound ${sound![1]} requested (${req.headers['user-agent']?.slice(0, 40)})`);
      soundsServed.add(sound![1]);
      return void res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Cache-Control': 'max-age=3600' }).end(audio);
    }
    const match = url.pathname.match(/^\/rooms\/([A-Za-z]{4})$/);
    if (req.method === 'GET' && match) return json(200, await game.getRoom(match[1]));
    const family = url.pathname.match(/^\/families\/([A-Za-z0-9-]+)$/);
    if (req.method === 'GET' && family) return json(200, { standings: await game.getFamily(family[1]) });
    if (req.method === 'GET' && url.pathname === '/topic-ideas') {
      const language = url.searchParams.get('language') as Language;
      return json(200, { topics: await game.topicIdeas(language, url.searchParams.get('difficulty') as Difficulty) });
    }
    json(404, { message: 'Not found' });
  } catch (error) {
    console.error(error);
    json(500, { message: 'Internal error' });
  }
});

// ---------- WebSocket: ws://host:8787/?room=ABCD&role=host|player ----------

const wss = new WebSocketServer({ server });
wss.on('connection', (socket, req) => {
  const connId = randomUUID();
  const params = Object.fromEntries(new URL(req.url ?? '/', 'http://local').searchParams);
  // Handle each connection's events one at a time, in order (like API Gateway → Lambda per message).
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (task: () => Promise<unknown>) => (queue = queue.then(task).catch((e) => console.error(e)));

  enqueue(async () => {
    if (await game.connect(connId, params)) {
      sockets.set(connId, socket);
      console.log(`${params.role} connected to ${params.room}`);
    } else socket.close(4001, 'Room not found or not allowed');
  });
  socket.on('message', (data) => {
    const text = data.toString();
    const action = /"action":"(\w+)"/.exec(text)?.[1];
    const topic = action === 'configure' ? ` "${/"topic":"([^"]*)"/.exec(text)?.[1]}"` : '';
    if (action && action !== 'ping' && action !== 'sync') console.log(`${params.role} ${params.room}: ${action}${topic}`);
    enqueue(() => game.message(connId, text));
  });
  socket.on('close', () =>
    enqueue(async () => {
      sockets.delete(connId);
      await game.disconnect(connId);
    }),
  );
});

server.listen(PORT, () => {
  console.log(`Couch Quiz local server on http://localhost:${PORT} (LAN: http://${lanIp}:${PORT})`);
  console.log(`AI: ${process.env.AI ? `Amazon Bedrock (${process.env.AI}, ${process.env.MODEL_ID ?? 'default model'})` : 'mock (bundled questions)'}`);
  console.log(`Phones join at: ${CONTROLLER_URL}`);
});
