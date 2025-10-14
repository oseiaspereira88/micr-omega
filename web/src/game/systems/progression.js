import { applyArchetypeToState, archetypes } from '../config/archetypes';
import { createInitialState } from '../state/initialState';
import { smallEvolutions as defaultSmallEvolutions } from '../config/smallEvolutions';
import { mediumEvolutions as defaultMediumEvolutions } from '../config/mediumEvolutions';
import { majorEvolutions as defaultMajorEvolutions } from '../config/majorEvolutions';

const BASE_REROLL_COST = 25;
const REROLL_GROWTH_FACTOR = 1.6;
const MEDIUM_SLOT_INTERVAL = 2;
const LARGE_SLOT_INTERVAL = 5;
const SMALL_EVOLUTION_POINT_COST = 1;

const getXpRequirementForLevel = (xpState = {}, level = 1) => {
  const thresholds = Array.isArray(xpState.thresholds) ? xpState.thresholds : [];
  if (thresholds.length > level) {
    const previous = thresholds[level - 1] ?? 0;
    const next = thresholds[level] ?? previous;
    return Math.max(50, next - previous);
  }

  const base = 120;
  const growth = 45;
  return Math.max(60, base + (level - 1) * growth);
};

const ensureQueue = (state) => {
  if (!Array.isArray(state.progressionQueue)) {
    state.progressionQueue = [];
  }
  return state.progressionQueue;
};

const ensureResourceReferences = (state) => {
  if (!state) return;
  const resources = state.resources || state.organism?.resources;
  if (resources) {
    state.resources = resources;
    state.xp = state.xp || resources.xp;
    state.characteristicPoints = state.characteristicPoints || resources.characteristicPoints;
    state.geneticMaterial = state.geneticMaterial || resources.geneticMaterial;
    state.geneFragments = state.geneFragments || resources.geneFragments;
    state.stableGenes = state.stableGenes || resources.stableGenes;
    state.evolutionSlots = state.evolutionSlots || resources.evolutionSlots;
    state.reroll = state.reroll || resources.reroll;
    state.dropPity = state.dropPity || resources.dropPity;
  }

  state.reroll = state.reroll || {
    baseCost: BASE_REROLL_COST,
    cost: BASE_REROLL_COST,
    count: 0,
    pity: 0,
  };
  state.dropPity = state.dropPity || { fragment: 0, stableGene: 0 };
  state.recentRewards = state.recentRewards || {
    xp: 0,
    geneticMaterial: 0,
    fragments: 0,
    stableGenes: 0,
  };
  state.macroEvolutionSlots = state.macroEvolutionSlots || { used: 0, max: 0 };

  if (state.organism) {
    state.organism.evolutionHistory = state.organism.evolutionHistory || {
      small: {},
      medium: {},
      large: {},
    };
    state.organism.persistentPassives = state.organism.persistentPassives || {};
    state.organism.unlockedEvolutionSlots = state.organism.unlockedEvolutionSlots || {
      small: 0,
      medium: 0,
      large: 0,
    };
  }
};

