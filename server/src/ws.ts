import type { FastifyInstance } from "fastify";
import { normalizeRoomCode } from "@dad-golf/shared";
import type { WsClientMessage } from "@dad-golf/shared";
import { buildRoundState } from "./roundState.js";
import {
  getUserBySession,
  getRoundByRoomCode,
  findPlayerByUserId,
  isUserInGroup,
} from "./db/index.js";
import { sendTo, subscribe, unsubscribe } from "./hub.js";

export async function registerWebsocket(app: FastifyInstance): Promise<void> {
  app.get("/ws/:code", { websocket: true }, async (socket, req) => {
    const params = req.params as { code: string };
    const code = normalizeRoomCode(params.code);

    // Optional auth via ?token=... query param so the WS knows the viewer for
    // course favorite/ownership flags.
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    const viewer = token ? await getUserBySession(token) : null;
    const viewerId = viewer?.id ?? null;

    const round = await getRoundByRoomCode(code);
    if (!round) {
      sendTo(socket, { type: "error", message: "round not found" });
      socket.close();
      return;
    }

    // Completed rounds require the viewer to be a participant or group member
    if (round.status === "complete") {
      if (!viewer) {
        sendTo(socket, { type: "error", message: "authentication required" });
        socket.close();
        return;
      }
      const isPlayer = !!(await findPlayerByUserId(round.id, viewer.id));
      const inGroup = round.groupId ? await isUserInGroup(round.groupId, viewer.id) : false;
      if (!isPlayer && !inGroup) {
        sendTo(socket, { type: "error", message: "access denied" });
        socket.close();
        return;
      }
    }

    const state = await buildRoundState(code, viewerId);
    if (!state) {
      sendTo(socket, { type: "error", message: "round not found" });
      socket.close();
      return;
    }
    subscribe(code, socket);
    sendTo(socket, { type: "state", state });

    socket.on("message", async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;
        if (msg.type === "ping") {
          sendTo(socket, { type: "pong" });
        } else if (msg.type === "hello") {
          const s = await buildRoundState(code, viewerId);
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
