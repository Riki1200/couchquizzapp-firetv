import { GameClient, GameClientEvent } from './GameClient';
import { CreateRoomResponse, Difficulty, HostEvent, HostMessage, Language, Room } from './types';

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000];
const PING_INTERVAL_MS = 60000; // keeps idle connections alive (API Gateway drops them after 10 min)

/** TV client for the game server (local server or API Gateway WebSocket API). */
export class WsGameClient implements GameClient {
  private listeners = new Set<(event: GameClientEvent) => void>();
  private socket: WebSocket | null = null;
  private room: CreateRoomResponse | null = null;
  private attempt = 0;
  private closed = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Commands issued while the socket is (re)connecting; sent in order once it opens. */
  private outbox: HostMessage[] = [];

  constructor(private server: { httpUrl: string; wsUrl: string }) {}

  async createRoom(): Promise<Room> {
    const response = await fetch(`${this.server.httpUrl}/rooms`, { method: 'POST' });
    if (!response.ok) throw new Error(`Could not create a room (HTTP ${response.status})`);
    this.room = await response.json();
    await this.connect();
    return { roomCode: this.room!.roomCode, joinUrl: this.room!.joinUrl };
  }

  configure(topic: string, difficulty: Difficulty, language: Language, questionCount: number) {
    this.send({ action: 'configure', topic, difficulty, language, questionCount });
  }
  startQuestion(index: number) {
    this.send({ action: 'startQuestion', index });
  }
  reveal(index: number) {
    this.send({ action: 'reveal', index });
  }
  endGame() {
    this.send({ action: 'endGame' });
  }

  subscribe(listener: (event: GameClientEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.listeners.clear();
  }

  /** Resolves once the first connection is open. Later drops reconnect automatically. */
  private connect(): Promise<void> {
    return new Promise((resolve) => {
      const { roomCode, hostToken } = this.room!;
      // "ws://host:8787?x" (no path) works in browsers but not with every native WebSocket; use "ws://host:8787/?x".
      const base = /^wss?:\/\/[^/]+$/.test(this.server.wsUrl) ? `${this.server.wsUrl}/` : this.server.wsUrl;
      const socket = new WebSocket(`${base}?room=${roomCode}&role=host&token=${hostToken}`);
      this.socket = socket;
      socket.onopen = () => {
        this.attempt = 0;
        this.emit({ type: 'connection', connected: true });
        socket.send(JSON.stringify({ action: 'sync' }));
        this.outbox.splice(0).forEach((message) => socket.send(JSON.stringify(message)));
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.sendRaw({ action: 'ping' }), PING_INTERVAL_MS);
        resolve();
      };
      socket.onmessage = (message) => this.emit(JSON.parse(String(message.data)) as HostEvent);
      socket.onerror = (event) => console.warn('[WsGameClient] error', (event as { message?: string }).message ?? '');
      socket.onclose = (event) => {
        if (this.socket !== socket || this.closed) return;
        console.warn(`[WsGameClient] closed (${event.code}), reconnecting`);
        this.emit({ type: 'connection', connected: false });
        const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt++, RECONNECT_DELAYS_MS.length - 1)];
        this.reconnectTimer = setTimeout(() => this.connect().then(resolve), delay);
      };
    });
  }

  private send(message: HostMessage) {
    if (!this.sendRaw(message)) this.outbox.push(message);
  }

  private sendRaw(message: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private emit(event: GameClientEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