const recalcPointsAndSlots = (state) => {
  const points = state.characteristicPoints || {
    total: 0,
    available: 0,
    spent: 0,
    perLevel: [],
  };
  const total = 2 + Math.floor(state.level / 3);
  const spent = points.spent ?? 0;

  points.total = total;
  points.available = Math.max(0, total - spent);
  points.perLevel = Array.isArray(points.perLevel) ? points.perLevel : [];
  if (!points.perLevel.some((entry) => entry?.level === state.level)) {
    points.perLevel.push({ level: state.level, points: total });
  }

  const slots = state.evolutionSlots || {
    small: { used: 0, max: 0 },
    medium: { used: 0, max: 0 },
    large: { used: 0, max: 0 },
  };

  slots.small = slots.small || { used: 0, max: 0 };
  slots.medium = slots.medium || { used: 0, max: 0 };
  slots.large = slots.large || { used: 0, max: 0 };

  slots.small.max = total;
  slots.small.used = Math.min(slots.small.used ?? 0, slots.small.max ?? 0);
  slots.medium.max = Math.max(slots.medium.max ?? 0, Math.floor(state.level / MEDIUM_SLOT_INTERVAL));
  slots.medium.used = Math.min(slots.medium.used ?? 0, slots.medium.max ?? slots.medium.used ?? 0);
  slots.large.max = Math.max(slots.large.max ?? 0, Math.floor(state.level / LARGE_SLOT_INTERVAL));
  slots.large.used = Math.min(slots.large.used ?? 0, slots.large.max ?? slots.large.used ?? 0);

  state.characteristicPoints = points;
  state.evolutionSlots = slots;

  const macroSlots = state.macroEvolutionSlots || { used: 0, max: 0 };
  macroSlots.max = Math.max(
    macroSlots.max ?? 0,
    Math.floor(state.level / LARGE_SLOT_INTERVAL)
  );
  macroSlots.used = Math.min(macroSlots.used ?? 0, macroSlots.max ?? macroSlots.used ?? 0);
  state.macroEvolutionSlots = macroSlots;

  if (state.organism?.unlockedEvolutionSlots) {
    state.organism.unlockedEvolutionSlots.small = Math.max(
      state.organism.unlockedEvolutionSlots.small ?? 0,
      slots.small.max ?? 0
    );
    state.organism.unlockedEvolutionSlots.medium = Math.max(
      state.organism.unlockedEvolutionSlots.medium ?? 0,
      slots.medium.max ?? 0
    );
    state.organism.unlockedEvolutionSlots.large = Math.max(
      state.organism.unlockedEvolutionSlots.large ?? 0,
      slots.large.max ?? 0
    );
  }
};

const pushTier = (state, tier) => {
  const queue = ensureQueue(state);
  queue.push(tier);
  state.canEvolve = true;
};

const determineFallbackTier = (state) => {
  if ((state.evolutionSlots?.large?.used ?? 0) < (state.evolutionSlots?.large?.max ?? 0)) {
    return 'large';
  }
  if ((state.evolutionSlots?.medium?.used ?? 0) < (state.evolutionSlots?.medium?.max ?? 0)) {
    return 'medium';
  }
  if ((state.characteristicPoints?.available ?? 0) >= SMALL_EVOLUTION_POINT_COST) {
    return 'small';
  }
  return null;
};

const hasCost = (state, cost = {}) => {
  if (!cost) return true;
  if (Number.isFinite(cost.pc) && (state.characteristicPoints?.available ?? 0) < cost.pc) {
    return false;
  }
  if (Number.isFinite(cost.mg) && (state.geneticMaterial?.current ?? 0) < cost.mg) {
    return false;
  }
  if (cost.fragments) {
    return Object.entries(cost.fragments).every(
      ([key, amount]) => (state.geneFragments?.[key] ?? 0) >= amount
    );
  }
  if (cost.stableGenes) {
    return Object.entries(cost.stableGenes).every(
      ([key, amount]) => (state.stableGenes?.[key] ?? 0) >= amount
    );
  }
  return true;
};

const applyCost = (state, cost = {}) => {
  if (!cost) return;
  if (Number.isFinite(cost.pc) && state.characteristicPoints) {
    state.characteristicPoints.available = Math.max(0, state.characteristicPoints.available - cost.pc);
    state.characteristicPoints.spent = (state.characteristicPoints.spent ?? 0) + cost.pc;
  }
  if (Number.isFinite(cost.mg) && state.geneticMaterial) {
    state.geneticMaterial.current = Math.max(0, state.geneticMaterial.current - cost.mg);
  }
  if (cost.fragments && state.geneFragments) {
    Object.entries(cost.fragments).forEach(([key, amount]) => {
      state.geneFragments[key] = Math.max(0, (state.geneFragments[key] ?? 0) - amount);
    });
  }
  if (cost.stableGenes && state.stableGenes) {
    Object.entries(cost.stableGenes).forEach(([key, amount]) => {
      state.stableGenes[key] = Math.max(0, (state.stableGenes[key] ?? 0) - amount);
    });
  }
};

