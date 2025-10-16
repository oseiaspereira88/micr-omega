import { WORLD_RADIUS } from "@micr-omega/shared";
import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import type { Env } from "../src";
import { RoomDO } from "../src/RoomDO";
import { MockDurableObjectState } from "./utils/mock-state";

const PLAYER_SPAWN_DISTANCE_RATIO = 18 / 25;
const PLAYER_SPAWN_DISTANCE = WORLD_RADIUS * PLAYER_SPAWN_DISTANCE_RATIO;

const PLAYER_SPAWN_POSITIONS = [
  { x: -PLAYER_SPAWN_DISTANCE, y: -PLAYER_SPAWN_DISTANCE },
  { x: PLAYER_SPAWN_DISTANCE, y: -PLAYER_SPAWN_DISTANCE },
  { x: -PLAYER_SPAWN_DISTANCE, y: PLAYER_SPAWN_DISTANCE },
  { x: PLAYER_SPAWN_DISTANCE, y: PLAYER_SPAWN_DISTANCE },
  { x: 0, y: -PLAYER_SPAWN_DISTANCE },
  { x: 0, y: PLAYER_SPAWN_DISTANCE },
  { x: PLAYER_SPAWN_DISTANCE, y: 0 },
  { x: -PLAYER_SPAWN_DISTANCE, y: 0 },
] as const;

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};

const getSpawnPositionForPlayer = (playerId: string) => {
  const index = hashString(playerId) % PLAYER_SPAWN_POSITIONS.length;
  const spawn = PLAYER_SPAWN_POSITIONS[index];
  return { x: spawn.x, y: spawn.y };
};

describe("RoomDO resetGame", () => {
  async function createRoom() {
    const mockState = new MockDurableObjectState();
    const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
    await (room as any).ready;
    return { room, mockState };
  }

  it("restores players to a neutral state", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const players: Map<string, any> = roomAny.players;

    const playerA = {
      id: "player-a",
      name: "Alice",
      score: 12,
      combo: 7,
      position: { x: 123, y: -456 },
      movementVector: { x: 1, y: 1 },
      orientation: { angle: Math.PI / 2, tilt: 0.3 },
      health: { current: 4, max: 120 },
      combatStatus: {
        state: "attacking",
        targetPlayerId: "player-b",
        targetObjectId: "object-1",
        lastAttackAt: Date.now() - 500,
      },
      combatAttributes: { attack: 10, defense: 5, speed: 150, range: 90 },
      connected: false,
      lastActiveAt: 0,
      lastSeenAt: 0,
      connectedAt: null,
      totalSessionDurationMs: 0,
      sessionCount: 0,
    };

    const playerB = {
      id: "player-b",
      name: "Bob",
      score: 3,
      combo: 2,
      position: { x: -400, y: 600 },
      movementVector: { x: -0.2, y: 0.8 },
      orientation: { angle: Math.PI, tilt: -0.1 },
      health: { current: 25, max: 75 },
      combatStatus: {
        state: "blocking",
        targetPlayerId: null,
        targetObjectId: "object-2",
        lastAttackAt: Date.now() - 1000,
      },
      combatAttributes: { attack: 8, defense: 4, speed: 140, range: 80 },
      connected: true,
      lastActiveAt: 0,
      lastSeenAt: 0,
      connectedAt: null,
      totalSessionDurationMs: 0,
      sessionCount: 0,
    };

    players.set(playerA.id, playerA);
    players.set(playerB.id, playerB);

    const snapshotBefore = roomAny.serializeGameState();

    await roomAny.resetGame();

    const snapshotAfter = roomAny.serializeGameState();
    expect(snapshotAfter).not.toBe(snapshotBefore);

    const updatedPlayerA = players.get(playerA.id)!;
    const updatedPlayerB = players.get(playerB.id)!;

    expect(updatedPlayerA.combo).toBe(1);
    expect(updatedPlayerA.lastActiveAt).not.toBe(0);
    expect(updatedPlayerA.movementVector).toEqual({ x: 0, y: 0 });
    expect(updatedPlayerA.orientation).toEqual({ angle: 0 });
    expect(updatedPlayerA.position).toEqual(getSpawnPositionForPlayer(playerA.id));
    expect(updatedPlayerA.health).toEqual({ current: 120, max: 120 });
    expect(updatedPlayerA.combatStatus).toEqual({
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: null,
    });

    expect(updatedPlayerB.combo).toBe(1);
    expect(updatedPlayerB.lastActiveAt).not.toBe(0);
    expect(updatedPlayerB.movementVector).toEqual({ x: 0, y: 0 });
    expect(updatedPlayerB.orientation).toEqual({ angle: 0 });
    expect(updatedPlayerB.position).toEqual(getSpawnPositionForPlayer(playerB.id));
    expect(updatedPlayerB.health).toEqual({ current: 75, max: 75 });
    expect(updatedPlayerB.combatStatus).toEqual({
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: null,
    });
  });
});
