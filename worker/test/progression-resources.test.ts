import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import { getDefaultSkillList } from "../src/skills";
import type {
  CombatLogEntry,
  Microorganism,
  OrganicMatter,
  SharedWorldStateDiff,
} from "../src/types";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
}

function createTestPlayer(id: string): any {
  const now = Date.now();
  const skillList = getDefaultSkillList();
  return {
    id,
    name: id,
    score: 0,
    combo: 1,
    energy: 0,
    xp: 0,
    geneticMaterial: 0,
    geneFragments: { minor: 0, major: 0, apex: 0 },
    stableGenes: { minor: 0, major: 0, apex: 0 },
    dashCharge: 100,
    dashCooldownMs: 0,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 120, max: 120 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null },
    combatAttributes: { attack: 12, defense: 4, speed: 140, range: 80 },
    archetypeKey: null,
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: 0,
    sessionCount: 0,
    evolutionState: undefined,
    skillState: {
      available: skillList,
      current: skillList[0]!,
      cooldowns: {},
    },
    pendingAttack: null,
    statusEffects: [],
    invulnerableUntil: null,
  };
}

describe("RoomDO progression resource updates", () => {
  let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  it("awards resources when defeating a microorganism", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("hunter");
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism: Microorganism = {
      id: "micro-drop",
      kind: "microorganism",
      species: "amoeba",
      name: "Scarlet Drifter",
      level: 2,
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 10, max: 10 },
      aggression: "hostile",
      attributes: { speed: 10, damage: 4, resilience: 0 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const now = Date.now();

    const result = roomAny.applyDamageToMicroorganism(
      player,
      microorganism,
      50,
      now,
      worldDiff,
      combatLog,
    );

    expect(result.defeated).toBe(true);
    expect(player.xp).toBeGreaterThan(0);
    expect(player.geneticMaterial).toBeGreaterThan(0);
    const fragmentTotal =
      (player.geneFragments.minor ?? 0) +
      (player.geneFragments.major ?? 0) +
      (player.geneFragments.apex ?? 0);
    expect(fragmentTotal).toBeGreaterThan(0);
  });

  it("restores energy from organic matter to enable costly skills", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("weaver");
    const skillList = getDefaultSkillList();
    player.skillState.available = skillList;
    player.skillState.current = "shield";
    player.skillState.cooldowns = { shield: 0 };
    player.geneticMaterial = 4;
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism: Microorganism = {
      id: "micro-prime",
      kind: "microorganism",
      species: "ciliate",
      name: "Azure Warden",
      level: 1,
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 12, max: 12 },
      aggression: "neutral",
      attributes: { speed: 12, damage: 3, resilience: 0 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const killDiff: SharedWorldStateDiff = {};
    const killLog: CombatLogEntry[] = [];
    const now = Date.now();

    const killResult = roomAny.applyDamageToMicroorganism(
      player,
      microorganism,
      20,
      now,
      killDiff,
      killLog,
    );

    expect(killResult.defeated).toBe(true);
    expect(player.xp).toBeGreaterThan(0);
    expect(player.geneticMaterial).toBeGreaterThanOrEqual(5);
    expect(player.energy).toBe(0);

    const attackDiff: SharedWorldStateDiff = {};
    const attackLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const failedAttack = roomAny.resolveSkillAttack(
      player,
      now,
      attackDiff,
      attackLog,
      updatedPlayers,
    );
    expect(failedAttack.worldChanged).toBe(false);
    expect(player.energy).toBe(0);
    expect(player.geneticMaterial).toBeGreaterThanOrEqual(5);

    player.skillState.cooldowns.shield = 0;
    player.combatStatus = { state: "idle", targetPlayerId: null, targetObjectId: null };

    const matter: OrganicMatter = {
      id: "organic-rich",
      kind: "organic_matter",
      position: { x: 0, y: 0 },
      quantity: 60,
      nutrients: { carbon: 10 },
    };
    roomAny.addOrganicMatterEntity(matter);

    const collectionDiff: SharedWorldStateDiff = {};
    const collectionLog: CombatLogEntry[] = [];
    roomAny.handleCollectionsDuringTick(player, collectionDiff, collectionLog, now);

    expect(player.energy).toBeGreaterThanOrEqual(70);
    expect(player.xp).toBeGreaterThan(0);
    expect(player.geneticMaterial).toBeGreaterThanOrEqual(5);

    const successDiff: SharedWorldStateDiff = {};
    const successLog: CombatLogEntry[] = [];
    const successUpdates = new Map<string, typeof player>();
    const energyAfterCollection = player.energy;
    const mgAfterCollection = player.geneticMaterial;
    roomAny.resolveSkillAttack(player, now, successDiff, successLog, successUpdates);

    expect(player.energy).toBeLessThan(energyAfterCollection);
    expect(player.geneticMaterial).toBe(mgAfterCollection - 5);
    expect(successUpdates.has(player.id)).toBe(true);
  });

  it("queues organic respawn groups using the configured delay window", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("gatherer");
    player.position = { x: 0, y: 0 };
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const matterA: OrganicMatter = {
      id: "organic-a",
      kind: "organic_matter",
      position: { x: 10, y: 0 },
      quantity: 12,
      nutrients: { carbon: 2 },
    };
    const matterB: OrganicMatter = {
      id: "organic-b",
      kind: "organic_matter",
      position: { x: -10, y: 0 },
      quantity: 8,
      nutrients: { nitrogen: 1 },
    };
    const matterC: OrganicMatter = {
      id: "organic-c",
      kind: "organic_matter",
      position: { x: 0, y: 12 },
      quantity: 10,
      nutrients: { sulfur: 1 },
    };

    roomAny.addOrganicMatterEntity(matterA);
    roomAny.addOrganicMatterEntity(matterB);
    roomAny.addOrganicMatterEntity(matterC);

    const anchor = { x: 160, y: -20 };
    roomAny.findOrganicMatterRespawnPosition = vi.fn().mockReturnValue(anchor);

    const rngValues = [0.3, 0.2, 0.75];
    roomAny.organicMatterRespawnRng = vi
      .fn(() => (rngValues.length > 0 ? rngValues.shift()! : 0.5));

    const collectionDiff: SharedWorldStateDiff = {};
    const collectionLog: CombatLogEntry[] = [];
    const now = 25_000;

    roomAny.handleCollectionsDuringTick(player, collectionDiff, collectionLog, now);

    expect(roomAny.organicRespawnQueue).toHaveLength(1);
    const group = roomAny.organicRespawnQueue[0];
    expect(group.size).toBe(3);
    expect(group.templates).toHaveLength(3);
    const delay = group.respawnAt - now;
    expect(delay).toBeGreaterThanOrEqual(group.delayRangeMs.min);
    expect(delay).toBeLessThanOrEqual(group.delayRangeMs.max);
    expect(group.clusterShape.length).toBeGreaterThanOrEqual(group.size);
  });

  it("respawns entire organic groups together once their delay elapses", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("sprinter");
    player.position = { x: 0, y: 0 };
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const matterA: OrganicMatter = {
      id: "organic-d",
      kind: "organic_matter",
      position: { x: 6, y: 0 },
      quantity: 6,
      nutrients: {},
    };
    const matterB: OrganicMatter = {
      id: "organic-e",
      kind: "organic_matter",
      position: { x: -6, y: 0 },
      quantity: 7,
      nutrients: {},
    };
    const matterC: OrganicMatter = {
      id: "organic-f",
      kind: "organic_matter",
      position: { x: 0, y: 6 },
      quantity: 9,
      nutrients: {},
    };

    roomAny.addOrganicMatterEntity(matterA);
    roomAny.addOrganicMatterEntity(matterB);
    roomAny.addOrganicMatterEntity(matterC);

    const anchor = { x: -140, y: 40 };
    roomAny.findOrganicMatterRespawnPosition = vi.fn().mockReturnValue(anchor);

    const rngValues = [0.25, 0.6, 0.4];
    roomAny.organicMatterRespawnRng = vi
      .fn(() => (rngValues.length > 0 ? rngValues.shift()! : 0.5));

    const collectionDiff: SharedWorldStateDiff = {};
    const collectionLog: CombatLogEntry[] = [];
    const now = 40_000;

    roomAny.handleCollectionsDuringTick(player, collectionDiff, collectionLog, now);

    expect(roomAny.organicRespawnQueue).toHaveLength(1);
    const group = roomAny.organicRespawnQueue[0];

    const prematureDiff: SharedWorldStateDiff = {};
    roomAny.processOrganicRespawnQueue(group.respawnAt - 1, prematureDiff);
    expect(prematureDiff.upsertOrganicMatter).toBeUndefined();
    expect(roomAny.organicRespawnQueue).toHaveLength(1);

    const respawnDiff: SharedWorldStateDiff = {};
    roomAny.processOrganicRespawnQueue(group.respawnAt, respawnDiff);

    expect(respawnDiff.upsertOrganicMatter).toHaveLength(group.size);
    const spawnedIds = new Set(respawnDiff.upsertOrganicMatter!.map((matter) => matter.id));
    expect(spawnedIds.size).toBe(group.size);
    expect(roomAny.organicRespawnQueue).toHaveLength(0);
  });
});
