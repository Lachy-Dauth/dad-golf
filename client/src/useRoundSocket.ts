import { useEffect, useRef, useState } from "react";
import type { RoundState, WsServerMessage } from "@dad-golf/shared";

export function useRoundSocket(
  roomCode: string | null,
  initialState: RoundState | null,
) {
  const [state, setState] = useState<RoundState | null>(initialState);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (initialState) setState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (!roomCode) return;
    let reconnectTimer: number | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${location.host}/ws/${roomCode}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setLastError(null);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
      ws.onerror = () => {
        setLastError("connection error");
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as WsServerMessage;
          if (
            msg.type === "state" ||
            msg.type === "score_update" ||
            msg.type === "player_joined" ||
            msg.type === "round_started" ||
            msg.type === "round_completed" ||
            msg.type === "current_hole"
          ) {
            setState(msg.state);
          } else if (msg.type === "error") {
            setLastError(msg.message);
          }
        } catch {
          /* ignore */
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      socketRef.current = null;
    };
  }, [roomCode]);

  return { state, setState, connected, lastError };
}
