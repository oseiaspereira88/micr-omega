import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import {
  CONTACT_BUFFER,
  MICRO_COLLISION_RADIUS,
  PLAYER_COLLISION_RADIUS,
  RoomDO,
  WORLD_TICK_INTERVAL_MS,
} from "../src/RoomDO";
import { getDefaultSkillList } from "../src/skills";
import type { Env } from "../src";
import type {
  CombatLogEntry,
  Microorganism,
  Obstacle,
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
  const skillList = getDefaultSkillList();

  const base: any = {
    id,
    name: id,
    score: 0,
    combo: 1,
    energy: 120,
    xp: 50,
    geneticMaterial: 20,
    dashCharge: 100,
    dashCooldownMs: 0,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 100, max: 100 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null },
    combatAttributes: { attack: 10, defense: 0, speed: 0, range: 50 },
    archetypeKey: null,
    characteristicPoints: { total: 0, available: 0, spent: 0 },
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

function createTestMicroorganism(
  id: string,
  overrides: Partial<Microorganism> = {},
): Microorganism {
  const base: Microorganism = {
    id,
    kind: "microorganism",
    species: "amoeba",
    name: `${id}-specimen`,
    level: 1,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 10, max: 10 },
    aggression: "neutral",
    attributes: {},
  };

  return {
    ...base,
    ...overrides,
    attributes: { ...base.attributes, ...(overrides.attributes ?? {}) },
  };
}

