import { useEffect, useRef, useState } from 'react';

export const useSocket = (meetingCode: string, peerId: string, displayName: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!meetingCode || !peerId) return;

    // Use environment variable NEXT_PUBLIC_WS_URL or fallback to local ws://
    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api';
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
