import { createPowerUp } from '../entities/powerUp';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

export const spawnPowerUp = ({
  worldSize = 4000,
  types = {},
  forcedType,
  position,
  rng = Math.random,
  idGenerator
} = {}) => {
  const random = getRandom(rng);
  const availableTypes = Object.keys(types || {});
  if (!availableTypes.length) return null;

  const typeKey = forcedType ?? pickRandom(availableTypes, random);
  const type = types[typeKey];
  if (!type) return null;

  const x = position?.x ?? random() * worldSize;
  const y = position?.y ?? random() * worldSize;

  return createPowerUp(typeKey, type, { x, y, rng: random, idGenerator });
};

export const dropPowerUps = (enemy, {
  types = {},
  rng = Math.random,
  idGenerator
} = {}) => {
  if (!enemy) return [];

  const random = getRandom(rng);
  const drops = [];
  const dropChance = enemy.boss ? 1 : 0.18;

  if (random() < dropChance) {
    const offsetX = (random() - 0.5) * 40;
    const offsetY = (random() - 0.5) * 40;
    const powerUp = spawnPowerUp({
      types,
      rng: random,
      idGenerator,
      position: { x: enemy.x + offsetX, y: enemy.y + offsetY }
    });
    if (powerUp) drops.push(powerUp);
  }

  if (enemy.boss) {
    const powerUp = spawnPowerUp({
      types,
      rng: random,
      idGenerator,
      position: { x: enemy.x, y: enemy.y }
    });
    if (powerUp) drops.push(powerUp);
  }

  return drops;
};
