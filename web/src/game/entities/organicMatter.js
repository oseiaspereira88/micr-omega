const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

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
    localX: legacyLocalX,
    localY: legacyLocalY,
    layout,
    rng = Math.random,
    ...overrides
  } = options;

  const random = getRandom(rng);
  const sizeRange = typeConfig.sizes || [1, 1];
  const size = overrides.size ?? (sizeRange[0] + random() * (sizeRange[1] - sizeRange[0]));

  const layoutLocalX = layout?.localX ?? legacyLocalX ?? 0;
  const layoutLocalY = layout?.localY ?? legacyLocalY ?? 0;
  const absoluteX = x + layoutLocalX;
  const absoluteY = y + layoutLocalY;
  const layoutInfo = layout
    ? { ...layout, localX: layoutLocalX, localY: layoutLocalY }
    : legacyLocalX !== undefined || legacyLocalY !== undefined
      ? { localX: layoutLocalX, localY: layoutLocalY }
      : undefined;

  return {
    x: absoluteX,
    y: absoluteY,
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
    ...(layoutInfo ? { layout: layoutInfo } : {}),
    ...overrides
  };
};
