import { DROP_TABLES } from '../config/enemyTemplates';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const clamp01 = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const formatAlpha = (value) => {
  const clamped = clamp01(value);
  if (clamped === 0 || clamped === 1) {
    return String(clamped);
  }
  return clamped.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

const hexToRgba = (hex, alphaOverride) => {
  if (!hex || typeof hex !== 'string') return hex;
  const trimmed = hex.trim();
  if (!trimmed.startsWith('#')) return hex;

  let value = trimmed.slice(1);
  if (![3, 4, 6, 8].includes(value.length)) return hex;

  if (value.length === 3 || value.length === 4) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const hasAlpha = value.length === 8;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const alphaFromHex = hasAlpha ? parseInt(value.slice(6, 8), 16) / 255 : undefined;
  const alpha = formatAlpha(
    typeof alphaOverride === 'number' ? alphaOverride : alphaFromHex ?? 1
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ensureColorWithAlpha = (color, alpha) => {
  if (!color || typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (!trimmed) return color;

  if (trimmed.startsWith('#')) {
    return hexToRgba(trimmed, alpha);
  }

  if (typeof alpha !== 'number') {
    return trimmed;
  }

  const formattedAlpha = formatAlpha(alpha);

  if (trimmed.startsWith('rgba(') || trimmed.startsWith('hsla(')) {
    return trimmed;
  }

  if (trimmed.startsWith('rgb(')) {
    const body = trimmed.slice(4, -1);
    return `rgba(${body}, ${formattedAlpha})`;
  }

  if (trimmed.startsWith('hsl(')) {
    const body = trimmed.slice(4, -1);
    return `hsla(${body}, ${formattedAlpha})`;
  }

  return trimmed;
};

const toFiniteNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveNumericValue = (value, fallback = 0) => {
  const normalizedFallback = toFiniteNumber(fallback);
  const fallbackNumber = normalizedFallback ?? 0;
  const normalizedValue = toFiniteNumber(value);
  return normalizedValue ?? fallbackNumber;
};

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const mergeArraysUnique = (...collections) => {
  const unique = new Set();
  collections
    .flat()
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .forEach((item) => unique.add(item));
  return Array.from(unique);
};

const combineResistances = (base = {}, additional = {}) => {
  const result = { ...base };
  Object.entries(additional || {}).forEach(([key, value]) => {
    const numeric = toFiniteNumber(value);
    if (numeric === null) return;
    const current = toFiniteNumber(result[key]) ?? 0;
    result[key] = clamp(current + numeric, -0.95, 0.95);
  });
  return result;
};

const mergeBehaviorTraits = (base = {}, extra = {}) => {
  const merged = { ...base };
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else {
      merged[key] = value;
    }
  });
  return merged;
};

const applyStatAdjustments = (enemy, stats = {}) => {
  if (!stats || typeof stats !== 'object') return;

  const withMultiplier = (value, multiplier) => {
    const numeric = toFiniteNumber(multiplier);
    if (numeric === null) return value;
    return value * numeric;
  };

  const withBonus = (value, bonus) => {
    const numeric = toFiniteNumber(bonus);
    if (numeric === null) return value;
    return value + numeric;
  };

  if ('sizeMultiplier' in stats) {
    enemy.size = withMultiplier(enemy.size, stats.sizeMultiplier);
  }

  if ('sizeBonus' in stats) {
    enemy.size = withBonus(enemy.size, stats.sizeBonus);
  }

  if ('speedMultiplier' in stats) {
    enemy.speed = withMultiplier(enemy.speed, stats.speedMultiplier);
  }

  if ('speedBonus' in stats) {
    enemy.speed = withBonus(enemy.speed, stats.speedBonus);
  }

  if ('attackMultiplier' in stats) {
    enemy.attack = withMultiplier(enemy.attack, stats.attackMultiplier);
  }

  if ('attackBonus' in stats) {
    enemy.attack = withBonus(enemy.attack, stats.attackBonus);
  }

  if ('defenseMultiplier' in stats) {
    enemy.defense = withMultiplier(enemy.defense, stats.defenseMultiplier);
  }

  if ('defenseBonus' in stats) {
    enemy.defense = withBonus(enemy.defense, stats.defenseBonus);
  }

  if ('healthMultiplier' in stats) {
    enemy.health = withMultiplier(enemy.health, stats.healthMultiplier);
    enemy.maxHealth = withMultiplier(enemy.maxHealth, stats.healthMultiplier);
  }

  if ('healthBonus' in stats) {
    enemy.health = withBonus(enemy.health, stats.healthBonus);
    enemy.maxHealth = withBonus(enemy.maxHealth, stats.healthBonus);
  }

  if ('energyRewardMultiplier' in stats) {
    enemy.energyReward = withMultiplier(enemy.energyReward, stats.energyRewardMultiplier);
  }

  if ('energyRewardBonus' in stats) {
    enemy.energyReward = withBonus(enemy.energyReward, stats.energyRewardBonus);
  }

  if ('pointsMultiplier' in stats) {
    enemy.points = withMultiplier(enemy.points, stats.pointsMultiplier);
  }

  if ('pointsBonus' in stats) {
    enemy.points = withBonus(enemy.points, stats.pointsBonus);
  }
};

const applyModifier = (enemy, modifier = {}, context = {}) => {
  if (!modifier || typeof modifier !== 'object') return;

  if (modifier.stats) {
    applyStatAdjustments(enemy, modifier.stats);
  }

  if (Array.isArray(modifier.abilities)) {
    enemy.abilities = mergeArraysUnique(enemy.abilities, modifier.abilities);
  }

  if (modifier.resistances) {
    enemy.resistances = combineResistances(enemy.resistances, modifier.resistances);
  }

  if (modifier.behaviorTraits) {
    enemy.behaviorTraits = mergeBehaviorTraits(enemy.behaviorTraits, modifier.behaviorTraits);
  }

  if (typeof modifier.onApply === 'function') {
    modifier.onApply(enemy, context);
  }
};

export const createEnemyFromTemplate = (
  templateKey,
  template,
  {
    level = 1,
    rng = Math.random,
    origin = { x: 0, y: 0 },
    spawnDistance = 600,
    idGenerator,
    overrides = {}
  } = {}
) => {
  if (!template) return null;

  const random = getRandom(rng);
  const levelScale = 1 + level * 0.2;
  const angle = random() * Math.PI * 2;
  const distance = overrides.spawnDistance ?? spawnDistance;
  const baseHealth = Math.floor(template.baseSize * levelScale * 2);

  const resolveAlpha = (overrideKey, templateKey, fallback) => {
    const overrideAlpha = overrides?.[overrideKey];
    if (typeof overrideAlpha === 'number' && Number.isFinite(overrideAlpha)) {
      return clamp01(overrideAlpha);
    }
    const templateAlpha = template?.[templateKey];
    if (typeof templateAlpha === 'number' && Number.isFinite(templateAlpha)) {
      return clamp01(templateAlpha);
    }
    return clamp01(fallback);
  };

  const baseColorInput = overrides.baseColor ?? template.baseColor ?? template.color ?? '#FFFFFF';
  const colorInput = overrides.color ?? template.color ?? baseColorInput;
  const coreColorInput = overrides.coreColor ?? template.coreColor ?? baseColorInput;
  const glowColorInput = overrides.glowColor ?? template.glowColor ?? colorInput;
  const outerColorInput = overrides.outerColor ?? template.outerColor ?? colorInput;
  const shadowColorInput = overrides.shadowColor ?? template.shadowColor ?? coreColorInput;
  const strokeColorInput = overrides.strokeColor ?? template.strokeColor ?? glowColorInput;
  const midColorInput = overrides.midColor ?? template.midColor ?? colorInput;

  const colorAlpha = resolveAlpha('colorAlpha', 'colorAlpha', 0.65);
  const coreAlpha = resolveAlpha('coreAlpha', 'coreAlpha', 0.9);
  const glowAlpha = resolveAlpha('glowAlpha', 'glowAlpha', 0.6);
  const outerAlpha = resolveAlpha('outerAlpha', 'outerAlpha', 0.25);
  const shadowAlpha = resolveAlpha('shadowAlpha', 'shadowAlpha', 0.75);
  const strokeAlpha = resolveAlpha('strokeAlpha', 'strokeAlpha', 0.6);

  const color = ensureColorWithAlpha(colorInput, colorAlpha);
  const coreColor = ensureColorWithAlpha(coreColorInput, coreAlpha);
  const glowColor = ensureColorWithAlpha(glowColorInput, glowAlpha);
  const outerColor = ensureColorWithAlpha(outerColorInput, outerAlpha);
  const shadowColor = ensureColorWithAlpha(shadowColorInput, shadowAlpha);
  const strokeColor = ensureColorWithAlpha(strokeColorInput, strokeAlpha);
  const midColor = ensureColorWithAlpha(midColorInput, colorAlpha);

  const defaultEnemy = {
    id: overrides.id ?? (idGenerator ? idGenerator() : Date.now() + random()),
    x: overrides.x ?? origin.x + Math.cos(angle) * distance,
    y: overrides.y ?? origin.y + Math.sin(angle) * distance,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    type: templateKey,
    size: overrides.size ?? template.baseSize * Math.sqrt(levelScale),
    speed: overrides.speed ?? template.baseSpeed,
    attack: overrides.attack ?? Math.floor(template.baseAttack * levelScale),
    defense: overrides.defense ?? Math.floor(template.baseDefense * levelScale),
    health: overrides.health ?? baseHealth,
    maxHealth: overrides.maxHealth ?? baseHealth,
    points: overrides.points ?? template.points,
    energyReward: resolveNumericValue(
      overrides.energyReward ?? template.energyReward,
      0
    ),
    baseColor: baseColorInput,
    color,
    coreColor,
    glowColor,
    outerColor,
    shadowColor,
    strokeColor,
    midColor,
    behavior: overrides.behavior ?? template.behavior,
    evolutionLevel: overrides.evolutionLevel ?? Math.floor(levelScale),
    attackCooldown: overrides.attackCooldown ?? 0,
    state: overrides.state ?? 'wandering',
    animPhase: overrides.animPhase ?? 0,
    canLeave: overrides.canLeave ?? true,
    ticksOutOfRange: overrides.ticksOutOfRange ?? 0,
    boss: false,
    opacity: overrides.opacity ?? template.opacity ?? 1,
    rotation: overrides.rotation ?? 0,
    pulseSpeed:
      overrides.pulseSpeed ?? template.pulseSpeed ?? 0.8 + random() * 0.6,
    behaviorTimer: overrides.behaviorTimer ?? 0,
    behaviorInterval:
      overrides.behaviorInterval ?? template.behaviorInterval ?? random() * 2 + 0.5,
    attackTimer: overrides.attackTimer ?? 0,
    phaseTimer: overrides.phaseTimer ?? 0
  };

  const enemy = {
    ...defaultEnemy,
    ...overrides,
    boss: false,
  };

  enemy.baseColor = baseColorInput;
  enemy.color = color;
  enemy.coreColor = coreColor;
  enemy.midColor = midColor;
  enemy.glowColor = glowColor;
  enemy.outerColor = outerColor;
  enemy.shadowColor = shadowColor;
  enemy.strokeColor = strokeColor;
  enemy.opacity = overrides.opacity ?? enemy.opacity ?? 1;
  enemy.energyReward = resolveNumericValue(enemy.energyReward, defaultEnemy.energyReward);

  enemy.tier = overrides.tier ?? template.tier ?? 'common';
  enemy.variantOf = overrides.variantOf ?? template.variantOf ?? templateKey;
  enemy.dropTier = overrides.dropTier ?? template.dropTier ?? 'minion';
  const dropProfile = DROP_TABLES[enemy.dropTier] ?? DROP_TABLES.minion;
  enemy.dropProfile = { ...dropProfile };
  enemy.abilities = mergeArraysUnique(template.abilities || [], overrides.abilities || []);
  enemy.resistances = combineResistances(template.resistances || {}, overrides.resistances || {});
  enemy.behaviorTraits = mergeBehaviorTraits(template.behaviorTraits || {}, overrides.behaviorTraits || {});
  enemy.activeBuffs = Array.isArray(overrides.activeBuffs) ? [...overrides.activeBuffs] : [];
  enemy.dynamicModifiers = {
    attackMultiplier: 1,
    defenseMultiplier: 1,
    speedMultiplier: 1,
    sizeMultiplier: 1,
    attackBonus: 0,
    defenseBonus: 0,
    speedBonus: 0,
    sizeBonus: 0,
  };

  const context = {
    templateKey,
    template,
    level,
    evolutionLevel: enemy.evolutionLevel,
  };

  const staticModifiers = [];
  const enqueueModifiers = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => enqueueModifiers(item));
      return;
    }
    if (typeof value === 'object') {
      staticModifiers.push(value);
    }
  };

  enqueueModifiers(template.modifiers);
  enqueueModifiers(overrides.modifiers);

  staticModifiers.forEach((modifier) => applyModifier(enemy, modifier, context));

  if (Array.isArray(template.evolutionModifiers)) {
    template.evolutionModifiers.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;

      const minLevel = toFiniteNumber(entry.minLevel) ?? 1;
      const maxLevel = toFiniteNumber(entry.maxLevel) ?? Number.POSITIVE_INFINITY;
      const minEvolutionLevel = toFiniteNumber(entry.minEvolutionLevel) ?? 1;
      const maxEvolutionLevel =
        toFiniteNumber(entry.maxEvolutionLevel) ?? Number.POSITIVE_INFINITY;

      if (
        level < minLevel ||
        level > maxLevel ||
        enemy.evolutionLevel < minEvolutionLevel ||
        enemy.evolutionLevel > maxEvolutionLevel
      ) {
        return;
      }

      if (entry.modifiers && typeof entry.modifiers === 'object') {
        applyModifier(enemy, entry.modifiers, context);
      }
    });
  }

  enemy.attack = Math.max(
    1,
    Math.round(resolveNumericValue(enemy.attack, defaultEnemy.attack))
  );
  enemy.defense = Math.max(
    0,
    Math.round(resolveNumericValue(enemy.defense, defaultEnemy.defense))
  );
  enemy.size = Math.max(1, resolveNumericValue(enemy.size, defaultEnemy.size));
  enemy.speed = Math.max(0, resolveNumericValue(enemy.speed, defaultEnemy.speed));
  enemy.points = Math.max(0, Math.round(resolveNumericValue(enemy.points, defaultEnemy.points)));
  enemy.health = Math.max(1, Math.round(resolveNumericValue(enemy.health, defaultEnemy.health)));
  enemy.maxHealth = Math.max(
    enemy.health,
    Math.round(resolveNumericValue(enemy.maxHealth, defaultEnemy.maxHealth))
  );
  enemy.energyReward = resolveNumericValue(enemy.energyReward, defaultEnemy.energyReward);
  enemy.projectileCooldown = resolveNumericValue(enemy.projectileCooldown, 0);

  enemy.baseStats = {
    size: enemy.size,
    speed: enemy.speed,
    attack: enemy.attack,
    defense: enemy.defense,
    maxHealth: enemy.maxHealth,
    health: enemy.health,
  };
  enemy.baseResistances = { ...enemy.resistances };

  return enemy;
};

