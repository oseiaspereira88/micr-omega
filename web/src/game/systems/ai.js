import {
  AFFINITY_TYPES,
  ELEMENT_TYPES,
  clampDamageMultiplier,
  getElementalRpsMultiplier,
  resolveAffinityBonus,
  resolveResistanceMultiplier,
} from '../../shared/combat';
import {
  HOSTILITY_MATRIX,
  getHostilityWeight,
  getTemperamentProfile,
} from '../config/ecosystem';

const DEFAULT_DECAY_PER_SECOND = 4;
const DEFAULT_SENSE_RANGE = 600;
const DEFAULT_PROXIMITY_WEIGHT = 320;
const MIN_THREAT_VALUE = 0.001;
const DEFAULT_MUTATION_LIMITS = { minor: 2, medium: 1 };
const DEFAULT_XP_THRESHOLDS = { minor: 60, medium: 140 };
const DEFAULT_XP_REWARD = { minion: 22, elite: 48, boss: 120 };
const DEFAULT_MUTATION_ODDS = { minor: 0.6, medium: 0.35 };

const clone = (value) => {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
};

const distanceBetween = (a = {}, b = {}) => {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
};

const normalizeNumber = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const ensureHealth = (entity = {}) => {
  const current = normalizeNumber(entity.health?.current ?? entity.currentHealth ?? entity.health, 0);
  const max = normalizeNumber(entity.health?.max ?? entity.maxHealth ?? current, Math.max(current, 1));
  return { current: clamp(current, 0, max), max: Math.max(1, max) };
};

const ensureVector = (vector = {}, fallback = 0) => ({
  x: normalizeNumber(vector.x, fallback),
  y: normalizeNumber(vector.y, fallback),
});

const resolveHostility = (matrix, sourceSpecies, targetSpecies) => {
  if (!sourceSpecies || !targetSpecies) return 0;
  const source = String(sourceSpecies).toLowerCase();
  const target = String(targetSpecies).toLowerCase();
  if (matrix && matrix[source] && Number.isFinite(matrix[source][target])) {
    return matrix[source][target];
  }
  return getHostilityWeight(sourceSpecies, targetSpecies);
};

const serializeEntries = (map) => {
  const result = {};
  Array.from(map.entries()).forEach(([key, value]) => {
    if (value > MIN_THREAT_VALUE) {
      result[key] = value;
    }
  });
  return result;
};

const scaleDropRange = (range = {}, multiplier = 1) => {
  const min = Math.round(Math.max(0, (range.min ?? 0) * multiplier));
  const max = Math.round(Math.max(min, (range.max ?? range.min ?? min) * multiplier));
  return { ...range, min, max };
};

const pickMutationColor = (enemy, type) => {
  if (type === 'medium') {
    return enemy.outerColor || enemy.glowColor || '#c75643';
  }
  return enemy.coreColor || enemy.color || '#f2a516';
};

const ensureArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export class ThreatManager {
  constructor({ decayPerSecond = DEFAULT_DECAY_PER_SECOND, now = 0, state } = {}) {
    this.decayPerSecond = Math.max(0, decayPerSecond);
    this.entries = new Map();
    this.lastTimestamp = Number.isFinite(state?.timestamp) ? state.timestamp : now;
    if (state?.entries && typeof state.entries === 'object') {
      Object.entries(state.entries).forEach(([key, value]) => {
        const numeric = normalizeNumber(value, 0);
        if (numeric > 0) {
          this.entries.set(key, numeric);
        }
      });
    }
  }

  decay(delta) {
    const elapsed = Math.max(0, delta);
    if (elapsed <= 0 || this.entries.size === 0 || this.decayPerSecond <= 0) return;
    const decayAmount = this.decayPerSecond * elapsed;
    Array.from(this.entries.keys()).forEach((key) => {
      const next = Math.max(0, (this.entries.get(key) ?? 0) - decayAmount);
      if (next <= MIN_THREAT_VALUE) {
        this.entries.delete(key);
      } else {
        this.entries.set(key, next);
      }
    });
  }

  addThreat(targetId, amount = 0, { weight = 1 } = {}) {
    if (!targetId) return;
    const numeric = Math.max(0, normalizeNumber(amount, 0));
    if (numeric <= 0) return;
    const existing = this.entries.get(targetId) ?? 0;
    const next = existing + numeric * Math.max(0.1, weight);
    this.entries.set(targetId, next);
  }

  applyControl(targetId, potency = 0, duration = 0.5) {
    const controlThreat = Math.max(0, potency) * Math.max(0.1, duration);
    this.addThreat(targetId, controlThreat, { weight: 1.1 });
  }

  getThreat(targetId) {
    return this.entries.get(targetId) ?? 0;
  }

  scoreCandidate(candidate, context = {}) {
    if (!candidate) return 0;
    const baseThreat = this.getThreat(candidate.id);
    if (baseThreat <= MIN_THREAT_VALUE) return 0;

    const attackerElement = context.element ?? ELEMENT_TYPES.BIO;
    const { multiplier, relation } = getElementalRpsMultiplier(attackerElement, candidate.element);
    const advantageFactor = relation === 'advantage' ? 1.25 : relation === 'disadvantage' ? 0.75 : 1;
    const hostility = Math.max(
      0.1,
      typeof context.resolveHostility === 'function'
        ? context.resolveHostility(candidate)
        : context.hostility ?? 0.1
    );
    const distance = distanceBetween(context.position, candidate.position);
    const range = Math.max(80, context.preferredRange ?? DEFAULT_PROXIMITY_WEIGHT);
    const proximityFactor = 1 + Math.max(0, (range - distance) / range);
    const aggression = clamp(context.aggression ?? 0.5, 0.1, 1.5);

    return baseThreat * advantageFactor * proximityFactor * hostility * aggression;
  }

  selectTarget(candidates = [], context = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { targetId: null, threat: 0 };
    }

    let best = null;
    let bestScore = MIN_THREAT_VALUE;

    candidates.forEach((candidate) => {
      if (!candidate || candidate.health?.current <= 0) return;
      const score = this.scoreCandidate(candidate, context);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    });

    return {
      targetId: best?.id ?? null,
      threat: bestScore,
      candidate: best,
    };
  }

  serialize(now = Date.now()) {
    return {
      timestamp: now,
      entries: serializeEntries(this.entries),
    };
  }
}

const ensureThreatManager = (existing, options) => {
  if (existing instanceof ThreatManager) return existing;
  return new ThreatManager(options);
};

const ensureEvolutionXp = (enemy = {}) => {
  const thresholds = {
    minor: normalizeNumber(enemy.evolutionXp?.thresholds?.minor, DEFAULT_XP_THRESHOLDS.minor),
    medium: normalizeNumber(enemy.evolutionXp?.thresholds?.medium, DEFAULT_XP_THRESHOLDS.medium),
  };
  const rolls = {
    minor: normalizeNumber(enemy.evolutionXp?.rolls?.minor, 0),
    medium: normalizeNumber(enemy.evolutionXp?.rolls?.medium, 0),
  };
  const state = {
    current: normalizeNumber(enemy.evolutionXp?.current, 0),
    thresholds,
    rolls,
  };
  enemy.evolutionXp = state;
  return state;
};

const resolveMutationLimits = (enemy = {}, biome = 'default') => {
  const base = enemy.mutationLimits ?? DEFAULT_MUTATION_LIMITS;
  const biomeLimits = enemy.mutationLimitsByBiome?.[biome] ?? enemy.mutationLimitsByBiome?.default;
  const effective = biomeLimits ? { ...base, ...biomeLimits } : base;
  return {
    minor: normalizeNumber(effective?.minor, DEFAULT_MUTATION_LIMITS.minor),
    medium: normalizeNumber(effective?.medium, DEFAULT_MUTATION_LIMITS.medium),
  };
};

const computeDropMultiplier = (enemy = {}) => {
  const evolution = Math.max(0, (enemy.evolutionLevel ?? 1) - 1);
  const mutationBonus = (Array.isArray(enemy.mutationHistory) ? enemy.mutationHistory.length : 0) * 0.12;
  return Math.max(1, 1 + evolution * 0.35 + mutationBonus);
};

