# Product feedback

For every tool, API and SDK used to build Couch Quiz: what we used it for, what worked well, what needs work, how onboarding felt, and whether we would build with it again. Detailed reproduction steps for each problem are in the [friction log](friction-log.md) (referenced as FL-n).

---

## Fire TV / Vega OS

### Vega SDK, `vega` CLI and React Native for Vega

- **Used for:** building, packaging and running the TV app (`react-native build-vega`, `vega run-app`, `vega device …`), with React Native 0.72 for Vega.
- **Worked well:** one React Native codebase runs on Vega, Android TV and web with almost no platform code (only audio and storage have `.vega` variants). Release packages are small (~640 KB) and start fast. Fetch, WebSocket, emoji text and `TextInput` all behaved like on other platforms, so our day-1 spikes passed without fallbacks.
- **Needs work:**
  - Native `WebSocket` silently fails for a URL without a path before the query (`ws://host:8787?x`), which browsers accept (FL-3); it also sometimes closes right after opening with no reason (FL-9).
  - The build appends `[[needs.module]]` entries to the *source* `manifest.toml` and never removes them (FL-12).
  - `vega device copy-from --help` swaps host and device (FL-6).
  - Errors are often empty or generic, which turns 5-minute problems into hour-long hunts.
- **Onboarding:** about half a day from install to our own app running in the Virtual Device, most of it understanding the sample and the build/run/port-forwarding loop. The docs are good once you find the right page.
- **Build again?** **Yes.** React Native skills transfer directly, and one codebase for Fire TV, Android TV and web is a real advantage. Clearer error messages would make it great.

### Vega Virtual Device (VVD)

- **Used for:** all TV development and testing, including fully automated games (remote presses injected with `inputd-cli`, phones simulated in a browser).
- **Worked well:** fast enough for daily work on an Apple Silicon Mac; behaves like a device (focus, keyboard, media, networking); port forwarding to Metro and a local server is reliable.
- **Needs work:** sending remote keys is possible but hard to discover (`inputd-cli button_press`, FL-4). Taking a screenshot with `screenshooter` breaks `vega device run-cmd` for a while (FL-5), so automated tests can't capture the TV. The app also needs a few seconds after launch before it accepts keys ("Key listener added"), with no signal for scripts.
- **Onboarding:** smooth: `vega virtual-device start` just worked.
- **Build again?** **Yes.** A `vega device send-key` and a `vega device screenshot` command would make it excellent for test automation.

### W3C Media `AudioPlayer` (`@amazon-devices/react-native-w3cmedia`)

- **Used for:** lobby music and game sound effects on the TV.
- **Worked well:** once set up, playback is low-latency and reliable; preloading works.
- **Needs work:**
  - `http://` sources fail with an empty "not supported" error and no network request (FL-8). HTTPS works.
  - A player does not play again after `ended` (FL-10), so sound effects silently stop after the first round. We create a fresh preloaded player per effect.
  - There is no lightweight API for short UI sounds.
- **Onboarding:** the video-oriented samples made the basics clear. Short sound effects took about 1.5 hours because of the two issues above.
- **Build again?** **Yes**, with HTTPS from the start. A simple "play this short sound" API would help every game and UI app.

### TV keyboard and `TextInput`

- **Used for:** typing a custom quiz topic with the remote.
- **Worked well:** the on-screen keyboard opens reliably and typing works.
- **Needs work:** Select types the highlighted key, and there is no obvious way to confirm. `returnKeyType="done"` doesn't give a reachable Done key, and `focus()` is deprecated in favor of a Vega-only API (FL-7). We redesigned the screen around closing the keyboard with Back and added "Surprise me" topic ideas, so families don't need to type.
- **Onboarding:** found by trial and error; the docs don't describe how to confirm or dismiss the keyboard on TV.
- **Build again?** **Yes**, but we'd avoid text entry on TV when possible. It's a UX lesson worth putting in the docs.

### `react-native-multi-tv-app-sample` and `vega-tv-interfaces-sample`

- **Used for:** the starting point of the repo (monorepo with Vega, Expo/web and a shared UI package) and the 10-foot UI patterns (focus vs. selected, Back handling).
- **Worked well:** the shared-UI structure let us build every screen on web first and run the same code on Vega. The focus patterns are solid.
- **Needs work:**
  - The sample's Expo dependencies are out of date for its own Expo version (FL-1).
  - It logs New Architecture errors on every launch (FL-2).
  - It still uses the deprecated `build-kepler` command (FL-11).
- **Onboarding:** running the sample took under an hour; adapting it into our own app took most of a day.
- **Build again?** **Yes.** It's the right starter for cross-platform TV apps; it just needs to be kept in sync with the SDK.

### `react-tv-space-navigation` (D-pad focus, used by the samples)

- **Used for:** every screen's D-pad navigation.
- **Worked well:** declarative focus groups, `DefaultFocus` and grid alignment made a fully D-pad-driven app quick to build.
- **Needs work:** controls that mount after a screen appears are reached in the wrong order, and focus is lost when the focused element unmounts (FL-13). We worked around both: the container stays mounted, and focus moves to a known button before the element is removed.
- **Onboarding:** easy thanks to the samples.
- **Build again?** **Yes.**

### Vega AsyncStorage port (`@amazon-devices/react-native-async-storage__async-storage`)

- **Used for:** saving the host's settings and the TV's family id on the device.
- **Worked well:** drop-in replacement; worked first time.
- **Needs work:** discoverability. We had to look up which `@amazon-devices/…` package name maps to the community library.
- **Onboarding:** 10 minutes.
- **Build again?** **Yes.**

