export const ELEMENTAL_ADVANTAGE_MULTIPLIER = 1.25;
export const ELEMENTAL_DISADVANTAGE_MULTIPLIER = 0.75;

export const DROP_TABLES = {
  minion: {
    xp: { base: 24, variance: 0.2 },
    geneticMaterial: { min: 2, max: 4 },
    fragment: {
      chance: 0.1,
      min: 1,
      max: 1,
      pityThreshold: 5,
      pityIncrement: 0.1,
    },
    stableGene: {
      chance: 0.02,
      amount: 1,
      pityThreshold: 12,
      pityIncrement: 0.05,
    },
    fragmentKey: 'minor',
    stableKey: 'minor',
  },
  elite: {
    xp: { base: 80, variance: 0.15 },
    geneticMaterial: { min: 6, max: 10 },
    fragment: {
      chance: 0.22,
      min: 1,
      max: 2,
      pityThreshold: 4,
      pityIncrement: 0.12,
    },
    stableGene: {
      chance: 0.08,
      amount: 1,
      pityThreshold: 6,
      pityIncrement: 0.1,
    },
    fragmentKey: 'major',
    stableKey: 'major',
  },
  boss: {
    xp: { base: 260, variance: 0.1 },
    geneticMaterial: { min: 20, max: 32 },
    fragment: {
      chance: 0.55,
      min: 3,
      max: 5,
      pityThreshold: 2,
      pityIncrement: 0.2,
    },
    stableGene: {
      chance: 0.35,
      amount: 1,
      pityThreshold: 3,
      pityIncrement: 0.25,
    },
    fragmentKey: 'apex',
    stableKey: 'apex',
  },
};

const mergeBehaviorTraits = (base = {}, addition = {}) => {
  const merged = { ...base };
  Object.entries(addition || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else {
      merged[key] = value;
    }
  });
  return merged;
};

