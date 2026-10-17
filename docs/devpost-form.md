# Devpost "Additional info" answers

Ready-to-paste answers for each field of the submission form, in order. Long-form background: [product feedback](product-feedback.md), [feature requests](feature-requests.md), [friction log](friction-log.md).

---

## Upload a File

`couch-quiz-vega.zip`: the Vega release packages (Apple Silicon and Intel Virtual Device, plus Fire TV device) with an INSTALL.txt.

## Submitter Type

Individual

## Organization Name

N/A

## If you reside in Canada, the province

N/A

## Primary Track(s)

Fire TV

## Code repository URL

https://github.com/Riki1200/couchquizzapp-firetv

## New or existing prior to August 31, 2026?

New

## If existing, what you updated

New project, built entirely during the submission period (first commit October 15, 2026). We started from Amazon's open-source react-native-multi-tv-app-sample (MIT-0) only for the monorepo layout and build setup. All screens, the phone controller, the game engine, the AWS backend and infrastructure, the AI host, the question bank, the sounds and the icon are new.

## AWS Builder Mini Challenge?

Yes

## Which AWS services did you incorporate and how?

The whole backend is serverless and defined in AWS CDK (TypeScript); every integration is documented in the README ("AWS integrations").

- Amazon API Gateway, WebSocket API: the real-time channel between the Fire TV app and every phone. $connect authenticates the TV (host token) and the phones (room code), $default carries all game messages, and Lambda pushes events back with PostToConnection.
- Amazon API Gateway, HTTP API:
  - creates rooms and returns family scores and "Surprise me" topic ideas;
  - streams the TV's sound effects over HTTPS (Vega's media player requires HTTPS);
  - serves the phone web page itself, so the QR code opens a public HTTPS page with no app install.
- AWS Lambda (Node.js 22, arm64): three functions that are thin adapters over one transport-independent game engine (http, ws, generate). AI generation runs in its own function, invoked asynchronously so the WebSocket handler returns immediately.
- Amazon DynamoDB: one on-demand table with TTL for rooms, players, connections, played bank games and family scores. Conditional writes guarantee one answer per player per question even with simultaneous taps; answers are keyed by game round so a rematch starts clean.
- Amazon Bedrock, through the OpenAI-compatible bedrock-mantle endpoint, signed with SigV4 by the Lambda role (no API keys):
  - Mistral Large 3 writes 10 questions plus a joke for each answer for any topic, in English or Spanish, and also suggests topics and writes an award for every player from computed game stats.
  - A second model, DeepSeek V3.1, independently fact-checks every AI game. The writer produces 3 spare questions and the game keeps the ones that passed.
  - Output is constrained with JSON schema, validated with zod, and retried with the validation errors as feedback.
  - Offline, the same writer + checker pipeline (plus Qwen3 235B as a second opinion and a manual review) grew our built-in question bank to about 1,450 questions.
- Amazon Polly: the spoken host. The HTTP function calls SynthesizeSpeech (neural voices: Matthew in English, Pedro in Spanish) to read each question when it appears and each quip after the reveal, and streams the MP3 to the TV over HTTPS. The text always comes from the room's own questions, so the endpoint can't be abused to read arbitrary text.
- AWS IAM: least-privilege grants from CDK. Bedrock access is limited to exactly the two models with a bedrock-mantle:Model condition.
- Amazon CloudWatch Logs: model latency and token usage per call.
- AWS CDK: the whole stack (table, functions, both APIs, IAM, logs, and an optional S3 + CloudFront site) in one TypeScript app, deployed with one command.

## Open Source Mini Challenge?

No

## [Optional] Feature Requests

