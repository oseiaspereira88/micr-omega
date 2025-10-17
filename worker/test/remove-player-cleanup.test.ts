import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

function createTestPlayer(id: string): any {
  const now = Date.now();

  return {
    id,
    name: id,
    score: 0,
    combo: 1,
    energy: 0,
    xp: 0,
    geneticMaterial: 0,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 0, max: 100 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: null },
    combatAttributes: { attack: 0, defense: 0, speed: 0, range: 0 },
    evolutionState: { pending: [], applied: [] },
    archetypeKey: null,
    reconnectToken: "token",
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: 0,
    sessionCount: 0,
    skillState: {
      available: [],
      current: "basic",
      cooldowns: {},
    },
    pendingAttack: null,
    statusEffects: [],
    invulnerableUntil: null,
  };
}

describe("RoomDO removePlayer cleanup", () => {
  it("clears pending death tracking when a queued player is removed", async () => {
    const mockState = new MockDurableObjectState();
    const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
    const roomAny = room as any;
    await roomAny.ready;

    const player = createTestPlayer("player-1");
    roomAny.players.set(player.id, player);
    roomAny.nameToPlayerId.set(player.name.toLowerCase(), player.id);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();
    roomAny.broadcast = vi.fn();

    expect(roomAny.getConnectedPlayersCount()).toBe(1);

    const now = Date.now();
    roomAny.queuePlayerDeath(player, now);

    expect(roomAny.getConnectedPlayersCount()).toBe(0);
    expect(roomAny.playersPendingRemoval.has(player.id)).toBe(true);
    expect(roomAny.pendingPlayerDeaths.some((entry: any) => entry.playerId === player.id)).toBe(true);

    await roomAny.removePlayer(player.id, "expired");

    expect(roomAny.playersPendingRemoval.has(player.id)).toBe(false);
    expect(roomAny.pendingPlayerDeaths.some((entry: any) => entry.playerId === player.id)).toBe(false);
    expect(roomAny.pendingPlayerDeaths.length).toBe(0);
    expect(roomAny.getConnectedPlayersCount()).toBe(0);
  });
});
