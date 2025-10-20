import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { createMulberry32 } from "@micr-omega/shared";
import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";
import { getDefaultSkillList } from "../src/skills";
import type { OrganicMatter, SharedWorldStateDiff, CombatLogEntry } from "../src/types";

async function createRoom(existingState?: MockDurableObjectState) {
  const mockState = existingState ?? new MockDurableObjectState();
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

  it("persists organic respawn RNG across resets", async () => {
    const mockState = new MockDurableObjectState();
    const { roomAny } = await createRoom(mockState);

    roomAny.createOrganicRespawnRng();
    roomAny.createOrganicRespawnRng();

    const nextSeedState = roomAny.organicMatterRespawnSeed;
    const expectedBase = createMulberry32(nextSeedState)();
    const expectedSeed = roomAny.normalizeOrganicRespawnSeed(expectedBase);

    await roomAny.flushSnapshots({ force: true });

    const { roomAny: resumed } = await createRoom(mockState);
    const resumedGroup = resumed.createOrganicRespawnRng();
    expect(resumedGroup.seed).toBe(expectedSeed);

    const expectedGroupRng = createMulberry32(expectedSeed);
    expect(resumedGroup.rng()).toBeCloseTo(expectedGroupRng());
  });
});
