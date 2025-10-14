import { ensureResourceProfile } from '../state/resourceProfile';

export const createOrganism = (overrides = {}) => {
  const {
    traits = [],
    trail = [],
    skills = [],
    skillCooldowns = {},
    resources: resourceOverrides,
    evolutionHistory = {},
    persistentPassives = {},
    unlockedEvolutionSlots = {},
    ...rest
  } = overrides;

  const resources = ensureResourceProfile(resourceOverrides);
  const {
    xp = { current: 0, next: 120, total: 0, level: 1 },
    characteristicPoints = { total: 0, available: 0, spent: 0, perLevel: [] },
    geneticMaterial = { current: 0, total: 0, bonus: 0 },
    geneFragments = { minor: 0, major: 0, apex: 0 },
    stableGenes = { minor: 0, major: 0, apex: 0 },
    evolutionSlots = {
      small: { used: 0, max: 0 },
      medium: { used: 0, max: 0 },
      large: { used: 0, max: 0 },
    },
    reroll = { baseCost: 25, cost: 25, count: 0, pity: 0 },
    dropPity = { fragment: 0, stableGene: 0 },
  } = resources;

  const defaults = {
    x: 2000,
    y: 2000,
    vx: 0,
    vy: 0,
    size: 32,
    form: 'sphere',
    color: '#00D9FF',
    secondaryColor: '#0088FF',
    tertiaryColor: '#00FFFF',
    angle: 0,
    targetAngle: 0,
    swimPhase: 0,
    bodyWave: 0,
    pulseIntensity: 1,
    rotation: 0,
    tiltX: 0,
    tiltY: 0,
    eyeBlinkTimer: 0,
    eyeBlinkState: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    eyeExpression: 'neutral',
    dashCharge: 100,
    maxDashCharge: 100,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: false,
    invulnerableTimer: 0,
    attack: 10,
    defense: 5,
    speed: 1,
    formDefenseMultiplier: 1,
    formSpeedMultiplier: 1,
    attackRange: 80,
    attackCooldown: 0,
    currentSkillIndex: 0,
    dying: false,
    deathTimer: 0,
    hasShieldPowerUp: false,
    invulnerableFromPowerUp: false,
    resources,
    xp,
    characteristicPoints,
    geneticMaterial,
    geneFragments,
    stableGenes,
    evolutionSlots,
    reroll,
    dropPity,
  };

  return {
    ...defaults,
    ...rest,
    traits: [...traits],
    trail: [...trail],
    skills: [...skills],
    skillCooldowns: { ...skillCooldowns },
    evolutionHistory: {
      small: { ...(evolutionHistory.small || {}) },
      medium: { ...(evolutionHistory.medium || {}) },
      large: { ...(evolutionHistory.large || {}) },
    },
    persistentPassives: { ...persistentPassives },
    unlockedEvolutionSlots: {
      small: unlockedEvolutionSlots.small ?? 0,
      medium: unlockedEvolutionSlots.medium ?? 0,
      large: unlockedEvolutionSlots.large ?? 0,
    },
  };
};
