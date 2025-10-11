const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

export const createPowerUp = (typeKey, typeConfig, options = {}) => {
  if (!typeKey || !typeConfig) return null;

  const {
    x = 0,
    y = 0,
    rng = Math.random,
    idGenerator,
    pulse,
    ...overrides
  } = options;

  const random = getRandom(rng);
  const id = overrides.id ?? (idGenerator ? idGenerator() : Date.now() + random());

  return {
    id,
    x,
    y,
    type: typeKey,
    color: overrides.color ?? typeConfig.color,
    icon: overrides.icon ?? typeConfig.icon,
    pulse: pulse ?? random() * Math.PI * 2,
    ...overrides
  };
};
