import { WORLD_SIZE } from '@micr-omega/shared';

import { organicMatterTypes as defaultOrganicMatterTypes } from '../config/organicMatterTypes';
import { createOrganicMatter } from '../entities/organicMatter';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

const CLUSTER_SPACING = 26;

const createLineLayout = (size) => {
  const offsets = [];
  const half = (size - 1) / 2;
  for (let i = 0; i < size; i++) {
    offsets.push({
      localX: (i - half) * CLUSTER_SPACING,
      localY: 0
    });
  }
  return offsets;
};

const createRingLayout = (size) => {
  const offsets = [];
  if (size === 1) {
    return [{ localX: 0, localY: 0 }];
  }

  const radius = CLUSTER_SPACING * 1.2;
  for (let i = 0; i < size; i++) {
    const angle = (2 * Math.PI * i) / size;
    offsets.push({
      localX: Math.cos(angle) * radius,
      localY: Math.sin(angle) * radius
    });
  }
  return offsets;
};

const createArcLayout = (size) => {
  if (size <= 2) return createLineLayout(size);

  const offsets = [];
  const radius = CLUSTER_SPACING * 1.15;
  const arcSpan = Math.PI;
  const step = size > 1 ? arcSpan / (size - 1) : 0;
  const start = -arcSpan / 2;

  for (let i = 0; i < size; i++) {
    const angle = start + i * step;
    offsets.push({
      localX: Math.cos(angle) * radius,
      localY: Math.sin(angle) * radius
    });
  }

  return offsets;
};

const HEX_POINTS = [
  { localX: 0, localY: 0 },
  { localX: CLUSTER_SPACING, localY: 0 },
  { localX: CLUSTER_SPACING / 2, localY: -CLUSTER_SPACING * 0.87 },
  { localX: -CLUSTER_SPACING / 2, localY: -CLUSTER_SPACING * 0.87 },
  { localX: -CLUSTER_SPACING, localY: 0 },
  { localX: -CLUSTER_SPACING / 2, localY: CLUSTER_SPACING * 0.87 },
  { localX: CLUSTER_SPACING / 2, localY: CLUSTER_SPACING * 0.87 }
];

const createHexLayout = (size) => {
  if (size <= 0) return [];
  const clampedSize = Math.min(size, HEX_POINTS.length);
  return HEX_POINTS.slice(0, clampedSize);
};

const CLUSTER_GENERATORS = [
  {
    shape: 'single',
    getSize: () => 1,
    createOffsets: (size) => createLineLayout(size)
  },
  {
    shape: 'line',
    getSize: (random) => Math.max(2, Math.floor(random() * 3) + 3),
    createOffsets: (size) => createLineLayout(size)
  },
  {
    shape: 'arc',
    getSize: (random) => Math.max(3, Math.floor(random() * 3) + 3),
    createOffsets: (size) => createArcLayout(size)
  },
  {
    shape: 'ring',
    getSize: (random) => Math.max(3, Math.floor(random() * 4) + 3),
    createOffsets: (size) => createRingLayout(size)
  },
  {
    shape: 'hex',
    getSize: (random) => Math.max(3, Math.floor(random() * 3) + 4),
    createOffsets: (size) => createHexLayout(size)
  }
];

const generateClusterDescriptor = (random) => {
  const generator = pickRandom(CLUSTER_GENERATORS, random) ?? CLUSTER_GENERATORS[0];
  const size = generator.getSize(random);
  const offsets = generator.createOffsets(size);

  return {
    shape: generator.shape,
    size: offsets.length,
    offsets
  };
};

export const spawnOrganicMatter = ({
  count = 1,
  worldSize = WORLD_SIZE,
  types = defaultOrganicMatterTypes,
  rng = Math.random
} = {}) => {
  const random = getRandom(rng);
  const availableTypes = Object.keys(types || {});
  if (!availableTypes.length || count <= 0) return [];

  const created = [];

  for (let i = 0; i < count; i++) {
    const typeKey = pickRandom(availableTypes, random);
    const type = types[typeKey];
    if (!type) continue;

    const cluster = generateClusterDescriptor(random);
    const baseX = random() * worldSize;
    const baseY = random() * worldSize;

    cluster.offsets.forEach((offset, index) => {
      const organic = createOrganicMatter(typeKey, type, {
        x: baseX,
        y: baseY,
        rng: random,
        layout: {
          shape: cluster.shape,
          size: cluster.size,
          index,
          localX: offset.localX,
          localY: offset.localY
        }
      });

      if (organic) {
        created.push(organic);
      }
    });
  }

  return created;
};
