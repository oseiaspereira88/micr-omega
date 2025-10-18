import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import { getDefaultSkillList, SKILL_DEFINITIONS } from "../src/skills";
import type { Env } from "../src";
import type { CombatLogEntry, SharedWorldStateDiff } from "../src/types";
import { MockDurableObjectState } from "./utils/mock-state";

type TestPlayer = ReturnType<typeof createTestPlayer>;

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
}

function createTestPlayer(id: string, overrides: Partial<TestPlayer> = {}) {
  const now = Date.now();
  const skillList = getDefaultSkillList();
  return {
    id,
    name: id,
    score: overrides.score ?? 0,
    combo: overrides.combo ?? 1,
    energy: overrides.energy ?? 0,
    xp: overrides.xp ?? 0,
    geneticMaterial: overrides.geneticMaterial ?? 0,
    geneFragments: overrides.geneFragments ?? { minor: 0, major: 0, apex: 0 },
    position: overrides.position ?? { x: 0, y: 0 },
    movementVector: overrides.movementVector ?? { x: 0, y: 0 },
    orientation: overrides.orientation ?? { angle: 0 },
    health: overrides.health ?? { current: 100, max: 100 },
    combatStatus:
      overrides.combatStatus ??
      { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: null },
    combatAttributes:
      overrides.combatAttributes ??
      { attack: 24, defense: 6, speed: 140, range: 80 },
    archetypeKey: overrides.archetypeKey ?? null,
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: overrides.totalSessionDurationMs ?? 0,
    sessionCount: overrides.sessionCount ?? 0,
    evolutionState: overrides.evolutionState,
    skillState:
      overrides.skillState ?? {
        available: skillList,
        current: skillList[0]!,
        cooldowns: {},
      },
    pendingAttack: overrides.pendingAttack ?? null,
    statusEffects: overrides.statusEffects ?? [],
    invulnerableUntil: overrides.invulnerableUntil ?? null,
  };
}

describe("player progression resources", () => {
  it("awards progression rewards on kills and enables skill costs", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("hunter", { energy: 60 });
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    player.skillState.current = "shield";
    player.skillState.cooldowns.shield = 0;

    const shieldDefinition = SKILL_DEFINITIONS.shield;
    const preShield = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });
    expect(preShield).not.toBeNull();
    expect(player.combatStatus.state).toBe("cooldown");
    expect(player.skillState.cooldowns.shield).toBe(shieldDefinition.cooldownMs);
    expect(player.pendingAttack).toBeNull();
    expect(player.energy).toBe(60);

    player.skillState.cooldowns.shield = 0;
    player.combatStatus = {
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: Date.now() - 1_000,
    };

    player.skillState.current = "spike";
    player.skillState.cooldowns.spike = 0;

    const spikeDefinition = SKILL_DEFINITIONS.spike;
    const preSpike = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });
    expect(preSpike).not.toBeNull();
    expect(player.combatStatus.state).toBe("cooldown");
    expect(player.skillState.cooldowns.spike).toBe(spikeDefinition.cooldownMs);
    expect(player.pendingAttack).toBeNull();
    expect(player.energy).toBe(60);

    player.skillState.cooldowns.spike = 0;
    player.combatStatus = {
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: Date.now() - 1_000,
    };

    const originalRandom = Math.random;
    const rolls = [0.01, 0.6, 0.99, 0.95];
    let index = 0;
    Math.random = () => {
      const value = rolls[index] ?? 0.5;
      index += 1;
      return value;
    };

    try {
      roomAny.recordKillProgression(player, { targetId: "micro-elite", dropTier: "elite" });
    } finally {
      Math.random = originalRandom;
    }

    expect(player.xp).toBeGreaterThan(0);
    expect(player.geneticMaterial).toBeGreaterThanOrEqual(6);
    expect(player.geneFragments.major).toBeGreaterThanOrEqual(1);

    player.skillState.current = "shield";
    player.skillState.cooldowns.shield = 0;

    const postShield = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });
    expect(postShield).not.toBeNull();
    expect(player.pendingAttack?.kind).toBe("skill");
    expect(player.combatStatus.state).toBe("engaged");
    expect(player.skillState.cooldowns.shield).toBe(0);

    player.pendingAttack = null;
    player.combatStatus = {
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: Date.now() - 1_000,
    };

    const xpAfterKill = player.xp;
    const energyBeforeSpike = player.energy;

    player.skillState.current = "spike";
    player.skillState.cooldowns.spike = 0;

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    const postSpike = roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });
    expect(postSpike).not.toBeNull();

    player.combatStatus.lastAttackAt =
      (player.combatStatus.lastAttackAt ?? Date.now()) - 1_000;

    roomAny.resolvePlayerAttackDuringTick(player, Date.now(), worldDiff, combatLog, updatedPlayers);

    expect(energyBeforeSpike - player.energy).toBeGreaterThanOrEqual(
      spikeDefinition.cost.energy ?? 0,
    );
    expect(player.skillState.cooldowns.spike).toBe(spikeDefinition.cooldownMs);
    expect(player.combatStatus.state).toBe("cooldown");
    expect(player.xp).toBeGreaterThanOrEqual(
      xpAfterKill - (spikeDefinition.cost.xp ?? 0),
    );
  });

  it("restores energy from organic matter collection so costly skills can trigger", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("collector", { energy: 0, xp: 20, geneticMaterial: 10 });
    player.skillState.current = "spike";
    roomAny.players.set(player.id, player);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const matter = {
      id: "organic-1",
      kind: "organic_matter" as const,
      position: { x: 0, y: 0 },
      quantity: 20,
      nutrients: { residue: 5 },
    };
    roomAny.addOrganicMatterEntity(matter);

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const result = roomAny.handleCollectionsDuringTick(player, worldDiff, combatLog, Date.now());

    expect(result.playerUpdated).toBe(true);
    expect(player.energy).toBeGreaterThanOrEqual(20);

    const energyBefore = player.energy;
    const xpBefore = player.xp;

    const worldDiff2: SharedWorldStateDiff = {};
    const combatLog2: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof player>();

    roomAny.applyPlayerAction(player, {
      type: "attack",
      kind: "skill",
      state: "engaged",
    });
    roomAny.resolvePlayerAttackDuringTick(player, Date.now(), worldDiff2, combatLog2, updatedPlayers);

    expect(energyBefore - player.energy).toBeGreaterThanOrEqual(18);
    expect(xpBefore - player.xp).toBeGreaterThanOrEqual(4);
  });
});
