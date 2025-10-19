import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import { getDefaultSkillList } from "../src/skills";
import type {
  CombatLogEntry,
  Microorganism,
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
    energy: 120,
    xp: 50,
    geneticMaterial: 20,
    dashCharge: 100,
    dashCooldownMs: 0,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 120, max: 120 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: now - 2_000 },
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

describe("RoomDO damage popups", () => {
  it("includes damage popups when microorganisms take damage", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("attacker");
    const microorganism: Microorganism = {
      id: "micro-dmg-1",
      kind: "microorganism",
      species: "amoeba",
      name: "Target Organism",
      level: 2,
      position: { x: 16, y: -4 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 20, max: 20 },
      aggression: "hostile",
      attributes: { speed: 20, damage: 5, resilience: 0 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const now = Date.now();

    const result = roomAny.applyDamageToMicroorganism(
      player,
      microorganism,
      6,
      now,
      worldDiff,
      combatLog,
    );

    expect(result.worldChanged).toBe(true);
    expect(worldDiff.damagePopups).toBeDefined();
    expect(worldDiff.damagePopups).toHaveLength(1);
    expect(worldDiff.damagePopups?.[0]).toMatchObject({
      id: expect.stringMatching(/^dmg-/),
      value: 6,
      variant: "normal",
      createdAt: now,
    });
  });

  it("emits popups when players receive damage from other players", async () => {
    const { roomAny } = await createRoom();
    const attacker = createTestPlayer("alpha");
    const defender = createTestPlayer("bravo");
    defender.position = { x: 10, y: 0 };
    defender.health = { current: 80, max: 80 };

    roomAny.players.set(attacker.id, attacker);
    roomAny.players.set(defender.id, defender);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const now = Date.now();
    attacker.combatStatus = {
      state: "engaged",
      targetPlayerId: defender.id,
      targetObjectId: null,
      lastAttackAt: now - 2_000,
    };
    attacker.pendingAttack = { kind: "basic", targetPlayerId: defender.id, targetObjectId: null };

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof attacker>();

    roomAny.resolvePlayerAttackDuringTick(attacker, now, worldDiff, combatLog, updatedPlayers);

    expect(worldDiff.damagePopups?.length).toBeGreaterThan(0);
    const popup = worldDiff.damagePopups?.[0];
    expect(popup?.variant).toBe("normal");
    expect(popup?.value).toBeGreaterThan(0);
    expect(popup?.x).toBe(defender.position.x);
    expect(popup?.y).toBe(defender.position.y);
  });

  it("stacks popups when hostile AI hits players", async () => {
    const { roomAny } = await createRoom();
    const target = createTestPlayer("victim");
    target.health = { current: 50, max: 50 };
    const ally = createTestPlayer("ally");
    ally.position = { x: -120, y: 0 };

    roomAny.players.set(target.id, target);
    roomAny.players.set(ally.id, ally);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism: Microorganism = {
      id: "micro-dmg-2",
      kind: "microorganism",
      species: "amoeba",
      name: "Aggressor",
      level: 3,
      position: { x: 6, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 30, max: 30 },
      aggression: "hostile",
      attributes: { speed: 40, damage: 8, resilience: 2 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof target>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(0, now, worldDiff, combatLog, updatedPlayers);

    expect(worldDiff.damagePopups?.length).toBeGreaterThan(0);
    const popup = worldDiff.damagePopups?.[0];
    expect(popup?.variant === "critical" || popup?.variant === "normal" || popup?.variant === "resisted").toBe(true);
    expect(popup?.value).toBeGreaterThan(0);
  });
});

