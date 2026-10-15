import { Platform } from 'react-native';

/**
 * Where the TV app finds the game backend. When no URLs are set, the TV plays against
 * built-in bots (MockGameClient) and needs no server.
 *
 * - Web: set EXPO_PUBLIC_HTTP_URL / EXPO_PUBLIC_WS_URL when starting `yarn dev:web`.
 * - Vega: edit VEGA_SERVER below (Metro for Vega does not inline EXPO_PUBLIC_* variables).
 *
 * Local server (`yarn dev:server`): http://localhost:8787 and ws://localhost:8787.
 * The VVD reaches it after `vega device start-port-forwarding --device VirtualDevice -p 8787 --forward false`.
 * AWS: the HttpApiUrl / WebSocketUrl outputs of `cdk deploy`.
 */
const VEGA_SERVER: { httpUrl: string; wsUrl: string } | null = { httpUrl: 'http://localhost:8787', wsUrl: 'ws://localhost:8787' };

const env = typeof process !== 'undefined' ? process.env : {};
const httpUrl = env.EXPO_PUBLIC_HTTP_URL;
const wsUrl = env.EXPO_PUBLIC_WS_URL;

export const GAME_SERVER: { httpUrl: string; wsUrl: string } | null =
  httpUrl && wsUrl ? { httpUrl, wsUrl } : Platform.OS === 'web' ? null : VEGA_SERVER;
