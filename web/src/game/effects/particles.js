const randomRange = (min, max) => Math.random() * (max - min) + min;

export const createParticle = (x, y, color, size = 3, overrides = {}) => {
  const {
    vx = randomRange(-2.5, 2.5),
    vy = randomRange(-2.5, 2.5),
    life = 1,
    decay = 0.02,
    gravity = 0.15,
    glowStrength = randomRange(0.4, 1.2),
    pulseSpeed = randomRange(0.6, 1.6),
    pulseOffset = randomRange(0, Math.PI * 2),
    baseAlpha = 1,
    composite = 'additive',
    sprite = null,
    shape = 'circle',
  } = overrides;

  const resolvedSize = overrides.size ?? randomRange(2, size + 2);

  return {
    x,
    y,
    vx,
    vy,
    life,
    decay,
    gravity,
    color,
    size: resolvedSize,
    age: 0,
    glowStrength,
    pulseSpeed,
    pulseOffset,
    baseAlpha,
    composite,
    sprite,
    shape,
  };
};

export const createParticleBurst = (x, y, color, count = 1, size = 3, overrides = {}) =>
  Array.from({ length: Math.max(0, count) }, () => createParticle(x, y, color, size, overrides));

export default createParticle;
