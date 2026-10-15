# Couch Quiz

An AI-hosted family trivia game for Fire TV (Vega OS). The TV is the game board, driven with the remote's D-pad. Players join by scanning a QR code and use their phones as answer pads — no app install for players. An AI host on Amazon Bedrock writes the questions for any topic ("space for kids", "our family trip to the beach", "90s cartoons"), cracks a joke after every answer, and hands out awards at the end.

> Built for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track).

## How a game works

1. **Setup (TV):** pick a topic (or type your own) and a difficulty — Easy, Medium, Hard or Kids (simpler questions, no timer).
2. **Lobby (TV + phones):** the TV shows a QR code and a 4-letter room code. Each player scans it, types a name and picks an avatar; they appear on the TV live. Meanwhile the AI host is already writing 10 questions.
3. **Questions:** the TV shows the question and a countdown; phones show four big answer buttons. Faster correct answers score more (500–1000 points; a flat 1000 in Kids mode).
4. **Reveal:** the TV highlights the answer, shows the host's quip and everyone's points.
5. **Podium:** final ranking plus an AI-written award for every player ("Fastest Finger", "Comeback Kid"…).

Phones that lose the connection rejoin automatically with their name and score.

## Architecture

```
 Fire TV (Vega)                      Phones (browser)
 React Native for Vega               React (Vite) page from the QR code
      │  HTTP: create room                │  HTTP: check room
      │  WebSocket: game events           │  WebSocket: join / answer
      ▼                                   ▼
 ┌──────────────── Amazon API Gateway ────────────────┐      ┌──────────────────────────┐
 │  HTTP API (/rooms)    WebSocket API ($connect,      │      │ Amazon CloudFront + S3   │
 │                       $disconnect, $default)        │      │ (serves the phone page)  │
 └──────────┬──────────────────────┬───────────────────┘      └──────────────────────────┘
            ▼                      ▼
     AWS Lambda (http)      AWS Lambda (ws) ──async invoke──▶ AWS Lambda (generate)
            │                      │   │                              │
            ▼                      ▼   └──────────┐                   ▼
       ┌──────────── Amazon DynamoDB ─────────────┐│        Amazon Bedrock (Amazon Nova)
       │ rooms · players · answers · connections  ││        questions + quips, awards
       └───────────────────────────────────────────┘└──────────────▶
```

All game rules live in one transport-independent class, [`GameService`](backend/src/game/GameService.ts). The Lambda handlers and the local development server are thin adapters around it, so what you test locally is what runs in AWS. The TV is the source of truth for the game phase (start question, reveal, end game); the backend stores state, timestamps and scores answers, and fans events out to the TV and the phones.

## AWS integrations

Everything is defined with AWS CDK (TypeScript) in [`infra/lib/couch-quiz-stack.ts`](infra/lib/couch-quiz-stack.ts).

| Service | What it does in Couch Quiz | Code |
|---|---|---|
| **Amazon API Gateway — HTTP API** | `POST /rooms` creates a room (code, host token, join URL); `GET /rooms/{code}` lets a phone check a code before joining. CORS enabled for the phone page. | [`handlers.ts` → `http`](backend/src/aws/handlers.ts) |
| **Amazon API Gateway — WebSocket API** | Real-time channel for the TV and every phone. `$connect` authenticates (host token / room code), `$disconnect` marks players offline, `$default` carries all game messages. The backend pushes events with `PostToConnection`. | [`handlers.ts` → `ws`](backend/src/aws/handlers.ts) |
| **AWS Lambda** (Node.js 22, arm64) | Three functions bundled with esbuild from the same entry file: `http`, `ws` and `generate`. Question generation takes seconds, so `ws` invokes `generate` asynchronously (`InvocationType: Event`) and returns immediately; `generate` pushes the result to the TV when it is ready. | [`handlers.ts`](backend/src/aws/handlers.ts) |
| **Amazon DynamoDB** | One on-demand table (`pk`/`sk`) with TTL (24 h). Items: room `ROOM#ABCD/META`, players `ROOM#ABCD/PLAYER#id`, answers `ROOM#ABCD/ANSWER#03#playerId` (a conditional put guarantees one answer per player per question), connections `CONN#id/META`. | [`dynamoStore.ts`](backend/src/aws/dynamoStore.ts) |
| **Amazon Bedrock** — Amazon Nova 2 Lite (`us.amazon.nova-2-lite-v1:0`, cross-region inference profile) | Converse API with forced tool use: the model must call `submit_questions` / `submit_awards` with a JSON schema. The output is validated with zod (10 questions, 4 unique short choices, one correct answer, length limits for TV readability) and retried up to 3 times with the validation errors as feedback. Choices are shuffled server-side so the right answer isn't always in the same slot. Awards are grounded in computed facts (rank, speed, streak, places climbed); if Bedrock fails, rule-based awards are used. | [`bedrockAi.ts`](backend/src/aws/bedrockAi.ts), [`ai.ts`](backend/src/game/ai.ts) |
| **Amazon S3 + Amazon CloudFront** | Private bucket (Origin Access Control) served over HTTPS by CloudFront: the phone page the QR code points to. CDK also writes a `config.json` next to it with the API URLs, so the page needs no rebuild per deployment. | [stack](infra/lib/couch-quiz-stack.ts) |
| **AWS IAM** | Least-privilege grants from CDK: table read/write, `execute-api:ManageConnections` on the WebSocket stage, `lambda:InvokeFunction` on `generate` only, and `bedrock:InvokeModel` scoped to the Nova inference profile and its foundation model. | [stack](infra/lib/couch-quiz-stack.ts) |
| **Amazon CloudWatch Logs** | One log group per function, one-week retention; Bedrock latency and token usage are logged per call. | [stack](infra/lib/couch-quiz-stack.ts) |