const scaleDropProfile = (enemy = {}) => {
  const profile = enemy.baseDropProfile ? clone(enemy.baseDropProfile) : clone(enemy.dropProfile);
  if (!profile) return null;
  const multiplier = computeDropMultiplier(enemy);
  const scaled = {
    ...profile,
    geneticMaterial: scaleDropRange(profile.geneticMaterial, multiplier),
    fragment: profile.fragment
      ? {
          ...profile.fragment,
          min: Math.max(0, Math.round((profile.fragment.min ?? 0) * (1 + (multiplier - 1) * 0.8))),
          max: Math.max(0, Math.round((profile.fragment.max ?? profile.fragment.min ?? 0) * (1 + (multiplier - 1) * 0.8))),
        }
      : undefined,
  };
  if (profile.stableGene?.amount) {
    scaled.stableGene = {
      ...profile.stableGene,
      amount: Math.max(0, Math.round(profile.stableGene.amount * (1 + (multiplier - 1) * 0.6))),
    };
  }
  return scaled;
};

const rollDropAmount = (rng, min, max) => {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const roll = typeof rng === 'function' ? rng() : Math.random();
  return Math.round(lower + (upper - lower) * clamp(roll, 0, 1));
};

const resolveNpcDrops = (enemy = {}, rng, dropTables = {}) => {
  const profile = enemy.dropProfile || dropTables[enemy.dropTier] || dropTables.minion;
  if (!profile) return null;
  const multiplier = computeDropMultiplier(enemy);
  const geneticMaterial = profile.geneticMaterial
    ? rollDropAmount(rng, profile.geneticMaterial.min ?? 0, profile.geneticMaterial.max ?? 0) * multiplier
    : 0;
  const fragmentAmount = profile.fragment
    ? rollDropAmount(rng, profile.fragment.min ?? 0, profile.fragment.max ?? 0) * (profile.fragment?.chance ?? 0)
    : 0;
  const stableGenes = profile.stableGene
    ? Math.round((profile.stableGene.amount ?? 0) * (profile.stableGene.chance ?? 0)) * (multiplier >= 1.4 ? 2 : 1)
    : 0;
  const loot = {
    geneticMaterial: Math.round(geneticMaterial),
    fragments: Math.round(fragmentAmount),
    stableGenes: Math.round(stableGenes),
  };
  if (!loot.geneticMaterial && !loot.fragments && !loot.stableGenes) {
    return null;
  }
  return { items: loot };
};

const computeBaseDamage = (attacker = {}, target = {}) => {
  const attack = Math.max(1, normalizeNumber(attacker.attack ?? attacker.attributes?.damage, 1));
  const defense = Math.max(0, normalizeNumber(target.defense ?? target.attributes?.resilience, 0));
  const penetration = Math.max(0, normalizeNumber(attacker.penetration, 0));
  const mitigated = Math.max(0, defense - penetration);
  return Math.max(1, attack - mitigated * 0.6);
};

const computeDamageAgainstTarget = (attacker = {}, target = {}) => {
  const base = computeBaseDamage(attacker, target);
  const attackElement = attacker.attackElement ?? attacker.element ?? ELEMENT_TYPES.BIO;
  const targetElement = target.element ?? ELEMENT_TYPES.BIO;
  const { multiplier, relation } = getElementalRpsMultiplier(attackElement, targetElement);
  const affinity = attacker.affinity ?? AFFINITY_TYPES.NEUTRAL;
  const affinityBonus = resolveAffinityBonus({
    attackerElement: attacker.element ?? attackElement,
    attackElement,
    affinity,
    relation,
  });
  const resistanceMultiplier = resolveResistanceMultiplier(target.resistances ?? {}, attackElement);
  const totalMultiplier = clampDamageMultiplier(multiplier * resistanceMultiplier * (1 + affinityBonus));
  return {
    damage: Math.max(1, Math.round(base * totalMultiplier)),
    relation,
  };
};

