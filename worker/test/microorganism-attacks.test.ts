import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO, WORLD_TICK_INTERVAL_MS } from "../src/RoomDO";
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

describe("RoomDO microorganism attacks", () => {
  it("applies temporary invulnerability after microorganism contact damage", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("target");
    player.combatAttributes.defense = 0;
    const initialHealth = player.health.current;

    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const microorganism: Microorganism = {
      id: "micro-contact",
      kind: "microorganism",
      species: "amoeba",
      name: "Crimson Lurker",
      level: 5,
      position: { x: 24, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 40, max: 40 },
      aggression: "hostile",
      attributes: { speed: 28, damage: 9, resilience: 0 },
    };

    roomAny.microorganisms = new Map([[microorganism.id, microorganism]]);
    roomAny.world.microorganisms = [microorganism];

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const startNow = 10_000;
    roomAny.updateMicroorganismsDuringTick(
      WORLD_TICK_INTERVAL_MS,
      startNow,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(combatLog).toHaveLength(1);
    const damageTaken = initialHealth - player.health.current;
    expect(damageTaken).toBeGreaterThan(0);
    expect(player.invulnerableUntil).toBeGreaterThan(startNow);
    expect(updatedPlayers.get(player.id)?.invulnerableUntil).toBe(player.invulnerableUntil);

    const invulnerableUntil = player.invulnerableUntil!;
    expect(invulnerableUntil - startNow).toBeGreaterThan(0);

    const nextWorldDiff: SharedWorldStateDiff = {};
    const nextCombatLog: CombatLogEntry[] = [];
    updatedPlayers.clear();

    const behavior = roomAny.microorganismBehavior.get(microorganism.id);
    expect(behavior).toBeDefined();
    if (behavior) {
      behavior.lastAttackAt = 0;
    }

    const nextNow = Math.min(invulnerableUntil - 1, startNow + WORLD_TICK_INTERVAL_MS);
    roomAny.updateMicroorganismsDuringTick(
      WORLD_TICK_INTERVAL_MS,
      nextNow,
      nextWorldDiff,
      nextCombatLog,
      updatedPlayers,
    );

    expect(player.health.current).toBe(initialHealth - damageTaken);
    expect(nextCombatLog).toHaveLength(0);
    expect(updatedPlayers.size).toBe(0);
  });
});

