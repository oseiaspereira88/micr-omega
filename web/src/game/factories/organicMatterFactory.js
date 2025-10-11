import { organicMatterTypes as defaultOrganicMatterTypes } from '../config/organicMatterTypes';
import { createOrganicMatter } from '../entities/organicMatter';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

export const spawnOrganicMatter = ({
  count = 1,
  worldSize = 4000,
  types = defaultOrganicMatterTypes,
  rng = Math.random
} = {}) => {
  const random = getRandom(rng);
  const availableTypes = Object.keys(types || {});
  if (!availableTypes.length || count <= 0) return [];

  const created = [];

  for (let i = 0; i < count; i++) {
    const typeKey = pickRandom(availableTypes, random);
    const type = types[typeKey];
    if (!type) continue;

    const isCluster = random() > 0.4;
    const clusterSize = isCluster ? Math.floor(random() * 5) + 3 : 1;
    const baseX = random() * worldSize;
    const baseY = random() * worldSize;

    for (let j = 0; j < clusterSize; j++) {
      const offset = isCluster ? (random() - 0.5) * 40 : 0;
      const organic = createOrganicMatter(typeKey, type, {
        x: baseX + offset,
        y: baseY + offset,
        rng: random
      });

      if (organic) {
        created.push(organic);
      }
    }
  }

  return created;
};
