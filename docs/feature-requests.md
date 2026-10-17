# Feature requests

What we would want built, why it matters for apps like Couch Quiz, and how urgent it is.

| # | Request | Why it matters | Priority |
|---|---|---|---|
| 1 | **Short UI sounds API on Vega** (fire-and-forget `playSound(url)`), and `AudioPlayer` replay after `ended` per the HTML spec | Games and 10-foot UIs need click, lock-in and reveal sounds. Today every effect needs its own preloaded player, or sounds silently stop after the first play (FL-10). | Important |
| 2 | **Clear error messages** for media and WebSocket failures (e.g. "cleartext HTTP is not allowed", "URL must include a path") | Empty "not supported" errors and silent socket failures cost us hours on problems with one-line fixes (FL-3, FL-8, FL-9). | Important |
| 3 | **`vega device send-key` and `vega device screenshot`** for the Virtual Device | Lets teams write end-to-end tests that drive the remote and capture the TV, the way web teams use Playwright (FL-4, FL-5). | Important |
| 4 | **"App ready for input" signal** after `vega run-app` | Test scripts have to guess how long to wait before keys are accepted. | Nice-to-have |
| 5 | **TV keyboard confirm key** mapped to `returnKeyType="done"` / `onSubmitEditing`, and keep `focus()` working cross-platform | Typing with a remote is already hard; users shouldn't have to learn "press Back, then select the button" (FL-7). | Important |
| 6 | **Companion-device / second-screen guidance**: a sample with phones joining a TV app via QR code | "TV + phones" is a natural multi-modal pattern for party games, quizzes, voting and shopping; a reference sample would make it a first-class Fire TV experience. | Important |
| 7 | **Bedrock model availability page** per API (Converse, InvokeModel, mantle Chat Completions / Responses / Messages) and account state, with actionable errors for new accounts | We lost most of a day to "Operation not allowed" and 403s with no explanation. | Critical |
| 8 | **CloudFront new-account verification surfaced early** (console banner, or a `cdk deploy` pre-check) | A failed distribution rolls back the whole stack; we only learned about the limit from the error. | Important |
| 9 | **Keep the multi-TV sample in sync** with the current Vega CLI and Expo versions (CI on the sample) | The first experience of the platform is the starter sample; deprecated commands and dependency warnings undermine trust (FL-1, FL-2, FL-11). | Nice-to-have |
| 10 | **Focus library: order dynamically mounted nodes by tree position** and restore focus when the focused node unmounts | Content that appears later (notifications, suggestions, async lists) is common on TV; today it can leave the remote "dead" (FL-13). | Important |
