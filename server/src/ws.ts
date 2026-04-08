import type { FastifyInstance } from "fastify";
import { normalizeRoomCode } from "@dad-golf/shared";
import type { WsClientMessage } from "@dad-golf/shared";
import { buildRoundState } from "./roundState.js";
import { getUserBySession } from "./db.js";
import { sendTo, subscribe, unsubscribe } from "./hub.js";

export async function registerWebsocket(app: FastifyInstance): Promise<void> {
  app.get("/ws/:code", { websocket: true }, (socket, req) => {
    const params = req.params as { code: string };
    const code = normalizeRoomCode(params.code);

    // Optional auth via ?token=... query param so the WS knows the viewer for
    // course favorite/ownership flags.
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    const viewer = token ? getUserBySession(token) : null;
    const viewerId = viewer?.id ?? null;

    const state = buildRoundState(code, viewerId);
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
          const s = buildRoundState(code, viewerId);
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
