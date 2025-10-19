const randomRange = (min, max, rng = Math.random) => rng() * (max - min) + min;

const clampNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const isParticleLike = (particle) =>
  particle &&
  typeof particle === 'object' &&
  Number.isFinite(particle.x) &&
  Number.isFinite(particle.y) &&
  Number.isFinite(particle.life);

export const createParticle = (x, y, colorOrOptions, legacySize = 3) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const options =
    colorOrOptions && typeof colorOrOptions === 'object' && !Array.isArray(colorOrOptions)
      ? colorOrOptions
      : { color: colorOrOptions, size: legacySize };

  const {
    color = '#ffffff',
    size = legacySize,
    life = 1,
    angle,
    direction,
    speed,
    rng = Math.random,
    fade = 0.02,
    gravity = 0.15,
    blend = 'source-over',
    orientation,
    angularVelocity = 0,
    stretch = 1,
    glowStrength = 0,
    glowColor,
    pulseSpeed = 0,
    pulseAmplitude = 0.2,
    pulsePhase,
  } = options;

  const random = typeof rng === 'function' ? rng : Math.random;
  const baseAngle = Number.isFinite(angle ?? direction)
    ? angle ?? direction
    : randomRange(0, Math.PI * 2, random);
  const baseSpeed = Number.isFinite(speed) ? speed : randomRange(0.6, 2.6, random);
  const resolvedSize = Math.max(1, clampNumber(size, legacySize));

  return {
    x,
    y,
    vx: Math.cos(baseAngle) * baseSpeed,
    vy: Math.sin(baseAngle) * baseSpeed,
    life: clampNumber(life, 1),
    color,
    size: randomRange(Math.max(1, resolvedSize * 0.6), resolvedSize + 2, random),
    fade: clampNumber(fade, 0.02),
    gravity: clampNumber(gravity, 0.15),
    blend,
    orientation: Number.isFinite(orientation) ? orientation : baseAngle,
    angularVelocity: clampNumber(angularVelocity, 0),
    stretch: Number.isFinite(stretch) ? stretch : 1,
    glowStrength: Number.isFinite(glowStrength) ? Math.max(0, glowStrength) : 0,
    glowColor: typeof glowColor === 'string' ? glowColor : undefined,
    pulseSpeed: Number.isFinite(pulseSpeed) ? pulseSpeed : 0,
    pulseAmplitude: Number.isFinite(pulseAmplitude) ? Math.max(0, pulseAmplitude) : 0.2,
    pulsePhase: Number.isFinite(pulsePhase) ? pulsePhase : randomRange(0, Math.PI * 2, random),
  };
};

export const createParticleBurst = (x, y, color, count = 1, size = 3) =>
  Array.from({ length: Math.max(0, Math.round(count)) }, () => createParticle(x, y, color, size)).filter(
    isParticleLike,
  );

export const createElementalBurst = (
  x,
  y,
  {
    color = '#ffffff',
    life = 1,
    direction = 0,
    spread = Math.PI * 2,
    count = 12,
    speed = 5,
    blend = 'lighter',
    rng = Math.random,
  } = {},
) => {
  const random = typeof rng === 'function' ? rng : Math.random;
  const total = Math.max(0, Math.round(count));

  return Array.from({ length: total }, () => {
    const offset = (random() - 0.5) * spread;
    const magnitude = speed * (0.6 + random() * 0.4);
    const particle = createParticle(x, y, {
      color,
      life: life * (0.8 + random() * 0.4),
      angle: direction + offset,
      speed: magnitude,
      fade: 0.03,
      gravity: 0.08,
      blend,
      stretch: 1.4,
      rng: random,
    });
    return particle;
  }).filter(isParticleLike);
};

export const createStatusDrip = (
  x,
  y,
  {
    color = '#ffffff',
    life = 1.2,
    direction = Math.PI / 2,
    spread = Math.PI / 5,
    count = 6,
    speed = 1.6,
    gravity = 0.25,
    fade = 0.015,
    blend = 'source-over',
    rng = Math.random,
  } = {},
) => {
  const random = typeof rng === 'function' ? rng : Math.random;
  const total = Math.max(0, Math.round(count));

  return Array.from({ length: total }, () => {
    const offset = (random() - 0.5) * spread;
    const magnitude = speed * (0.6 + random() * 0.3);
    const particle = createParticle(x, y, {
      color,
      life: life * (0.9 + random() * 0.2),
      angle: direction + offset,
      speed: magnitude,
      fade,
      gravity,
      blend,
      stretch: 0.6,
      rng: random,
    });
    return particle;
  }).filter(isParticleLike);
};

export const createCriticalSparks = (
  x,
  y,
  {
    color = '#ffd93d',
    highlight = '#ffffff',
    life = 0.9,
    direction = 0,
    spread = Math.PI / 3,
    count = 8,
    speed = 7,
    blend = 'lighter',
    rng = Math.random,
  } = {},
) => {
  const random = typeof rng === 'function' ? rng : Math.random;
  const total = Math.max(0, Math.round(count));

  return Array.from({ length: total }, (_, index) => {
    const offset = (random() - 0.5) * spread;
    const magnitude = speed * (0.7 + random() * 0.5);
    const particle = createParticle(x, y, {
      color: index % 2 === 0 ? highlight : color,
      life: life * (0.8 + random() * 0.4),
      angle: direction + offset,
      speed: magnitude,
      fade: 0.04,
      gravity: 0,
      blend,
      stretch: 1.8,
      angularVelocity: (random() - 0.5) * 0.6,
      rng: random,
    });
    return particle;
  }).filter(isParticleLike);
};

export default createParticle;
