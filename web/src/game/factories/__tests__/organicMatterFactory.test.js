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

describe('spawnOrganicMatter randomness overrides', () => {
  const richType = {
    colors: ['#112233', '#445566'],
    shapes: ['sphere', 'spike'],
    sizes: [2, 5],
    energy: 1,
    health: 1
  };

  const types = { test: richType };

  it('keeps cluster and appearance stable when seeds repeat', () => {
    const randomness = {
      groups: [
        {
          cluster: { seed: 1337 },
          appearance: { seed: 4242 }
        }
      ]
    };

    const run = (sequence) =>
      spawnOrganicMatter({
        count: 1,
        worldSize: 200,
        types,
        rng: createSequenceRng(sequence),
        randomness
      });

    const first = run([0, 0.25, 0.5, 0.75]);
    const second = run([0, 0.85, 0.15, 0.35]);

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
    const primary = first[0];
    const secondary = second[0];
    expect(secondary.layout.shape).toBe(primary.layout.shape);
    expect(secondary.layout.size).toBe(primary.layout.size);
    expect(secondary.shape).toBe(primary.shape);
    expect(secondary.color).toBe(primary.color);
  });

  it('produces different visuals when seeds change', () => {
    const baseSequence = [0, 0.2, 0.6, 0.8];
    const baseRandomness = {
      groups: [
        {
          cluster: { seed: 7331 },
          appearance: { seed: 9001 }
        }
      ]
    };
    const alternateRandomness = {
      groups: [
        {
          cluster: { seed: 1338 },
          appearance: { seed: 9002 }
        }
      ]
    };

    const base = spawnOrganicMatter({
      count: 1,
      worldSize: 150,
      types,
      rng: createSequenceRng(baseSequence),
      randomness: baseRandomness
    });

    const alternate = spawnOrganicMatter({
      count: 1,
      worldSize: 150,
      types,
      rng: createSequenceRng(baseSequence),
      randomness: alternateRandomness
    });

    expect(base.length).toBeGreaterThan(0);
    expect(alternate.length).toBeGreaterThan(0);
    const basePrimary = base[0];
    const alternatePrimary = alternate[0];
    const sameCluster =
      basePrimary.layout.shape === alternatePrimary.layout.shape &&
      basePrimary.layout.size === alternatePrimary.layout.size;
    const sameAppearance =
      basePrimary.shape === alternatePrimary.shape &&
      basePrimary.color === alternatePrimary.color;

    expect(sameCluster && sameAppearance).toBe(false);
  });
});
