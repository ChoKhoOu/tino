import { useState, useEffect, useRef, useCallback } from 'react';
import { EngineWsClient, type ServerEvent } from '@tino/shared';

export interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (event: any) => void;
  on: (eventType: string, handler: (event: ServerEvent) => void) => () => void;
  client: EngineWsClient | null;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState<EngineWsClient | null>(null);
  const clientRef = useRef<EngineWsClient | null>(null);

  useEffect(() => {
    const wsClient = new EngineWsClient({ url });
    clientRef.current = wsClient;
    setClient(wsClient);

    const removeConnect = wsClient.onConnect(() => {
      setIsConnected(true);
    });

    const removeDisconnect = wsClient.onDisconnect(() => {
      setIsConnected(false);
    });

    if (autoConnect) {
      wsClient.connect();
    }

    return () => {
      removeConnect();
      removeDisconnect();
      wsClient.disconnect();
      clientRef.current = null;
      setClient(null);
    };
  }, [url, autoConnect]);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback((event: any) => {
    if (client && client.isConnected) {
      client.send(event);
    }
  }, [client]);

  const on = useCallback((eventType: string, handler: (event: ServerEvent) => void): (() => void) => {
    if (!client) {
      return () => {};
    }
    return client.on(eventType, handler);
  }, [client]);

  return {
    isConnected,
    connect,
    disconnect,
    send,
    on,
    client,
  };
}
