import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import { getDefaultSkillList } from "../src/skills";
import type {
  CombatLogEntry,
  Microorganism,
  Obstacle,
  SharedWorldStateDiff,
} from "../src/types";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

const DASH_CHARGE_COST = 30;
const DASH_COOLDOWN_MS = 1_000;
const DASH_RECHARGE_PER_MS = 20 / 1_000;

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
    energy: 120,
    xp: 50,
    geneticMaterial: 20,
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

describe("RoomDO attack kind resolution", () => {
  it("executes dash attacks with displacement and status events", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("runner");
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();
    roomAny.obstacles = new Map();
    roomAny.world.obstacles = [];

    const microorganism: Microorganism = {
      id: "micro-1",
      kind: "microorganism",
      species: "amoeba",
      position: { x: 30, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 25, max: 25 },
      aggression: "hostile",
      attributes: { speed: 30, damage: 6, resilience: 0 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "dash",
      state: "engaged",
    });
    expect(applied).not.toBeNull();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const result = roomAny.resolvePlayerAttackDuringTick(
      player,
      Date.now(),
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(true);
    expect(player.position.x).not.toBe(0);
    expect(player.combatStatus.state).toBe("cooldown");
    const remaining = roomAny.microorganisms.get(microorganism.id);
    expect(remaining?.health.current).toBeLessThan(microorganism.health.max);
    expect(worldDiff.statusEffects).toBeDefined();
    expect(worldDiff.statusEffects?.some((event) => event.status === "KNOCKBACK")).toBe(true);
  });

  it("shortens dash movement when the path is obstructed by an obstacle", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("skimmer");
    player.position = { x: -100, y: 0 };
    player.orientation = { angle: 0 };
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const obstacle: Obstacle = {
      id: "wall-1",
      kind: "obstacle",
      position: { x: -20, y: 0 },
      size: { x: 60, y: 120 },
      impassable: true,
    };

    roomAny.obstacles = new Map([[obstacle.id, obstacle]]);
    roomAny.world.obstacles = [obstacle];

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "dash",
      state: "engaged",
    });
    expect(applied).not.toBeNull();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const result = roomAny.resolvePlayerAttackDuringTick(
      player,
      Date.now(),
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(true);
    expect(player.position.x).toBeGreaterThan(-100);
    const padding = 12;
    const leftBoundary = obstacle.position.x - (obstacle.size.x / 2 + padding);
    expect(player.position.x).toBeLessThan(leftBoundary);
    expect(roomAny.isBlockedByObstacle(player.position)).toBe(false);
    expect(combatLog).toHaveLength(0);
  });

  it("aborts dash resolution when an obstacle immediately blocks movement", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("blocked");
    const startX = -62.05;
    player.position = { x: startX, y: 0 };
    player.orientation = { angle: 0 };
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const obstacle: Obstacle = {
      id: "wall-2",
      kind: "obstacle",
      position: { x: -20, y: 0 },
      size: { x: 60, y: 120 },
      impassable: true,
    };

    roomAny.obstacles = new Map([[obstacle.id, obstacle]]);
    roomAny.world.obstacles = [obstacle];

    const microorganism: Microorganism = {
      id: "micro-blocked",
      kind: "microorganism",
      species: "amoeba",
      position: { x: -10, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 25, max: 25 },
      aggression: "hostile",
      attributes: { speed: 10, damage: 3, resilience: 0 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "dash",
      state: "engaged",
    });
    expect(applied).not.toBeNull();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const result = roomAny.resolvePlayerAttackDuringTick(
      player,
      Date.now(),
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(false);
    expect(player.position.x).toBeCloseTo(startX, 2);
    expect(roomAny.isBlockedByObstacle(player.position)).toBe(false);
    expect(worldDiff.statusEffects).toBeUndefined();
    const remaining = roomAny.microorganisms.get(microorganism.id);
    expect(remaining?.health.current).toBe(microorganism.health.current);
    expect(combatLog).toHaveLength(1);
    expect(combatLog[0]).toMatchObject({
      outcome: "blocked",
      targetKind: "obstacle",
      targetObjectId: obstacle.id,
    });
  });

  it("consumes dash charge, applies cooldown and recharges over time", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("sprinter");
    player.dashCharge = 90;
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "dash",
      state: "engaged",
    });
    expect(applied).not.toBeNull();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    roomAny.resolvePlayerAttackDuringTick(player, Date.now(), worldDiff, combatLog, updatedPlayers);

    expect(player.dashCharge).toBeCloseTo(90 - DASH_CHARGE_COST, 5);
    expect(player.dashCooldownMs).toBeGreaterThanOrEqual(DASH_COOLDOWN_MS);

    roomAny.tickPlayerDashState(player, 500);
    expect(player.dashCooldownMs).toBeCloseTo(DASH_COOLDOWN_MS - 500, 5);
    expect(player.dashCharge).toBeCloseTo(90 - DASH_CHARGE_COST, 5);

    roomAny.tickPlayerDashState(player, 600);
    expect(player.dashCooldownMs).toBe(0);
    const expectedCharge = 90 - DASH_CHARGE_COST + (100 * DASH_RECHARGE_PER_MS);
    expect(player.dashCharge).toBeCloseTo(expectedCharge, 5);
  });

  it("rejects dash commands when no charge is available", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("tired");
    player.dashCharge = 10;
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "dash",
      state: "engaged",
    });

    expect(applied).toEqual({ updatedPlayers: [player] });
    expect(player.combatStatus.state).toBe("cooldown");
    expect(player.pendingAttack).toBeNull();
    expect(player.dashCharge).toBe(10);
    expect(player.dashCooldownMs).toBeGreaterThanOrEqual(DASH_COOLDOWN_MS);

    const previousPosition = { ...player.position };
    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const result = roomAny.resolvePlayerAttackDuringTick(
      player,
      Date.now(),
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(false);
    expect(player.position).toEqual(previousPosition);
  });

  it("resolves skill attacks applying damage, cooldowns and statuses", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("caster");
    player.skillState.current = "pulse";
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const weakMicro: Microorganism = {
      id: "weak", 
      kind: "microorganism",
      species: "spore",
      position: { x: 45, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 6, max: 6 },
      aggression: "hostile",
      attributes: { speed: 10, damage: 4, resilience: 0 },
    };
    const sturdyMicro: Microorganism = {
      id: "sturdy",
      kind: "microorganism",
      species: "spore",
      position: { x: 60, y: 10 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 30, max: 30 },
      aggression: "hostile",
      attributes: { speed: 20, damage: 5, resilience: 0 },
    };

    roomAny.microorganisms = new Map([
      [weakMicro.id, weakMicro],
      [sturdyMicro.id, sturdyMicro],
    ]);
    roomAny.world.microorganisms = [weakMicro, sturdyMicro];

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });
    expect(applied).not.toBeNull();

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const result = roomAny.resolvePlayerAttackDuringTick(
      player,
      Date.now(),
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(result.worldChanged).toBe(true);
    expect(player.skillState.cooldowns.pulse).toBeGreaterThan(0);
    expect(worldDiff.statusEffects?.some((event) => event.status === "FISSURE")).toBe(true);
    expect(roomAny.microorganisms.has(weakMicro.id)).toBe(false);
    expect(worldDiff.upsertOrganicMatter?.length ?? 0).toBeGreaterThan(0);
    const surviving = roomAny.microorganisms.get(sturdyMicro.id);
    expect(surviving?.health.current).toBeLessThan(sturdyMicro.health.max);
  });

  it("prevents skill execution when resources are insufficient", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("caster");
    player.skillState.current = "pulse";
    player.energy = 0;
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const applied = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });

    expect(applied).toEqual({ updatedPlayers: [player] });
    expect(player.combatStatus.state).toBe("cooldown");
    expect(player.pendingAttack).toBeNull();
    expect(player.skillState.cooldowns.pulse).toBeGreaterThan(0);
  });
});
