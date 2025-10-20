import {
  ELEMENT_TYPES,
  STATUS_EFFECTS,
  clampDamageMultiplier,
} from '../../shared/combat';

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const roundTo = (value, precision = 3) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const STATUS_METADATA = Object.freeze({
  [STATUS_EFFECTS.FISSURE]: {
    label: 'Fissura',
    icon: '⨂',
    color: '#ff6b6b',
    category: 'debuff',
    duration: 6,
    maxStacks: 3,
    synergy: { element: ELEMENT_TYPES.CHEMICAL, bonus: 0.25 },
    dot: { element: ELEMENT_TYPES.CHEMICAL, damagePerSecond: 6 },
    defensePenaltyPerStack: 0.03,
    effect: 'fissure',
    aura: {
      color: '#ff8a8a',
      intensity: 1.15,
      interval: 0.32,
      accumulation: 1.6,
      burstThreshold: 4.8,
    },
  },
  [STATUS_EFFECTS.CORROSION]: {
    label: 'Corrosão',
    icon: '☣️',
    color: '#ffb347',
    category: 'debuff',
    duration: 8,
    maxStacks: 4,
    synergy: { element: ELEMENT_TYPES.ACID, bonus: 0.18 },
    dot: { element: ELEMENT_TYPES.ACID, damagePerSecond: 8 },
    defensePenaltyPerStack: 0.05,
    effect: 'corrosion',
    aura: {
      color: '#ffd27f',
      intensity: 1.05,
      interval: 0.36,
      accumulation: 1.4,
      burstThreshold: 5.5,
    },
  },
  [STATUS_EFFECTS.PHOTOLESION]: {
    label: 'Fotolesão',
    icon: '🔆',
    color: '#ffd93d',
    category: 'debuff',
    duration: 5,
    maxStacks: 2,
    synergy: { element: ELEMENT_TYPES.ELECTRIC, bonus: 0.15 },
    dot: { element: ELEMENT_TYPES.THERMAL, damagePerSecond: 5 },
    criticalBonusPerStack: 0.1,
    effect: 'photolesion',
    aura: {
      color: '#fff2a3',
      intensity: 0.9,
      interval: 0.42,
      accumulation: 1.2,
      burstThreshold: 4,
    },
  },
  [STATUS_EFFECTS.ENTANGLED]: {
    label: 'Enredamento',
    icon: '🕸️',
    color: '#7f8cff',
    category: 'control',
    duration: 4,
    maxStacks: 2,
    movementPenaltyPerStack: 0.25,
    controlWeight: 1.5,
    effect: 'entangled',
  },
});

export const STATUS_KEYS = Object.freeze(Object.keys(STATUS_METADATA));

const clampResistance = (value) => clamp(value, -0.75, 0.75);

export const createStatusResistanceProfile = (overrides = {}) => {
  const profile = {};
  STATUS_KEYS.forEach((key) => {
    const overrideValue = Number(overrides?.[key]);
    profile[key] = Number.isFinite(overrideValue) ? clampResistance(overrideValue) : 0;
  });
  return profile;
};

const defaultState = () => ({
  active: {},
  controlDr: { value: 0, timer: 0 },
});

export const createStatusState = (overrides = {}) => {
  const base = defaultState();
  if (overrides?.active && typeof overrides.active === 'object') {
    base.active = { ...overrides.active };
  }
  if (overrides?.controlDr && typeof overrides.controlDr === 'object') {
    base.controlDr = {
      value: Number.isFinite(overrides.controlDr.value)
        ? clamp(overrides.controlDr.value, 0, 6)
        : 0,
      timer: Number.isFinite(overrides.controlDr.timer) ? Math.max(0, overrides.controlDr.timer) : 0,
    };
  }
  return base;
};

export const ensureStatusState = (entity) => {
  if (!entity) return createStatusState();
  if (!entity.status || typeof entity.status !== 'object') {
    entity.status = createStatusState();
  }
  return entity.status;
};

