# Couch Quiz — Devpost submission

Everything to paste into the Devpost form. Long answers live in their own files: [product feedback](product-feedback.md), [feature requests](feature-requests.md), [friction log](friction-log.md).

## Form fields

| Field | Value |
|---|---|
| **Project name** | Couch Quiz |
| **Tagline** | A multi-modal family game show for Fire TV: the D-pad runs the show, every phone is a buzzer, and an AI host on Amazon Bedrock writes the questions. |
| **Primary track** | Fire TV (Vega OS). Priority categories: family entertainment, multi-modal UX, AI-enhanced viewing. |
| **Mini challenges** | AWS Builder (Amazon Bedrock, API Gateway WebSocket + HTTP APIs, AWS Lambda, Amazon DynamoDB, AWS CDK; see Product Feedback and the README's "AWS integrations"). |
| **Code repository** | https://github.com/Riki1200/couchquizzapp-firetv (public, MIT license; setup and run instructions in the README) |
| **Demo video** | *(YouTube or Vimeo link, public, under 3 minutes, in English)* |
| **Built with** | React Native for Vega, Vega SDK, Vega Virtual Device, TypeScript, Amazon Bedrock, Amazon API Gateway, AWS Lambda, Amazon DynamoDB, AWS CDK, React, Vite, zod |
| **Product feedback** | Paste [product-feedback.md](product-feedback.md); it covers every tool, API and SDK, including how each AWS service is used. |
| **Feature requests (optional)** | Paste [feature-requests.md](feature-requests.md). |
| **Friction log (optional, judging bonus)** | Paste [friction-log.md](friction-log.md) (13 entries). |

**Built during the hackathon:** all of Couch Quiz was built during the submission period (first commit October 15, 2026). We started from Amazon's open-source [react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0) for the monorepo layout and build setup. Everything else is new: every screen, the phone controller, the game engine, the AWS backend and infrastructure, the AI host, the question bank, the sounds and the icon. The sample's demo content was removed.

**How judges can test it:**
- *Easiest:* install the release package on the Vega Virtual Device (`vega run-app apps/vega/build/aarch64-release/vega_aarch64.vpkg com.romeodev.couchquiz.main -d VirtualDevice`, or build it with `yarn build:vega`). It talks to our AWS backend, which stays deployed through the end of judging. Join from any phone by scanning the QR code on the TV.
- *Without AWS:* `yarn play` runs a local server, the phone page and the TV in a browser (see the README).

## Inspiration

Game night at home breaks down at the controller: one person holds the remote, everyone else watches. Party games solve that with phones, but they usually need an app on every device and a fixed set of questions. We wanted something a family could start from the couch in under a minute — pick a topic with the remote, scan a code, play — with a host that can talk about *anything*, from "space for kids" to "our family trip to the beach".

## What it does

Couch Quiz is a **multi-modal** experience: three inputs work together in a single flow. The **remote's D-pad** runs the show on the TV, **every phone** becomes a private answer pad and topic-suggestion box, and the **AI host** turns any idea into a game in seconds.

- **On the TV (Vega, D-pad only):** pick a topic and a difficulty (Easy, Medium, Hard or Kids — simpler questions, no timer), or type your own topic with the TV keyboard. The TV shows a QR code and a room code.
- **On the phones (no install):** scan, type a name, pick an avatar — you appear on the TV live. Each question shows four big answer buttons.
- **The game:** a "Question N" intro, then the question with a smooth countdown; faster correct answers score more. When everyone has answered (or time runs out), the TV reveals the answer with the host's quip, 🔥 streak badges, and an animated leaderboard where players slide to their new rank. The final question is worth double points. The reveal moves on by itself — or right away with the remote.
- **The finale:** a podium with confetti and an award for every player ("Fastest Finger", "Comeback Kid"…), based on real game stats. **Rematch** keeps everyone in the room for another round on the same topic with fresh questions.
- **Families, not just players:** play in **two teams** (red vs. blue, balanced automatically), and every finished game adds to the **family scores** kept per TV — who has the most wins this month?
- **Everyone can pick the topic:** players **suggest topics from their phones** and the TV plays one with a click; or press **"Surprise me"** for three AI ideas — no typing with the remote.
- **The AI host (Amazon Bedrock):** writes 10 questions and a one-liner per answer for any custom topic, and the end-of-game awards. A **second model fact-checks** every AI game before it is played and swaps out anything wrong or ambiguous. Preset topics play instantly from a built-in bank of about 1,450 questions in English and Spanish that doesn't repeat games you already finished — 300 written by hand, the rest written by AI and kept only after two fact-checking models and a human review agreed.
- **Polish:** English and Spanish (TV, phones and questions), 5 or 10 questions per game, original synthesized music and sound effects, saved settings, automatic reconnection for phones that drop off Wi-Fi.

## Who it's for

Families and friends on the couch, a mixed-age group with one TV and a handful of phones. Kids mode has no timer and simpler questions, the whole game switches to Spanish, and nobody needs an account or an app. The same pattern (TV as the shared screen, phones as private controllers, AI-generated content) fits classrooms, office parties and bilingual homes. It's built to ship on the Amazon Appstore: D-pad-first UI, a serverless backend that costs cents per game, and a built-in question bank that works even without the AI.

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
- **AI trivia is confidently wrong more often than you'd think:** about 1 in 10 generated questions had a wrong answer, a myth ("hippo milk is pink") or two defensible answers. A second model catches many but not all — even questions approved by two different checker models still needed a human pass. Live games use a writer + an independent checker with spare questions; the built-in bank adds a manual review on top.
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

React Native for Vega · Vega SDK · Vega Virtual Device · TypeScript · React · Vite · Amazon API Gateway (HTTP + WebSocket) · AWS Lambda · Amazon DynamoDB · Amazon Bedrock (Mistral Large 3, DeepSeek V3.1) · AWS CDK · zod
