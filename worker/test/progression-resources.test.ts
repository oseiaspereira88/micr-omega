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
});