1. Short UI sounds API on Vega, and AudioPlayer replay after "ended" (Important). Games and 10-foot UIs need click, lock-in and reveal sounds. Today every effect needs its own preloaded player, or sounds silently stop after the first play.
2. Clear error messages for media and WebSocket failures, e.g. "cleartext HTTP is not allowed" or "URL must include a path" (Important). Empty "not supported" errors and silent socket failures cost hours on one-line fixes.
3. `vega device send-key` and `vega device screenshot` for the Virtual Device (Important). They enable end-to-end tests that drive the remote and capture the TV.
4. An "app ready for input" signal after `vega run-app` (Nice-to-have). Test scripts have to guess when keys are accepted.
5. TV keyboard confirm key mapped to returnKeyType="done" / onSubmitEditing, and keep focus() working cross-platform (Important). Users shouldn't have to learn "press Back, then select the button".
6. A companion-device / second-screen sample, with phones joining a TV app via QR code (Important). "TV + phones" is a natural multi-modal pattern for party games, quizzes, voting and shopping.
7. A Bedrock model availability page per API and account state, with actionable errors for new accounts (Critical). We lost most of a day to "Operation not allowed" and 403s with no explanation.
8. CloudFront new-account verification surfaced early, as a console banner or a cdk deploy pre-check (Important). A failed distribution rolls back the whole stack.
9. Keep the multi-TV sample in sync with the current Vega CLI and Expo versions (Nice-to-have). It's the first experience of the platform.
10. Focus library: order dynamically mounted nodes by tree position, and restore focus when the focused node unmounts (Important). Content that appears later can otherwise leave the remote "dead".

## [Optional] Friction Log (URL field)

https://github.com/Riki1200/couchquizzapp-firetv/blob/main/docs/friction-log.md

## [Optional] Project Testing Link

https://github.com/Riki1200/couchquizzapp-firetv#on-the-vega-virtual-device

## Feedback Question 1: Which developer tools, APIs, and SDKs did you use and for what?

- React Native for Vega + Vega SDK and `vega` CLI: the Fire TV app (build, package, install, run).
- Vega Virtual Device: all TV development and testing, including fully automated games (remote presses with inputd-cli).
- W3C Media AudioPlayer (@amazon-devices/react-native-w3cmedia): lobby music and sound effects.
- TV keyboard / TextInput: typing a custom quiz topic with the remote.
- Vega AsyncStorage port: saving settings and the TV's family id on the device.
- react-native-multi-tv-app-sample and vega-tv-interfaces-sample: starting point (one codebase for Vega, Android TV and web) and 10-foot UI patterns.
- react-tv-space-navigation (used by the samples): D-pad focus on every screen.
- Amazon Bedrock via the bedrock-mantle endpoint: Mistral Large 3 writes questions, jokes, topic ideas and awards; DeepSeek V3.1 fact-checks.
- Amazon Polly (neural voices): the spoken host reads questions and quips aloud on the TV.
- Amazon API Gateway (WebSocket + HTTP), AWS Lambda, Amazon DynamoDB, IAM, CloudWatch Logs: the serverless game backend.
- AWS CDK (TypeScript): all infrastructure as code.

## Feedback Question 2: For each tool, API, or SDK, what worked well?

- Vega SDK / React Native for Vega:
  - One React Native codebase runs on Vega, Android TV and web; only audio and storage needed .vega variants.
  - Fetch, WebSocket, emoji and TextInput behaved like elsewhere, so our day-1 spikes passed with no fallbacks.
  - Release packages are small (about 640 KB) and start fast.
- Vega Virtual Device:
  - Fast enough for daily work on an Apple Silicon Mac, and behaves like a device.
  - `vega virtual-device start` just worked, and port forwarding to Metro and a local server was reliable.
- AudioPlayer: low-latency, reliable playback once using HTTPS and one preloaded player per effect.
- Samples and focus library:
  - The multi-TV sample let us build every screen on web first and run the same code on Vega.
  - The focus patterns (focused vs. selected, DefaultFocus, grids) made a fully D-pad app quick to build.
- AsyncStorage port: drop-in, worked first time.
- Amazon Bedrock (mantle):
  - JSON-schema output plus SigV4 from the Lambda role gave structured answers, with no API keys and an IAM condition per model.
  - Switching models is one config value, so we compared Gemma 3 27B, Qwen3 235B, DeepSeek V3.1 and Mistral Large 3 in an afternoon.
  - About 6 s to write 10 questions, and about 1.5 s to fact-check them.
- API Gateway WebSockets + Lambda: real-time multiplayer with no servers to manage; cold starts on Node.js 22 arm64 were not noticeable; costs are near zero.
- DynamoDB: conditional writes make "one answer per player" trivial; TTL cleans old rooms for free.
- AWS CDK: NodejsFunction in a Yarn monorepo, grant helpers, and context values for model and site mode made deploys one command.