const awardEvolutionXp = (attacker, victim, { rng, now, biome, events }) => {
  if (!attacker) return;
  const xp = ensureEvolutionXp(attacker);
  const rewardKey = victim.dropTier && DEFAULT_XP_REWARD[victim.dropTier] ? victim.dropTier : 'minion';
  const reward = Math.max(6, DEFAULT_XP_REWARD[rewardKey] ?? DEFAULT_XP_REWARD.minion);
  xp.current += reward;
  if (Array.isArray(events)) {
    events.push({ type: 'xp', sourceId: attacker.id, amount: reward, targetId: victim.id });
  }

  const limits = resolveMutationLimits(attacker, biome);
  const attemptMutation = (type) => {
    const threshold = xp.thresholds?.[type] ?? DEFAULT_XP_THRESHOLDS[type];
    const rolls = xp.rolls?.[type] ?? 0;
    if (!threshold || xp.current < threshold * (rolls + 1)) {
      return null;
    }
    const limit = limits?.[type] ?? DEFAULT_MUTATION_LIMITS[type];
    if (rolls >= limit) {
      return null;
    }
    const odds = DEFAULT_MUTATION_ODDS[type] ?? 0.5;
    const roll = typeof rng === 'function' ? rng() : Math.random();
    const success = roll < odds;
    xp.rolls[type] = rolls + 1;
    const historyEntry = {
      type,
      success,
      roll,
      timestamp: now,
      biome,
    };
    attacker.mutationHistory = ensureArray(attacker.mutationHistory);
    attacker.mutationHistory.push(historyEntry);

    attacker.scars = ensureArray(attacker.scars);
    attacker.scars.push({
      type,
      color: pickMutationColor(attacker, type),
      intensity: success ? (type === 'medium' ? 1 : 0.6) : 0.2,
      timestamp: now,
    });

    if (success) {
      attacker.evolutionLevel = (attacker.evolutionLevel ?? 1) + (type === 'medium' ? 1 : 0.5);
      attacker.dropProfile = scaleDropProfile(attacker) || attacker.dropProfile;
    }

    if (Array.isArray(events)) {
      events.push({
        type: 'mutation',
        sourceId: attacker.id,
        mutation: historyEntry,
      });
    }
    return historyEntry;
  };

  attemptMutation('minor');
  attemptMutation('medium');
};

const handleNpcKill = (attacker, victim, context) => {
  const { rng, dropTables, drops, events, now, biome } = context;
  if (Array.isArray(events)) {
    events.push({
      type: 'kill',
      attackerId: attacker?.id ?? null,
      targetId: victim?.id ?? null,
      position: clone(victim?.position || {}),
    });
  }
  const loot = resolveNpcDrops(victim, rng, dropTables);
  if (loot && loot.items) {
    loot.sourceId = victim?.id ?? null;
    if (Array.isArray(drops)) {
      drops.push(loot);
    }
  }
  if (attacker) {
    awardEvolutionXp(attacker, victim, { rng, now, biome, events });
  }
};

const buildEngagementContext = (npc, threatManagers, options) => {
  const matrix = options.hostilityMatrix ?? HOSTILITY_MATRIX;
  const candidates = options.living.filter((target) => {
    if (!target || target.id === npc.id) return false;
    if (target.health.current <= 0) return false;
    const hostility = resolveHostility(matrix, npc.species, target.species);
    return hostility > 0;
  });

  if (candidates.length === 0) {
    return { candidates: [], temperament: getTemperamentProfile(npc.species) };
  }

  const manager = threatManagers[npc.id];
  const temperamentBase = getTemperamentProfile(npc.species);
  const temperamentOverride = options.temperamentProfiles?.[npc.species];
  const temperament = temperamentOverride
    ? { ...temperamentBase, ...temperamentOverride }
    : temperamentBase;

  candidates.forEach((candidate) => {
    const hostility = resolveHostility(matrix, npc.species, candidate.species);
    const distance = distanceBetween(npc.position, candidate.position);
    const range = options.senseRange ?? DEFAULT_SENSE_RANGE;
    const weight = 1 + Math.max(0, (range - distance) / range);
    manager.addThreat(candidate.id, hostility, { weight });
    if (candidate.ai?.lastAttackerId === npc.id) {
      manager.addThreat(candidate.id, 4, { weight: 1.4 });
    }
  });

  return { candidates, temperament };
};

