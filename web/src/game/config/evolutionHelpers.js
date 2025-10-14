export const ensureBaseStat = (organism, statKey, baseKey) => {
  if (!organism) return statKey;

  const resolvedBaseKey =
    baseKey ?? `base${statKey.charAt(0).toUpperCase()}${statKey.slice(1)}`;

  if (
    organism[resolvedBaseKey] === undefined ||
    !Number.isFinite(organism[resolvedBaseKey])
  ) {
    organism[resolvedBaseKey] = Number.isFinite(organism[statKey])
      ? organism[statKey]
      : 0;
  }

  return resolvedBaseKey;
};

export const addSkillOnce = (organism = {}, skill) => {
  if (!skill) return;

  if (!Array.isArray(organism.skills)) {
    organism.skills = [];
  }

  if (!organism.skills.includes(skill)) {
    organism.skills.push(skill);
  }
};

const ensurePersistentPassives = (organism = {}) => {
  if (!organism.persistentPassives) {
    organism.persistentPassives = {};
  }
  return organism.persistentPassives;
};

export const applyMultiplicativePassive = (organism, statKey, delta) => {
  if (!organism || !Number.isFinite(delta)) return 0;

  const baseKey = ensureBaseStat(organism, statKey);
  const passives = ensurePersistentPassives(organism);
  const passiveKey = `${statKey}Multiplier`;

  passives[passiveKey] = (passives[passiveKey] ?? 0) + delta;

  const baseValue = Number.isFinite(organism[baseKey])
    ? organism[baseKey]
    : Number.isFinite(organism[statKey])
      ? organism[statKey]
      : 0;

  organism[statKey] = baseValue * (1 + passives[passiveKey]);
  return passives[passiveKey];
};

export const applyAdditivePassive = (organism, statKey, delta) => {
  if (!organism || !Number.isFinite(delta)) return 0;

  const baseKey = ensureBaseStat(organism, statKey);
  const passives = ensurePersistentPassives(organism);
  const passiveKey = `${statKey}Bonus`;

  passives[passiveKey] = (passives[passiveKey] ?? 0) + delta;

  const baseValue = Number.isFinite(organism[baseKey])
    ? organism[baseKey]
    : Number.isFinite(organism[statKey])
      ? organism[statKey]
      : 0;

  organism[statKey] = baseValue + passives[passiveKey];
  return passives[passiveKey];
};

export const buildEvolutionDescriptor = (key, definition = {}, overrides = {}) => ({
  key,
  ...definition,
  ...overrides,
});

