import { afterEach, describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import type { CombatLogEntry, SharedWorldStateDiff } from "../src/types";
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
  const base: any = {
    id,
    name: id,
    score: 0,
    combo: 1,
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 100, max: 100 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null },
    combatAttributes: { attack: 10, defense: 0, speed: 0, range: 50 },
    connected: true,
    lastActiveAt: now,
    lastSeenAt: now,
    connectedAt: now,
    totalSessionDurationMs: 0,
    sessionCount: 0,
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
});
