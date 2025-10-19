import { createSeededRandom } from '../utils/random';

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

export const createOrganicMatter = (typeKey, typeConfig, options = {}) => {
  if (!typeKey || !typeConfig) return null;

  const {
    x = 0,
    y = 0,
    rng = Math.random,
    seed,
    clusterSeed,
    clusterIndex,
    ...overrides
  } = options;

  const random = createSeededRandom({ rng, seed, clusterSeed, clusterIndex });
  const sizeRange = typeConfig.sizes || [1, 1];
  const size = overrides.size ?? (sizeRange[0] + random() * (sizeRange[1] - sizeRange[0]));

  return {
    x,
    y,
    vx: overrides.vx ?? (random() - 0.5) * 0.2,
    vy: overrides.vy ?? (random() - 0.5) * 0.2,
    size,
    color: overrides.color ?? pickRandom(typeConfig.colors || ['#FFFFFF'], random),
    shape: overrides.shape ?? pickRandom(typeConfig.shapes || ['sphere'], random),
    type: typeKey,
    energy: overrides.energy ?? typeConfig.energy,
    health: overrides.health ?? typeConfig.health,
    rotationSpeed: overrides.rotationSpeed ?? (random() - 0.5) * 2,
    rotation: overrides.rotation ?? random() * Math.PI * 2,
    pulsePhase: overrides.pulsePhase ?? random() * Math.PI * 2,
    glowIntensity: overrides.glowIntensity ?? random() * 0.5 + 0.5,
    ...overrides
  };
};
