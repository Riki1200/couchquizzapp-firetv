# Couch Quiz

An AI-hosted family trivia game for Fire TV (Vega OS). The TV is the game board; players join by scanning a QR code and use their phones as buzzers. No app install for players.

> Work in progress for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track).

## Repository layout

| Path | What it is |
|---|---|
| `apps/vega` | Fire TV app for Vega OS (React Native for Vega) |
| `apps/expo-multi-tv` | Same TV app for web and Android TV (used for fast UI iteration) |
| `packages/shared-ui` | TV screens and components shared by both TV apps |
| `docs/friction-log.md` | Issues found in the Vega SDK, docs, and tooling |

## Getting started

Requires Node.js 22 LTS and Yarn 4 (via `corepack enable`).

```sh
yarn install
yarn dev:web      # TV UI in the browser at http://localhost:8082 (arrow keys = D-pad, Enter = select, Backspace = back)
yarn build:vega   # Build the Vega app (requires the Vega SDK)
```

## Credits

Based on [AmazonAppDev/react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0).

## License

[MIT](LICENSE)
