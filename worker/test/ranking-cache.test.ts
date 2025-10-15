import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import type { CombatLogEntry, OrganicMatter, SharedWorldStateDiff } from "../src/types";
import { MockDurableObjectState } from "./utils/mock-state";

type TestPlayer = ReturnType<typeof createTestPlayer>;

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
}

function createTestPlayer(id: string, overrides: Partial<Record<string, unknown>> = {}): any {
  const now = Date.now();
  const base: any = {
    id,
    name: id,
    score: 0,
    combo: 1,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 100, max: 100 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null },
    combatAttributes: { attack: 10, defense: 0, speed: 0, range: 50 },
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: 0,
    sessionCount: 0,
  };

  return { ...base, ...overrides };
}

function createMockSocket(sent: string[] = []): WebSocket {
  return {
    readyState: (globalThis as any).WebSocket?.OPEN ?? 1,
    send(payload: string) {
      sent.push(typeof payload === "string" ? payload : String(payload));
    },
    close() {
      /* noop */
    },
    addEventListener() {
      /* noop */
    },
    removeEventListener() {
      /* noop */
    },
  } as unknown as WebSocket;
}

describe("RoomDO ranking cache", () => {
  it("reuses cached ranking until a score change invalidates it", async () => {
    const { roomAny } = await createRoom();

    const playerA: TestPlayer = createTestPlayer("player-a", { name: "Alice" });
    const playerB: TestPlayer = createTestPlayer("player-b", { name: "Bob" });

    roomAny.players.set(playerA.id, playerA);
    roomAny.players.set(playerB.id, playerB);
    roomAny.nameToPlayerId.set(playerA.name.toLowerCase(), playerA.id);
    roomAny.nameToPlayerId.set(playerB.name.toLowerCase(), playerB.id);

    const initialRanking = roomAny.getRanking();
    expect(Array.isArray(initialRanking)).toBe(true);
    expect(roomAny.rankingDirty).toBe(false);

    const cachedRanking = roomAny.getRanking();
    expect(cachedRanking).toBe(initialRanking);

    const matter: OrganicMatter = {
      id: "matter-1",
      kind: "organic_matter",
      position: { x: 0, y: 0 },
      quantity: 5,
      nutrients: {},
    };

    roomAny.world.organicMatter = [matter];
    roomAny.rebuildWorldCaches();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const now = Date.now();

    const result = roomAny.handleCollectionsDuringTick(playerA, worldDiff, combatLog, now);
    expect(result.scoresChanged).toBe(true);
    expect(roomAny.rankingDirty).toBe(true);

    const updatedRanking = roomAny.getRanking();
    expect(updatedRanking).not.toBe(initialRanking);
    expect(roomAny.rankingDirty).toBe(false);

    const updatedEntry = updatedRanking.find((entry: { playerId: string }) => entry.playerId === playerA.id);
    expect(updatedEntry?.score).toBeGreaterThan(0);
  });

  it("invalidates cached ranking when a player is detached", async () => {
    const { roomAny } = await createRoom();

    const playerA: TestPlayer = createTestPlayer("player-a", { name: "Alice" });
    const playerB: TestPlayer = createTestPlayer("player-b", { name: "Bob" });

    roomAny.players.set(playerA.id, playerA);
    roomAny.players.set(playerB.id, playerB);
    roomAny.nameToPlayerId.set(playerA.name.toLowerCase(), playerA.id);
    roomAny.nameToPlayerId.set(playerB.name.toLowerCase(), playerB.id);

    const initialRanking = roomAny.getRanking();
    expect(roomAny.rankingDirty).toBe(false);

    const removed = roomAny.detachPlayer(playerA.id);
    expect(removed?.id).toBe(playerA.id);
    expect(roomAny.rankingDirty).toBe(true);

    const updatedRanking = roomAny.getRanking();
    expect(updatedRanking).not.toBe(initialRanking);
    expect(updatedRanking.some((entry: { playerId: string }) => entry.playerId === playerA.id)).toBe(false);
  });

  it("rebuilds the cached ranking when a new player joins", async () => {
    const originalWebSocket = (globalThis as any).WebSocket;
    const websocketMock = { OPEN: 1, CLOSING: 2, CLOSED: 3 };
    (globalThis as any).WebSocket = websocketMock;

    try {
      const { roomAny } = await createRoom();

      const firstSocket = createMockSocket();
      await roomAny.handleJoin(firstSocket, { type: "join", name: "Alice" });

      const cachedBefore = roomAny.getRanking();
      expect(roomAny.rankingDirty).toBe(false);
      expect(cachedBefore.map((entry: { name: string }) => entry.name)).toEqual(["Alice"]);

      const secondSocket = createMockSocket();
      await roomAny.handleJoin(secondSocket, { type: "join", name: "Bob" });

      const cachedAfter = roomAny.getRanking();
      expect(cachedAfter).not.toBe(cachedBefore);
      expect(roomAny.rankingDirty).toBe(false);
      expect(cachedAfter.map((entry: { name: string }) => entry.name)).toEqual(["Alice", "Bob"]);
    } finally {
      (globalThis as any).WebSocket = originalWebSocket;
    }
  });
});
