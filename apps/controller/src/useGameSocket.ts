import { useCallback, useEffect, useRef, useState } from 'react';
import { Language, Player, PlayerEvent, PlayerMessage } from '@couch-quiz/protocol';

/**
 * Backend URLs. In AWS they come from /config.json (written by the CDK deployment);
 * otherwise they point at the local server on the machine that served this page.
 */
export const endpoints = {
  httpUrl: `http://${location.hostname}:8787`,
  wsUrl: `ws://${location.hostname}:8787`,
};
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000];

export type View =
  | { kind: 'join' }
  | { kind: 'lobby'; topic: string | null }
  | { kind: 'question'; index: number; total: number; text: string; choices: string[]; deadline: number | null; answered: number | null }
  | { kind: 'reveal'; correctIndex: number; correct: boolean; points: number; total: number; choices: string[] }
  | { kind: 'over'; rank: number; playerCount: number; score: number; title: string | null; line: string | null };

const playerKey = (room: string) => `couchquiz:player:${room}`;

/** One WebSocket per phone. Reconnects automatically and rejoins with the saved player id. */
export function useGameSocket(room: string, onLanguage: (language: Language) => void) {
  const [view, setView] = useState<View>({ kind: 'join' });
  const [player, setPlayer] = useState<Player | null>(null);
  const [connected, setConnected] = useState(false);
  const [hostLeft, setHostLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastChoices = useRef<string[]>([]);

  useEffect(() => {
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const open = () => {
      const savedId = localStorage.getItem(playerKey(room));
      const base = /^wss?:\/\/[^/]+$/.test(endpoints.wsUrl) ? `${endpoints.wsUrl}/` : endpoints.wsUrl;
      const socket = new WebSocket(`${base}?room=${room}&role=player${savedId ? `&playerId=${savedId}` : ''}`);
      socketRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
        socket.send(JSON.stringify({ action: 'sync' }));
      };
      socket.onmessage = (message) => handle(JSON.parse(message.data) as PlayerEvent);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) timer = setTimeout(open, RECONNECT_DELAYS_MS[Math.min(attempt++, RECONNECT_DELAYS_MS.length - 1)]);
      };
    };

    const handle = (event: PlayerEvent) => {
      setHostLeft(event.type === 'hostLeft');
      switch (event.type) {
        case 'joined':
          localStorage.setItem(playerKey(room), event.player.id);
          setPlayer(event.player);
          setError(null);
          break;
        case 'lobby':
          onLanguage(event.language);
          setView({ kind: 'lobby', topic: event.topic });
          break;
        case 'question':
          lastChoices.current = event.choices;
          setView({
            kind: 'question',
            index: event.index,
            total: event.total,
            text: event.text,
            choices: event.choices,
            deadline: event.timeLeftMs === null ? null : Date.now() + event.timeLeftMs,
            answered: null,
          });
          break;
        case 'answerAck':
          setView((v) => (v.kind === 'question' && v.index === event.index ? { ...v, answered: event.choice } : v));
          break;
        case 'reveal':
          setView({ kind: 'reveal', ...event, choices: lastChoices.current });
          break;
        case 'gameOver':
          setView({ kind: 'over', ...event, title: event.award?.title ?? null, line: event.award?.line ?? null });
          break;
        case 'error':
          setError(event.message);
          break;
      }
    };

    open();
    return () => {
      closed = true;
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [room]);

  const send = useCallback((message: PlayerMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message));
  }, []);

  return { view, player, connected, hostLeft, error, send };
}
