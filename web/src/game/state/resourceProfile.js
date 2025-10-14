const deepMerge = (target, source) => {
  if (!source) return target;
  const result = Array.isArray(target) ? [...target] : { ...target };

  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value.slice();
    } else if (value && typeof value === 'object') {
      const base = target && typeof target === 'object' ? target[key] : undefined;
      result[key] = deepMerge(base || {}, value);
    } else {
      result[key] = value;
    }
  });

  return result;
};

const markProfile = (profile) => {
  if (!profile || typeof profile !== 'object') return profile;
  Object.defineProperty(profile, '__isResourceProfile', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return profile;
};

const createDefaultProfile = () => {
  const xpCurrentLevel = 1;
  const nextThreshold = 120;

  const profile = {
    xp: {
      level: xpCurrentLevel,
      current: 0,
      total: 0,
      next: nextThreshold,
      thresholds: [0, 120, 280, 520, 840, 1240, 1720, 2280, 2920, 3640],
    },
    characteristicPoints: {
      total: 2,
      available: 2,
      spent: 0,
      perLevel: [{ level: 1, points: 2 }],
    },
    geneticMaterial: {
      current: 0,
      total: 0,
      bonus: 0,
    },
    geneFragments: {
      minor: 0,
      major: 0,
      apex: 0,
    },
    stableGenes: {
      minor: 0,
      major: 0,
      apex: 0,
    },
    evolutionSlots: {
      small: { used: 0, max: 2 },
      medium: { used: 0, max: 0 },
      large: { used: 0, max: 0 },
    },
    reroll: {
      baseCost: 25,
      cost: 25,
      count: 0,
      pity: 0,
    },
    dropPity: {
      fragment: 0,
      stableGene: 0,
    },
  };

  return profile;
};

export const createResourceProfile = (overrides = {}) => {
  const base = createDefaultProfile();
  const merged = deepMerge(base, overrides);
  return markProfile(merged);
};

export const cloneResourceProfile = (profile) => {
  if (profile && profile.__isResourceProfile) {
    return createResourceProfile(profile);
  }
  return createResourceProfile();
};

export const ensureResourceProfile = (profile) => {
  if (profile && profile.__isResourceProfile) {
    return profile;
  }
  return createResourceProfile(profile);
};

