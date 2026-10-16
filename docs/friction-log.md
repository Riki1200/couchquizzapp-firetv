# Friction Log

Things in the Vega SDK, docs, samples, or tooling that did not work as expected while building Couch Quiz.

Severity: **High** (blocked progress) · **Medium** (cost > 30 min or needed a workaround) · **Low** (annoyance)

---

## 1. Sample's Expo dependencies are out of date for its own Expo version

- **Date:** 2026-10-14
- **Task:** Run `react-native-multi-tv-app-sample` on web as the starting point.
- **Steps:** Fresh clone → `yarn install` → `yarn dev:web`.
- **Expected:** Dev server starts cleanly.
- **Actual:** Starts and bundles, but Expo warns that 19 packages (`@expo/metro-runtime`, `react-native-web`, `react-native-reanimated`, `expo-font`, …) don't match the versions expected by `expo@54`, ending with "Your project may not work correctly until you install the expected versions".
- **Severity:** Low
- **Workaround:** Ignored for now; web target works.
- **Suggestion:** Run `npx expo install --fix` in the sample (or pin Expo to the matching SDK) and add a CI check so the sample stays in sync.

---

## 2. Sample logs New Architecture errors on every launch in VVD

- **Date:** 2026-10-14
- **Task:** Run the multi-tv sample (Vega app) in the Vega Virtual Device with Metro (SDK 0.24.12112, CLI 1.4.4).
- **Steps:** `yarn build:vega:debug` → `yarn dev:vega` → `vega device start-port-forwarding --device VirtualDevice -p 8081 --forward false` → `vega run-app apps/vega/build/aarch64-debug/vega_aarch64.vpkg <id>.main -d VirtualDevice`.
- **Expected:** App launches with a clean log.
- **Actual:** App launches, but Metro prints two `ERROR`s from inside `VegaAppNavigator`: `'getConstants' is not available in the new React Native architecture` and `'getViewManagerConfig' is not available ... Use hasViewManagerConfig instead`. The app keeps working, so it's hard to tell whether they matter.
- **Severity:** Low
- **Workaround:** None needed. Update 2026-10-15: both errors disappeared once the app stopped using the sample's `VegaAppNavigator` (React Navigation port + gesture handler), so they come from those ported libraries.
- **Suggestion:** Fix or silence these in the sample/ported libraries, or document which ones are known and harmless.

---

## 3. WebSocket URL without a path silently fails on Vega

- **Date:** 2026-10-15
- **Task:** Connect the TV app (VVD) to the local game server over WebSocket.
- **Steps:** `new WebSocket('ws://localhost:8787?room=QZCZ&role=host&token=…')` from React Native for Vega, with `vega device start-port-forwarding -p 8787 --forward false`.
- **Expected:** Connection opens, as it does in Chrome with the same URL and as `curl` does from inside the VVD.
- **Actual:** The connection never reached the server, and nothing obvious showed up in the Metro log. HTTP `fetch` to the same host and port worked, and so did a raw handshake with `curl` from `vega device run-cmd`.
- **Severity:** Medium (cost ~30 min; looked like a port-forwarding problem)
- **Workaround:** Add a path before the query string: `ws://localhost:8787/?room=…`.
- **Suggestion:** Normalize URLs like browsers do, or fire `onerror` with a clear message for URLs the native WebSocket cannot handle; mention it in the networking docs.

---

## 4. Simulating remote presses in the VVD is possible but hard to discover

- **Date:** 2026-10-15
- **Task:** Automate a D-pad test run of the app in the VVD.
- **Steps:** Looked for a CLI command to send key events; found `inputd-cli` by listing `/usr/bin` through `vega device run-cmd`.
- **Expected:** A documented `vega device` command (e.g. `send-key`) with the key names used by `TVEventHandler` (`select`, `up`, `back`…).
- **Actual:** `vega device run-cmd --command 'inputd-cli button_press KEY_ENTER'` works, but `select` / `dpad_center` are rejected (“invalid button value”); the valid names are Linux key codes (`KEY_ENTER`, …), which differ from the `eventType` names the app receives.
- **Severity:** Low
- **Workaround:** `inputd-cli button_press KEY_ENTER` / `KEY_UP` / `KEY_DOWN` / `KEY_LEFT` / `KEY_RIGHT` / `KEY_BACK` (all verified), and `inputd-cli send_text 'some text'` to type into a focused text field.
- **Suggestion:** Document `inputd-cli` (or wrap it as `vega device send-key`) with a table mapping key codes to `TVEventHandler` event types.

---

## 5. Taking a VVD screenshot breaks `vega device run-cmd` for a while

- **Date:** 2026-10-15
- **Task:** Capture VVD screenshots during an automated test run.
- **Steps:** `vega device run-cmd --command 'screenshooter /tmp/lobby.png'`, then more `run-cmd` calls.
- **Expected:** A PNG in `/tmp` on the device, then normal `run-cmd` behavior.
- **Actual:** Both times we called `screenshooter`, the following `run-cmd` / `terminate-app` calls failed with `No running instances of com.amazon.dev.shell.service found` or `no chroot directory found for com.amazon.dev.shell` for 10–30 seconds. The app itself kept running.
- **Severity:** Medium (for test automation)
- **Workaround:** Retry `vega` commands with a short delay; take screenshots outside the VVD (we captured the phone side instead).
- **Suggestion:** Provide a `vega device screenshot` command that copies the PNG to the host, and make the dev shell recover from (or not be affected by) `screenshooter`.

---

## 6. `vega device copy-from --help` swaps host and device

- **Date:** 2026-10-15
- **Task:** Copy a file from the VVD to the Mac.
- **Steps:** `vega device copy-from --help`.
- **Expected:** `--source` is on the device and `--destination` is on the host.
- **Actual:** The option descriptions say the opposite (“Source file or directory on the host”, “Destination file or directory on the device”), while the examples below show the correct direction.
- **Severity:** Low
- **Workaround:** Follow the examples, not the option descriptions.
- **Suggestion:** Fix the option descriptions in the CLI help.

---

## 7. TV keyboard: no quick way to confirm, and `focus()` is deprecated in favor of a Vega-only API

- **Date:** 2026-10-15
- **Task:** Let the host type a custom quiz topic with the remote.
- **Steps:** Focus a `TextInput` (`ref.focus()`), type with the on-screen keyboard, try to confirm.
- **Expected:** Select/Enter confirms the text (fires `onSubmitEditing`), like `returnKeyType="done"` suggests; a cross-platform way to focus a text field.
- **Actual:**
  - The keyboard opens automatically and typing works, but Select types the highlighted key (we got "beach" → "beacha"); `onSubmitEditing` never fired in our tests.
  - The first Back closes the keyboard without reaching the app; a second Back reaches the app's `BackHandler`.
  - `ref.focus()` logs: "ref.current?.focus() is currently deprecated … Use requestTVFocus instead." `requestTVFocus` is not part of React Native, so shared code would need a platform branch. `focus()` still works.
  - `onChangeText` fires twice per character.
- **Severity:** Medium (UX design + time to discover by trial)
- **Workaround:** On TV, show a hint ("Press Back to close the keyboard, then select Use this topic") and put the confirm button first so Down lands on it.
- **Suggestion:** Document keyboard confirm/dismiss behavior for TV; make `returnKeyType="done"` map to a reachable Done key that fires `onSubmitEditing`; keep `focus()` working (or provide a shim) for cross-platform code.

---

<!-- Template
## N. Title

- **Date:**
- **Task:**
- **Steps:**
- **Expected:**
- **Actual:**
- **Severity:**
- **Workaround:**
- **Suggestion:**
-->