export const createBossEnemy = (
  config = {},
  {
    origin = { x: 0, y: 0 },
    spawnDistance = 900,
    rng = Math.random,
    idGenerator,
    overrides = {}
  } = {}
) => {
  const random = getRandom(rng);
  const angle = random() * Math.PI * 2;
  const distance = overrides.spawnDistance ?? spawnDistance;
  const id = overrides.id ?? (idGenerator ? idGenerator() : Date.now() + random());

  const defaults = {
    id,
    x: overrides.x ?? origin.x + Math.cos(angle) * distance,
    y: overrides.y ?? origin.y + Math.sin(angle) * distance,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    type: config.type ?? 'boss',
    size: config.size ?? 160,
    speed: config.speed ?? 1,
    attack: config.attack ?? 20,
    defense: config.defense ?? 10,
    health: config.health ?? 500,
    maxHealth: config.maxHealth ?? config.health ?? 500,
    points: config.points ?? 500,
    energyReward: resolveNumericValue(config.energyReward ?? overrides.energyReward, 50),
    color: config.color ?? '#FFFFFF',
    behavior: config.behavior ?? 'boss',
    evolutionLevel: config.evolutionLevel ?? 1,
    attackCooldown: overrides.attackCooldown ?? 0,
    state: overrides.state ?? config.state ?? 'aggressive',
    animPhase: overrides.animPhase ?? 0,
    canLeave: overrides.canLeave ?? config.canLeave ?? false,
    ticksOutOfRange: overrides.ticksOutOfRange ?? 0,
    boss: true
  };

  const boss = {
    ...defaults,
    ...config,
    ...overrides,
    id,
    x: overrides.x ?? defaults.x,
    y: overrides.y ?? defaults.y,
    vx: overrides.vx ?? defaults.vx,
    vy: overrides.vy ?? defaults.vy,
    boss: true,
    canLeave: overrides.canLeave ?? config.canLeave ?? false,
    maxHealth: overrides.maxHealth ?? config.maxHealth ?? defaults.maxHealth
  };

  boss.energyReward = resolveNumericValue(boss.energyReward, defaults.energyReward);
  boss.dropTier = overrides.dropTier ?? config.dropTier ?? 'boss';
  const bossDropProfile = DROP_TABLES[boss.dropTier] ?? DROP_TABLES.boss ?? DROP_TABLES.minion;
  boss.dropProfile = { ...bossDropProfile };

  return boss;
};
