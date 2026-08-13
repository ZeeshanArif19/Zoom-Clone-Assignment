import { useEffect, useRef, useState } from 'react';

export const useSocket = (meetingCode: string, peerId: string, displayName: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!meetingCode || !peerId) return;

    // Smart detection for WebSocket URL
    let wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsBaseUrl) {
      if (typeof window !== 'undefined') {
        const isHttps = window.location.protocol === 'https:';
        wsBaseUrl = isHttps 
          ? 'wss://zoomasm.duckdns.org/api' 
          : 'ws://localhost:8000/api';
      } else {
        wsBaseUrl = 'ws://localhost:8000/api';
      }
    }

    const wsUrl = `${wsBaseUrl}/ws/meeting/${meetingCode}?peer_id=${peerId}&display_name=${encodeURIComponent(displayName)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [meetingCode, peerId, displayName]);

  const sendMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  return { isConnected, sendMessage, messages, setMessages };
};