### Amazon Devices Builder Tools (MCP server / Agent Skills)

- **Used for:** not used directly; our AI coding assistant worked from the public Vega docs and samples instead.
- **Note:** we only found them later through the hackathon resources page. Linking them from the Vega getting-started guide would help new developers find them on day one.

---

## AWS (AWS Builder mini challenge)

Couch Quiz's backend is fully serverless and defined in CDK (TypeScript). How each service is used is documented in the README's [AWS integrations](../README.md#aws-integrations) table. In short:

- **API Gateway WebSocket API:** real-time channel for the TV and every phone.
- **API Gateway HTTP API:** room creation, family scores, topic ideas, TV sound effects over HTTPS, and the phone page itself.
- **AWS Lambda:** three functions. `http` and `ws` are thin adapters over one game engine; `generate` runs AI generation asynchronously.
- **Amazon DynamoDB:** one table, with TTL, for rooms, players, answers (conditional writes = one answer per player per question), connections, played bank games and family scores.
- **Amazon Bedrock:** Mistral Large 3 writes questions, quips, topic ideas and awards; DeepSeek V3.1 independently fact-checks every AI game.
- **IAM:** least-privilege grants, with Bedrock limited to the two models.
- **CloudWatch Logs:** per-call model latency and token usage.

### Amazon Bedrock (via the OpenAI-compatible `bedrock-mantle` endpoint)

- **Used for:**
  - The AI host: 10 questions and a one-liner per answer for any topic, in English or Spanish.
  - "Surprise me" topic ideas.
  - End-of-game awards grounded in computed player stats.
  - A second model fact-checks every AI game; the game keeps the questions that passed out of 13 written.
  - Offline: a writer + two-checker pipeline that grew our built-in question bank.
- **Worked well:**
  - Chat Completions with `response_format: json_schema` plus SigV4 signing from the Lambda role: no API keys, structured output, and an IAM condition (`bedrock-mantle:Model`) that scopes the role to exactly the models we use.
  - Switching models is one config value. That let us compare Gemma 3 27B, Qwen3 235B, DeepSeek V3.1 and Mistral Large 3 in an afternoon and pick on accuracy and latency: about 6 s for 10 questions, about 1.5 s for the fact-check.
- **Needs work:**
  - **New-account access:** on our new account, the bedrock-runtime Converse API returned "Operation not allowed" for every model, with no hint about why or what to do. The mantle endpoint worked with the same account.
  - Anthropic models returned 403 "not available for this account" on mantle. Gemma 4 returned "not supported on this route" for Chat Completions, and the Responses route hung.
  - A single page listing which models support which API/route per account state would have saved us most of a day.
- **Factual accuracy:** about 1 in 10 generated trivia questions was wrong or ambiguous. Even after two different checker models agreed, our manual review rejected roughly 15% more (myths, two defensible answers). A documented fact-checking pattern, or a grounded "verify" mode, would help everyone building quiz or education content.
- **Onboarding:** IAM and SigV4 for mantle took a couple of hours from docs plus trial and error. Once working, it was very stable.
- **Build again?** **Yes.** Model choice through one endpoint and keyless IAM auth is exactly what a small team wants, but we'd ask for clearer errors and access status for new accounts.

### AWS CDK (TypeScript)

- **Used for:** the whole stack: table, three `NodejsFunction`s (esbuild bundling with hooks that ship sound files and the built phone page), HTTP and WebSocket APIs, IAM, log groups, and an optional S3 + CloudFront site.
- **Worked well:** `NodejsFunction` in a Yarn monorepo; `grant*` helpers; context values for the model, the AI API and the site mode (`lambda`, `cloudfront` or `local`); `cdk diff` before every deploy.
- **Needs work:** the CDK CLI couldn't use credentials from `aws login` sessions. We had to `eval "$(aws configure export-credentials --format env)"` before each deploy, and the error didn't point there.
- **Onboarding:** quick for anyone who knows TypeScript.
- **Build again?** **Yes.**

### Amazon API Gateway (WebSocket + HTTP APIs) and AWS Lambda

- **Used for:**
  - `$connect`, `$disconnect` and `$default` routes for the game; `PostToConnection` to push events.
  - HTTP routes for rooms and families, plus static serving of the phone page from Lambda. That gave every phone a public HTTPS URL without CloudFront.
  - An async Lambda invoke for generation, so the WebSocket handler returns immediately.
- **Worked well:**
  - WebSocket APIs made multiplayer real-time play simple with no servers to manage, and costs are close to zero for a family game.
  - Lambda cold starts on Node.js 22 arm64 were not noticeable in play.
- **Needs work:** idle WebSocket connections drop after 10 minutes, so we added a ping. A clearer note in the docs on keeping game or chat connections alive would help.
- **Onboarding:** smooth with CDK's L2 constructs.
- **Build again?** **Yes.**

### Amazon DynamoDB

- **Used for:** all game state in one on-demand table with TTL.
- **Worked well:** conditional puts guarantee one answer per player per question, even with simultaneous taps. TTL cleans old rooms for free.
- **Needs work:** nothing blocking.
- **Build again?** **Yes.**

### Amazon CloudFront + S3

- **Used for:** planned host for the phone page (still in the stack as `site: cloudfront`).
- **Needs work:** on a new account, creating a distribution fails with "Your account must be verified before you can add new CloudFront resources." CloudFormation rolls back the whole stack update, and the only path is a Support case. We served the page from API Gateway + Lambda instead. Surfacing this limit when the account is created, or in `cdk deploy` before it starts, would save a failed deploy.
- **Build again?** **Yes**, once the account is verified.
