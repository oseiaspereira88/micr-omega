import { WORLD_RADIUS } from "@micr-omega/shared";
import { describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import type { Env } from "../src";
import { RoomDO } from "../src/RoomDO";
import { MockDurableObjectState } from "./utils/mock-state";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

const ENTITY_OFFSET_RATIOS = [0.22, 0.18, 0.16, 0.14, 0.12, 0.1] as const;

const normalizeVector = (vector: { x: number; y: number }) => {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / magnitude, y: vector.y / magnitude };
};

const getOrderedSpawnDirections = (primarySpawn: { x: number; y: number }) => {
  const remaining = [...PLAYER_SPAWN_POSITIONS];
  const primaryIndex = remaining.findIndex(
    (position) => position.x === primarySpawn.x && position.y === primarySpawn.y,
  );

  if (primaryIndex >= 0) {
    const [primary] = remaining.splice(primaryIndex, 1);
    return [primary, ...remaining].map((position) => normalizeVector(position));
  }

  return [primarySpawn, ...remaining].map((position) => normalizeVector(position));
};

const getOffsetsForSpawn = (primarySpawn: { x: number; y: number }, count: number) => {
  const directions = getOrderedSpawnDirections(primarySpawn);
  return Array.from({ length: count }, (_, index) => {
    const direction = directions[index % directions.length] ?? { x: 0, y: 0 };
    const ratio = ENTITY_OFFSET_RATIOS[index % ENTITY_OFFSET_RATIOS.length] ?? 0;
    const distance = WORLD_RADIUS * ratio;
    return {
      x: direction.x * distance,
      y: direction.y * distance,
    };
  });
};

const applyOffset = (
  position: { x: number; y: number },
  offset: { x: number; y: number },
) => ({
  x: clamp(position.x + offset.x, -WORLD_RADIUS, WORLD_RADIUS),
  y: clamp(position.y + offset.y, -WORLD_RADIUS, WORLD_RADIUS),
});

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

    const baseMicroPositions = roomAny.world.microorganisms.map((entity: { position: { x: number; y: number } }) => ({
      x: entity.position.x,
      y: entity.position.y,
    }));
    const baseOrganicPositions = roomAny.world.organicMatter.map((matter: { position: { x: number; y: number } }) => ({
      x: matter.position.x,
      y: matter.position.y,
    }));

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
      pendingAttack: { kind: "basic", targetPlayerId: "player-b" },
      statusEffects: [
        { status: "BURNING", stacks: 2, expiresAt: Date.now() + 5_000 },
        { status: "SLOWED", stacks: 1, expiresAt: null },
      ],
      invulnerableUntil: Date.now() + 1_000,
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
      connectedAt: 1,
      lastActiveAt: 0,
      lastSeenAt: 0,
      totalSessionDurationMs: 0,
      sessionCount: 0,
      pendingAttack: { kind: "basic", targetObjectId: "object-3" },
      statusEffects: [{ status: "SHIELDED", stacks: 3, expiresAt: Date.now() + 2_000 }],
      invulnerableUntil: Date.now() + 2_000,
    };

    players.set(playerA.id, playerA);
    players.set(playerB.id, playerB);

    roomAny.playersPendingRemoval.add(playerA.id);
    roomAny.playersPendingRemoval.add(playerB.id);
    roomAny.pendingStatusEffects = [
      {
        targetKind: "player",
        targetPlayerId: playerA.id,
        status: "BURNING",
        stacks: 1,
        durationMs: 1_000,
      },
    ];
    roomAny.microorganismStatusEffects.set("micro-1", [
      { status: "POISON", stacks: 1, expiresAt: Date.now() + 1_000 },
    ]);

    const snapshotBefore = roomAny.serializeGameState();

    await roomAny.resetGame();

    const snapshotAfter = roomAny.serializeGameState();
    expect(snapshotAfter).not.toBe(snapshotBefore);

    const anchorSpawn = getSpawnPositionForPlayer(playerB.id);
    const offsets = getOffsetsForSpawn(
      anchorSpawn,
      baseMicroPositions.length + baseOrganicPositions.length,
    );

    const updatedMicroPositions = roomAny.world.microorganisms.map(
      (entity: { position: { x: number; y: number } }) => entity.position,
    );
    const updatedOrganicPositions = roomAny.world.organicMatter.map(
      (matter: { position: { x: number; y: number } }) => matter.position,
    );

    expect(updatedMicroPositions).toEqual(
      baseMicroPositions.map((position, index) => applyOffset(position, offsets[index]!)),
    );
    expect(updatedOrganicPositions).toEqual(
      baseOrganicPositions.map((position, index) =>
        applyOffset(position, offsets[baseMicroPositions.length + index]!),
      ),
    );

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
    expect(updatedPlayerA.statusEffects).toEqual([]);
    expect(updatedPlayerA.pendingAttack).toBeNull();
    expect(updatedPlayerA.invulnerableUntil).toBeNull();

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
    expect(updatedPlayerB.statusEffects).toEqual([]);
    expect(updatedPlayerB.pendingAttack).toBeNull();
    expect(updatedPlayerB.invulnerableUntil).toBeNull();

    expect(roomAny.playersPendingRemoval.size).toBe(0);
    expect(roomAny.pendingStatusEffects).toEqual([]);
    expect(roomAny.microorganismStatusEffects.size).toBe(0);
  });

  it("broadcasts an updated ranking after resetting the game", async () => {
    const { room } = await createRoom();
    const roomAny = room as any;

    const now = Date.now();
    const player = {
      id: "player-1",
      name: "Alice",
      score: 42,
      combo: 2,
      energy: 0,
      xp: 0,
      geneticMaterial: 0,
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 50, max: 100 },
      combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: now },
      combatAttributes: { attack: 0, defense: 0, speed: 0, range: 0 },
      connected: true,
      connectedAt: now,
      lastActiveAt: now,
      lastSeenAt: now,
      totalSessionDurationMs: 0,
      sessionCount: 0,
      pendingAttack: null,
      statusEffects: [],
      invulnerableUntil: null,
    };

    roomAny.players.set(player.id, player);
    roomAny.nameToPlayerId.set(player.name.toLowerCase(), player.id);
    roomAny.adjustConnectedPlayers(1);

    const broadcastSpy = vi.fn();
    roomAny.broadcast = broadcastSpy;

    await roomAny.resetGame();

    const messages = broadcastSpy.mock.calls.map(([message]: [any]) => message);
    const stateIndex = messages.findIndex(
      (message: any) => message?.type === "state" && message?.mode === "full",
    );
    expect(stateIndex).toBeGreaterThanOrEqual(0);

    const diffIndex = messages.findIndex(
      (message: any) =>
        message?.type === "state" && message?.mode === "diff" && message?.state?.world !== undefined,
    );

    const rankingIndex = messages.findIndex((message: any) => message?.type === "ranking");
    expect(rankingIndex).toBeGreaterThanOrEqual(0);
    expect(rankingIndex).toBeGreaterThan(stateIndex);
    if (diffIndex >= 0) {
      expect(rankingIndex).toBeGreaterThan(diffIndex);
    }

    const rankingMessage = messages[rankingIndex]!;
    expect(rankingMessage.ranking).toEqual([
      expect.objectContaining({ playerId: player.id, name: player.name, score: player.score }),
    ]);
  });
});
