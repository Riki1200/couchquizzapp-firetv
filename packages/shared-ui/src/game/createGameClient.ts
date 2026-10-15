import { GAME_SERVER } from '../config';
import { GameClient } from './GameClient';
import { MockGameClient } from './MockGameClient';
import { WsGameClient } from './WsGameClient';

export function createGameClient(): GameClient {
  return GAME_SERVER ? new WsGameClient(GAME_SERVER) : new MockGameClient();
}
