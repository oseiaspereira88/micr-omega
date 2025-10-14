import { createInitialState } from '../state/initialState';

const BASE_REROLL_COST = 25;
const REROLL_GROWTH_FACTOR = 1.6;
const SMALL_EVOLUTION_POINT_COST = 1;
const MEDIUM_SLOT_INTERVAL = 2;
const LARGE_SLOT_INTERVAL = 5;

const MEDIUM_EVOLUTION_COST = {
  mg: 45,
  fragments: { major: 1 },
};

const LARGE_EVOLUTION_COST = {
  mg: 120,
  stableGenes: { apex: 1 },
};

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

const buildTraitOptions = (state, helpers = {}) => {
  const { pickRandomUnique, evolutionaryTraits } = helpers;
  const traitPool = Object.keys(evolutionaryTraits || {});
  const owned = new Set(state.organism?.traits || []);
  const unused = traitPool.filter((key) => !owned.has(key));
  const sourcePool = unused.length > 0 ? unused : traitPool;
  const count = Math.min(3, sourcePool.length);
  if (count <= 0) return [];
  if (typeof pickRandomUnique === 'function') {
    return pickRandomUnique(sourcePool, count) || sourcePool.slice(0, count);
  }
  return sourcePool.slice(0, count);
};

const buildFormOptions = (state, helpers = {}) => {
  const { pickRandomUnique, forms } = helpers;
  const allForms = Object.keys(forms || {});
  const currentForm = state.organism?.form;
  const available = allForms.filter((formKey) => formKey !== currentForm);
  const pool = available.length > 0 ? available : allForms;
  const count = Math.min(3, pool.length);
  if (count <= 0) return [];
  if (typeof pickRandomUnique === 'function') {
    return pickRandomUnique(pool, count) || pool.slice(0, count);
  }
  return pool.slice(0, count);
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
  const cost =
    tier === 'large'
      ? { ...LARGE_EVOLUTION_COST }
      : tier === 'medium'
        ? { ...MEDIUM_EVOLUTION_COST }
        : { pc: SMALL_EVOLUTION_POINT_COST };

  if (!hasCost(state, cost)) {
    helpers.addNotification?.(state, 'Recursos insuficientes para evoluir.');
    queue.unshift(tier);
    state.canEvolve = false;
    return state;
  }

  state.evolutionContext = { tier, cost };
  state.evolutionType = tier === 'large' ? 'form' : 'skill';
  state.showEvolutionChoice = true;
  state.canEvolve = false;
  state.availableTraits = [];
  state.availableForms = [];

  if (state.evolutionType === 'skill') {
    state.availableTraits = buildTraitOptions(state, helpers);
    state.formReapplyNotice = false;
  } else {
    state.availableForms = buildFormOptions(state, helpers);
    state.formReapplyNotice = (state.availableForms || []).every((form) => form === state.organism?.form);
  }

  state.uiSyncTimer = 0;
  helpers.playSound?.('skill');
  helpers.syncState?.(state);
  return state;
};

