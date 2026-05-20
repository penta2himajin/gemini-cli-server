import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiSocketProps {
  url: string;
  sessionId: string;
  clientType: 'web' | 'cli';
  onMessage: (event: any) => void;
}

export function useGeminiSocket({ url, sessionId, clientType, onMessage }: UseGeminiSocketProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep callback fresh
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!url) return;
    
    setStatus('connecting');
    // クエリパラメータにクライアント情報を付与
    const wsUrl = new URL(url);
    wsUrl.searchParams.set('clientType', clientType);
    if (sessionId) wsUrl.searchParams.set('sessionId', sessionId);

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [url, sessionId, clientType]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const sendRaw = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const sendMessage = useCallback((text: string) => {
    return sendRaw({
      type: 'chat_message',
      payload: { sessionId, text }
    });
  }, [sessionId, sendRaw]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, sendMessage, sendRaw, connect, disconnect };
}
