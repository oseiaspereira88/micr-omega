import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { createMulberry32 } from "@micr-omega/shared";
import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";
import { getDefaultSkillList } from "../src/skills";
import type { OrganicMatter, SharedWorldStateDiff, CombatLogEntry } from "../src/types";

const RNG_STATE_KEY = "rng_state";

type TestRngState = {
  organicMatterRespawn: number;
  progression: number;
};

async function createRoom(options: {
  state?: MockDurableObjectState;
  rngState?: TestRngState;
} = {}) {
  const mockState = options.state ?? new MockDurableObjectState();
  if (options.rngState) {
    const snapshot =
      typeof structuredClone === "function"
        ? structuredClone(options.rngState)
        : { ...options.rngState };
    mockState.storageImpl.data.set(RNG_STATE_KEY, snapshot);
  }

  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny, mockState } as const;
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

describe("organic respawn randomness", () => {
  it("mulberry32 produces deterministic sequences within bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 25 }),
        (seed, count) => {
          const rngA = createMulberry32(seed);
          const rngB = createMulberry32(seed);
          for (let index = 0; index < count; index += 1) {
            const nextA = rngA();
            const nextB = rngB();
            expect(nextA).toBeGreaterThanOrEqual(0);
            expect(nextA).toBeLessThan(1);
            expect(nextB).toBe(nextA);
          }
        },
      ),
    );
  });

  it("keeps organic respawn delay and size within expected bounds", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.array(fc.double({ min: 0, max: 0.999999999, noNaN: true }), {
            minLength: 3,
            maxLength: 5,
          }),
          { minLength: 1, maxLength: 3 },
        ),
        async (groupSequences) => {
          const { roomAny } = await createRoom();
          const player = createTestPlayer("collector");
          player.position = { x: 0, y: 0 };
          roomAny.players.set(player.id, player);
          roomAny.connectedPlayers = roomAny.recalculateConnectedPlayers();

          const matterCount = groupSequences.length * 5;
          for (let index = 0; index < matterCount; index += 1) {
            const matter: OrganicMatter = {
              id: `organic-${index}`,
              kind: "organic_matter",
              position: { x: index * 2, y: 0 },
              quantity: 10 + index,
              nutrients: {},
              tags: { nutrients: [], attributes: [] },
            };
            roomAny.addOrganicMatterEntity(matter);
          }

          const anchors = groupSequences.map((_, index) => ({ x: index * 32, y: -index * 24 }));
          let anchorIndex = 0;
          roomAny.findOrganicMatterRespawnPosition = vi
            .fn()
            .mockImplementation(() => anchors[anchorIndex++] ?? { x: 0, y: 0 });

          let sequenceIndex = 0;
          roomAny.organicMatterRespawnRng = vi.fn(() => 0.231 + sequenceIndex * 0.001);
          roomAny.organicGroupRngFactory = vi.fn((_seed: number) => {
            const values = groupSequences[sequenceIndex++] ?? [];
            let valueIndex = 0;
            return () => (valueIndex < values.length ? values[valueIndex++]! : 0.5);
          });

          const worldDiff: SharedWorldStateDiff = {};
          const combatLog: CombatLogEntry[] = [];
          const now = 12_000;

          roomAny.handleCollectionsDuringTick(player, worldDiff, combatLog, now);

          expect(roomAny.organicRespawnQueue.length).toBeGreaterThan(0);
          roomAny.organicRespawnQueue.forEach((group: any) => {
            const delay = group.respawnAt - now;
            expect(delay).toBeGreaterThanOrEqual(group.delayRangeMs.min);
            expect(delay).toBeLessThanOrEqual(group.delayRangeMs.max);
            expect(group.templates).toHaveLength(group.size);
            expect(group.randomSeed).toBeGreaterThan(0);
          });
        },
      ),
    );
  });

  it("continues organic respawn RNG sequences after restart", async () => {
    const seeds: TestRngState = {
      organicMatterRespawn: 0x9e3779b9,
      progression: 0x85ebca6b,
    };

    const { roomAny: baselineRoom } = await createRoom({ rngState: seeds });
    const baselineFirst = baselineRoom.createOrganicRespawnRng();
    const baselineFirstValues = [baselineFirst.rng(), baselineFirst.rng()];
    const baselineSecond = baselineRoom.createOrganicRespawnRng();
    const baselineSecondValues = [baselineSecond.rng(), baselineSecond.rng()];

    const restartState = new MockDurableObjectState();
    restartState.storageImpl.data.set(RNG_STATE_KEY, { ...seeds });

    const { roomAny: initialRoom } = await createRoom({ state: restartState });
    const initialGroup = initialRoom.createOrganicRespawnRng();
    const initialValues = [initialGroup.rng(), initialGroup.rng()];
    expect(initialGroup.seed).toBe(baselineFirst.seed);
    expect(initialValues).toEqual(baselineFirstValues);

    await initialRoom.flushQueuedRngStatePersist({ force: true });

    const { roomAny: resumedRoom } = await createRoom({ state: restartState });
    const resumedGroup = resumedRoom.createOrganicRespawnRng();
    const resumedValues = [resumedGroup.rng(), resumedGroup.rng()];
    expect(resumedGroup.seed).toBe(baselineSecond.seed);
    expect(resumedValues).toEqual(baselineSecondValues);
  });
});