## Repository layout

| Path | What it is |
|---|---|
| `apps/vega` | Fire TV app for Vega OS (React Native for Vega) |
| `apps/expo-multi-tv` | The same TV app for web and Android TV (used for fast UI iteration) |
| `apps/controller` | Phone page (Vite + React) |
| `packages/shared-ui` | TV screens, focus components and game clients shared by both TV apps |
| `packages/protocol` | Types, messages and game rules shared by TV, phones and backend |
| `backend` | `GameService` + adapters: Lambda handlers, DynamoDB store, Bedrock AI host, local server |
| `infra` | AWS CDK app |
| `docs/friction-log.md` | Issues found in the Vega SDK, docs and tooling while building this |

## Running it locally

Requires Node.js 22 LTS and Yarn 4 (`corepack enable`). No AWS account is needed for local play.

```sh
yarn install
yarn dev:server       # game server on :8787 (in-memory, bundled questions)
yarn dev:controller   # phone page on :5173 (also on your Wi-Fi IP, which the QR code uses)

# TV in the browser, connected to the local server
# (arrow keys = D-pad, Enter = select, Esc = back)
EXPO_PUBLIC_HTTP_URL=http://localhost:8787 EXPO_PUBLIC_WS_URL=ws://localhost:8787 yarn dev:web
```

Open http://localhost:8082, create a room, and scan the QR code with phones on the same Wi-Fi. Without the two `EXPO_PUBLIC_*` variables the web TV plays against three built-in bots.

To use Amazon Bedrock from the local server with your AWS credentials: `AI=bedrock yarn dev:server` (optionally `MODEL_ID=...`).

### On the Vega Virtual Device

`VEGA_SERVER` in [`packages/shared-ui/src/config.ts`](packages/shared-ui/src/config.ts) points the Vega app at the local server (`localhost:8787`, reached through port forwarding).

```sh
vega virtual-device start
yarn build:vega:debug
yarn dev:vega                                   # Metro, keep running
vega device start-port-forwarding --device VirtualDevice -p 8081 --forward false   # Metro
vega device start-port-forwarding --device VirtualDevice -p 8787 --forward false   # game server
vega run-app apps/vega/build/aarch64-debug/vega_aarch64.vpkg com.romeodev.couchquiz.main -d VirtualDevice
```

Use the `x86_64` package on Intel Macs.

## Deploying to AWS

```sh
cd infra
npx cdk bootstrap        # once per account/region
yarn deploy              # builds the phone page, then cdk deploy
```

The stack prints `HttpApiUrl`, `WebSocketUrl` and `ControllerUrl`. Put the first two in `VEGA_SERVER` (or the `EXPO_PUBLIC_*` variables for web) and rebuild the TV app. The Bedrock model is the `modelId` context value in [`infra/cdk.json`](infra/cdk.json).

## Credits

Based on [AmazonAppDev/react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0). Focus and 10-foot UI patterns follow [AmazonAppDev/vega-tv-interfaces-sample](https://github.com/AmazonAppDev/vega-tv-interfaces-sample).

## License

[MIT](LICENSE)