const getEvolutionPool = (helpers = {}, tier = 'small') => {
  if (tier === 'medium') return helpers.mediumEvolutions || defaultMediumEvolutions || {};
  if (tier === 'large') return helpers.majorEvolutions || defaultMajorEvolutions || {};
  return helpers.smallEvolutions || defaultSmallEvolutions || {};
};

const computeNextMultiplier = (entry = {}, purchases = 0) => {
  const diminishing = Number.isFinite(entry.diminishing) ? entry.diminishing : 0.6;
  const minimum = Number.isFinite(entry.minimumBonus) ? entry.minimumBonus : 0.2;
  if (purchases <= 0) return 1;
  return Math.max(minimum, diminishing ** purchases);
};

const getHistoryCount = (state, tier, key) => {
  return state.organism?.evolutionHistory?.[tier]?.[key] ?? 0;
};

export const selectArchetype = (state, helpers = {}, archetypeKey) => {
  if (!state) return state;

  const normalizedKey = typeof archetypeKey === 'string' ? archetypeKey.trim() : '';
  if (!normalizedKey) {
    helpers.addNotification?.(state, 'Seleção de arquétipo inválida.');
    return state;
  }

  const entry = archetypes[normalizedKey];
  if (!entry) {
    helpers.addNotification?.(state, 'Arquétipo indisponível.');
    return state;
  }

  ensureResourceReferences(state);
  applyArchetypeToState(state, entry.key);
  state.health = state.maxHealth;
  state.energy = Math.max(0, state.energy ?? 0);
  state.archetypeSelection = {
    pending: false,
    options: Object.keys(archetypes),
  };

  if (state.organism) {
    state.organism.evolutionHistory = state.organism.evolutionHistory || {
      small: {},
      medium: {},
      large: {},
    };
  }

  helpers.addNotification?.(state, `🌱 Arquétipo selecionado: ${entry.name}`);
  helpers.syncState?.(state);
  return state;
};

const meetsRequirements = (state, requirements = {}) => {
  if (!requirements) return { met: true };
  if (
    Number.isFinite(requirements.level) &&
    (state.level ?? 0) < requirements.level
  ) {
    return { met: false, reason: `Requer nível ${requirements.level}` };
  }
  if (
    Number.isFinite(requirements.mg) &&
    (state.geneticMaterial?.current ?? 0) < requirements.mg
  ) {
    return { met: false, reason: 'MG insuficiente' };
  }
  if (requirements.fragments) {
    const missingFragment = Object.entries(requirements.fragments).find(
      ([key, amount]) => (state.geneFragments?.[key] ?? 0) < amount
    );
    if (missingFragment) {
      const [key, amount] = missingFragment;
      return { met: false, reason: `Fragmentos ${key}: ${amount}` };
    }
  }
  if (requirements.stableGenes) {
    const missingGene = Object.entries(requirements.stableGenes).find(
      ([key, amount]) => (state.stableGenes?.[key] ?? 0) < amount
    );
    if (missingGene) {
      const [key, amount] = missingGene;
      return { met: false, reason: `Genes ${key}: ${amount}` };
    }
  }
  return { met: true };
};

const describeCost = (cost = {}) => ({ ...cost });

