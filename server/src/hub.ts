import type { WebSocket } from "@fastify/websocket";
import type { WsServerMessage } from "@dad-golf/shared";

// roomCode -> set of sockets subscribed to that round
const rooms = new Map<string, Set<WebSocket>>();

export function subscribe(roomCode: string, socket: WebSocket): void {
  let set = rooms.get(roomCode);
  if (!set) {
    set = new Set();
    rooms.set(roomCode, set);
  }
  set.add(socket);
}

export function unsubscribe(roomCode: string, socket: WebSocket): void {
  const set = rooms.get(roomCode);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) rooms.delete(roomCode);
}

export function broadcast(roomCode: string, message: WsServerMessage): void {
  const set = rooms.get(roomCode);
  if (!set) return;
  const data = JSON.stringify(message);
  for (const socket of set) {
    try {
      socket.send(data);
    } catch {
      // ignore; removed on close
    }
  }
}

export function sendTo(socket: WebSocket, message: WsServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    /* ignore */
  }
}
