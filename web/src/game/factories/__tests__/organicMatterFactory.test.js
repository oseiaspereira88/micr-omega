import { describe, expect, it } from 'vitest';

import { spawnOrganicMatter } from '../organicMatterFactory';

const createSequenceRng = (sequence) => {
  let index = 0;
  return () => {
    if (index < sequence.length) {
      return sequence[index++];
    }
    return 0;
  };
};

const baseType = {
  colors: ['#abcdef'],
  shapes: ['sphere'],
  sizes: [2, 4],
  energy: 1,
  health: 1
};

const types = {
  test: baseType
};

describe('spawnOrganicMatter cluster layouts', () => {
  it('generates tightly grouped hex layouts with local offsets', () => {
    const rng = createSequenceRng([
      0, // type selection (only one type)
      0.99, // choose hex shape
      0.2, // hex cluster size calculation
      0.4, // baseX
      0.6 // baseY
    ]);

    const spawned = spawnOrganicMatter({ count: 1, worldSize: 1000, types, rng });

    expect(spawned).toHaveLength(4);
    const baseX = spawned[0].x - spawned[0].layout.localX;
    const baseY = spawned[0].y - spawned[0].layout.localY;

    spawned.forEach((matter, index) => {
      expect(matter.layout.shape).toBe('hex');
      expect(matter.layout.size).toBe(4);
      expect(matter.layout.index).toBe(index);
      expect(matter.x).toBeCloseTo(baseX + matter.layout.localX, 5);
      expect(matter.y).toBeCloseTo(baseY + matter.layout.localY, 5);
    });

    const expectedOffsets = [
      { localX: 0, localY: 0 },
      { localX: 26, localY: 0 },
      { localX: 13, localY: -22.62 },
      { localX: -13, localY: -22.62 }
    ];

    expectedOffsets.forEach((offset) => {
      const match = spawned.find(
        (matter) =>
          Math.abs(matter.layout.localX - offset.localX) < 0.01 &&
          Math.abs(matter.layout.localY - offset.localY) < 0.02
      );
      expect(match).toBeDefined();
    });
  });

  it('generates circular ring layouts with consistent radius', () => {
    const rng = createSequenceRng([
      0,
      0.7, // choose ring shape
      0.4, // ring cluster size
      0.25,
      0.75
    ]);

    const spawned = spawnOrganicMatter({ count: 1, worldSize: 500, types, rng });

    expect(spawned).toHaveLength(4);
    const radii = spawned.map((matter) =>
      Math.hypot(matter.layout.localX, matter.layout.localY)
    );

    const averageRadius = radii.reduce((sum, value) => sum + value, 0) / radii.length;
    radii.forEach((radius) => {
      expect(radius).toBeGreaterThan(25);
      expect(Math.abs(radius - averageRadius)).toBeLessThan(1);
    });
  });

  it('generates arc layouts aligned along a curve', () => {
    const rng = createSequenceRng([
      0,
      0.5, // choose arc shape
      0, // arc size calculation -> minimum size of 3
      0.1,
      0.2
    ]);

    const spawned = spawnOrganicMatter({ count: 1, worldSize: 300, types, rng });

    expect(spawned).toHaveLength(3);
    const [first, middle, last] = spawned;

    expect(first.layout.localY).toBeLessThan(middle.layout.localY);
    expect(middle.layout.localY).toBeLessThan(last.layout.localY);

    const baseX = middle.x - middle.layout.localX;
    const baseY = middle.y - middle.layout.localY;
    expect(first.x).toBeCloseTo(baseX + first.layout.localX, 5);
    expect(first.y).toBeCloseTo(baseY + first.layout.localY, 5);
    expect(last.x).toBeCloseTo(baseX + last.layout.localX, 5);
    expect(last.y).toBeCloseTo(baseY + last.layout.localY, 5);
  });
});