## Feedback Question 3: For each tool, API, or SDK, what needs work?

- Vega networking:
  - A WebSocket URL without a path before the query string (ws://host:8787?x) silently never connects, although browsers accept it.
  - Sockets sometimes close right after opening with no reason.
- AudioPlayer:
  - http:// sources fail with an empty "not supported" error and no network request.
  - A player does not play again after "ended", so sound effects silently stop after round one.
  - There is no lightweight API for short sounds.
- TV keyboard: Select types the highlighted key and there is no reachable confirm key. returnKeyType="done" doesn't help, and focus() is deprecated in favor of a Vega-only API.
- Virtual Device tooling:
  - Sending remote keys (inputd-cli) is hard to discover.
  - Taking a screenshot breaks `vega device run-cmd` for a while.
  - There is no "app ready for input" signal.
- Build: it appends [[needs.module]] entries to the source manifest.toml and never removes them. `vega device copy-from --help` swaps host and device.
- Samples: the multi-TV sample has outdated Expo dependencies, logs New Architecture errors on launch, and still uses the deprecated build-kepler command.
- Focus library: controls mounted after a screen appears are reached in the wrong order, and focus is lost when the focused element unmounts.
- Amazon Bedrock:
  - On our new account, the Converse API returned "Operation not allowed" for every model with no hint why, while the mantle endpoint worked.
  - Anthropic models returned 403 on mantle; Gemma 4 wasn't supported on Chat Completions.
  - About 1 in 10 generated trivia questions was wrong or ambiguous, even after one checker. A documented fact-checking pattern would help.
- CloudFront: new accounts can't create distributions until AWS Support verifies them, and the failure rolls back the whole stack. We served the phone page from API Gateway + Lambda instead.
- AWS CDK: the CLI couldn't use `aws login` session credentials, so we needed `aws configure export-credentials` before each deploy.

All of these have reproduction steps in our friction log (13 entries).

## Feedback Question 4: For each tool, API, or SDK, how was your onboarding experience?

- Vega SDK + Virtual Device: about half a day from install to our own app running on the Virtual Device. Most of it went to understanding the sample and the build / run / port-forward loop; the docs are good once you find the right page.
- AudioPlayer: the basics came quickly from the samples. Short sound effects took about 1.5 hours because of the HTTPS and replay issues.
- TV keyboard: found by trial and error; how to confirm or dismiss the keyboard on TV isn't documented.
- Multi-TV sample: running it took under an hour; turning it into our own app took most of a day.
- AsyncStorage port: about 10 minutes, mostly finding the @amazon-devices package name.
- Amazon Bedrock: getting access was the hard part (see above); IAM and SigV4 for the mantle endpoint took a couple of hours. After that it was very stable.
- API Gateway, Lambda, DynamoDB, CDK: smooth for anyone who knows TypeScript thanks to CDK's L2 constructs. The friction was in account setup (credentials for the CDK CLI, CloudFront verification), not in the services.
- Amazon Devices Builder Tools (MCP server / Agent Skills): we only found them through the hackathon resources page; linking them from the Vega getting-started guide would help.

## Feedback Question 5: Would you build with these devices and services again?

Yes.
- Fire TV / Vega: React Native skills transfer directly, and one codebase for Fire TV, Android TV and web is a real advantage. The Virtual Device made it possible to build and test everything without hardware. With clearer error messages and a few tooling additions (send-key, screenshot), it would be excellent.
- AWS: a serverless WebSocket backend plus Bedrock let a solo developer ship a real-time, AI-hosted multiplayer game in a week, at near-zero cost.

## Which AI tools have you leveraged while working on this project?

- Claude Code (Anthropic's Claude) as an AI coding assistant throughout. It planned and wrote most of the code and infrastructure, ran tests and automated games on the Vega Virtual Device, helped review the AI-generated question bank, wrote documentation, and produced the demo video (recording, editing, narration).
- Amazon Bedrock models inside the product and its tooling:
  - Mistral Large 3 (writer);
  - DeepSeek V3.1 (live fact-checker);
  - Qwen3 235B (second-opinion checker for the question bank);
  - Google Gemma 3 27B (evaluated early on).

## Describe the level of learning

(Your choice from the dropdown.)

## Did you gain AI value that you can use in your career?

(Your choice from the dropdown.)
