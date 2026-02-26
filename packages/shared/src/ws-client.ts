import {
  ServerEventSchema,
  type ServerEvent,
  type ClientEvent,
} from './schemas/events.js';

export type EventHandler = (event: ServerEvent) => void;
export type ErrorHandler = (error: Error) => void;
export type ConnectionHandler = () => void;

export interface WsClientOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatTimeout?: number;
}

export class EngineWsClient {
  private ws: WebSocket | null = null;
  private options: Required<WsClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private _isConnected = false;

  constructor(options: WsClientOptions) {
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatTimeout: 45000,
      ...options,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this._resetHeartbeat();
      this.connectHandlers.forEach((h) => h());
    };

    this.ws.onmessage = (event) => {
      this._resetHeartbeat();
      try {
        const raw = JSON.parse(event.data as string);

        // Handle ping/pong
        if (raw.type === 'ping') {
          this.send({ type: 'pong' } as ClientEvent);
          return;
        }

        const parsed = ServerEventSchema.parse(raw);
        this._emit(parsed);
      } catch (error) {
        this.errorHandlers.forEach((h) =>
          h(error instanceof Error ? error : new Error(String(error))),
        );
      }
    };

    this.ws.onerror = () => {
      this.errorHandlers.forEach((h) =>
        h(new Error('WebSocket error')),
      );
    };

    this.ws.onclose = () => {
      this._isConnected = false;
      this._clearHeartbeat();
      this.disconnectHandlers.forEach((h) => h());

      if (
        this.options.autoReconnect &&
        this.reconnectAttempts < this.options.maxReconnectAttempts
      ) {
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(
          () => this.connect(),
          this.options.reconnectInterval * Math.min(this.reconnectAttempts, 5),
        );
      }
    };
  }

  disconnect(): void {
    this.options.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._clearHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(event: ClientEvent): void {
    if (this.ws && this._isConnected) {
      this.ws.send(JSON.stringify(event));
    }
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    return () => this.eventHandlers.get(eventType)?.delete(handler);
  }

  onAny(handler: EventHandler): () => void {
    return this.on('*', handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  private _emit(event: ServerEvent): void {
    // Type-specific handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((h) => h(event));
    }
    // Wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((h) => h(event));
    }
  }

  private _resetHeartbeat(): void {
    this._clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      // Server missed heartbeat, connection may be dead
      if (this.ws) {
        this.ws.close();
      }
    }, this.options.heartbeatTimeout);
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
