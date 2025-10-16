import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO, WORLD_TICK_INTERVAL_MS } from "../src/RoomDO";
import type { Env } from "../src";
import type {
  CombatLogEntry,
  Microorganism,
  OrganicMatter,
  SharedWorldStateDiff,
} from "../src/types";
import { MockDurableObjectState } from "./utils/mock-state";

type TestPlayer = ReturnType<typeof createTestPlayer>;

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { room, roomAny } as const;
}

function createTestPlayer(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): any {
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
    archetypeKey: null,
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: 0,
    sessionCount: 0,
  };

  return { ...base, ...overrides };
}

describe("RoomDO distance-sensitive behaviour", () => {
  it("collects organic matter at the collection radius threshold", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("collector");
    roomAny.players.set(player.id, player);

    const nearMatter: OrganicMatter = {
      id: "matter-near",
      kind: "organic_matter",
      position: { x: 60, y: 0 },
      quantity: 5,
      nutrients: {},
    };
    const farMatter: OrganicMatter = {
      id: "matter-far",
      kind: "organic_matter",
      position: { x: 70, y: 0 },
      quantity: 5,
      nutrients: {},
    };

    roomAny.world.organicMatter = [nearMatter, farMatter];
    roomAny.rebuildWorldCaches();
    const originalWorldOrganicMatter = roomAny.world.organicMatter;

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const now = Date.now();

    const result = roomAny.handleCollectionsDuringTick(player, worldDiff, combatLog, now);

    expect(result.playerUpdated).toBe(true);
    expect(roomAny.organicMatter.has(nearMatter.id)).toBe(false);
    expect(roomAny.organicMatter.has(farMatter.id)).toBe(true);
    expect(roomAny.world.organicMatter).toBe(originalWorldOrganicMatter);
    expect(roomAny.world.organicMatter).toHaveLength(1);
    expect(roomAny.world.organicMatter[0]).toBe(farMatter);
    const removedIds = worldDiff.removeOrganicMatterIds ?? [];
    expect(removedIds).toContain(nearMatter.id);
    expect(removedIds).not.toContain(farMatter.id);
    expect(player.score).toBeGreaterThan(0);
    expect(combatLog.some((entry) => entry.targetKind === "organic_matter")).toBe(true);
  });

  it("resolves player attacks when targets are within range", async () => {
    const { roomAny } = await createRoom();

    const attacker: TestPlayer = createTestPlayer("attacker", {
      combatStatus: {
        state: "engaged",
        targetPlayerId: "defender",
        targetObjectId: null,
      },
      combatAttributes: { attack: 20, defense: 0, speed: 0, range: 50 },
    });
    const defender: TestPlayer = createTestPlayer("defender", {
      position: { x: 54, y: 0 },
      combatAttributes: { attack: 10, defense: 0, speed: 0, range: 30 },
    });

    roomAny.players.set(attacker.id, attacker);
    roomAny.players.set(defender.id, defender);

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    const result = roomAny.resolvePlayerAttackDuringTick(
      attacker,
      now,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(false);
    expect(result.scoresChanged).toBe(true);
    expect(defender.health.current).toBeLessThan(defender.health.max);
    expect(updatedPlayers.has(attacker.id)).toBe(true);
    expect(updatedPlayers.has(defender.id)).toBe(true);
    expect(attacker.combatStatus.lastAttackAt).toBe(now);
  });

  it("prevents player attacks when targets are out of range", async () => {
    const { roomAny } = await createRoom();

    const attacker: TestPlayer = createTestPlayer("attacker", {
      combatStatus: {
        state: "engaged",
        targetPlayerId: "defender",
        targetObjectId: null,
      },
      combatAttributes: { attack: 20, defense: 0, speed: 0, range: 50 },
    });
    const defender: TestPlayer = createTestPlayer("defender", {
      position: { x: 56, y: 0 },
      combatAttributes: { attack: 10, defense: 0, speed: 0, range: 30 },
    });

    roomAny.players.set(attacker.id, attacker);
    roomAny.players.set(defender.id, defender);

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    const result = roomAny.resolvePlayerAttackDuringTick(
      attacker,
      now,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(false);
    expect(result.scoresChanged).toBe(false);
    expect(defender.health.current).toBe(defender.health.max);
    expect(updatedPlayers.size).toBe(0);
    expect(attacker.combatStatus.lastAttackAt).toBeUndefined();
  });

  it("lets hostile microorganisms attack players within range", async () => {
    const { roomAny } = await createRoom();

    const playerNear: TestPlayer = createTestPlayer("near", {
      position: { x: 80, y: 60 },
      combatAttributes: { attack: 10, defense: 0, speed: 0, range: 30 },
    });
    const playerFar: TestPlayer = createTestPlayer("far", {
      position: { x: 150, y: 0 },
      combatAttributes: { attack: 10, defense: 0, speed: 0, range: 30 },
    });

    roomAny.players.set(playerNear.id, playerNear);
    roomAny.players.set(playerFar.id, playerFar);

    const microorganism: Microorganism = {
      id: "hostile-1",
      kind: "microorganism",
      species: "amoeba",
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 0, damage: 5, resilience: 0 },
    };

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(0, now, worldDiff, combatLog, updatedPlayers);

    expect(playerNear.health.current).toBeLessThan(playerNear.health.max);
    expect(playerFar.health.current).toBe(playerFar.health.max);
    expect(updatedPlayers.has(playerNear.id)).toBe(true);
    expect(updatedPlayers.has(playerFar.id)).toBe(false);
    expect(roomAny.microorganismBehavior.get(microorganism.id)?.lastAttackAt).toBe(now);
    expect(combatLog.some((entry) => entry.targetId === playerNear.id)).toBe(true);
  });

  it("ignores large position jumps from clients and caps movement per tick", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("speedster", {
      position: { x: -360, y: -360 },
      combatAttributes: { attack: 0, defense: 0, speed: 120, range: 0 },
    });

    roomAny.players.set(player.id, player);

    const initialPosition = { ...player.position };

    const action = {
      type: "movement" as const,
      position: { x: 10_000, y: 10_000 },
      movementVector: { x: 5, y: 0 },
      orientation: { angle: 0 },
    };

    const result = roomAny.applyPlayerAction(player, action);

    expect(result).not.toBeNull();
    expect(player.position).toEqual(initialPosition);
    expect(player.movementVector.x).toBeCloseTo(1);
    expect(player.movementVector.y).toBeCloseTo(0);

    const deltaMs = WORLD_TICK_INTERVAL_MS * 10;
    const moved = roomAny.movePlayerDuringTick(player, deltaMs);

    expect(moved).toBe(true);
    const expectedDistance = (player.combatAttributes.speed * WORLD_TICK_INTERVAL_MS) / 1000;
    expect(player.position.x - initialPosition.x).toBeCloseTo(expectedDistance);
    expect(player.position.y).toBeCloseTo(initialPosition.y);
  });
});

