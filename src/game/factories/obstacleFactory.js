import { obstacleTypes } from '../config/obstacleTypes';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

export const spawnObstacle = ({ worldSize = 4000, types = obstacleTypes, rng = Math.random } = {}) => {
  const random = getRandom(rng);
  const availableTypes = Object.keys(types || {});
  if (!availableTypes.length) return null;

  const typeKey = pickRandom(availableTypes, random);
  const type = types[typeKey];
  if (!type) return null;

  const sizeRange = type.sizes || [20, 80];

  return {
    x: random() * worldSize,
    y: random() * worldSize,
    size: sizeRange[0] + random() * (sizeRange[1] - sizeRange[0]),
    color: pickRandom(type.colors || ['#FFFFFF'], random),
    shape: pickRandom(type.shapes || ['sphere'], random),
    type: typeKey,
    rotation: random() * Math.PI * 2,
    rotationSpeed: (random() - 0.5) * 0.3,
    pulsePhase: random() * Math.PI * 2
  };
};