const buildEvolutionOptions = (state, helpers = {}, tier = 'small') => {
  const pool = getEvolutionPool(helpers, tier);
  const entries = Object.entries(pool || {});
  if (entries.length === 0) return [];

  const availableEntries = entries.filter(([key, entry]) => {
    const purchases = getHistoryCount(state, tier, key);
    if (entry.unique && purchases > 0) {
      return false;
    }
    if (Number.isFinite(entry.maxPurchases) && purchases >= entry.maxPurchases) {
      return false;
    }
    return true;
  });

  const sourcePool = availableEntries.length > 0 ? availableEntries : entries;
  const keys = sourcePool.map(([key]) => key);
  const count = Math.min(3, keys.length);
  const pick =
    typeof helpers.pickRandomUnique === 'function'
      ? helpers.pickRandomUnique(keys, count) || keys.slice(0, count)
      : keys.slice(0, count);

  return pick.map((key) => {
    const entry = pool[key];
    const purchases = getHistoryCount(state, tier, key);
    const requirementCheck = meetsRequirements(state, entry?.requirements);
    const affordable = hasCost(state, entry?.cost);
    const available = requirementCheck.met && affordable;
    const reason = requirementCheck.met
      ? affordable
        ? null
        : 'Recursos insuficientes'
      : requirementCheck.reason;

    return {
      key,
      tier,
      name: entry?.name ?? key,
      icon: entry?.icon ?? '🧬',
      color: entry?.color ?? '#00D9FF',
      cost: describeCost(entry?.cost),
      requirements: entry?.requirements || {},
      purchases,
      available,
      reason,
      unique: Boolean(entry?.unique),
      nextBonusMultiplier: computeNextMultiplier(entry, purchases),
      macro: Boolean(entry?.macro),
      macroRewardPc: entry?.macroProfile?.rewardPc ?? 0,
      affinityOptions: entry?.macroProfile?.affinityOptions || [],
      subforms: entry?.macroProfile?.subforms || [],
    };
  });
};

const getEvolutionEntry = (helpers = {}, tier = 'small', key) => {
  const pool = getEvolutionPool(helpers, tier);
  return pool?.[key];
};

const registerEvolutionPurchase = (state, tier, key) => {
  if (!state.organism) return;
  state.organism.evolutionHistory = state.organism.evolutionHistory || {
    small: {},
    medium: {},
    large: {},
  };
  const bucket = state.organism.evolutionHistory[tier] || {};
  bucket[key] = (bucket[key] ?? 0) + 1;
  state.organism.evolutionHistory[tier] = bucket;
};

const incrementSlotUsage = (state, tier) => {
  if (!state.evolutionSlots) return;
  if (tier === 'small') {
    state.evolutionSlots.small.used = Math.min(
      (state.evolutionSlots.small.used ?? 0) + 1,
      state.evolutionSlots.small.max ?? Infinity
    );
  } else if (tier === 'medium') {
    state.evolutionSlots.medium.used = Math.min(
      (state.evolutionSlots.medium.used ?? 0) + 1,
      state.evolutionSlots.medium.max ?? Infinity
    );
  } else if (tier === 'large') {
    state.evolutionSlots.large.used = Math.min(
      (state.evolutionSlots.large.used ?? 0) + 1,
      state.evolutionSlots.large.max ?? Infinity
    );
  }
};

export const checkEvolution = (state, helpers = {}) => {
  if (!state) return state;
  ensureResourceReferences(state);

  const xpState = state.xp || { current: 0, next: 120, total: 0, level: state.level };
  xpState.next = xpState.next ?? getXpRequirementForLevel(xpState, state.level);

  let threshold = xpState.next;
  let leveledUp = false;

  while (xpState.current >= threshold) {
    xpState.current -= threshold;
    xpState.total = (xpState.total ?? 0) + threshold;
    state.level += 1;
    xpState.level = state.level;
    threshold = getXpRequirementForLevel(xpState, state.level);
    xpState.next = threshold;
    recalcPointsAndSlots(state);

    if (state.level % LARGE_SLOT_INTERVAL === 0) {
      pushTier(state, 'large');
    } else if (state.level % MEDIUM_SLOT_INTERVAL === 0) {
      pushTier(state, 'medium');
    } else {
      pushTier(state, 'small');
    }

    leveledUp = true;
  }

  if (!leveledUp && ensureQueue(state).length === 0) {
    const fallback = determineFallbackTier(state);
    if (fallback) {
      pushTier(state, fallback);
    }
  }

  state.canEvolve = ensureQueue(state).length > 0;

  if (leveledUp) {
    state.reroll.cost = state.reroll.baseCost ?? BASE_REROLL_COST;
    state.reroll.count = 0;
    helpers.addNotification?.(state, `⬆️ Nível ${state.level}`);
  }

  helpers.syncState?.(state);
  return state;
};