const baseTemplates = {
  virus: {
    name: 'Vírus',
    baseSize: 18,
    baseSpeed: 2.5,
    baseAttack: 8,
    baseDefense: 2,
    energyReward: 12,
    color: '#FF3333',
    coreColor: '#FF6677',
    glowColor: '#FF8899',
    outerColor: '#991A2F',
    colorAlpha: 0.7,
    coreAlpha: 0.95,
    glowAlpha: 0.65,
    outerAlpha: 0.25,
    shadowAlpha: 0.8,
    strokeAlpha: 0.6,
    behavior: 'aggressive',
    points: 100,
    tier: 'common',
    dropTier: 'minion',
    abilities: ['viral_dash'],
    resistances: { bio: 0.1 },
    behaviorTraits: {
      speedBurst: { interval: 6, duration: 0.8, speedMultiplier: 1.75 },
    },
    evolutionModifiers: [
      {
        minLevel: 3,
        modifiers: {
          abilities: ['toxin_cloud'],
          resistances: { chemical: 0.05 },
          behaviorTraits: {
            projectileVolley: {
              interval: 7,
              count: 2,
              speed: 4.5,
              spread: 0.35,
              damageMultiplier: 0.45,
              life: 2.5,
              color: '#FF6677',
            },
          },
        },
      },
      {
        minLevel: 5,
        modifiers: {
          stats: {
            attackMultiplier: 1.1,
            speedMultiplier: 1.1,
            healthMultiplier: 1.1,
          },
          abilities: ['viral_burst'],
        },
      },
    ],
  },
  bacteria: {
    name: 'Bactéria',
    baseSize: 25,
    baseSpeed: 1.8,
    baseAttack: 12,
    baseDefense: 5,
    energyReward: 18,
    color: '#FF6600',
    coreColor: '#FF9955',
    glowColor: '#FFB577',
    outerColor: '#B34700',
    colorAlpha: 0.68,
    coreAlpha: 0.92,
    glowAlpha: 0.6,
    outerAlpha: 0.22,
    shadowAlpha: 0.78,
    strokeAlpha: 0.58,
    behavior: 'territorial',
    points: 150,
    tier: 'common',
    dropTier: 'minion',
    abilities: ['corrosive_aura'],
    resistances: { acid: 0.15 },
    behaviorTraits: {
      supportAura: {
        interval: 9,
        duration: 3,
        radius: 260,
        modifiers: { defenseMultiplier: 1.15 },
        includeSelf: true,
      },
    },
    evolutionModifiers: [
      {
        minLevel: 4,
        modifiers: {
          stats: {
            defenseMultiplier: 1.2,
            healthMultiplier: 1.25,
          },
          resistances: { thermal: 0.1 },
        },
      },
      {
        minLevel: 6,
        modifiers: {
          abilities: ['spore_burst'],
          behaviorTraits: {
            projectileVolley: {
              interval: 8,
              count: 3,
              speed: 3.8,
              spread: 0.4,
              damageMultiplier: 0.35,
              life: 3.2,
              color: '#FF9955',
            },
          },
        },
      },
    ],
  },
  parasite: {
    name: 'Parasita',
    baseSize: 20,
    baseSpeed: 3.0,
    baseAttack: 6,
    baseDefense: 3,
    energyReward: 10,
    color: '#66FF33',
    coreColor: '#99FF77',
    glowColor: '#B5FF99',
    outerColor: '#2F991A',
    colorAlpha: 0.7,
    coreAlpha: 0.94,
    glowAlpha: 0.62,
    outerAlpha: 0.24,
    shadowAlpha: 0.8,
    strokeAlpha: 0.6,
    behavior: 'opportunist',
    points: 120,
    tier: 'common',
    dropTier: 'minion',
    abilities: ['drain_bite'],
    resistances: { bio: 0.05, electric: -0.05 },
    behaviorTraits: {
      speedBurst: { interval: 5, duration: 1.2, speedMultiplier: 1.6 },
    },
    evolutionModifiers: [
      {
        minLevel: 3,
        modifiers: {
          stats: {
            attackMultiplier: 1.15,
            speedMultiplier: 1.05,
          },
          abilities: ['leech_swarm'],
        },
      },
      {
        minLevel: 5,
        modifiers: {
          resistances: { electric: 0.05 },
          behaviorTraits: {
            projectileVolley: {
              interval: 6,
              count: 4,
              speed: 5.2,
              spread: 0.5,
              damageMultiplier: 0.4,
              life: 2.2,
              color: '#99FF77',
            },
          },
        },
      },
    ],
  },
  predator: {
    name: 'Predador',
    baseSize: 40,
    baseSpeed: 1.5,
    baseAttack: 20,
    baseDefense: 10,
    energyReward: 25,
    color: '#9933FF',
    coreColor: '#BB66FF',
    glowColor: '#D699FF',
    outerColor: '#4F1A99',
    colorAlpha: 0.72,
    coreAlpha: 0.96,
    glowAlpha: 0.66,
    outerAlpha: 0.26,
    shadowAlpha: 0.82,
    strokeAlpha: 0.6,
    behavior: 'hunter',
    points: 300,
    tier: 'rare',
    dropTier: 'elite',
    abilities: ['razor_charge'],
    resistances: { kinetic: 0.1 },
    behaviorTraits: {
      speedBurst: { interval: 7, duration: 1, speedMultiplier: 1.8 },
    },
    evolutionModifiers: [
      {
        minLevel: 4,
        modifiers: {
          stats: {
            attackMultiplier: 1.2,
            speedMultiplier: 1.05,
          },
          abilities: ['bleeding_strike'],
        },
      },
      {
        minLevel: 6,
        modifiers: {
          stats: {
            healthMultiplier: 1.15,
            defenseMultiplier: 1.1,
          },
          behaviorTraits: {
            projectileVolley: {
              interval: 9,
              count: 5,
              speed: 4.2,
              spread: 0.6,
              damageMultiplier: 0.5,
              life: 3,
              color: '#BB66FF',
            },
          },
        },
      },
    ],
  },
};

