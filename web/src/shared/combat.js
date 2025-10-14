const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const normalizeKey = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
};

export const ELEMENT_TYPES = Object.freeze({
  BIO: 'bio',
  CHEMICAL: 'chemical',
  ACID: 'acid',
  THERMAL: 'thermal',
  ELECTRIC: 'electric',
  KINETIC: 'kinetic',
  PSIONIC: 'psionic',
  SONIC: 'sonic',
});

export const ELEMENT_LIST = Object.freeze(Object.values(ELEMENT_TYPES));

export const ELEMENT_LABELS = Object.freeze({
  [ELEMENT_TYPES.BIO]: 'Bio-orgânico',
  [ELEMENT_TYPES.CHEMICAL]: 'Químico',
  [ELEMENT_TYPES.ACID]: 'Corrosivo',
  [ELEMENT_TYPES.THERMAL]: 'Térmico',
  [ELEMENT_TYPES.ELECTRIC]: 'Elétrico',
  [ELEMENT_TYPES.KINETIC]: 'Cinético',
  [ELEMENT_TYPES.PSIONIC]: 'Psíquico',
  [ELEMENT_TYPES.SONIC]: 'Sônico',
});

export const ELEMENT_ICONS = Object.freeze({
  [ELEMENT_TYPES.BIO]: '🧫',
  [ELEMENT_TYPES.CHEMICAL]: '⚗️',
  [ELEMENT_TYPES.ACID]: '🧪',
  [ELEMENT_TYPES.THERMAL]: '🔥',
  [ELEMENT_TYPES.ELECTRIC]: '⚡',
  [ELEMENT_TYPES.KINETIC]: '💥',
  [ELEMENT_TYPES.PSIONIC]: '🧠',
  [ELEMENT_TYPES.SONIC]: '🔊',
});

export const AFFINITY_TYPES = Object.freeze({
  NEUTRAL: 'neutral',
  ATTUNED: 'attuned',
  DIVERGENT: 'divergent',
});

export const AFFINITY_LABELS = Object.freeze({
  [AFFINITY_TYPES.NEUTRAL]: 'Neutra',
  [AFFINITY_TYPES.ATTUNED]: 'Sintonizada',
  [AFFINITY_TYPES.DIVERGENT]: 'Dissonante',
});

export const AFFINITY_ICONS = Object.freeze({
  [AFFINITY_TYPES.NEUTRAL]: '⚖️',
  [AFFINITY_TYPES.ATTUNED]: '✨',
  [AFFINITY_TYPES.DIVERGENT]: '🔻',
});

export const SKILL_TYPES = Object.freeze({
  ACTIVE: 'active',
  PASSIVE: 'passive',
});

export const SKILL_TYPE_LABELS = Object.freeze({
  [SKILL_TYPES.ACTIVE]: 'Ativa',
  [SKILL_TYPES.PASSIVE]: 'Passiva',
});

export const STATUS_EFFECTS = Object.freeze({
  KNOCKBACK: 'knockback',
  STAGGER: 'stagger',
  BLEED: 'bleed',
  SHIELD: 'shield',
  BARRIER: 'barrier',
  LEECH: 'leech',
  RESTORE: 'restore',
  FISSURE: 'fissure',
  CORROSION: 'corrosion',
  PHOTOLESION: 'photolesion',
  ENTANGLED: 'entangled',
});

export const STATUS_LABELS = Object.freeze({
  [STATUS_EFFECTS.KNOCKBACK]: 'Empurrão',
  [STATUS_EFFECTS.STAGGER]: 'Atordoar',
  [STATUS_EFFECTS.BLEED]: 'Hemorragia',
  [STATUS_EFFECTS.SHIELD]: 'Escudo',
  [STATUS_EFFECTS.BARRIER]: 'Barreira',
  [STATUS_EFFECTS.LEECH]: 'Drenar',
  [STATUS_EFFECTS.RESTORE]: 'Cura',
  [STATUS_EFFECTS.FISSURE]: 'Fissura',
  [STATUS_EFFECTS.CORROSION]: 'Corrosão',
  [STATUS_EFFECTS.PHOTOLESION]: 'Fotolesão',
  [STATUS_EFFECTS.ENTANGLED]: 'Enredamento',
});

