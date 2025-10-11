import { nebulaTypes } from '../config/nebulaTypes';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

export const spawnNebula = ({
  worldSize = 4000,
  types = nebulaTypes,
  forcedType,
  rng = Math.random
} = {}) => {
  const random = getRandom(rng);
  const availableTypes = Object.keys(types || {});
  if (!availableTypes.length) return null;

  const typeKey = forcedType ?? pickRandom(availableTypes, random);
  const type = types[typeKey];
  if (!type) return null;

  const radiusRange = type.radius || [150, 300];
  const radius = radiusRange[0] + random() * (radiusRange[1] - radiusRange[0]);

  const layers = Array.from({ length: 4 }, () => ({
    offset: random() * Math.PI * 2,
    scale: 0.6 + random() * 0.5,
    alpha: (type.opacity ?? 1) * (0.4 + random() * 0.6)
  }));

  return {
    id: Date.now() + random(),
    x: random() * worldSize,
    y: random() * worldSize,
    radius,
    type: typeKey,
    rotation: random() * Math.PI * 2,
    swirlSpeed: (random() * 0.2 + 0.05) * (typeKey === 'gas' ? 1.5 : 1),
    pulse: random() * Math.PI * 2,
    layers,
    color: type.color,
    innerColor: type.innerColor,
    glow: type.glow,
    opacity: type.opacity
  };
};