const combineModifiers = (baseModifiers, extraModifiers) => {
  const normalize = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  };

  return [...normalize(baseModifiers), ...normalize(extraModifiers)];
};

const createVariant = (baseKey, overrides = {}) => {
  const base = baseTemplates[baseKey];
  if (!base) {
    return overrides;
  }

  const normalizeArray = (value) => (Array.isArray(value) ? value : []);

  const abilities = Array.from(
    new Set([...(base.abilities || []), ...normalizeArray(overrides.abilities)])
  );

  const resistances = {
    ...(base.resistances || {}),
    ...(overrides.resistances || {}),
  };

  const behaviorTraits = mergeBehaviorTraits(base.behaviorTraits, overrides.behaviorTraits);

  return {
    ...base,
    ...overrides,
    tier: overrides.tier ?? base.tier ?? 'variant',
    dropTier: overrides.dropTier ?? base.dropTier ?? 'minion',
    variantOf: baseKey,
    abilities,
    resistances,
    behaviorTraits,
    modifiers: combineModifiers(base.modifiers, overrides.modifiers),
    evolutionModifiers: [
      ...(base.evolutionModifiers || []),
      ...((overrides.evolutionModifiers || [])),
    ],
  };
};

export const enemyTemplates = {
  ...baseTemplates,
  virus_elite: createVariant('virus', {
    name: 'Vírus Élite',
    tier: 'elite',
    dropTier: 'elite',
    baseAttack: 10,
    points: 180,
    abilities: ['acid_surge'],
    resistances: { chemical: 0.1 },
    behaviorTraits: {
      projectileVolley: {
        interval: 5,
        count: 3,
        speed: 5,
        spread: 0.45,
        damageMultiplier: 0.55,
        life: 2.6,
        color: '#FF5566',
      },
    },
    modifiers: {
      stats: {
        attackMultiplier: 1.25,
        speedMultiplier: 1.1,
        healthMultiplier: 1.3,
      },
    },
  }),
  virus_prime: createVariant('virus', {
    name: 'Vírus Prime',
    tier: 'mythic',
    dropTier: 'elite',
    baseAttack: 12,
    points: 260,
    abilities: ['neuroburst'],
    resistances: { psionic: 0.1 },
    behaviorTraits: {
      supportAura: {
        interval: 8,
        duration: 2.5,
        radius: 220,
        modifiers: { speedMultiplier: 1.15 },
      },
    },
    modifiers: [
      {
        stats: {
          attackMultiplier: 1.35,
          speedMultiplier: 1.15,
          healthMultiplier: 1.35,
        },
        abilities: ['viral_barrage'],
      },
    ],
  }),
  bacteria_elite: createVariant('bacteria', {
    name: 'Bactéria Guardiã',
    tier: 'elite',
    dropTier: 'elite',
    baseDefense: 6,
    points: 220,
    abilities: ['fortified_shell'],
    resistances: { kinetic: 0.1 },
    behaviorTraits: {
      supportAura: {
        interval: 7,
        duration: 3.5,
        radius: 300,
        modifiers: { defenseMultiplier: 1.3, attackMultiplier: 1.1 },
      },
    },
    modifiers: {
      stats: {
        defenseMultiplier: 1.35,
        healthMultiplier: 1.4,
        sizeMultiplier: 1.1,
      },
      abilities: ['shield_pulse'],
    },
  }),
  bacteria_colossus: createVariant('bacteria', {
    name: 'Bactéria Colosso',
    tier: 'legendary',
    dropTier: 'elite',
    baseSize: 32,
    points: 320,
    abilities: ['spore_wall'],
    resistances: { acid: 0.2, thermal: 0.1 },
    behaviorTraits: {
      projectileVolley: {
        interval: 6,
        count: 4,
        speed: 3.5,
        spread: 0.5,
        damageMultiplier: 0.45,
        life: 3.4,
        color: '#FFAA66',
      },
      supportAura: {
        interval: 6,
        duration: 4,
        radius: 320,
        modifiers: { defenseMultiplier: 1.25 },
      },
    },
    modifiers: [
      {
        stats: {
          defenseMultiplier: 1.45,
          healthMultiplier: 1.55,
          sizeMultiplier: 1.2,
        },
      },
    ],
  }),
  parasite_stalker: createVariant('parasite', {
    name: 'Parasita Caçador',
    tier: 'elite',
    dropTier: 'elite',
    baseSpeed: 3.2,
    points: 200,
    abilities: ['shadow_step'],
    resistances: { psionic: -0.05, bio: 0.1 },
    behaviorTraits: {
      speedBurst: { interval: 4, duration: 1.4, speedMultiplier: 1.85 },
      projectileVolley: {
        interval: 5,
        count: 3,
        speed: 6,
        spread: 0.4,
        damageMultiplier: 0.5,
        life: 2,
        color: '#7CFF66',
      },
    },
    modifiers: {
      stats: {
        attackMultiplier: 1.3,
        speedMultiplier: 1.2,
      },
    },
  }),
  parasite_symbiote: createVariant('parasite', {
    name: 'Parasita Simbionte',
    tier: 'legendary',
    dropTier: 'elite',
    baseAttack: 8,
    points: 260,
    abilities: ['symbiotic_link'],
    resistances: { electric: 0.1, bio: 0.15 },
    behaviorTraits: {
      supportAura: {
        interval: 5,
        duration: 2.5,
        radius: 260,
        modifiers: { attackMultiplier: 1.2, speedMultiplier: 1.1 },
        includeSelf: true,
      },
      projectileVolley: {
        interval: 7,
        count: 5,
        speed: 5.5,
        spread: 0.55,
        damageMultiplier: 0.45,
        life: 2.4,
        color: '#88FF77',
      },
    },
    modifiers: [
      {
        stats: {
          attackMultiplier: 1.25,
          healthMultiplier: 1.3,
        },
        abilities: ['energy_siphon'],
      },
    ],
  }),
  predator_alpha: createVariant('predator', {
    name: 'Predador Alfa',
    tier: 'elite',
    dropTier: 'elite',
    baseAttack: 24,
    points: 380,
    abilities: ['alpha_howl'],
    resistances: { kinetic: 0.15, sonic: 0.05 },
    behaviorTraits: {
      speedBurst: { interval: 6, duration: 1.2, speedMultiplier: 2 },
      projectileVolley: {
        interval: 6,
        count: 4,
        speed: 5.5,
        spread: 0.5,
        damageMultiplier: 0.6,
        life: 2.8,
        color: '#C67BFF',
      },
    },
    modifiers: {
      stats: {
        attackMultiplier: 1.4,
        speedMultiplier: 1.15,
        healthMultiplier: 1.2,
      },
    },
  }),
  predator_matriarch: createVariant('predator', {
    name: 'Predadora Matriarca',
    tier: 'legendary',
    dropTier: 'elite',
    baseDefense: 12,
    points: 460,
    abilities: ['matriarch_roar'],
    resistances: { kinetic: 0.2, bio: 0.1 },
    behaviorTraits: {
      supportAura: {
        interval: 5.5,
        duration: 2.8,
        radius: 340,
        modifiers: { attackMultiplier: 1.25, defenseMultiplier: 1.15 },
        includeSelf: true,
      },
      projectileVolley: {
        interval: 7,
        count: 6,
        speed: 4.8,
        spread: 0.65,
        damageMultiplier: 0.55,
        life: 3.1,
        color: '#D699FF',
      },
    },
    modifiers: [
      {
        stats: {
          defenseMultiplier: 1.35,
          healthMultiplier: 1.4,
          attackMultiplier: 1.25,
        },
        abilities: ['pack_coordination'],
      },
    ],
  }),
};
