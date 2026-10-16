# Couch Quiz — Devpost submission

**Tagline:** An AI-hosted family trivia game for Fire TV: the TV is the board, every phone is a buzzer.

## Inspiration

Game night at home breaks down at the controller: one person plays, everyone else watches. Party games solve that with phones, but they usually need an app on every device and a fixed set of questions. We wanted something a family could start from the couch in under a minute — pick a topic with the remote, scan a code, play — with a host that can talk about *anything*, from "space for kids" to "our family trip to the beach".

## What it does

- **On the TV (Vega, D-pad only):** pick a topic and a difficulty (Easy, Medium, Hard or Kids — simpler questions, no timer), or type your own topic with the TV keyboard. The TV shows a QR code and a room code.
- **On the phones (no install):** scan, type a name, pick an avatar — you appear on the TV live. Each question shows four big answer buttons.
- **The game:** a "Question N" intro, then the question with a smooth countdown; faster correct answers score more. When everyone has answered (or time runs out), the TV reveals the answer with the host's quip, 🔥 streak badges, and an animated leaderboard where players slide to their new rank. The final question is worth double points. The reveal moves on by itself — or right away with the remote.
- **The finale:** a podium with confetti and an award for every player ("Fastest Finger", "Comeback Kid"…), based on real game stats. **Rematch** keeps everyone in the room for another round on the same topic with fresh questions.
- **Families, not just players:** play in **two teams** (red vs. blue, balanced automatically), and every finished game adds to the **family scores** kept per TV — who has the most wins this month?
- **Everyone can pick the topic:** players **suggest topics from their phones** and the TV plays one with a click; or press **"Surprise me"** for three AI ideas — no typing with the remote.
- **The AI host (Amazon Bedrock):** writes 10 questions and a one-liner per answer for any custom topic, and the end-of-game awards. A **second model fact-checks** every AI game before it is played and swaps out anything wrong or ambiguous. Preset topics play instantly from a built-in, hand-written bank of 150 questions (plus 150 in Spanish) that doesn't repeat games you already finished.
- **Polish:** English and Spanish (TV, phones and questions), 5 or 10 questions per game, original synthesized music and sound effects, saved settings, automatic reconnection for phones that drop off Wi-Fi.

## How we built it

- **TV app:** React Native for Vega, starting from the multi-TV sample (one codebase for Vega, Android TV and web). D-pad focus with react-tv-space-navigation; animations on the native driver; sound with the W3C media `AudioPlayer`; settings with the Vega port of AsyncStorage. We built the UI on web first and verified on the Vega Virtual Device at every milestone — including fully automated game runs with remote presses injected through `inputd-cli`.
- **Phones:** a small Vite + React page. The QR code's link carries the backend URLs, so a phone always talks to the backend that created the room.
- **Backend (AWS, CDK in TypeScript):** API Gateway HTTP API (rooms, sounds) and WebSocket API (real-time game), three Lambda functions (Node.js 22, arm64), DynamoDB (single table with TTL; conditional writes guarantee one answer per player per question), Amazon Bedrock (Mistral Large 3 writes, DeepSeek V3.1 fact-checks, both through the OpenAI-compatible bedrock-mantle endpoint, SigV4-signed by the Lambda role) for questions, quips, topic ideas and awards. The HTTP API also serves the phone page itself, so the whole game — TV backend and phones — runs in AWS.
- **One game engine, two adapters:** all rules live in a transport-independent `GameService`. The Lambda handlers and a local Node server are thin adapters, so what we test locally on the couch is exactly what runs in AWS.
- **Reliable AI output:** a writer model and an independent checker model (it must echo each answer it judges, so a shifted numbering can't approve the wrong question); the model must answer with JSON that matches a schema; the result is validated with zod (lengths that fit a TV, four unique choices, one correct answer), retried with the validation errors as feedback, and the choices are shuffled server-side. Awards are grounded in computed facts so the host never invents them.

## Challenges we ran into

- **Audio on Vega:** `AudioPlayer` silently refused `http://` sources (an empty "not supported" error, no request ever made) and never replayed a sound once it had ended — so the game "went quiet" after round one. We serve sounds over HTTPS and use a fresh, preloaded player per effect.
- **Native WebSocket quirks:** a URL without a path before the query string never connected on Vega, while browsers accepted it.
- **The TV keyboard:** Select types the highlighted key instead of confirming, so we redesigned the custom-topic screen around closing the keyboard with Back.
- **Fairness on a shared screen:** phones receive each question only after the TV's intro, so nobody answers before seeing it on the TV; answers are timed by the server, not by phone clocks.
- All of these (13 entries) are documented with steps and suggestions in our friction log.

## Accomplishments that we're proud of

- A full game can be played on the Vega Virtual Device against the AWS backend without touching the remote after "Start".
- The same engine runs locally and in Lambda, unchanged.
- Everything is original: questions, quips, synthesized sounds and music, the app icon.

## What we learned

- Design for the 10-foot UI first: "focused" and "selected" must never look alike, and every screen needs a clear Back.
- Treat LLM output as untrusted input: schemas, validation, retries with feedback, and a fallback that keeps the game going.
- Test on the target device early — most of our Vega surprises only showed up there.

## What's next

- A spoken AI host with Amazon Polly.
- Custom question packs a family can save and replay.
- Publishing to the Amazon Appstore.

## Built with

React Native for Vega · Vega SDK · TypeScript · React · Vite · Amazon API Gateway (HTTP + WebSocket) · AWS Lambda · Amazon DynamoDB · Amazon Bedrock (Mistral Large 3, DeepSeek V3.1) · AWS CDK · zod