export const ELEMENTAL_RPS_TABLE = Object.freeze({
  [ELEMENT_TYPES.BIO]: {
    advantage: [ELEMENT_TYPES.CHEMICAL],
    disadvantage: [ELEMENT_TYPES.KINETIC, ELEMENT_TYPES.SONIC],
  },
  [ELEMENT_TYPES.CHEMICAL]: {
    advantage: [ELEMENT_TYPES.KINETIC, ELEMENT_TYPES.BIO],
    disadvantage: [ELEMENT_TYPES.ACID, ELEMENT_TYPES.THERMAL],
  },
  [ELEMENT_TYPES.ACID]: {
    advantage: [ELEMENT_TYPES.KINETIC, ELEMENT_TYPES.THERMAL],
    disadvantage: [ELEMENT_TYPES.PSIONIC, ELEMENT_TYPES.BIO],
  },
  [ELEMENT_TYPES.THERMAL]: {
    advantage: [ELEMENT_TYPES.ELECTRIC, ELEMENT_TYPES.CHEMICAL],
    disadvantage: [ELEMENT_TYPES.ACID],
  },
  [ELEMENT_TYPES.ELECTRIC]: {
    advantage: [ELEMENT_TYPES.BIO, ELEMENT_TYPES.SONIC],
    disadvantage: [ELEMENT_TYPES.THERMAL],
  },
  [ELEMENT_TYPES.KINETIC]: {
    advantage: [ELEMENT_TYPES.BIO, ELEMENT_TYPES.PSIONIC],
    disadvantage: [ELEMENT_TYPES.CHEMICAL, ELEMENT_TYPES.ACID],
  },
  [ELEMENT_TYPES.PSIONIC]: {
    advantage: [ELEMENT_TYPES.ACID, ELEMENT_TYPES.ELECTRIC],
    disadvantage: [ELEMENT_TYPES.SONIC],
  },
  [ELEMENT_TYPES.SONIC]: {
    advantage: [ELEMENT_TYPES.PSIONIC, ELEMENT_TYPES.CHEMICAL],
    disadvantage: [ELEMENT_TYPES.ELECTRIC, ELEMENT_TYPES.BIO],
  },
});

export const ELEMENTAL_ADVANTAGE_MULTIPLIER = 1.15;
export const ELEMENTAL_DISADVANTAGE_MULTIPLIER = 0.9;

const AFFINITY_MODIFIERS = Object.freeze({
  [AFFINITY_TYPES.NEUTRAL]: { same: 0, advantage: 0, disadvantage: 0 },
  [AFFINITY_TYPES.ATTUNED]: { same: 0.15, advantage: 0.05, disadvantage: 0 },
  [AFFINITY_TYPES.DIVERGENT]: { same: -0.1, advantage: 0, disadvantage: -0.15 },
});

export const clampResistanceValue = (value) => {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, -0.95, 0.95);
};

export const normalizeWeaknessProfile = (weaknesses = {}) => {
  const normalized = {};
  Object.entries(weaknesses || {}).forEach(([element, value]) => {
    const key = normalizeKey(element);
    if (!key) return;
    const numeric = Math.abs(Number(value));
    if (!Number.isFinite(numeric)) return;
    normalized[key] = clampResistanceValue(numeric);
  });
  return normalized;
};

export const convertWeaknessesToResistances = (weaknesses = {}) => {
  const result = {};
  Object.entries(normalizeWeaknessProfile(weaknesses)).forEach(([element, value]) => {
    result[element] = clampResistanceValue(-Math.abs(value));
  });
  return result;
};

export const resolveResistanceProfile = (...sources) => {
  const profile = {};
  ELEMENT_LIST.forEach((element) => {
    profile[element] = 0;
  });

  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([element, value]) => {
      const key = normalizeKey(element) ?? element;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      const current = Number.isFinite(profile[key]) ? profile[key] : 0;
      profile[key] = clampResistanceValue(current + numeric);
    });
  });

  return { ...profile };
};

export const getElementalRelationship = (attackingElement, defendingElement) => {
  const attacker = normalizeKey(attackingElement);
  const defender = normalizeKey(defendingElement);

  if (!attacker || !defender) return 'neutral';
  if (attacker === defender) return 'mirror';

  const entry = ELEMENTAL_RPS_TABLE[attacker];
  if (!entry) return 'neutral';
  if (entry.advantage?.includes(defender)) return 'advantage';
  if (entry.disadvantage?.includes(defender)) return 'disadvantage';
  return 'neutral';
};

export const getElementalRpsMultiplier = (attackingElement, defendingElement) => {
  const relation = getElementalRelationship(attackingElement, defendingElement);
  if (relation === 'advantage') {
    return { relation, multiplier: ELEMENTAL_ADVANTAGE_MULTIPLIER };
  }
  if (relation === 'disadvantage') {
    return { relation, multiplier: ELEMENTAL_DISADVANTAGE_MULTIPLIER };
  }
  return { relation, multiplier: 1 };
};

export const resolveAffinityBonus = ({
  attackerElement,
  attackElement,
  affinity,
  relation = 'neutral',
}) => {
  const key = normalizeKey(affinity) ?? AFFINITY_TYPES.NEUTRAL;
  const modifiers = AFFINITY_MODIFIERS[key] ?? AFFINITY_MODIFIERS[AFFINITY_TYPES.NEUTRAL];
  const normalizedAttack = normalizeKey(attackElement);
  const normalizedAttacker = normalizeKey(attackerElement);

  if (normalizedAttack && normalizedAttacker && normalizedAttack === normalizedAttacker) {
    return modifiers.same ?? 0;
  }
  if (relation === 'advantage') {
    return modifiers.advantage ?? 0;
  }
  if (relation === 'disadvantage') {
    return modifiers.disadvantage ?? 0;
  }
  return 0;
};

export const createResistanceSnapshot = (profile = {}) =>
  resolveResistanceProfile(profile);

export const clampDamageMultiplier = (value) => {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, 0.05, 5);
};

export const resolveResistanceMultiplier = (profile, element) => {
  const key = normalizeKey(element);
  if (!key) return 1;
  const resistance = clampResistanceValue((profile || {})[key] ?? 0);
  return clampDamageMultiplier(1 - resistance);
};