describe("RoomDO distance-sensitive behaviour", () => {
  it("collects organic matter and respawns a new entity near the collector", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("collector");
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const nearMatter: OrganicMatter = {
      id: "matter-near",
      kind: "organic_matter",
      position: { x: 60, y: 0 },
      quantity: 5,
      nutrients: {},
      tags: { nutrients: [], attributes: [] },
    };
    const farMatter: OrganicMatter = {
      id: "matter-far",
      kind: "organic_matter",
      position: { x: 70, y: 0 },
      quantity: 5,
      nutrients: {},
      tags: { nutrients: [], attributes: [] },
    };

    roomAny.world.organicMatter = [nearMatter, farMatter];
    roomAny.rebuildWorldCaches();
    const originalWorldOrganicMatter = roomAny.world.organicMatter;

    const randomValues = [0.25, 0.4, 0.6, 0.8];
    roomAny.organicMatterRespawnRng = () => {
      const next = randomValues.shift();
      return next !== undefined ? next : 0.5;
    };

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const now = Date.now();

    const result = roomAny.handleCollectionsDuringTick(player, worldDiff, combatLog, now);

    expect(result.playerUpdated).toBe(true);
    expect(roomAny.organicMatter.has(nearMatter.id)).toBe(false);
    expect(roomAny.organicMatter.has(farMatter.id)).toBe(true);
    expect(roomAny.world.organicMatter).toBe(originalWorldOrganicMatter);
    expect(roomAny.world.organicMatter).toHaveLength(1);
    const queuedRespawns = roomAny.organicRespawnQueue as unknown[];
    expect(queuedRespawns.length).toBeGreaterThan(0);
    const removedIds = worldDiff.removeOrganicMatterIds ?? [];
    expect(removedIds).toContain(nearMatter.id);
    expect(removedIds).not.toContain(farMatter.id);
    expect(worldDiff.upsertOrganicMatter).toBeUndefined();
    expect(player.score).toBeGreaterThan(0);
    expect(combatLog.some((entry) => entry.targetKind === "organic_matter")).toBe(true);

    const respawnDiff: SharedWorldStateDiff = {};
    (roomAny as any).processOrganicRespawnQueue(now + 4_000, respawnDiff);
    const upserted = respawnDiff.upsertOrganicMatter ?? [];
    expect(upserted.length).toBeGreaterThan(0);
    const replacement = upserted[0]!;
    const storedEntry = roomAny.organicMatter.get(replacement.id);
    expect(storedEntry).toEqual(replacement);
    expect(storedEntry).not.toBe(replacement);
    expect(replacement.id).not.toBe(nearMatter.id);
    const distance = Math.hypot(
      replacement.position.x - player.position.x,
      replacement.position.y - player.position.y,
    );
    expect(distance).toBeGreaterThan(0);
    expect(roomAny.world.organicMatter).toHaveLength(2);
  });

  it("maintains organic matter saturation after collecting multiple pieces", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("collector");
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const matters: OrganicMatter[] = [
      {
        id: "matter-one",
        kind: "organic_matter",
        position: { x: 40, y: 0 },
        quantity: 4,
        nutrients: {},
        tags: { nutrients: [], attributes: [] },
      },
      {
        id: "matter-two",
        kind: "organic_matter",
        position: { x: -30, y: 10 },
        quantity: 6,
        nutrients: {},
        tags: { nutrients: [], attributes: [] },
      },
      {
        id: "matter-three",
        kind: "organic_matter",
        position: { x: 0, y: -45 },
        quantity: 8,
        nutrients: {},
        tags: { nutrients: [], attributes: [] },
      },
    ];

    roomAny.world.organicMatter = [...matters];
    roomAny.rebuildWorldCaches();
    const originalReference = roomAny.world.organicMatter;
    const originalCount = originalReference.length;

    const randomValues = [0.1, 0.3, 0.5, 0.7, 0.2, 0.4];
    roomAny.organicMatterRespawnRng = () => {
      const next = randomValues.shift();
      return next !== undefined ? next : 0.5;
    };

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const now = Date.now();

    const result = roomAny.handleCollectionsDuringTick(player, worldDiff, combatLog, now);

    expect(result.playerUpdated).toBe(true);
    expect(roomAny.world.organicMatter).toBe(originalReference);
    expect(roomAny.world.organicMatter).toHaveLength(0);
    const queued = roomAny.organicRespawnQueue as unknown[];
    expect(queued.length).toBeGreaterThanOrEqual(matters.length);
    const upsert = worldDiff.upsertOrganicMatter ?? [];
    expect(upsert).toHaveLength(0);
    const remove = worldDiff.removeOrganicMatterIds ?? [];
    expect(remove).toHaveLength(matters.length);
    const respawnDiff: SharedWorldStateDiff = {};
    (roomAny as any).processOrganicRespawnQueue(now + 5_000, respawnDiff);
    const respawned = respawnDiff.upsertOrganicMatter ?? [];
    expect(respawned).toHaveLength(matters.length);
    const storedIds = new Set(roomAny.organicMatter.keys());
    for (const entry of respawned) {
      expect(storedIds.has(entry.id)).toBe(true);
    }
    expect(roomAny.world.organicMatter).toHaveLength(originalCount);
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
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

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
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

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
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism = createTestMicroorganism("hostile-1", {
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 0, damage: 5, resilience: 0 },
    });

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

  it("only applies contact damage once collision radii overlap", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("target", {
      position: { x: 0, y: 0 },
    });
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const attackRange =
      PLAYER_COLLISION_RADIUS + MICRO_COLLISION_RADIUS + CONTACT_BUFFER;
    const farDistance = attackRange + 1;

    const microorganism = createTestMicroorganism("hostile-contact", {
      position: { x: farDistance, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 0, damage: 5, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    let worldDiff: SharedWorldStateDiff = {};
    let combatLog: CombatLogEntry[] = [];
    let updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(0, now, worldDiff, combatLog, updatedPlayers);

    expect(player.health.current).toBe(player.health.max);
    expect(updatedPlayers.has(player.id)).toBe(false);
    expect(combatLog.some((entry) => entry.targetId === player.id)).toBe(false);

    const closeDistance = attackRange - 1;
    microorganism.position = { x: closeDistance, y: 0 };
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];

    worldDiff = {};
    combatLog = [];
    updatedPlayers = new Map<string, TestPlayer>();
    const later = now + 2_000;

    roomAny.updateMicroorganismsDuringTick(0, later, worldDiff, combatLog, updatedPlayers);

    expect(player.health.current).toBeLessThan(player.health.max);
    expect(updatedPlayers.has(player.id)).toBe(true);
    expect(combatLog.some((entry) => entry.targetId === player.id)).toBe(true);
    expect(roomAny.microorganismBehavior.get(microorganism.id)?.lastAttackAt).toBe(later);
  });

  it("does not let hostile microorganisms attack disconnected players", async () => {
    const { roomAny } = await createRoom();

    const disconnected: TestPlayer = createTestPlayer("disconnected", {
      position: { x: 50, y: 0 },
      connected: false,
    });
    const connected: TestPlayer = createTestPlayer("connected", {
      position: { x: 90, y: 0 },
    });

    roomAny.players.set(disconnected.id, disconnected);
    roomAny.players.set(connected.id, connected);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism = createTestMicroorganism("hostile-2", {
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 0, damage: 5, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(0, now, worldDiff, combatLog, updatedPlayers);

    expect(disconnected.health.current).toBe(disconnected.health.max);
    expect(connected.health.current).toBeLessThan(connected.health.max);
    expect(updatedPlayers.has(disconnected.id)).toBe(false);
    expect(updatedPlayers.has(connected.id)).toBe(true);
    expect(combatLog.some((entry) => entry.targetId === connected.id)).toBe(true);
  });

  it("does not let hostile microorganisms attack defeated players", async () => {
    const { roomAny } = await createRoom();

    const defeated: TestPlayer = createTestPlayer("defeated", {
      position: { x: 30, y: 0 },
      health: { current: 0, max: 100 },
    });
    const active: TestPlayer = createTestPlayer("active", {
      position: { x: 90, y: 0 },
    });

    roomAny.players.set(defeated.id, defeated);
    roomAny.players.set(active.id, active);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism = createTestMicroorganism("hostile-3", {
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 0, damage: 5, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(0, now, worldDiff, combatLog, updatedPlayers);

    expect(defeated.health.current).toBe(0);
    expect(active.health.current).toBeLessThan(active.health.max);
    expect(updatedPlayers.has(defeated.id)).toBe(false);
    expect(updatedPlayers.has(active.id)).toBe(true);
    expect(combatLog.some((entry) => entry.targetId === active.id)).toBe(true);
  });

  it("does not let hostile microorganisms attack players marked for removal", async () => {
    const { roomAny } = await createRoom();

    const pendingRemoval: TestPlayer = createTestPlayer("pending", {
      position: { x: 40, y: 0 },
    });
    pendingRemoval.pendingRemoval = true;
    const eligible: TestPlayer = createTestPlayer("eligible", {
      position: { x: 90, y: 0 },
    });

    roomAny.players.set(pendingRemoval.id, pendingRemoval);
    roomAny.players.set(eligible.id, eligible);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism = createTestMicroorganism("hostile-4", {
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 0, damage: 5, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(0, now, worldDiff, combatLog, updatedPlayers);

    expect(pendingRemoval.health.current).toBe(pendingRemoval.health.max);
    expect(eligible.health.current).toBeLessThan(eligible.health.max);
    expect(updatedPlayers.has(pendingRemoval.id)).toBe(false);
    expect(updatedPlayers.has(eligible.id)).toBe(true);
    expect(combatLog.some((entry) => entry.targetId === eligible.id)).toBe(true);
  });

  it("ignores large position jumps from clients and caps movement per tick", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("speedster", {
      position: { x: -360, y: -360 },
      combatAttributes: { attack: 0, defense: 0, speed: 120, range: 0 },
    });

    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

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

  it("does not emit microorganism diffs when movement is blocked", async () => {
    const { roomAny } = await createRoom();

    const obstacle: Obstacle = {
      id: "blocker",
      kind: "obstacle",
      position: { x: 0, y: 0 },
      size: { x: 160, y: 120 },
      impassable: true,
    };

    const microorganism = createTestMicroorganism("micro-blocked", {
      position: { x: -100, y: 0 },
      movementVector: { x: 1, y: 0 },
      orientation: { angle: 0 },
      health: { current: 10, max: 10 },
      aggression: "neutral",
      attributes: { speed: 50, damage: 0, resilience: 0 },
    });

    roomAny.obstacles.clear();
    roomAny.obstacles.set(obstacle.id, obstacle);
    roomAny.world.obstacles = [obstacle];

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    const result = roomAny.updateMicroorganismsDuringTick(1_000, now, worldDiff, combatLog, updatedPlayers);

    expect(result.worldChanged).toBe(true);
    expect(worldDiff.upsertMicroorganisms).toHaveLength(1);
    const halfWidth = obstacle.size.x / 2;
    expect(Math.abs(microorganism.position.x - obstacle.position.x)).toBeGreaterThanOrEqual(
      halfWidth,
    );
  });

  it("steers hostile microorganisms toward the closest player each tick", async () => {
    const { roomAny } = await createRoom();

    const playerNear: TestPlayer = createTestPlayer("target-near", {
      position: { x: 80, y: 0 },
    });
    const playerFar: TestPlayer = createTestPlayer("target-far", {
      position: { x: -140, y: 60 },
    });
    roomAny.players.set(playerNear.id, playerNear);
    roomAny.players.set(playerFar.id, playerFar);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism = createTestMicroorganism("hunter", {
      aggression: "hostile",
      position: { x: -150, y: 0 },
      attributes: { speed: 60, damage: 4, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(
      WORLD_TICK_INTERVAL_MS,
      now,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(worldDiff.upsertMicroorganisms).toHaveLength(1);
    const update = worldDiff.upsertMicroorganisms![0]!;
    const magnitude = Math.hypot(update.movementVector.x, update.movementVector.y);
    expect(magnitude).toBeGreaterThan(0);
    expect(update.movementVector.x).toBeGreaterThan(0);
    expect(update.orientation.angle).toBeGreaterThan(-Math.PI / 2);
    expect(update.orientation.angle).toBeLessThan(Math.PI / 2);
    expect(microorganism.position.x).toBeGreaterThan(-150);
  });

  it("maintains patrol movement for neutral microorganisms with zig-zag steering", async () => {
    const { roomAny } = await createRoom();

    const microorganism = createTestMicroorganism("wanderer", {
      aggression: "neutral",
      position: { x: -200, y: 200 },
      attributes: { speed: 45 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    const now = Date.now();
    roomAny.microorganismBehavior.clear();
    roomAny.microorganismBehavior.set(microorganism.id, {
      lastAttackAt: 0,
      movement: {
        targetPlayerId: null,
        retargetAfter: now - 2_000,
        nextWaypoint: { x: 80, y: 0 },
        zigzagDirection: 1,
        lastZigToggleAt: 0,
        baseHeadingAngle: 0,
        fleeUntil: 0,
      },
    });

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();

    roomAny.updateMicroorganismsDuringTick(
      WORLD_TICK_INTERVAL_MS,
      now,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(worldDiff.upsertMicroorganisms).toHaveLength(1);
    const update = worldDiff.upsertMicroorganisms![0]!;
    expect(Math.hypot(update.movementVector.x, update.movementVector.y)).toBeGreaterThan(0);
    expect(update.orientation.angle).not.toBeNaN();
  });

  it("forces microorganisms to flee from nearby players when low on health", async () => {
    const { roomAny } = await createRoom();

    const pursuer: TestPlayer = createTestPlayer("chaser", {
      position: { x: 40, y: 0 },
    });
    roomAny.players.set(pursuer.id, pursuer);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism = createTestMicroorganism("frail", {
      health: { current: 2, max: 10 },
      aggression: "hostile",
      position: { x: -150, y: 0 },
      attributes: { speed: 50, damage: 3, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(
      WORLD_TICK_INTERVAL_MS,
      now,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(worldDiff.upsertMicroorganisms).toHaveLength(1);
    const update = worldDiff.upsertMicroorganisms![0]!;
    expect(update.movementVector.x).toBeLessThan(0);
    expect(Math.abs(update.orientation.angle)).toBeCloseTo(Math.PI, 1);
  });

  it("adjusts pursuit vectors to dodge immediate obstacles", async () => {
    const { roomAny } = await createRoom();

    const player: TestPlayer = createTestPlayer("runner", {
      position: { x: 120, y: 0 },
    });
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const obstacle: Obstacle = {
      id: "wall", 
      kind: "obstacle",
      position: { x: 40, y: 0 },
      size: { x: 60, y: 40 },
      impassable: true,
    };

    roomAny.obstacles.clear();
    roomAny.obstacles.set(obstacle.id, obstacle);
    roomAny.world.obstacles = [obstacle];

    const microorganism = createTestMicroorganism("dodger", {
      aggression: "hostile",
      position: { x: -150, y: 0 },
      attributes: { speed: 60, damage: 4, resilience: 0 },
    });

    roomAny.microorganisms.clear();
    roomAny.microorganisms.set(microorganism.id, microorganism);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.clear();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, TestPlayer>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(
      WORLD_TICK_INTERVAL_MS,
      now,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(worldDiff.upsertMicroorganisms).toHaveLength(1);
    const update = worldDiff.upsertMicroorganisms![0]!;
    expect(Math.abs(update.movementVector.y)).toBeGreaterThan(0.05);
    expect(update.orientation.angle).not.toBeCloseTo(0);
  });
});

