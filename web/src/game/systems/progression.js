import { applyArchetypeToState, archetypes } from '../config/archetypes';
import { createInitialState } from '../state/initialState';
import { smallEvolutions as defaultSmallEvolutions } from '../config/smallEvolutions';
import { mediumEvolutions as defaultMediumEvolutions } from '../config/mediumEvolutions';
import { majorEvolutions as defaultMajorEvolutions } from '../config/majorEvolutions';
import { calculateDiminishingMultiplier } from '@micr-omega/shared';

// Evolution lock para prevenir dupla evolução
let evolutionInProgress = false;
let evolutionSequence = 0;

// Cache de opções de evolução para otimização de performance
const evolutionOptionsCache = new Map();
const MAX_CACHE_SIZE = 20;

const BASE_REROLL_COST = 25;
const REROLL_GROWTH_FACTOR = 1.6;
const MEDIUM_SLOT_INTERVAL = 2;
const LARGE_SLOT_INTERVAL = 5;
const SMALL_EVOLUTION_POINT_COST = 1;

const sanitizeThresholds = (thresholds) => {
  if (!Array.isArray(thresholds)) return [];

  let previous = 0;
  return thresholds.map((value, index) => {
    const fallback = index === 0 ? 0 : previous;
    const normalized = Number.isFinite(value) ? value : fallback;
    const sanitized = Math.max(fallback, normalized);
    previous = sanitized;
    return sanitized;
  });
};

