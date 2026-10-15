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
