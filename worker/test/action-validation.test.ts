import { afterEach, describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { actionMessageSchema, type ActionMessage } from "../src/types";
import { getDefaultSkillList } from "../src/skills";
import { MockDurableObjectState } from "./utils/mock-state";
import { createMockSocket } from "./utils/mock-socket";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
}

function createTestPlayer(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): any {
  const now = Date.now();
  const skillList = getDefaultSkillList();

  const base: any = {
    id,
    name: id,
    score: 0,
    combo: 1,
    energy: 120,
    xp: 50,
    geneticMaterial: 20,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 100, max: 100 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null },
    combatAttributes: { attack: 10, defense: 0, speed: 0, range: 50 },
    archetypeKey: null,
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: 0,
    sessionCount: 0,
    skillState: {
      available: skillList,
      current: skillList[0]!,
      cooldowns: {},
    },
    pendingAttack: null,
    statusEffects: [],
    invulnerableUntil: null,
  };

  return { ...base, ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoomDO action validation", () => {
  it("skips schema validation for typed action payloads", async () => {
    const safeParseSpy = vi.spyOn(actionMessageSchema, "safeParse");
    const sent: string[] = [];
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const { roomAny } = await createRoom();
      roomAny.phase = "active";

      const player = createTestPlayer("player-1");
      roomAny.players.set(player.id, player);
      roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

      const socket = createMockSocket(sent);
      roomAny.clientsBySocket.set(socket, player.id);
      roomAny.socketsByPlayer.set(player.id, socket);

      const message: ActionMessage = {
        type: "action",
        playerId: player.id,
        action: {
          type: "combo",
          multiplier: 2,
        },
      };

      await roomAny.handleActionMessage(message, socket);

      expect(safeParseSpy).not.toHaveBeenCalled();
      expect(player.combo).toBe(2);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });

  it("validates legacy payloads when requested", async () => {
    const safeParseSpy = vi.spyOn(actionMessageSchema, "safeParse");
    const sent: string[] = [];
    const originalWebSocket = globalThis.WebSocket;
    const websocketMock = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const;
    (globalThis as any).WebSocket = websocketMock;

    try {
      const { roomAny } = await createRoom();
      roomAny.phase = "active";

      const player = createTestPlayer("player-1");
      roomAny.players.set(player.id, player);
      roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

      const socket = createMockSocket(sent);
      roomAny.clientsBySocket.set(socket, player.id);
      roomAny.socketsByPlayer.set(player.id, socket);

      const invalidMessage = {
        type: "action",
        playerId: player.id,
      } as unknown as ActionMessage;

      await roomAny.handleActionMessage(invalidMessage, socket, { validate: true });

      expect(safeParseSpy).toHaveBeenCalledTimes(1);
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0]!)).toEqual({ type: "error", reason: "invalid_payload" });
      expect(player.combo).toBe(1);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
