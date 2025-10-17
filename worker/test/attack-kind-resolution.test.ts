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

  it("resolves skill attacks applying damage, cooldowns and statuses", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("caster");
    player.skillState.current = "pulse";
    roomAny.players.set(player.id, player);

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
});
