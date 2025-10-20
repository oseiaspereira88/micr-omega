const randomRange = (min, max, rng = Math.random) => rng() * (max - min) + min;

const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHex = (color) => {
  if (typeof color !== 'string') {
    return null;
  }

  const trimmed = color.trim();
  if (!hexPattern.test(trimmed)) {
    return null;
  }

  if (trimmed.length === 4) {
    const [hash, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return trimmed.length === 7 ? trimmed.toLowerCase() : null;
};

const adjustHexColor = (color, variance, rng = Math.random) => {
  const normalized = normalizeHex(color);
  if (!normalized || !Number.isFinite(variance) || variance <= 0) {
    return color;
  }

  const random = typeof rng === 'function' ? rng : Math.random;
  const factor = 1 + (random() * 2 - 1) * variance;
  const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  const toHex = (value) => clampChannel(value).toString(16).padStart(2, '0');

  return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
};

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

export const createStatusAura = (
  x,
  y,
  {
    color = '#66ccff',
    palette,
    life = 1.4,
    fade,
    count = 12,
    radius = 18,
    angularSpeed = 0.9,
    oscillationAmplitude = 3,
    oscillationFrequency = 2.4,
    colorVariance = 0.15,
    intensityVariance = 0.4,
    pulseSpeed = 0,
    pulseAmplitude = 0.25,
    glowStrength = 1.2,
    blend = 'lighter',
    size = 3,
    rng = Math.random,
  } = {},
) => {
  const random = typeof rng === 'function' ? rng : Math.random;
  const total = Math.max(0, Math.round(count));
  if (total === 0) {
    return [];
  }

  const resolvedLife = Number.isFinite(life) ? Math.max(0.1, life) : 1.4;
  const resolvedFade = Number.isFinite(fade)
    ? Math.max(0.001, fade)
    : Math.max(0.01, resolvedLife / 60);
  const resolvedRadius = Number.isFinite(radius) ? Math.max(0, radius) : 18;
  const resolvedAngularSpeed = Number.isFinite(angularSpeed) ? angularSpeed : 0.9;
  const resolvedOscillationAmplitude = Number.isFinite(oscillationAmplitude)
    ? Math.max(0, oscillationAmplitude)
    : 3;
  const resolvedOscillationFrequency = Number.isFinite(oscillationFrequency)
    ? Math.max(0, oscillationFrequency)
    : 2.4;
  const paletteArray = Array.isArray(palette) && palette.length > 0 ? palette : null;
  const resolvedPulseSpeed = Number.isFinite(pulseSpeed) ? pulseSpeed : 0;
  const resolvedPulseAmplitude = Number.isFinite(pulseAmplitude) ? Math.max(0, pulseAmplitude) : 0.25;
  const baseGlowStrength = Number.isFinite(glowStrength) ? Math.max(0, glowStrength) : 0;

  return Array.from({ length: total }, (_, index) => {
    const baseAngle = (index / total) * Math.PI * 2;
    const oscillationPhase = random() * Math.PI * 2;
    const colorSource = paletteArray ? paletteArray[index % paletteArray.length] : color;
    const variedColor = adjustHexColor(colorSource, colorVariance, random);
    const variedGlowStrength = baseGlowStrength * (1 - intensityVariance / 2 + random() * intensityVariance);
    const particle = createParticle(x + Math.cos(baseAngle) * resolvedRadius, y + Math.sin(baseAngle) * resolvedRadius, {
      color: variedColor,
      life: resolvedLife * (0.8 + random() * 0.4),
      fade: resolvedFade,
      gravity: 0,
      speed: 0,
      blend,
      size,
      rng: random,
      pulseSpeed: resolvedPulseSpeed,
      pulseAmplitude: resolvedPulseAmplitude,
      glowStrength: variedGlowStrength,
    });

    if (!isParticleLike(particle)) {
      return null;
    }

    particle.vx = -Math.sin(baseAngle) * resolvedAngularSpeed * resolvedRadius;
    particle.vy = Math.cos(baseAngle) * resolvedAngularSpeed * resolvedRadius;
    particle.angularVelocity = resolvedAngularSpeed;
    particle.orbit = {
      centerX: x,
      centerY: y,
      radius: resolvedRadius,
      oscillationAmplitude: resolvedOscillationAmplitude,
      oscillationFrequency: resolvedOscillationFrequency,
      oscillationPhase,
    };
    particle.pulseSpeed = resolvedPulseSpeed;
    particle.pulseAmplitude = resolvedPulseAmplitude;
    particle.glowStrength = Math.max(0, variedGlowStrength);

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
