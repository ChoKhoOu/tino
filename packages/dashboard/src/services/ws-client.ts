import { z } from 'zod';

const ServerEventSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

type ServerEvent = z.infer<typeof ServerEventSchema>;
type EventHandler = (event: ServerEvent) => void;

export class DashboardWsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isConnected = false;

  constructor(url: string = 'ws://localhost:8000/ws/dashboard') {
    this.url = url;
  }

  get isConnected() { return this._isConnected; }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this._isConnected = true;
      this._emit({ type: 'connection.open' });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          this.ws?.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        const parsed = ServerEventSchema.parse(data);
        this._emit(parsed);
      } catch { /* ignore parse errors */ }
    };

    this.ws.onclose = () => {
      this._isConnected = false;
      this._emit({ type: 'connection.close' });
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this._emit({ type: 'connection.error' });
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  onAny(handler: EventHandler): () => void {
    return this.on('*', handler);
  }

  private _emit(event: ServerEvent): void {
    this.handlers.get(event.type)?.forEach(h => h(event));
    this.handlers.get('*')?.forEach(h => h(event));
  }
}