export const chooseTrait = (state, helpers = {}, traitKey) => {
  if (!state) return state;
  ensureResourceReferences(state);

  const { evolutionaryTraits, addNotification, syncState } = helpers;
  const tier = state.evolutionContext?.tier ?? 'small';
  const cost = state.evolutionContext?.cost ?? (tier === 'medium' ? MEDIUM_EVOLUTION_COST : { pc: SMALL_EVOLUTION_POINT_COST });
  const trait = evolutionaryTraits?.[traitKey];

  if (!trait || state.organism?.traits?.includes(traitKey)) {
    return state;
  }

  if (!hasCost(state, cost)) {
    addNotification?.(state, 'Recursos insuficientes.');
    return state;
  }

  applyCost(state, cost);

  state.organism.traits = Array.isArray(state.organism.traits)
    ? [...state.organism.traits, traitKey]
    : [traitKey];
  trait.effect?.(state.organism);
  state.organism.size += 4;
  state.organism.color = trait.color;
  state.maxHealth = (state.maxHealth ?? 100) + 30;
  state.health = state.maxHealth;

  if (trait.skill && state.organism.skillCooldowns) {
    if (state.organism.skillCooldowns[trait.skill] === undefined) {
      state.organism.skillCooldowns[trait.skill] = 0;
    }
  }

  if (tier === 'small') {
    state.evolutionSlots.small.used = Math.min(
      (state.evolutionSlots.small.used ?? 0) + 1,
      state.evolutionSlots.small.max ?? Infinity
    );
  } else {
    state.evolutionSlots.medium.used = Math.min(
      (state.evolutionSlots.medium.used ?? 0) + 1,
      state.evolutionSlots.medium.max ?? Infinity
    );
  }

  state.showEvolutionChoice = false;
  state.availableTraits = [];
  state.evolutionContext = null;
  state.reroll.cost = state.reroll.baseCost ?? BASE_REROLL_COST;
  addNotification?.(state, `✨ ${trait.name}`);
  state.uiSyncTimer = 0;
  syncState?.(state);
  return state;
};

export const chooseForm = (state, helpers = {}, formKey) => {
  if (!state) return state;
  ensureResourceReferences(state);

  const { forms, addNotification, syncState } = helpers;
  const form = forms?.[formKey];
  if (!form) return state;

  const tier = state.evolutionContext?.tier ?? 'large';
  const cost = state.evolutionContext?.cost ?? LARGE_EVOLUTION_COST;
  if (!hasCost(state, cost)) {
    addNotification?.(state, 'Recursos insuficientes.');
    return state;
  }

  applyCost(state, cost);

  const currentDefenseMultiplier = Number.isFinite(state.organism?.formDefenseMultiplier)
    ? state.organism.formDefenseMultiplier
    : 1;
  const currentSpeedMultiplier = Number.isFinite(state.organism?.formSpeedMultiplier)
    ? state.organism.formSpeedMultiplier
    : 1;

  const safeDefenseMultiplier = form.defense > 0 ? form.defense : 1;
  const safeSpeedMultiplier = form.speed > 0 ? form.speed : 1;

  const baseDefense = currentDefenseMultiplier > 0
    ? state.organism.defense / currentDefenseMultiplier
    : state.organism.defense;
  const baseSpeed = currentSpeedMultiplier > 0
    ? state.organism.speed / currentSpeedMultiplier
    : state.organism.speed;

  state.organism.form = formKey;
  state.organism.formDefenseMultiplier = safeDefenseMultiplier;
  state.organism.formSpeedMultiplier = safeSpeedMultiplier;
  state.organism.defense = baseDefense * safeDefenseMultiplier;
  state.organism.speed = baseSpeed * safeSpeedMultiplier;

  state.evolutionSlots.large.used = Math.min(
    (state.evolutionSlots.large.used ?? 0) + 1,
    state.evolutionSlots.large.max ?? Infinity
  );

  state.showEvolutionChoice = false;
  state.formReapplyNotice = false;
  state.availableForms = [];
  state.evolutionContext = null;
  state.reroll.cost = state.reroll.baseCost ?? BASE_REROLL_COST;
  addNotification?.(state, `✨ Forma ${form.name}!`);
  state.uiSyncTimer = 0;
  syncState?.(state);
  return state;
};

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

  if (state.evolutionType === 'skill') {
    state.availableTraits = buildTraitOptions(state, helpers);
  } else {
    state.availableForms = buildFormOptions(state, helpers);
  }

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
  const baseState = factory?.();
  if (!baseState) return state;

  Object.assign(state, {
    energy: 0,
    health: 100,
    maxHealth: 100,
    level: 1,
    score: 0,
    canEvolve: false,
    showEvolutionChoice: false,
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
    availableTraits: [],
    availableForms: [],
    formReapplyNotice: false,
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
    reroll: baseState.reroll,
    dropPity: baseState.dropPity,
    progressionQueue: [],
    recentRewards: baseState.recentRewards,
    evolutionContext: null,
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