export const openEvolutionMenu = (state, helpers = {}) => {
  if (!state) return state;
  ensureResourceReferences(state);
  recalcPointsAndSlots(state);

  const queue = ensureQueue(state);
  if (queue.length === 0) {
    const fallback = determineFallbackTier(state);
    if (fallback) {
      queue.push(fallback);
    }
  }

  if (queue.length === 0) {
    state.canEvolve = false;
    return state;
  }

  const tier = queue.shift();
  const options = {
    small: buildEvolutionOptions(state, helpers, 'small'),
    medium: buildEvolutionOptions(state, helpers, 'medium'),
    large: buildEvolutionOptions(state, helpers, 'large'),
  };
  const activeOptions = options[tier] || [];

  if (activeOptions.length === 0) {
    helpers.addNotification?.(state, 'Nenhuma evolução disponível no momento.');
    state.canEvolve = false;
    return state;
  }

  state.evolutionContext = { tier };
  state.evolutionType = 'evolution';
  state.showEvolutionChoice = true;
  state.canEvolve = false;
  state.evolutionMenu = {
    activeTier: tier,
    options,
  };
  state.currentForm = state.organism?.form ?? null;

  state.uiSyncTimer = 0;
  helpers.playSound?.('skill');
  helpers.syncState?.(state);
  return state;
};

export const chooseEvolution = (state, helpers = {}, evolutionKey, forcedTier) => {
  if (!state) return state;
  ensureResourceReferences(state);

  const tier = forcedTier || state.evolutionContext?.tier || state.evolutionMenu?.activeTier;
  if (!tier) return state;

  const entry = getEvolutionEntry(helpers, tier, evolutionKey);
  if (!entry) return state;

  const purchases = getHistoryCount(state, tier, evolutionKey);
  if (entry.unique && purchases > 0) {
    helpers.addNotification?.(state, 'Evolução já adquirida.');
    return state;
  }

  if (Number.isFinite(entry.maxPurchases) && purchases >= entry.maxPurchases) {
    helpers.addNotification?.(state, 'Limite de evolução atingido.');
    return state;
  }

  const requirementCheck = meetsRequirements(state, entry.requirements);
  if (!requirementCheck.met) {
    helpers.addNotification?.(state, requirementCheck.reason || 'Requisitos não atendidos.');
    return state;
  }

  if (!hasCost(state, entry.cost)) {
    helpers.addNotification?.(state, 'Recursos insuficientes.');
    return state;
  }

  applyCost(state, entry.cost);

  const multiplier = computeNextMultiplier(entry, purchases);
  entry.effect?.(state, {
    entry,
    previousPurchases: purchases,
    multiplier,
    helpers,
  });

  registerEvolutionPurchase(state, tier, evolutionKey);
  incrementSlotUsage(state, tier);

  if (entry.macro) {
    state.macroEvolutionSlots = state.macroEvolutionSlots || { used: 0, max: 0 };
    state.macroEvolutionSlots.used = Math.min(
      (state.macroEvolutionSlots.used ?? 0) + 1,
      state.macroEvolutionSlots.max ?? Infinity
    );

    if (!Array.isArray(state.organism?.macroEvolutions)) {
      state.organism.macroEvolutions = [];
    }
    if (!state.organism.macroEvolutions.includes(evolutionKey)) {
      state.organism.macroEvolutions.push(evolutionKey);
    }

    const rewardPc = entry.macroProfile?.rewardPc;
    if (Number.isFinite(rewardPc) && state.characteristicPoints) {
      state.characteristicPoints.total = (state.characteristicPoints.total ?? 0) + rewardPc;
      state.characteristicPoints.available =
        (state.characteristicPoints.available ?? 0) + rewardPc;
    }
  }

  state.showEvolutionChoice = false;
  state.evolutionContext = null;
  state.evolutionMenu = {
    activeTier: tier,
    options: { small: [], medium: [], large: [] },
  };
  state.currentForm = state.organism?.form ?? null;
  state.reroll.cost = state.reroll.baseCost ?? BASE_REROLL_COST;
  state.reroll.count = 0;
  state.uiSyncTimer = 0;

  const queue = ensureQueue(state);
  state.canEvolve = queue.length > 0;

  helpers.addNotification?.(state, `✨ ${entry.name}`);
  helpers.syncState?.(state);
  return state;
};

