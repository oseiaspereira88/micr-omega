import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO, WORLD_TICK_INTERVAL_MS } from "../src/RoomDO";
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
    expect(roomAny.world.organicMatter).toHaveLength(2);
    const worldMatterIds = roomAny.world.organicMatter.map((matter: OrganicMatter) => matter.id);
    expect(worldMatterIds).toContain(farMatter.id);
    const replacementId = worldMatterIds.find((id: string) => id !== farMatter.id);
    expect(replacementId).toBeDefined();
    const replacement = replacementId ? roomAny.organicMatter.get(replacementId) : undefined;
    expect(replacement?.id).not.toBe(nearMatter.id);
    const removedIds = worldDiff.removeOrganicMatterIds ?? [];
    expect(removedIds).toContain(nearMatter.id);
    expect(removedIds).not.toContain(farMatter.id);
    expect(worldDiff.upsertOrganicMatter).toBeDefined();
    const upsertedIds = worldDiff.upsertOrganicMatter?.map((matter) => matter.id) ?? [];
    expect(upsertedIds).toContain(replacementId);
    if (replacementId) {
      const diffEntry = worldDiff.upsertOrganicMatter?.find((matter) => matter.id === replacementId);
      const storedEntry = roomAny.organicMatter.get(replacementId);
      expect(diffEntry).toEqual(storedEntry);
      expect(diffEntry).not.toBe(storedEntry);
    }
    expect(player.score).toBeGreaterThan(0);
    expect(combatLog.some((entry) => entry.targetKind === "organic_matter")).toBe(true);
    if (replacement) {
      const distance = Math.hypot(
        replacement.position.x - player.position.x,
        replacement.position.y - player.position.y,
      );
      expect(distance).toBeGreaterThan(0);
    }
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
      },
      {
        id: "matter-two",
        kind: "organic_matter",
        position: { x: -30, y: 10 },
        quantity: 6,
        nutrients: {},
      },
      {
        id: "matter-three",
        kind: "organic_matter",
        position: { x: 0, y: -45 },
        quantity: 8,
        nutrients: {},
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
    expect(roomAny.world.organicMatter).toHaveLength(originalCount);
    const currentIds = new Set(roomAny.world.organicMatter.map((matter: OrganicMatter) => matter.id));
    for (const matter of matters) {
      expect(currentIds.has(matter.id)).toBe(false);
    }
    const upsert = worldDiff.upsertOrganicMatter ?? [];
    expect(upsert).toHaveLength(matters.length);
    const remove = worldDiff.removeOrganicMatterIds ?? [];
    expect(remove).toHaveLength(matters.length);
    const storedIds = new Set(roomAny.organicMatter.keys());
    for (const entry of upsert) {
      expect(storedIds.has(entry.id)).toBe(true);
    }
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

    const microorganism: Microorganism = {
      id: "hostile-2",
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

    const microorganism: Microorganism = {
      id: "hostile-3",
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

    const microorganism: Microorganism = {
      id: "hostile-4",
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

    const microorganism: Microorganism = {
      id: "micro-blocked",
      kind: "microorganism",
      species: "amoeba",
      position: { x: -100, y: 0 },
      movementVector: { x: 1, y: 0 },
      orientation: { angle: 0 },
      health: { current: 10, max: 10 },
      aggression: "neutral",
      attributes: { speed: 50, damage: 0, resilience: 0 },
    };

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

    expect(result.worldChanged).toBe(false);
    expect(worldDiff.upsertMicroorganisms).toBeUndefined();
    expect(microorganism.position).toEqual({ x: -100, y: 0 });
  });
});

