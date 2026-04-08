import type { FastifyInstance } from "fastify";
import { normalizeRoomCode } from "@dad-golf/shared";
import type { WsClientMessage } from "@dad-golf/shared";
import { buildRoundState } from "./roundState.js";
import { sendTo, subscribe, unsubscribe } from "./hub.js";

export async function registerWebsocket(app: FastifyInstance): Promise<void> {
  app.get("/ws/:code", { websocket: true }, (socket, req) => {
    const params = req.params as { code: string };
    const code = normalizeRoomCode(params.code);
    const state = buildRoundState(code);
    if (!state) {
      sendTo(socket, { type: "error", message: "round not found" });
      socket.close();
      return;
    }
    subscribe(code, socket);
    sendTo(socket, { type: "state", state });

    socket.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;
        if (msg.type === "ping") {
          sendTo(socket, { type: "pong" });
        } else if (msg.type === "hello") {
          const s = buildRoundState(code);
          if (s) sendTo(socket, { type: "state", state: s });
        }
      } catch {
        // ignore malformed
      }
    });

    socket.on("close", () => {
      unsubscribe(code, socket);
    });
  });
}
