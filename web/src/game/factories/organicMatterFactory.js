import { WORLD_SIZE } from '@micr-omega/shared';

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
  worldSize = WORLD_SIZE,
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

    const isCluster = random() > 0.35;
    const clusterSize = isCluster ? Math.floor(random() * 4) + 4 : 1;
    const baseX = random() * worldSize;
    const baseY = random() * worldSize;

    for (let j = 0; j < clusterSize; j++) {
      const scatterScale = isCluster ? 70 : 25;
      const offsetX = (random() - 0.5) * scatterScale;
      const offsetY = (random() - 0.5) * scatterScale;
      const organic = createOrganicMatter(typeKey, type, {
        x: baseX + offsetX,
        y: baseY + offsetY,
        rng: random
      });

      if (organic) {
        created.push(organic);
      }
    }
  }

  return created;
};
