import { Platform } from 'react-native';

/**
 * Where the TV app finds the game backend.
 *
 * - AWS_SERVER: the deployed backend (HttpApiUrl / WebSocketUrl outputs of `cdk deploy`).
 * - LOCAL_SERVER: `yarn dev:server` on this machine; the VVD reaches it after
 *   `vega device start-port-forwarding --device VirtualDevice -p 8787 --forward false`.
 * - Web: set EXPO_PUBLIC_HTTP_URL / EXPO_PUBLIC_WS_URL (see `yarn play` and `yarn play:aws`);
 *   without them the web TV plays against built-in bots.
 * The phones always follow the TV: the join link in the QR code carries the backend's URLs.
 */
export const AWS_SERVER = {
  httpUrl: 'https://dsl07dvuch.execute-api.us-east-1.amazonaws.com',
  wsUrl: 'wss://s6wd1rjqo2.execute-api.us-east-1.amazonaws.com/prod',
};
export const LOCAL_SERVER = { httpUrl: 'http://localhost:8787', wsUrl: 'ws://localhost:8787' };

/** Backend used by the Vega (and Android TV) app. Switch to LOCAL_SERVER for offline development. */
const VEGA_SERVER: { httpUrl: string; wsUrl: string } | null = AWS_SERVER;

// Written as literal `process.env.EXPO_PUBLIC_*` so Expo can inline them at build time.
declare const process: { env: Record<string, string | undefined> } | undefined;
const httpUrl = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_HTTP_URL : undefined;
const wsUrl = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_WS_URL : undefined;

export const GAME_SERVER: { httpUrl: string; wsUrl: string } | null =
  httpUrl && wsUrl ? { httpUrl, wsUrl } : Platform.OS === 'web' ? null : VEGA_SERVER;

/**
 * Where the TV streams its sound effects from (GET /sounds/{name}.m4a on the game backend).
 * Vega's media player only plays HTTPS sources, so on Vega the sounds come from the AWS HTTP API
 * (HttpApiUrl output of `cdk deploy`) even while the game itself runs on the local server.
 */
const VEGA_SOUNDS_URL: string | null = AWS_SERVER.httpUrl;

export const SOUNDS_URL: string | null =
  Platform.OS === 'web' ? (GAME_SERVER?.httpUrl ?? null) : (VEGA_SOUNDS_URL ?? GAME_SERVER?.httpUrl ?? null);