export const chooseTrait = (state, helpers = {}, key) => chooseEvolution(state, helpers, key);
export const chooseForm = (state, helpers = {}, key) => chooseEvolution(state, helpers, key, 'large');

export const requestEvolutionReroll = (state, helpers = {}) => {
  if (!state || !state.showEvolutionChoice) return state;
  ensureResourceReferences(state);

  const rerollState = state.reroll || {
    baseCost: BASE_REROLL_COST,
    cost: BASE_REROLL_COST,
    count: 0,
    pity: 0,
  };

  const currentCost = Math.floor(rerollState.cost ?? rerollState.baseCost ?? BASE_REROLL_COST);
  if ((state.geneticMaterial?.current ?? 0) < currentCost) {
    helpers.addNotification?.(state, 'MG insuficiente para rerrolar.');
    return state;
  }

  state.geneticMaterial.current -= currentCost;
  rerollState.count += 1;
  rerollState.cost = Math.ceil(currentCost * REROLL_GROWTH_FACTOR);
  rerollState.pity += 1;
  state.reroll = rerollState;

  const tier = state.evolutionMenu?.activeTier || state.evolutionContext?.tier || 'small';
  const updatedOptions = buildEvolutionOptions(state, helpers, tier);
  const previous = state.evolutionMenu?.options || { small: [], medium: [], large: [] };
  state.evolutionMenu = {
    activeTier: tier,
    options: { ...previous, [tier]: updatedOptions },
  };

  state.uiSyncTimer = 0;
  helpers.playSound?.('reroll');
  helpers.syncState?.(state);
  return state;
};

export const restartGame = (state, helpers = {}) => {
  if (!state) return state;

  const {
    resetControls,
    spawnObstacle,
    spawnNebula,
    spawnPowerUp,
    spawnOrganicMatter,
    syncState,
    createInitialState: overrideCreateInitialState,
  } = helpers;

  const factory = overrideCreateInitialState || createInitialState;
  const baseState = factory?.({ archetypeKey: state.selectedArchetype });
  if (!baseState) return state;

  Object.assign(state, {
    energy: baseState.energy,
    health: baseState.health,
    maxHealth: baseState.maxHealth,
    level: 1,
    score: 0,
    canEvolve: false,
    showEvolutionChoice: false,
    archetypeSelection: baseState.archetypeSelection,
    selectedArchetype: baseState.selectedArchetype,
    gameOver: false,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    boss: null,
    bossPending: false,
    nextBossLevel: 3,
    fogIntensity: 0,
    uiSyncTimer: 0,
    activePowerUps: [],
    powerUps: [],
    evolutionMenu: {
      activeTier: 'small',
      options: {
        small: [],
        medium: [],
        large: [],
      },
    },
    currentForm: baseState.organism?.form ?? null,
    organicMatter: [],
    enemies: [],
    projectiles: [],
    effects: [],
    particles: [],
    nebulas: [],
    notifications: [],
    lastEventTime: 0,
    gameTime: 0,
    resources: baseState.resources,
    xp: baseState.xp,
    characteristicPoints: baseState.characteristicPoints,
    geneticMaterial: baseState.geneticMaterial,
    geneFragments: baseState.geneFragments,
    stableGenes: baseState.stableGenes,
    evolutionSlots: baseState.evolutionSlots,
    macroEvolutionSlots: baseState.macroEvolutionSlots,
    reroll: baseState.reroll,
    dropPity: baseState.dropPity,
    progressionQueue: [],
    recentRewards: baseState.recentRewards,
    evolutionContext: null,
    traitLineage: baseState.traitLineage,
  });

  state.organism = { ...baseState.organism };

  resetControls?.();
  spawnObstacle?.(state);
  spawnNebula?.(state);
  spawnPowerUp?.(state);
  spawnOrganicMatter?.(state);
  syncState?.(state);
  return state;
};
