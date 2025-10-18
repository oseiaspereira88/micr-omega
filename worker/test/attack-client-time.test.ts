import { afterEach, describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import { getDefaultSkillList } from "../src/skills";
import type { Env } from "../src";
import type { CombatLogEntry, RoomObject, SharedWorldStateDiff } from "../src/types";
import { MockDurableObjectState } from "./utils/mock-state";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoomDO player attacks", () => {
  it("ignores past clientTime values when applying cooldown", async () => {
    const fixedNow = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    const { roomAny } = await createRoom();

    const attacker = createTestPlayer("attacker");
    const defender = createTestPlayer("defender");
    roomAny.players.set(attacker.id, attacker);
    roomAny.players.set(defender.id, defender);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const result = roomAny.applyPlayerAction(
      attacker,
      {
        type: "attack",
        targetPlayerId: defender.id,
        targetObjectId: null,
        state: "engaged",
      },
      fixedNow - 5_000,
    );

    expect(result).not.toBeNull();
    expect(attacker.combatStatus.lastAttackAt).toBe(fixedNow);

    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    const updatedPlayers = new Map<string, typeof attacker>();
    const tickNow = fixedNow + 100;

    const cooldownResult = roomAny.resolvePlayerAttackDuringTick(
      attacker,
      tickNow,
      worldDiff,
      combatLog,
      updatedPlayers,
    );

    expect(cooldownResult.scoresChanged).toBe(false);
    expect(updatedPlayers.size).toBe(0);
    expect(combatLog).toHaveLength(0);
    expect(defender.health.current).toBe(defender.health.max);
  });

  it("ignores resultingHealth values above the recorded max", async () => {
    const { roomAny } = await createRoom();

    const attacker = createTestPlayer("attacker");
    const defender = createTestPlayer("defender");
    roomAny.players.set(attacker.id, attacker);
    roomAny.players.set(defender.id, defender);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const result = roomAny.applyPlayerAction(attacker, {
      type: "attack",
      targetPlayerId: defender.id,
      targetObjectId: null,
      state: "engaged",
      damage: 10,
      resultingHealth: {
        current: attacker.health.max + 25,
        max: attacker.health.max + 25,
      },
    });

    expect(result).not.toBeNull();
    expect(attacker.health.max).toBe(100);
    expect(attacker.health.current).toBe(90);
  });

  it("ignores resultingHealth values that exceed the server damage calculation", async () => {
    const { roomAny } = await createRoom();

    const attacker = createTestPlayer("attacker");
    const defender = createTestPlayer("defender");
    roomAny.players.set(attacker.id, attacker);
    roomAny.players.set(defender.id, defender);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const result = roomAny.applyPlayerAction(attacker, {
      type: "attack",
      targetPlayerId: defender.id,
      targetObjectId: null,
      state: "engaged",
      damage: 10,
      resultingHealth: {
        current: attacker.health.max - 5,
        max: attacker.health.max,
      },
    });

    expect(result).not.toBeNull();
    expect(attacker.health.max).toBe(100);
    expect(attacker.health.current).toBe(90);
  });

  it("accepts attack actions targeting known room objects", async () => {
    const { roomAny } = await createRoom();

    const attacker = createTestPlayer("attacker");
    roomAny.players.set(attacker.id, attacker);
    roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

    const controlPanel: RoomObject = {
      id: "room-console",
      kind: "room_object",
      type: "control_panel",
      position: { x: 10, y: -5 },
      state: { status: "online" },
    };

    roomAny.world.roomObjects = [controlPanel];
    roomAny.roomObjects = new Map([[controlPanel.id, controlPanel]]);

    const result = roomAny.applyPlayerAction(attacker, {
      type: "attack",
      targetPlayerId: null,
      targetObjectId: controlPanel.id,
      state: "engaged",
    });

    expect(result).not.toBeNull();
    expect(attacker.combatStatus.targetObjectId).toBe(controlPanel.id);
    expect(attacker.combatStatus.state).toBe("engaged");
  });
});
