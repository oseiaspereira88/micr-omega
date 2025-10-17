import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import { getDefaultSkillList } from "../src/skills";
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
    position: { x: 0, y: 0 },
    movementVector: { x: 0, y: 0 },
    orientation: { angle: 0 },
    health: { current: 120, max: 120 },
    combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null },
    combatAttributes: { attack: 8, defense: 4, speed: 140, range: 80 },
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

describe("RoomDO archetype actions", () => {
  it("applies archetype selection and recalculates stats", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("alpha");
    roomAny.players.set(player.id, player);

    const result = roomAny.applyPlayerAction(player, {
      type: "archetype",
      archetype: "virus",
    });

    expect(result).not.toBeNull();
    expect(result?.updatedPlayers).toHaveLength(1);
    expect(player.archetypeKey).toBe("virus");
    expect(player.health.max).toBe(90);
    expect(player.health.current).toBe(90);
    expect(player.combatAttributes.attack).toBe(12);
    expect(player.combatAttributes.defense).toBe(3);
    expect(player.combatAttributes.speed).toBe(176);
    expect(player.combatAttributes.range).toBe(88);
  });

  it("rejects unsupported archetype keys", async () => {
    const { roomAny } = await createRoom();
    const player = createTestPlayer("beta");
    roomAny.players.set(player.id, player);

    const result = roomAny.applyPlayerAction(player, {
      type: "archetype",
      archetype: "unknown" as any,
    });

    expect(result).toBeNull();
    expect(player.archetypeKey).toBeNull();
    expect(player.health.max).toBe(120);
  });
});