const applyControlDiminishingReturns = (tracker, definition, duration) => {
  if (definition.category !== 'control') {
    return duration;
  }

  const weight = definition.controlWeight ?? 1;
  const controlEntry = tracker.controlDr ?? { value: 0, timer: 0 };
  const appliedValue = clamp(controlEntry.value ?? 0, 0, 6);
  const drMultiplier = 1 / (1 + appliedValue * 0.5);
  const adjustedDuration = Math.max(duration * drMultiplier, 0.4);

  controlEntry.value = clamp(controlEntry.value + weight, 0, 6);
  controlEntry.timer = Math.max(controlEntry.timer ?? 0, adjustedDuration + 1.5);
  tracker.controlDr = controlEntry;
  return adjustedDuration;
};

const updateModifiers = (entry, definition) => {
  const stacks = Math.max(1, entry.stacks ?? 1);
  entry.modifiers = entry.modifiers || {};

  if (definition.defensePenaltyPerStack) {
    entry.modifiers.defensePenalty = roundTo(
      definition.defensePenaltyPerStack * stacks,
      4,
    );
  }

  if (definition.movementPenaltyPerStack) {
    entry.modifiers.movementPenalty = roundTo(
      Math.min(0.85, definition.movementPenaltyPerStack * stacks),
      4,
    );
  }

  if (definition.criticalBonusPerStack) {
    entry.modifiers.criticalBonus = roundTo(
      definition.criticalBonusPerStack * stacks,
      4,
    );
  }
};

export const applyStatusEffect = (entity, effect = {}, context = {}) => {
  if (!entity || !effect?.type) {
    return { applied: false };
  }

  const tracker = ensureStatusState(entity);
  const key = effect.type;
  const definition = STATUS_METADATA[key];
  if (!definition) {
    return { applied: false };
  }

  const resistanceProfile = entity.statusResistances || {};
  const resistance = clampResistance(resistanceProfile[key] ?? 0);
  const baseDuration = Number.isFinite(effect.duration)
    ? Math.max(effect.duration, 0.2)
    : definition.duration;
  let duration = baseDuration * Math.max(0.15, 1 - resistance);
  duration = applyControlDiminishingReturns(tracker, definition, duration);

  const current = tracker.active[key] || {
    stacks: 0,
    remaining: 0,
    potency: 0,
    tickBuffer: 0,
  };

  const incomingStacks = Math.max(0, Number(effect.stacks ?? 1));
  const combinedStacks = effect.replace
    ? incomingStacks
    : Math.min(definition.maxStacks, current.stacks + incomingStacks);

  const potency = Number.isFinite(effect.potency)
    ? Math.max(effect.potency, 0)
    : current.potency ?? 0;

  tracker.active[key] = {
    ...current,
    stacks: Math.max(1, combinedStacks),
    potency,
    remaining: Math.max(duration, current.remaining),
    tickBuffer: current.tickBuffer ?? 0,
    lastApplied: context.now ?? Date.now(),
  };

  updateModifiers(tracker.active[key], definition);

  return {
    applied: true,
    key,
    stacks: tracker.active[key].stacks,
    duration: tracker.active[key].remaining,
    resistance,
  };
};

export const tickStatusEffects = (entity, deltaSeconds, hooks = {}) => {
  if (!entity) return { totalDamage: 0, expired: [] };
  const tracker = ensureStatusState(entity);
  const expired = [];
  let totalDamage = 0;

  Object.entries(tracker.active).forEach(([key, entry]) => {
    const definition = STATUS_METADATA[key];
    if (!definition) {
      delete tracker.active[key];
      return;
    }

    entry.remaining = Math.max(0, (entry.remaining ?? definition.duration) - deltaSeconds);
    const stacks = Math.max(1, entry.stacks ?? 1);

    if (definition.dot && definition.dot.damagePerSecond > 0) {
      const dps = definition.dot.damagePerSecond * stacks * (1 + (entry.potency ?? 0));
      const damage = Math.max(0, dps * deltaSeconds);
      if (damage > 0) {
        totalDamage += damage;
        hooks.onDamage?.({
          entity,
          status: key,
          damage,
          element: definition.dot.element,
        });
      }
    }

    if (entry.remaining <= 0) {
      expired.push(key);
      hooks.onExpire?.({ entity, status: key });
      delete tracker.active[key];
    }
  });

  if (tracker.controlDr) {
    tracker.controlDr.timer = Math.max(0, (tracker.controlDr.timer ?? 0) - deltaSeconds);
    if (tracker.controlDr.timer <= 0 && tracker.controlDr.value > 0) {
      tracker.controlDr.value = Math.max(0, tracker.controlDr.value - deltaSeconds * 0.75);
    }
  }

  return { totalDamage, expired };
};

