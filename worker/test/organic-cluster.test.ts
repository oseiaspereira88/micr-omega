import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ORGANIC_TYPE_KEYS, planOrganicCluster } from "../src/organic";

const SCATTER_MIN = 20;
const SCATTER_RADIUS = 70;

const MAX_UINT32 = 0xffffffff;

describe("planOrganicCluster", () => {
  it("keeps random outputs within expected bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_UINT32 }),
        fc.integer({ min: 1, max: 16 }),
        (seed, remaining) => {
          const plan = planOrganicCluster(seed, {
            remaining,
            scatterMin: SCATTER_MIN,
            scatterRadius: SCATTER_RADIUS,
          });

          expect(plan.size).toBeGreaterThanOrEqual(1);
          expect(plan.size).toBeLessThanOrEqual(remaining);
          expect(plan.entries).toHaveLength(plan.size);

          plan.entries.forEach((entry, index) => {
            expect(entry.scatterDistance).toBeGreaterThanOrEqual(SCATTER_MIN);
            expect(entry.scatterDistance).toBeLessThanOrEqual(SCATTER_MIN + SCATTER_RADIUS);
            expect(entry.scatterAngle).toBeGreaterThanOrEqual(0);
            expect(entry.scatterAngle).toBeLessThan(Math.PI * 2);
            expect(entry.delayFactor).toBeGreaterThanOrEqual(0);
            expect(entry.delayFactor).toBeLessThan(1);
            expect(entry.appearance.clusterSeed).toBe((seed >>> 0) >>> 0);
            expect(entry.appearance.clusterIndex).toBe(index);
            expect(entry.appearance.seed).toBeGreaterThanOrEqual(0);
            expect(entry.appearance.seed).toBeLessThanOrEqual(MAX_UINT32);
            expect(ORGANIC_TYPE_KEYS).toContain(entry.appearance.type);
          });
        }
      ),
      { numRuns: 500 },
    );
  });

  it("honors size overrides when provided", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_UINT32 }),
        fc.integer({ min: 1, max: 12 }),
        (seed, count) => {
          const plan = planOrganicCluster(seed, {
            remaining: count,
            scatterMin: SCATTER_MIN,
            scatterRadius: SCATTER_RADIUS,
            sizeOverride: count,
          });

          expect(plan.size).toBe(count);
          expect(plan.entries).toHaveLength(count);
        }
      ),
      { numRuns: 200 },
    );
  });
});