export const resolveNpcCombat = (world = {}, options = {}) => {
  const delta = Math.max(0, Number.isFinite(options.delta) ? options.delta : 0);
  const microorganisms = Array.isArray(world?.microorganisms) ? world.microorganisms.map((entity) => ({
    ...entity,
    position: ensureVector(entity.position),
    movementVector: ensureVector(entity.movementVector),
    health: ensureHealth(entity),
  })) : [];

  if (microorganisms.length === 0) {
    return {
      world: world ?? { microorganisms: [] },
      events: [],
      drops: [],
      memory: { threatManagers: {} },
    };
  }

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const memory = options.memory ?? {};
  const previousManagers = memory.threatManagers ?? {};
  const threatManagers = {};

  microorganisms.forEach((npc) => {
    npc.baseDropProfile = npc.baseDropProfile || clone(npc.dropProfile);
    npc.dropProfile = npc.dropProfile || clone(npc.baseDropProfile);
    npc.scars = ensureArray(npc.scars);
    npc.mutationHistory = ensureArray(npc.mutationHistory);
    threatManagers[npc.id] = ensureThreatManager(null, {
      decayPerSecond: options.decayPerSecond ?? DEFAULT_DECAY_PER_SECOND,
      now,
      state: previousManagers[npc.id],
    });
  });

  const living = microorganisms.filter((npc) => npc.health.current > 0);
  if (living.length === 0) {
    return {
      world: { ...world, microorganisms: [] },
      events: [],
      drops: [],
      memory: { threatManagers: {} },
    };
  }

  const events = [];
  const drops = [];
  const engagements = [];
  const senseRange = options.senseRange ?? DEFAULT_SENSE_RANGE;

  living.forEach((npc) => {
    const manager = threatManagers[npc.id];
    manager.decay(delta);
    const { candidates, temperament } = buildEngagementContext(npc, threatManagers, {
      hostilityMatrix: options.hostilityMatrix ?? HOSTILITY_MATRIX,
      living,
      senseRange,
      temperamentProfiles: options.temperamentProfiles,
    });

    const selection = manager.selectTarget(candidates, {
      position: npc.position,
      element: npc.element ?? ELEMENT_TYPES.BIO,
      aggression: temperament.aggression,
      preferredRange: npc.range ?? npc.attributes?.range ?? DEFAULT_PROXIMITY_WEIGHT,
      resolveHostility: (candidate) =>
        1 + resolveHostility(options.hostilityMatrix ?? HOSTILITY_MATRIX, npc.species, candidate?.species),
    });

    const healthRatio = npc.health.current / Math.max(1, npc.health.max);
    let decision = 'idle';
    if (selection.targetId && selection.threat > MIN_THREAT_VALUE) {
      const courageThreshold = clamp(0.2 + temperament.courage * 0.6, 0.2, 0.9);
      const aggressionThreshold = clamp(0.15 + temperament.aggression * 0.5, 0.1, 0.95);
      if (healthRatio < courageThreshold * 0.45 && selection.threat > courageThreshold) {
        decision = 'flee';
      } else {
        decision = selection.threat > aggressionThreshold ? 'engage' : 'cooperate';
      }
    }

    if (decision === 'flee' && selection.candidate) {
      const dx = npc.position.x - selection.candidate.position.x;
      const dy = npc.position.y - selection.candidate.position.y;
      const mag = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeSpeed = Math.max(0.25, normalizeNumber(npc.speed ?? npc.attributes?.speed, 1) * 0.75);
      npc.movementVector = { x: (dx / mag) * fleeSpeed, y: (dy / mag) * fleeSpeed };
    }

    if ((decision === 'engage' || decision === 'cooperate') && selection.targetId) {
      engagements.push({
        attackerId: npc.id,
        targetId: selection.targetId,
        decision,
      });
    }

    npc.ai = {
      ...(npc.ai || {}),
      lastDecision: decision,
      targetId: selection.targetId ?? null,
      lastThreatValue: selection.threat,
    };
  });

  if (engagements.length > 0) {
    const byId = new Map(living.map((npc) => [npc.id, npc]));
    engagements.forEach(({ attackerId, targetId, decision }) => {
      const attacker = byId.get(attackerId);
      const target = byId.get(targetId);
      if (!attacker || !target) return;
      if (attacker.health.current <= 0 || target.health.current <= 0) return;

      const { damage, relation } = computeDamageAgainstTarget(attacker, target);
      target.health.current = Math.max(0, target.health.current - damage);
      target.ai = {
        ...(target.ai || {}),
        lastAttackerId: attacker.id,
      };
      events.push({
        type: 'attack',
        attackerId,
        targetId,
        damage,
        relation,
        decision,
      });
      threatManagers[target.id]?.addThreat(attacker.id, damage, { weight: 1.2 });
      if (target.health.current <= 0) {
        handleNpcKill(attacker, target, { rng, dropTables: options.dropTables, drops, events, now, biome: options.biome ?? 'default' });
      }
    });
  }

  const survivors = microorganisms.filter((npc) => npc.health.current > 0);
  const serializedManagers = {};
  survivors.forEach((npc) => {
    serializedManagers[npc.id] = threatManagers[npc.id]?.serialize(now);
  });

  return {
    world: {
      ...world,
      microorganisms: survivors,
    },
    events,
    drops,
    memory: { threatManagers: serializedManagers },
  };
};
