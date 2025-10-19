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

describe("RoomDO damage popups", () => {
  it("emits a popup when a player damages a microorganism", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("attacker");
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism: Microorganism = {
      id: "micro-1",
      kind: "microorganism",
      species: "amoeba",
      name: "Crimson Scout",
      level: 3,
      position: { x: 24, y: -12 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 45, max: 45 },
      aggression: "hostile",
      attributes: { speed: 30, damage: 6, resilience: 2 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const now = Date.now();
    player.combatStatus = {
      state: "engaged",
      targetPlayerId: null,
      targetObjectId: microorganism.id,
      lastAttackAt: now - 1_000,
    };

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    roomAny.resolvePlayerAttackDuringTick(player, now, worldDiff, combatLog, updatedPlayers);
    roomAny.finalizeDamagePopups(worldDiff, now);

    const popups = worldDiff.damagePopups ?? [];
    expect(popups).toHaveLength(1);
    const popup = popups[0]!;
    expect(popup.value).toBeGreaterThan(0);
    expect(popup.position).toEqual({ x: microorganism.position.x, y: microorganism.position.y });
    expect(popup.variant).toBe("normal");
    expect(popup.createdAt).toBe(now);
    expect(popup.expiresAt).toBeGreaterThan(popup.createdAt);
  });

  it("emits a popup when a microorganism damages a player", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("target");
    player.combatAttributes.defense = 0;
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism: Microorganism = {
      id: "micro-2",
      kind: "microorganism",
      species: "amoeba",
      name: "Azure Hunter",
      level: 2,
      position: { x: 18, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 30, max: 30 },
      aggression: "hostile",
      attributes: { speed: 28, damage: 7, resilience: 1 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];
    roomAny.microorganismBehavior.set(
      microorganism.id,
      roomAny.createMicroorganismBehaviorState(Date.now()),
    );

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();
    const now = Date.now();

    roomAny.updateMicroorganismsDuringTick(50, now, worldDiff, combatLog, updatedPlayers);
    roomAny.finalizeDamagePopups(worldDiff, now);

    const popups = worldDiff.damagePopups ?? [];
    expect(popups).toHaveLength(1);
    const popup = popups[0]!;
    expect(popup.value).toBeGreaterThan(0);
    expect(popup.position).toEqual({ x: player.position.x, y: player.position.y });
    expect(popup.variant).toBe("normal");
    expect(popup.createdAt).toBe(now);
    expect(popup.expiresAt).toBeGreaterThan(popup.createdAt);
  });
});

