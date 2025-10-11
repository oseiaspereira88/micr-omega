import { obstacleTypes } from '../config/obstacleTypes';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items?.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

const randomBetween = (range, random, fallback) => {
  if (Array.isArray(range) && range.length >= 2) {
    const [min, max] = range;
    if (typeof min === 'number' && typeof max === 'number') {
      return min + random() * (max - min);
    }
  }
  return fallback;
};

const ensureAlpha = (color, alpha = '88') => {
  if (!color || typeof color !== 'string') return color;
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alpha}`;
  }
  return color;
};

export const spawnObstacle = ({ worldSize = 4000, types = obstacleTypes, rng = Math.random } = {}) => {
  const random = getRandom(rng);
  const availableTypes = Object.keys(types || {});
  if (!availableTypes.length) return null;

  const typeKey = pickRandom(availableTypes, random);
  const type = types[typeKey];
  if (!type) return null;

  const sizeRange = type.sizes || [20, 80];
  const baseColor = pickRandom(type.colors || ['#FFFFFF'], random) || '#FFFFFF';
  const coreColor =
    pickRandom(type.coreColors, random) ?? ensureAlpha(baseColor, '99');
  const hitColor = pickRandom(type.hitColors, random) ?? ensureAlpha(baseColor, 'DD');
  const fallbackOpacity = typeof type.opacity === 'number' ? type.opacity : 0.75;
  const opacity = randomBetween(type.opacityRange, random, fallbackOpacity);
  const fallbackPulse = 0.5 + random() * 0.5;
  const pulseSpeed = randomBetween(type.pulseSpeedRange, random, fallbackPulse);
  const fallbackDrift = 0.2 + random() * 0.3;
  const drift = randomBetween(type.driftRange, random, fallbackDrift);
  const vx = (random() - 0.5) * drift;
  const vy = (random() - 0.5) * drift;

  return {
    x: random() * worldSize,
    y: random() * worldSize,
    size: sizeRange[0] + random() * (sizeRange[1] - sizeRange[0]),
    color: baseColor,
    coreColor,
    hitColor,
    opacity: Math.max(0.2, Math.min(1, opacity)),
    pulseSpeed,
    vx,
    vy,
    hitPulse: 0,
    shape: pickRandom(type.shapes || ['sphere'], random),
    type: typeKey,
    rotation: random() * Math.PI * 2,
    rotationSpeed: (random() - 0.5) * 0.3,
    pulsePhase: random() * Math.PI * 2
  };
};
