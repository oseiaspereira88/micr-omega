export const TEMPERAMENT_PROFILES = {
  virus: { aggression: 0.85, courage: 0.6, discipline: 0.35 },
  bacteria: { aggression: 0.65, courage: 0.55, discipline: 0.5 },
  rotifer: { aggression: 0.5, courage: 0.7, discipline: 0.6 },
  fungus: { aggression: 0.4, courage: 0.45, discipline: 0.7 },
  amoeba: { aggression: 0.3, courage: 0.35, discipline: 0.45 },
};

export const HOSTILITY_MATRIX = {
  virus: {
    bacteria: 0.8,
    rotifer: 0.9,
    fungus: 0.6,
  },
  bacteria: {
    virus: 0.7,
    rotifer: 0.55,
    fungus: 0.65,
  },
  rotifer: {
    virus: 0.65,
    bacteria: 0.5,
    amoeba: 0.35,
  },
  fungus: {
    bacteria: 0.75,
    virus: 0.4,
  },
  amoeba: {
    bacteria: 0.45,
    virus: 0.25,
  },
};

export const getTemperamentProfile = (species) => ({
  aggression: 0.45,
  courage: 0.5,
  discipline: 0.5,
  ...(TEMPERAMENT_PROFILES[species] || {}),
});

export const getHostilityWeight = (sourceSpecies, targetSpecies) => {
  if (!sourceSpecies || !targetSpecies) return 0;
  const species = String(sourceSpecies).toLowerCase();
  const target = String(targetSpecies).toLowerCase();
  return HOSTILITY_MATRIX[species]?.[target] ?? 0;
};

export const enumerateHostileSpecies = (species) =>
  Object.entries(HOSTILITY_MATRIX[String(species).toLowerCase()] || {})
    .filter(([, weight]) => weight > 0)
    .map(([target]) => target);