export const getStatusDamageModifier = ({ target, attackElement }) => {
  if (!target?.status) return 0;
  const entries = target.status.active || {};
  let bonus = 0;

  Object.entries(entries).forEach(([key, entry]) => {
    const definition = STATUS_METADATA[key];
    if (!definition?.synergy) return;
    if (definition.synergy.element !== attackElement) return;

    const stacks = Math.max(1, entry.stacks ?? 1);
    bonus += definition.synergy.bonus * stacks;
  });

  return bonus;
};

export const getStatusDefensePenalty = (entity) => {
  if (!entity?.status?.active) return 0;
  let penalty = 0;
  Object.entries(entity.status.active).forEach(([key, entry]) => {
    const definition = STATUS_METADATA[key];
    if (!definition?.defensePenaltyPerStack) return;
    const stacks = Math.max(1, entry.stacks ?? 1);
    penalty += definition.defensePenaltyPerStack * stacks;
  });
  return penalty;
};

export const getStatusCriticalBonus = (entity) => {
  if (!entity?.status?.active) return 0;
  let bonus = 0;
  Object.entries(entity.status.active).forEach(([key, entry]) => {
    const definition = STATUS_METADATA[key];
    if (!definition?.criticalBonusPerStack) return;
    const stacks = Math.max(1, entry.stacks ?? 1);
    bonus += definition.criticalBonusPerStack * stacks;
  });
  return bonus;
};

export const getStatusMovementMultiplier = (entity) => {
  if (!entity?.status?.active) return 1;
  let penalty = 0;
  Object.entries(entity.status.active).forEach(([key, entry]) => {
    const definition = STATUS_METADATA[key];
    if (!definition?.movementPenaltyPerStack) return;
    const stacks = Math.max(1, entry.stacks ?? 1);
    penalty += definition.movementPenaltyPerStack * stacks;
  });
  return clampDamageMultiplier(Math.max(0.2, 1 - penalty));
};

export const shouldTriggerPhagocytosis = ({ attacker, target }) => {
  if (!attacker || !target) return false;
  const attackerMass = Number.isFinite(attacker.mass) ? attacker.mass : 1;
  const targetMass = Number.isFinite(target.mass) ? target.mass : 1;
  if (targetMass <= 0) return false;
  if (target.health > 0) return false;
  return attackerMass >= targetMass * 1.25;
};

export const getStatusHudSnapshot = (entity) => {
  if (!entity?.status?.active) return [];
  return Object.entries(entity.status.active)
    .map(([key, entry]) => {
      const definition = STATUS_METADATA[key] ?? {};
      return {
        key,
        label: definition.label ?? key,
        icon: definition.icon ?? '✴️',
        color: definition.color ?? '#ffffff',
        stacks: entry.stacks ?? 1,
        remaining: Math.max(0, entry.remaining ?? 0),
      };
    })
    .sort((a, b) => b.remaining - a.remaining);
};

export const getStatusEffectVisual = (statusKey) => STATUS_METADATA[statusKey]?.effect ?? 'status';

export default {
  STATUS_METADATA,
  STATUS_KEYS,
  createStatusResistanceProfile,
  createStatusState,
  ensureStatusState,
  applyStatusEffect,
  tickStatusEffects,
  getStatusDamageModifier,
  getStatusDefensePenalty,
  getStatusCriticalBonus,
  getStatusMovementMultiplier,
  shouldTriggerPhagocytosis,
  getStatusHudSnapshot,
  getStatusEffectVisual,
};