const getXpRequirementForLevel = (xpState = {}, level = 1) => {
  const thresholds = sanitizeThresholds(xpState.thresholds);
  if (thresholds.length > 0) {
    xpState.thresholds = thresholds;
  }
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

  const safeLevel = Number.isFinite(state.level) ? state.level : 1;
  state.level = safeLevel;
  if (!Number.isFinite(state.confirmedLevel)) {
    state.confirmedLevel = safeLevel;
  }
  if (!Number.isFinite(state.pendingEvolutionLevel)) {
    state.pendingEvolutionLevel = null;
  }
  if (!Number.isFinite(state.lastLevelToast)) {
    state.lastLevelToast = state.confirmedLevel;
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

const hasAvailableSlots = (slot = {}) => {
  const used = Number.isFinite(slot.used) ? slot.used : 0;
  const max = Number.isFinite(slot.max) ? slot.max : 0;
  return used < max;
};

const determineFallbackTier = (state) => {
  if (hasAvailableSlots(state.evolutionSlots?.large)) {
    return 'large';
  }
  if (hasAvailableSlots(state.evolutionSlots?.medium)) {
    return 'medium';
  }
  if (hasAvailableSlots(state.evolutionSlots?.small)) {
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

const computeNextMultiplier = (entry = {}, purchases = 0, tier = 'small') => {
  const customRate = Number.isFinite(entry.diminishing) ? entry.diminishing : undefined;
  const customMin = Number.isFinite(entry.minimumBonus) ? entry.minimumBonus : undefined;
  return calculateDiminishingMultiplier(purchases, tier, customRate, customMin);
};

const getHistoryCount = (state, tier, key) => {
  return state.organism?.evolutionHistory?.[tier]?.[key] ?? 0;
};

/**
 * Gera uma chave de cache baseada nos estados que afetam as opções de evolução.
 * Captura: tier, level, recursos disponíveis, slots e histórico de evoluções.
 */
const getCacheKey = (state, tier) => {
  if (!state) return `${tier}-null`;

  const level = state.level ?? 0;
  const pcAvailable = state.characteristicPoints?.available ?? 0;
  const mgCurrent = state.geneticMaterial?.current ?? 0;

  // Serializar fragments e stable genes de forma compacta
  const fragments = JSON.stringify(state.geneFragments || {});
  const stableGenes = JSON.stringify(state.stableGenes || {});

  // Slots para o tier específico
  const slot = state.evolutionSlots?.[tier];
  const slotUsed = slot?.used ?? 0;
  const slotMax = slot?.max ?? 0;

  // Macro slots se relevante
  const macroUsed = state.macroEvolutionSlots?.used ?? 0;
  const macroMax = state.macroEvolutionSlots?.max ?? 0;

  // Histórico de evolução para verificar unique/maxPurchases
  const history = JSON.stringify(state.organism?.evolutionHistory?.[tier] || {});

  return `${tier}|L${level}|PC${pcAvailable}|MG${mgCurrent}|S${slotUsed}/${slotMax}|M${macroUsed}/${macroMax}|F${fragments}|G${stableGenes}|H${history}`;
};

/**
 * Invalida todo o cache de opções de evolução.
 * Deve ser chamado quando há mudanças significativas no estado do jogo.
 */
export const invalidateEvolutionCache = () => {
  evolutionOptionsCache.clear();
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

  // Invalidar cache ao mudar arquétipo
  invalidateEvolutionCache();

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

const clampRandom = (value) => {
  const number = Number.isFinite(value) ? value : 0;
  if (number <= 0) return 0;
  if (number >= 1) return 0.999999999;
  return number;
};

const pickRandomUniqueKeys = (keys = [], count = 0, randomFn = Math.random) => {
  if (!Array.isArray(keys) || keys.length === 0 || count <= 0) {
    return [];
  }

  const pool = [...keys];
  const result = [];
  const picks = Math.min(count, pool.length);
  const generator = typeof randomFn === 'function' ? randomFn : Math.random;

  for (let i = 0; i < picks; i += 1) {
    const remaining = pool.length - i;
    const randomValue = clampRandom(generator());
    const offset = Math.floor(randomValue * remaining);
    const index = i + offset;

    const swap = pool[index];
    pool[index] = pool[i];
    pool[i] = swap;

    result.push(pool[i]);
  }

  return result;
};

/**
 * Builds the evolution options for the requested tier.
 * When no deterministic picker is provided via `helpers.pickRandomUnique`,
 * the selection uses the optional `helpers.random` function (falling back to
 * `Math.random`) to shuffle available evolutions.
 *
 * PERFORMANCE: Usa memoization para cachear opções já calculadas.
 */
const buildEvolutionOptions = (state, helpers = {}, tier = 'small') => {
  // Verificar cache primeiro
  const cacheKey = getCacheKey(state, tier);

  if (evolutionOptionsCache.has(cacheKey)) {
    return evolutionOptionsCache.get(cacheKey);
  }

  // Cache miss - calcular opções
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
      ? helpers.pickRandomUnique(keys, count) || pickRandomUniqueKeys(keys, count, helpers.random)
      : pickRandomUniqueKeys(keys, count, helpers.random);

  const options = pick.map((key) => {
    const entry = pool[key];
    const purchases = getHistoryCount(state, tier, key);
    const requirementCheck = meetsRequirements(state, entry?.requirements);
    const affordable = hasCost(state, entry?.cost);
    const slotState = entry?.macro
      ? state.macroEvolutionSlots
      : state.evolutionSlots?.[tier];
    const maxSlots = Number.isFinite(slotState?.max)
      ? slotState.max
      : entry?.macro
        ? 0
        : Infinity;
    const usedSlots = Number.isFinite(slotState?.used) ? slotState.used : 0;
    const slotsAvailable = usedSlots < maxSlots;
    const slotReason = entry?.macro
      ? 'Sem espaços macro disponíveis'
      : 'Sem espaços de evolução disponíveis';

    let available = true;
    let reason = null;

    if (!slotsAvailable) {
      available = false;
      reason = slotReason;
    } else if (!requirementCheck.met) {
      available = false;
      reason = requirementCheck.reason;
    } else if (!affordable) {
      available = false;
      reason = 'Recursos insuficientes';
    }

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
      nextBonusMultiplier: computeNextMultiplier(entry, purchases, tier),
      macro: Boolean(entry?.macro),
      macroRewardPc: entry?.macroProfile?.rewardPc ?? 0,
      affinityOptions: entry?.macroProfile?.affinityOptions || [],
      subforms: entry?.macroProfile?.subforms || [],
    };
  });

  // Limitar tamanho do cache (LRU simples - remove o mais antigo)
  if (evolutionOptionsCache.size >= MAX_CACHE_SIZE) {
    const firstKey = evolutionOptionsCache.keys().next().value;
    evolutionOptionsCache.delete(firstKey);
  }

  // Armazenar no cache
  evolutionOptionsCache.set(cacheKey, options);

  return options;
};

/**
 * Verifica se o jogador pode evoluir, considerando não apenas a fila,
 * mas também se há pelo menos uma evolução disponível em algum tier.
 */
const computeCanEvolve = (state, helpers = {}) => {
  // Verificar se há tiers na fila
  const queue = ensureQueue(state);
  if (queue.length === 0) {
    return false;
  }

  // Verificar se há pelo menos uma opção disponível em algum tier
  const tiers = ['small', 'medium', 'large', 'macro'];
  for (const tier of tiers) {
    const options = buildEvolutionOptions(state, helpers, tier);
    const hasAvailableOption = options.some((option) => option.available);
    if (hasAvailableOption) {
      return true;
    }
  }

  return false;
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
  const safeLevel = Number.isFinite(state.level) ? state.level : 1;

  const safeCurrent = Number.isFinite(xpState.current) ? xpState.current : 0;
  const safeTotal = Number.isFinite(xpState.total) ? xpState.total : 0;

  xpState.current = Math.max(0, safeCurrent);
  xpState.total = Math.max(0, safeTotal);
  xpState.level = Number.isFinite(xpState.level) ? xpState.level : safeLevel;
  state.xp = xpState;

  const normalizedThreshold = (() => {
    const requirement = getXpRequirementForLevel(xpState, safeLevel);
    if (Number.isFinite(xpState.next) && xpState.next > 0) {
      return xpState.next;
    }
    return requirement;
  })();

  if (!Number.isFinite(normalizedThreshold) || normalizedThreshold <= 0) {
    xpState.next = 1;
    state.xp = xpState;
    helpers.syncState?.(state);
    return state;
  }

  xpState.next = Math.max(1, normalizedThreshold);

  let threshold = xpState.next;
  let leveledUp = false;

  while (xpState.current >= threshold) {
    xpState.current -= threshold;
    xpState.total = (xpState.total ?? 0) + threshold;
    state.level += 1;
    xpState.level = state.level;
    threshold = getXpRequirementForLevel(xpState, state.level);

    if (!Number.isFinite(threshold) || threshold <= 0) {
      xpState.next = 1;
      break;
    }

    threshold = Math.max(1, threshold);
    xpState.next = threshold;
    recalcPointsAndSlots(state);

    if (!Number.isFinite(state.pendingEvolutionLevel) || state.pendingEvolutionLevel < state.level) {
      state.pendingEvolutionLevel = state.level;
    }

    if (!Number.isFinite(state.lastLevelToast) && Number.isFinite(state.confirmedLevel)) {
      state.lastLevelToast = state.confirmedLevel;
    }

    if (Number.isFinite(state.lastLevelToast) && state.level > state.lastLevelToast) {
      helpers.addNotification?.(state, `⬆️ Nível ${state.level}`);
      state.lastLevelToast = state.level;
    } else if (!Number.isFinite(state.lastLevelToast)) {
      state.lastLevelToast = state.level;
      helpers.addNotification?.(state, `⬆️ Nível ${state.level}`);
    }

    if (state.level % LARGE_SLOT_INTERVAL === 0) {
      pushTier(state, 'large');
    } else if (state.level % MEDIUM_SLOT_INTERVAL === 0) {
      pushTier(state, 'medium');
    } else {
      pushTier(state, 'small');
    }

    leveledUp = true;
  }

  if (!leveledUp) {
    const targetLevel = Number.isFinite(state.level)
      ? state.level
      : Number.isFinite(state.confirmedLevel)
        ? state.confirmedLevel
        : null;

    if (targetLevel !== null) {
      const baselineToast = Number.isFinite(state.lastLevelToast)
        ? state.lastLevelToast
        : Number.isFinite(state.confirmedLevel)
          ? state.confirmedLevel
          : targetLevel - 1;

      if (!Number.isFinite(state.lastLevelToast)) {
        state.lastLevelToast = baselineToast;
      }

      if (targetLevel > baselineToast) {
        helpers.addNotification?.(state, `⬆️ Nível ${targetLevel}`);
        state.lastLevelToast = targetLevel;
      }
    }
  }

  if (!leveledUp && ensureQueue(state).length === 0) {
    const fallback = determineFallbackTier(state);
    if (fallback) {
      pushTier(state, fallback);
    }
  }

  state.canEvolve = computeCanEvolve(state, helpers);

  if (leveledUp) {
    state.reroll.cost = state.reroll.baseCost ?? BASE_REROLL_COST;
    state.reroll.count = 0;

    // Invalidar cache após level up (mudança de slots e pontos)
    invalidateEvolutionCache();
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

  const originalTier = queue.shift();
  let tier = originalTier;
  const options = {
    small: buildEvolutionOptions(state, helpers, 'small'),
    medium: buildEvolutionOptions(state, helpers, 'medium'),
    large: buildEvolutionOptions(state, helpers, 'large'),
  };
  let activeOptions = options[tier] || [];

  let hasAvailableOption = activeOptions.some((option) => option?.available);
  const isSmallTier = () => tier === 'small';
  const allowUnavailableSmallOptions = () =>
    isSmallTier() && activeOptions.length > 0 && (state.characteristicPoints?.available ?? 0) < SMALL_EVOLUTION_POINT_COST;
  let canShowUnavailableSmallOptions = allowUnavailableSmallOptions();

  if (!hasAvailableOption && !canShowUnavailableSmallOptions) {
    const tierOrder = ['small', 'medium', 'large'];
    for (const candidate of tierOrder) {
      if (candidate === tier) continue;
      const candidateOptions = options[candidate] || [];
      if (candidateOptions.some((option) => option?.available)) {
        queue.unshift(originalTier);
        tier = candidate;
        activeOptions = candidateOptions;
        hasAvailableOption = true;
        canShowUnavailableSmallOptions = false;
        break;
      }
    }
  }

  if (!hasAvailableOption && !canShowUnavailableSmallOptions) {
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

const closeEvolutionMenu = (state, helpers = {}) => {
  if (!state) return;

  state.showEvolutionChoice = false;
  state.evolutionContext = null;
  state.evolutionMenu = {
    activeTier: state.evolutionMenu?.activeTier || 'small',
    options: { small: [], medium: [], large: [], macro: [] },
  };
  state.currentForm = state.organism?.form ?? null;

  helpers.syncState?.(state);
};

export const chooseEvolution = (state, helpers = {}, evolutionKey, forcedTier) => {
  if (!state) return state;

  // Proteção contra dupla evolução
  if (evolutionInProgress) {
    console.warn('[Evolution] Evolução já em progresso, ignorando');
    return state;
  }

  evolutionInProgress = true;
  evolutionSequence++;
  const currentSequence = evolutionSequence;

  // Timeout de segurança para garantir que menu fecha mesmo em erro
  const safetyTimeoutId = setTimeout(() => {
    console.error('[Evolution] Timeout de segurança atingido, fechando menu');
    closeEvolutionMenu(state, helpers);
    evolutionInProgress = false;
  }, 5000);

  try {
    ensureResourceReferences(state);

    const tier = forcedTier || state.evolutionContext?.tier || state.evolutionMenu?.activeTier;
    if (!tier) {
      throw new Error('Tier de evolução não especificado');
    }

    const entry = getEvolutionEntry(helpers, tier, evolutionKey);
    if (!entry) {
      throw new Error(`Evolução não encontrada: ${tier}/${evolutionKey}`);
    }

    if (!entry.effect || typeof entry.effect !== 'function') {
      throw new Error(`Evolução ${evolutionKey} não tem efeito válido`);
    }

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

    const multiplier = computeNextMultiplier(entry, purchases, tier);

    // Executar efeito com proteção
    try {
      entry.effect(state, {
        entry,
        previousPurchases: purchases,
        multiplier,
        helpers,
        sequenceNumber: currentSequence,
      });
    } catch (effectError) {
      console.error('[Evolution] Erro ao executar efeito de evolução:', effectError);

      // Tentar reverter custo em caso de erro
      if (entry.cost?.pc && state.characteristicPoints) {
        state.characteristicPoints.available =
          (state.characteristicPoints.available ?? 0) + entry.cost.pc;
      }
      if (entry.cost?.mg && state.geneticMaterial) {
        state.geneticMaterial.current =
          (state.geneticMaterial.current ?? 0) + entry.cost.mg;
      }

      throw effectError;
    }

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

    closeEvolutionMenu(state, helpers);

    state.reroll.cost = state.reroll.baseCost ?? BASE_REROLL_COST;
    state.reroll.count = 0;
    state.uiSyncTimer = 0;

    const queue = ensureQueue(state);
    state.canEvolve = computeCanEvolve(state, helpers);

    // Invalidar cache após aplicar evolução (mudança de histórico, slots e recursos)
    invalidateEvolutionCache();

    helpers.addNotification?.(state, `✨ ${entry.name}`);
    helpers.syncState?.(state);

    clearTimeout(safetyTimeoutId);
    return state;
  } catch (error) {
    console.error('[Evolution] Erro ao aplicar evolução:', error);

    // Garantir que menu fecha mesmo em erro
    closeEvolutionMenu(state, helpers);

    // Notificar usuário
    helpers.addNotification?.(state, 'Erro ao aplicar evolução. Tente novamente.');

    clearTimeout(safetyTimeoutId);
    return state;
  } finally {
    // Timeout de segurança para liberar lock
    setTimeout(() => {
      evolutionInProgress = false;
    }, 1000);
  }
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

  // Invalidar cache antes do reroll para gerar novas opções
  invalidateEvolutionCache();

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

export const cancelEvolutionChoice = (state, helpers = {}) => {
  if (!state || !state.showEvolutionChoice) return state;

  ensureResourceReferences(state);

  const queue = ensureQueue(state);
  const tier =
    state.evolutionContext?.tier ||
    state.evolutionMenu?.activeTier ||
    (queue.length > 0 ? queue[0] : null) ||
    'small';

  if (tier) {
    queue.unshift(tier);
  }

  state.showEvolutionChoice = false;
  state.evolutionContext = null;
  state.evolutionMenu = {
    activeTier: tier,
    options: {
      small: [],
      medium: [],
      large: [],
      macro: [],
    },
  };
  state.currentForm = state.organism?.form ?? null;
  state.canEvolve = computeCanEvolve(state, helpers);
  state.uiSyncTimer = 0;

  helpers.syncState?.(state);
  return state;
};

export const restartGame = (state, helpers = {}) => {
  if (!state) return state;

  // Invalidar cache ao reiniciar o jogo
  invalidateEvolutionCache();

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
    confirmedLevel: baseState.confirmedLevel,
    pendingEvolutionLevel: baseState.pendingEvolutionLevel,
    lastLevelToast: baseState.lastLevelToast,
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
