import { describe, expect, it } from 'vitest';

import {
  generateCompactBlobOffsets,
  generateOrganicShapeOffsets,
  generateSpiralOffsets,
  generateWaveOffsets
} from './organicShapeGenerators.js';

const magnitude = (point) => Math.sqrt(point.x * point.x + point.y * point.y);

describe('organic shape generators', () => {
  it('creates spiral offsets that move outward from the center', () => {
    const offsets = generateSpiralOffsets(14, () => 0.25);
    expect(offsets.length).toBeGreaterThan(2);
    const distances = offsets.map(magnitude);
    const growth = distances[distances.length - 1] - distances[0];
    expect(growth).toBeGreaterThan(5);
  });

  it('creates wave offsets that oscillate on the y-axis', () => {
    const offsets = generateWaveOffsets(12, () => 0.33);
    const ys = offsets.map((entry) => entry.y);
    const hasPositive = ys.some((value) => value > 0);
    const hasNegative = ys.some((value) => value < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });

  it('creates compact blob offsets within a tight radius', () => {
    const baseRadius = 16;
    const offsets = generateCompactBlobOffsets(baseRadius, () => 0.5);
    offsets.forEach((entry) => {
      expect(magnitude(entry)).toBeLessThanOrEqual(baseRadius);
    });
  });

  it('produces deterministic results for the same seed', () => {
    const first = generateOrganicShapeOffsets('spiral', 18, 0.42);
    const second = generateOrganicShapeOffsets('spiral', 18, 0.42);
    expect(first).toEqual(second);
  });

  it('falls back to a single sphere offset for unknown shapes', () => {
    const offsets = generateOrganicShapeOffsets('unknown-shape', 10, 0.5);
    expect(offsets).toHaveLength(1);
    expect(offsets[0]).toMatchObject({ x: 0, y: 0 });
  });
});
