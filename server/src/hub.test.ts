import { test } from "node:test";
import assert from "node:assert/strict";
import type { WebSocket } from "@fastify/websocket";
import { subscribe, unsubscribe, broadcast, sendTo } from "./hub.js";

function mockSocket(): WebSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    send(data: string) {
      sent.push(data);
    },
  } as unknown as WebSocket & { sent: string[] };
}

function throwingSocket(): WebSocket {
  return {
    send() {
      throw new Error("socket error");
    },
  } as unknown as WebSocket;
}

// Use unique room codes per test to avoid shared state

test("subscribe and broadcast delivers message", () => {
  const room = "GOLF-HUB1";
  const s1 = mockSocket();
  subscribe(room, s1);
  broadcast(room, { type: "round_state", state: null } as never);
  assert.equal(s1.sent.length, 1);
  const parsed = JSON.parse(s1.sent[0]);
  assert.equal(parsed.type, "round_state");
  unsubscribe(room, s1);
});

test("subscribe multiple sockets to same room", () => {
  const room = "GOLF-HUB2";
  const s1 = mockSocket();
  const s2 = mockSocket();
  subscribe(room, s1);
  subscribe(room, s2);
  broadcast(room, { type: "round_state", state: null } as never);
  assert.equal(s1.sent.length, 1);
  assert.equal(s2.sent.length, 1);
  unsubscribe(room, s1);
  unsubscribe(room, s2);
});

test("unsubscribe stops delivery", () => {
  const room = "GOLF-HUB3";
  const s1 = mockSocket();
  subscribe(room, s1);
  unsubscribe(room, s1);
  broadcast(room, { type: "round_state", state: null } as never);
  assert.equal(s1.sent.length, 0);
});

test("unsubscribe from non-existent room does not throw", () => {
  const s1 = mockSocket();
  assert.doesNotThrow(() => unsubscribe("GOLF-NOPE", s1));
});

test("broadcast to non-existent room is no-op", () => {
  assert.doesNotThrow(() => broadcast("GOLF-EMPTY", { type: "round_state", state: null } as never));
});

test("broadcast ignores socket send errors", () => {
  const room = "GOLF-HUB4";
  const bad = throwingSocket();
  const good = mockSocket();
  subscribe(room, bad);
  subscribe(room, good);
  assert.doesNotThrow(() => broadcast(room, { type: "round_state", state: null } as never));
  assert.equal(good.sent.length, 1);
  unsubscribe(room, bad);
  unsubscribe(room, good);
});

test("sendTo delivers to single socket", () => {
  const s1 = mockSocket();
  sendTo(s1, { type: "round_state", state: null } as never);
  assert.equal(s1.sent.length, 1);
});

test("sendTo ignores socket send errors", () => {
  const bad = throwingSocket();
  assert.doesNotThrow(() => sendTo(bad, { type: "round_state", state: null } as never));
});
